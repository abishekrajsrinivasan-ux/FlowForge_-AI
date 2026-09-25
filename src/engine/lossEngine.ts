import { ProductionRecord, LossAnalysisRecord } from '../types/database';
import { LossTreeItem } from '../types/analytics';

export interface LossBreakdownResult {
  records: LossAnalysisRecord[];
  tree: LossTreeItem;
  totalLossMinutes: number;
  availabilityLossMinutes: number;
  performanceLossMinutes: number;
  qualityLossMinutes: number;
  availabilityLossPercent: number;
  performanceLossPercent: number;
  qualityLossPercent: number;
  paretoReasons: { reason: string; category: string; value: number; percentage: number; cumulativePercentage: number }[];
}

export const calculateLosses = (records: ProductionRecord[]): LossBreakdownResult => {
  if (!records || records.length === 0) {
    return {
      records: [],
      tree: {
        name: 'Total Production Loss',
        value: 0,
        percentage: 100,
        category: 'Availability Loss',
        children: [],
      },
      totalLossMinutes: 0,
      availabilityLossMinutes: 0,
      performanceLossMinutes: 0,
      qualityLossMinutes: 0,
      availabilityLossPercent: 0,
      performanceLossPercent: 0,
      qualityLossPercent: 0,
      paretoReasons: [],
    };
  }

  // 1. Availability losses: Breakdown, Changeover, Unplanned Downtime, Idle
  let breakdownMinutes = 0;
  let changeoverMinutes = 0;
  let otherDowntimeMinutes = 0;
  const reasonMap: Record<string, { category: 'Availability Loss' | 'Performance Loss' | 'Quality Loss'; value: number }> = {};

  // 2. Performance losses: (Actual Cycle - Ideal Cycle) * Units
  let speedLossMinutes = 0;
  let minorStopsMinutes = 0;

  // 3. Quality losses: Defective units converted to lost minutes via ideal cycle time
  let defectLossMinutes = 0;
  let reworkLossMinutes = 0;

  for (const r of records) {
    // Availability
    const dt = r.downtime ?? 0;
    const unplanned = r.unplanned_downtime ?? 0;
    const changeover = r.changeover_time ?? 0;
    const idle = r.idle_time ?? 0;

    if (changeover > 0) {
      changeoverMinutes += changeover;
      const reason = r.downtime_reason || 'Tooling & Changeover';
      reasonMap[reason] = {
        category: 'Availability Loss',
        value: (reasonMap[reason]?.value ?? 0) + changeover,
      };
    }

    if (unplanned > 0) {
      breakdownMinutes += unplanned;
      const reason = r.downtime_reason || 'Unplanned Breakdown';
      reasonMap[reason] = {
        category: 'Availability Loss',
        value: (reasonMap[reason]?.value ?? 0) + unplanned,
      };
    } else if (dt > changeover) {
      const remainder = dt - changeover;
      breakdownMinutes += remainder;
      const reason = r.downtime_reason || 'Equipment Stoppage';
      reasonMap[reason] = {
        category: 'Availability Loss',
        value: (reasonMap[reason]?.value ?? 0) + remainder,
      };
    }

    if (idle > 0) {
      otherDowntimeMinutes += idle;
      const reason = 'Waiting / Material Starvation';
      reasonMap[reason] = {
        category: 'Availability Loss',
        value: (reasonMap[reason]?.value ?? 0) + idle,
      };
    }

    // Performance
    const idealCycleSec = r.ideal_cycle_time ?? 0;
    const actualCycleSec = r.actual_cycle_time ?? 0;
    const units = r.actual_quantity ?? r.total_units ?? 0;

    if (actualCycleSec > idealCycleSec && idealCycleSec > 0 && units > 0) {
      const lostSeconds = (actualCycleSec - idealCycleSec) * units;
      const lostMinutes = lostSeconds / 60;
      speedLossMinutes += lostMinutes;
      const reason = 'Reduced Cycle Speed';
      reasonMap[reason] = {
        category: 'Performance Loss',
        value: (reasonMap[reason]?.value ?? 0) + lostMinutes,
      };
    }

    // Quality: Convert defect units to time loss
    const defUnits = r.defective_units ?? 0;
    const reworkUnits = r.rework ?? 0;

    if (defUnits > 0) {
      const cyclePerUnitMinutes = idealCycleSec > 0 ? idealCycleSec / 60 : 1.0;
      const timeLost = defUnits * cyclePerUnitMinutes;
      defectLossMinutes += timeLost;
      const reason = 'Defective Parts / Scrap';
      reasonMap[reason] = {
        category: 'Quality Loss',
        value: (reasonMap[reason]?.value ?? 0) + timeLost,
      };
    }

    if (reworkUnits > 0) {
      const cyclePerUnitMinutes = idealCycleSec > 0 ? (idealCycleSec / 60) * 0.5 : 0.5;
      const timeLost = reworkUnits * cyclePerUnitMinutes;
      reworkLossMinutes += timeLost;
      const reason = 'Rework & Rectification';
      reasonMap[reason] = {
        category: 'Quality Loss',
        value: (reasonMap[reason]?.value ?? 0) + timeLost,
      };
    }
  }

  const availabilityLossMinutes = Math.round((breakdownMinutes + changeoverMinutes + otherDowntimeMinutes) * 10) / 10;
  const performanceLossMinutes = Math.round((speedLossMinutes + minorStopsMinutes) * 10) / 10;
  const qualityLossMinutes = Math.round((defectLossMinutes + reworkLossMinutes) * 10) / 10;
  const totalLossMinutes = Math.round((availabilityLossMinutes + performanceLossMinutes + qualityLossMinutes) * 10) / 10;

  const availabilityLossPercent = totalLossMinutes > 0 ? Math.round((availabilityLossMinutes / totalLossMinutes) * 1000) / 10 : 0;
  const performanceLossPercent = totalLossMinutes > 0 ? Math.round((performanceLossMinutes / totalLossMinutes) * 1000) / 10 : 0;
  const qualityLossPercent = totalLossMinutes > 0 ? Math.round((qualityLossMinutes / totalLossMinutes) * 1000) / 10 : 0;

  // Build Pareto list
  const paretoReasons: LossBreakdownResult['paretoReasons'] = [];
  const sortedReasons = Object.entries(reasonMap).sort((a, b) => b[1].value - a[1].value);
  let cumSum = 0;

  for (const [reason, info] of sortedReasons) {
    const val = Math.round(info.value * 10) / 10;
    const pct = totalLossMinutes > 0 ? Math.round((val / totalLossMinutes) * 1000) / 10 : 0;
    cumSum += pct;
    paretoReasons.push({
      reason,
      category: info.category,
      value: val,
      percentage: pct,
      cumulativePercentage: Math.min(100, Math.round(cumSum * 10) / 10),
    });
  }

  // Build structured Loss Tree
  const tree: LossTreeItem = {
    name: 'Total Production Loss',
    value: totalLossMinutes,
    percentage: 100,
    category: 'Availability Loss',
    children: [
      {
        name: 'Availability Loss',
        value: availabilityLossMinutes,
        percentage: availabilityLossPercent,
        category: 'Availability Loss',
        children: [
          {
            name: 'Equipment Breakdowns',
            value: Math.round(breakdownMinutes * 10) / 10,
            percentage: totalLossMinutes > 0 ? Math.round((breakdownMinutes / totalLossMinutes) * 1000) / 10 : 0,
            category: 'Availability Loss',
          },
          {
            name: 'Tooling & Changeover',
            value: Math.round(changeoverMinutes * 10) / 10,
            percentage: totalLossMinutes > 0 ? Math.round((changeoverMinutes / totalLossMinutes) * 1000) / 10 : 0,
            category: 'Availability Loss',
          },
          {
            name: 'Starvation & Stoppages',
            value: Math.round(otherDowntimeMinutes * 10) / 10,
            percentage: totalLossMinutes > 0 ? Math.round((otherDowntimeMinutes / totalLossMinutes) * 1000) / 10 : 0,
            category: 'Availability Loss',
          },
        ],
      },
      {
        name: 'Performance Loss',
        value: performanceLossMinutes,
        percentage: performanceLossPercent,
        category: 'Performance Loss',
        children: [
          {
            name: 'Reduced Cycle Speed',
            value: Math.round(speedLossMinutes * 10) / 10,
            percentage: totalLossMinutes > 0 ? Math.round((speedLossMinutes / totalLossMinutes) * 1000) / 10 : 0,
            category: 'Performance Loss',
          },
          {
            name: 'Minor Stoppages',
            value: Math.round(minorStopsMinutes * 10) / 10,
            percentage: totalLossMinutes > 0 ? Math.round((minorStopsMinutes / totalLossMinutes) * 1000) / 10 : 0,
            category: 'Performance Loss',
          },
        ],
      },
      {
        name: 'Quality Loss',
        value: qualityLossMinutes,
        percentage: qualityLossPercent,
        category: 'Quality Loss',
        children: [
          {
            name: 'Defects & Scrap',
            value: Math.round(defectLossMinutes * 10) / 10,
            percentage: totalLossMinutes > 0 ? Math.round((defectLossMinutes / totalLossMinutes) * 1000) / 10 : 0,
            category: 'Quality Loss',
          },
          {
            name: 'Rework & Rectification',
            value: Math.round(reworkLossMinutes * 10) / 10,
            percentage: totalLossMinutes > 0 ? Math.round((reworkLossMinutes / totalLossMinutes) * 1000) / 10 : 0,
            category: 'Quality Loss',
          },
        ],
      },
    ],
  };

  const recordsOutput: LossAnalysisRecord[] = paretoReasons.map((p) => ({
    dataset_id: records[0]?.dataset_id || '',
    loss_category: p.category as any,
    loss_reason: p.reason,
    loss_value: p.value,
    percentage: p.percentage,
    impact_score: Math.min(100, Math.round(p.percentage * 1.5)),
  }));

  return {
    records: recordsOutput,
    tree,
    totalLossMinutes,
    availabilityLossMinutes,
    performanceLossMinutes,
    qualityLossMinutes,
    availabilityLossPercent,
    performanceLossPercent,
    qualityLossPercent,
    paretoReasons,
  };
};
