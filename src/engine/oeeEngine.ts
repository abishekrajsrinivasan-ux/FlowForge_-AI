import { ProductionRecord } from '../types/database';
import { OeeCalculationResult } from '../types/analytics';

export const calculateOee = (records: ProductionRecord[]): OeeCalculationResult => {
  const unavailabilityReasons: string[] = [];

  if (!records || records.length === 0) {
    return {
      availability: null,
      performance: null,
      quality: null,
      oee: null,
      totalPlannedTime: 0,
      totalOperatingTime: 0,
      totalDowntime: 0,
      totalTargetQuantity: 0,
      totalActualQuantity: 0,
      totalGoodUnits: 0,
      totalDefectiveUnits: 0,
      productionGap: 0,
      targetAchievementRate: null,
      defectRate: null,
      averageActualCycleTime: null,
      averageIdealCycleTime: null,
      cycleTimeDeviation: null,
      unavailabilityReasons: ['No production records available.'],
    };
  }

  let sumPlannedTime = 0;
  let sumOperatingTime = 0;
  let sumDowntime = 0;
  let hasPlannedTimeCount = 0;
  let hasOperatingTimeCount = 0;
  let hasDowntimeCount = 0;

  let sumTargetQuantity = 0;
  let sumActualQuantity = 0;
  let sumGoodUnits = 0;
  let sumDefectiveUnits = 0;
  let hasTargetCount = 0;
  let hasActualCount = 0;
  let hasGoodUnitsCount = 0;
  let hasDefectiveUnitsCount = 0;

  let sumIdealCycleSeconds = 0;
  let sumActualCycleSeconds = 0;
  let cycleDataPoints = 0;

  let idealTimeNeededSecondsTotal = 0;

  for (const r of records) {
    // Times (in minutes)
    if (r.planned_time !== null && r.planned_time !== undefined && !isNaN(r.planned_time)) {
      sumPlannedTime += r.planned_time;
      hasPlannedTimeCount++;
    }
    if (r.operating_time !== null && r.operating_time !== undefined && !isNaN(r.operating_time)) {
      sumOperatingTime += r.operating_time;
      hasOperatingTimeCount++;
    }
    if (r.downtime !== null && r.downtime !== undefined && !isNaN(r.downtime)) {
      sumDowntime += r.downtime;
      hasDowntimeCount++;
    }

    // Quantities
    if (r.target_quantity !== null && r.target_quantity !== undefined && !isNaN(r.target_quantity)) {
      sumTargetQuantity += r.target_quantity;
      hasTargetCount++;
    }
    const actual = r.actual_quantity ?? r.total_units;
    if (actual !== null && actual !== undefined && !isNaN(actual)) {
      sumActualQuantity += actual;
      hasActualCount++;
    }
    if (r.good_units !== null && r.good_units !== undefined && !isNaN(r.good_units)) {
      sumGoodUnits += r.good_units;
      hasGoodUnitsCount++;
    }
    if (r.defective_units !== null && r.defective_units !== undefined && !isNaN(r.defective_units)) {
      sumDefectiveUnits += r.defective_units;
      hasDefectiveUnitsCount++;
    }

    // Cycles (in seconds)
    const ideal = r.ideal_cycle_time;
    const actualCycle = r.actual_cycle_time;
    const units = r.total_units ?? r.actual_quantity ?? 0;

    if (ideal && ideal > 0) {
      sumIdealCycleSeconds += ideal;
      if (units > 0) {
        idealTimeNeededSecondsTotal += ideal * units;
      }
    }
    if (actualCycle && actualCycle > 0) {
      sumActualCycleSeconds += actualCycle;
    }
    if (ideal || actualCycle) {
      cycleDataPoints++;
    }
  }

  // --- AVAILABILITY CALCULATION ---
  let availability: number | null = null;
  let effectivePlannedTime = sumPlannedTime;
  let effectiveOperatingTime = sumOperatingTime;

  // Infer missing time dimensions if needed
  if (effectivePlannedTime === 0 && effectiveOperatingTime > 0 && sumDowntime > 0) {
    effectivePlannedTime = effectiveOperatingTime + sumDowntime;
  } else if (effectiveOperatingTime === 0 && effectivePlannedTime > 0 && sumDowntime > 0) {
    effectiveOperatingTime = Math.max(0, effectivePlannedTime - sumDowntime);
  }

  if (effectivePlannedTime > 0) {
    availability = Math.min(100, Math.max(0, (effectiveOperatingTime / effectivePlannedTime) * 100));
  } else if (hasPlannedTimeCount === 0 && hasOperatingTimeCount === 0) {
    unavailabilityReasons.push('Availability cannot be calculated: planned and operating times are missing.');
  }

  // --- PERFORMANCE CALCULATION ---
  let performance: number | null = null;

  if (idealTimeNeededSecondsTotal > 0 && effectiveOperatingTime > 0) {
    const operatingSeconds = effectiveOperatingTime * 60;
    performance = Math.max(0, (idealTimeNeededSecondsTotal / operatingSeconds) * 100);
    // Performance can theoretically exceed 100% if running faster than standard, but cap or flag
    performance = Math.min(120, Math.round(performance * 100) / 100);
  } else if (hasTargetCount > 0 && sumTargetQuantity > 0 && sumActualQuantity > 0) {
    // Secondary fallback based on target achievement rate during operating window
    performance = Math.min(120, Math.round((sumActualQuantity / sumTargetQuantity) * 10000) / 100);
  } else {
    unavailabilityReasons.push('Performance cannot be calculated: ideal cycle time or target quantities are missing.');
  }

  // --- QUALITY CALCULATION ---
  let quality: number | null = null;
  const totalProduced = sumActualQuantity > 0 ? sumActualQuantity : (sumGoodUnits + sumDefectiveUnits);

  if (hasGoodUnitsCount > 0 && totalProduced > 0) {
    quality = Math.min(100, Math.max(0, (sumGoodUnits / totalProduced) * 100));
  } else if (hasDefectiveUnitsCount > 0 && totalProduced > 0) {
    const inferredGood = Math.max(0, totalProduced - sumDefectiveUnits);
    quality = Math.min(100, Math.max(0, (inferredGood / totalProduced) * 100));
  } else if (totalProduced > 0 && hasDefectiveUnitsCount === 0 && hasGoodUnitsCount === 0) {
    unavailabilityReasons.push('Quality cannot be calculated: good and defective unit counts are missing.');
  }

  // --- OEE CALCULATION ---
  let oee: number | null = null;
  if (availability !== null && performance !== null && quality !== null) {
    oee = Math.round(((availability / 100) * (performance / 100) * (quality / 100)) * 10000) / 100;
  }

  // Production Gap & Rates
  const productionGap = sumTargetQuantity > 0 ? sumTargetQuantity - sumActualQuantity : 0;
  const targetAchievementRate =
    sumTargetQuantity > 0 ? Math.round((sumActualQuantity / sumTargetQuantity) * 10000) / 100 : null;

  const defectRate =
    totalProduced > 0 && sumDefectiveUnits > 0
      ? Math.round((sumDefectiveUnits / totalProduced) * 10000) / 100
      : (quality !== null ? Math.round((100 - quality) * 100) / 100 : null);

  const averageIdealCycleTime =
    cycleDataPoints > 0 && sumIdealCycleSeconds > 0
      ? Math.round((sumIdealCycleSeconds / cycleDataPoints) * 10) / 10
      : null;

  const averageActualCycleTime =
    cycleDataPoints > 0 && sumActualCycleSeconds > 0
      ? Math.round((sumActualCycleSeconds / cycleDataPoints) * 10) / 10
      : null;

  const cycleTimeDeviation =
    averageActualCycleTime !== null && averageIdealCycleTime !== null
      ? Math.round((averageActualCycleTime - averageIdealCycleTime) * 10) / 10
      : null;

  return {
    availability: availability !== null ? Math.round(availability * 10) / 10 : null,
    performance: performance !== null ? Math.round(performance * 10) / 10 : null,
    quality: quality !== null ? Math.round(quality * 10) / 10 : null,
    oee: oee !== null ? Math.round(oee * 10) / 10 : null,
    totalPlannedTime: Math.round(effectivePlannedTime * 10) / 10,
    totalOperatingTime: Math.round(effectiveOperatingTime * 10) / 10,
    totalDowntime: Math.round(sumDowntime * 10) / 10,
    totalTargetQuantity: sumTargetQuantity,
    totalActualQuantity: sumActualQuantity,
    totalGoodUnits: sumGoodUnits > 0 ? sumGoodUnits : Math.max(0, sumActualQuantity - sumDefectiveUnits),
    totalDefectiveUnits: sumDefectiveUnits,
    productionGap,
    targetAchievementRate,
    defectRate,
    averageActualCycleTime,
    averageIdealCycleTime,
    cycleTimeDeviation,
    unavailabilityReasons,
  };
};
