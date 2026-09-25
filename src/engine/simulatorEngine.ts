import { ProductionRecord } from '../types/database';
import { SimulationParameters, SimulationComparison } from '../types/analytics';
import { calculateOee } from './oeeEngine';

export const simulateScenario = (
  records: ProductionRecord[],
  params: SimulationParameters
): SimulationComparison => {
  const baseline = calculateOee(records);

  // Use custom user-given values first, or fall back to dataset actual values
  const baseOutput =
    params.customBaseline?.actualOutput !== undefined && !isNaN(params.customBaseline.actualOutput)
      ? params.customBaseline.actualOutput
      : baseline.totalActualQuantity > 0
      ? baseline.totalActualQuantity
      : 8700;

  const baseTarget =
    params.customBaseline?.targetQuota !== undefined && !isNaN(params.customBaseline.targetQuota)
      ? params.customBaseline.targetQuota
      : baseline.totalTargetQuantity > 0
      ? baseline.totalTargetQuantity
      : Math.round(baseOutput * 1.15);

  const baseTargetGap = Math.max(0, baseTarget - baseOutput);

  const baseDowntime =
    params.customBaseline?.downtimeMinutes !== undefined && !isNaN(params.customBaseline.downtimeMinutes)
      ? params.customBaseline.downtimeMinutes
      : baseline.totalDowntime > 0
      ? baseline.totalDowntime
      : 780; // minutes

  const basePlannedTime =
    baseline.totalPlannedTime > 0 ? baseline.totalPlannedTime : 4800; // minutes

  const baseOperatingTime =
    params.customBaseline?.operatingMinutes !== undefined && !isNaN(params.customBaseline.operatingMinutes)
      ? params.customBaseline.operatingMinutes
      : baseline.totalOperatingTime > 0
      ? baseline.totalOperatingTime
      : Math.max(120, basePlannedTime - baseDowntime);

  const baseAvail =
    baseline.availability ??
    Math.min(100, Math.round((baseOperatingTime / basePlannedTime) * 1000) / 10);

  const basePerf = baseline.performance ?? 87.5;
  const baseQual = baseline.quality ?? 97.2;

  const baseOee =
    params.customBaseline?.baselineOee !== undefined && !isNaN(params.customBaseline.baselineOee)
      ? params.customBaseline.baselineOee
      : baseline.oee ??
        Math.round(((baseAvail / 100) * (basePerf / 100) * (baseQual / 100)) * 10000) / 100;

  const baseDefects =
    params.customBaseline?.defectUnits !== undefined && !isNaN(params.customBaseline.defectUnits)
      ? params.customBaseline.defectUnits
      : baseline.totalDefectiveUnits > 0
      ? baseline.totalDefectiveUnits
      : Math.round(baseOutput * 0.028);

  const baseDefectRate =
    baseline.defectRate ??
    Math.round((baseDefects / Math.max(1, baseOutput)) * 10000) / 100;

  const baseActualCycle =
    baseline.averageActualCycleTime && baseline.averageActualCycleTime > 0
      ? baseline.averageActualCycleTime
      : baseOperatingTime > 0 && baseOutput > 0
      ? Math.round(((baseOperatingTime * 60) / baseOutput) * 10) / 10
      : 52; // seconds

  // 1. Downtime reduction impact
  const dtReductionFactor = Math.max(0, Math.min(1, params.downtimeReductionPercent / 100));
  const downtimeSavedMinutes = Math.round(baseDowntime * dtReductionFactor * 10) / 10;
  const simulatedDowntime = Math.max(0, Math.round((baseDowntime - downtimeSavedMinutes) * 10) / 10);
  const simulatedOperatingTime = baseOperatingTime + downtimeSavedMinutes;

  const simulatedAvail =
    basePlannedTime > 0
      ? Math.min(100, Math.round((simulatedOperatingTime / basePlannedTime) * 1000) / 10)
      : Math.min(100, Math.round(baseAvail + dtReductionFactor * 15 * 10) / 10);

  // 2. Cycle time improvement impact
  const cycleImproveFactor = Math.max(0, Math.min(0.8, params.cycleTimeImprovementPercent / 100));
  const simulatedActualCycle = Math.max(1, Math.round(baseActualCycle * (1 - cycleImproveFactor) * 10) / 10);

  // Additional units produced during recovered downtime:
  const extraUnitsFromDowntime =
    simulatedActualCycle > 0
      ? Math.floor((downtimeSavedMinutes * 60) / simulatedActualCycle)
      : 0;

  // Additional units produced from faster speed during existing operating time:
  const speedGainUnits =
    cycleImproveFactor > 0 && baseActualCycle > 0
      ? Math.floor(
          (baseOperatingTime * 60) * (1 / simulatedActualCycle - 1 / baseActualCycle)
        )
      : 0;

  // 3. Capacity / line boost impact
  const capacityBoostFactor = Math.max(0, Math.min(0.5, (params.capacityBoostPercent ?? 0) / 100));
  const capacityGainUnits = Math.floor(baseOutput * capacityBoostFactor);

  const totalOutputGain = Math.max(0, extraUnitsFromDowntime + speedGainUnits + capacityGainUnits);
  const simulatedOutput = baseOutput + totalOutputGain;

  // Simulated Performance (smooth calculation with upper realistic boundary)
  const baseIdealCycle = baseline.averageIdealCycleTime ?? Math.round(baseActualCycle * 0.92);
  let simulatedPerf: number = basePerf;
  if (baseIdealCycle > 0 && simulatedOperatingTime > 0) {
    const totalIdealSeconds = baseIdealCycle * simulatedOutput;
    simulatedPerf = Math.min(
      110,
      Math.max(40, Math.round((totalIdealSeconds / (simulatedOperatingTime * 60)) * 1000) / 10)
    );
  } else {
    simulatedPerf = Math.min(100, Math.round((basePerf * (1 + cycleImproveFactor * 0.75)) * 10) / 10);
  }

  // 4. Quality / Defect reduction impact
  const defectReductionFactor = Math.max(0, Math.min(1, params.defectReductionPercent / 100));
  const defectReductionUnits = Math.round(baseDefects * defectReductionFactor);
  const simulatedDefects = Math.max(0, baseDefects - defectReductionUnits);

  const simulatedDefectRate =
    simulatedOutput > 0
      ? Math.round((simulatedDefects / simulatedOutput) * 10000) / 100
      : Math.max(0.1, Math.round(baseDefectRate * (1 - defectReductionFactor) * 100) / 100);

  const simulatedQuality = Math.min(100, Math.max(50, Math.round((100 - simulatedDefectRate) * 10) / 10));

  // 5. Simulated OEE
  const simulatedOee = Math.round(
    ((simulatedAvail / 100) * (simulatedPerf / 100) * (simulatedQuality / 100)) * 10000
  ) / 100;

  const oeeChange = Math.round((simulatedOee - baseOee) * 10) / 10;
  const simulatedTargetGap = Math.max(0, baseTargetGap - totalOutputGain);
  const targetGapReduction = Math.max(0, baseTargetGap - simulatedTargetGap);

  // 6. Risk Assessment & Velocity Dynamics strictly based on user values
  const totalIntervention =
    params.downtimeReductionPercent +
    params.cycleTimeImprovementPercent +
    params.defectReductionPercent +
    (params.capacityBoostPercent ?? 0);

  const deficitPercent = baseTarget > 0 ? (simulatedTargetGap / baseTarget) * 100 : 0;

  // Run rates in units/hour
  const baselineRunRate =
    baseOperatingTime > 0 ? Math.round((baseOutput / (baseOperatingTime / 60)) * 10) / 10 : 0;
  const simulatedRunRate =
    simulatedOperatingTime > 0
      ? Math.round((simulatedOutput / (simulatedOperatingTime / 60)) * 10) / 10
      : 0;
  const requiredRunRate =
    basePlannedTime > 0 ? Math.round((baseTarget / (basePlannedTime / 60)) * 10) / 10 : 0;

  // Granular lever-level warnings
  const downtimeWarning =
    params.downtimeReductionPercent <= 5
      ? '⚠️ Critical Unplanned Downtime: Zero/low downtime recovery. Chronic line stoppages remain unaddressed.'
      : params.downtimeReductionPercent <= 12
      ? '⚠️ Low Downtime Recovery: Residual line stoppages continue to consume operating capacity.'
      : null;

  const cycleWarning =
    params.cycleTimeImprovementPercent <= 5
      ? '⚠️ Critical Velocity Lag: Line speed exceeds takt time; speed is insufficient to meet planned quota.'
      : params.cycleTimeImprovementPercent <= 10
      ? '⚠️ Mild Speed Throttling: Micro-stoppages and takt lag drag performance.'
      : null;

  const defectWarning =
    params.defectReductionPercent <= 5
      ? '⚠️ Scrap Vulnerability: High scrap rate persists; defect units drain net yield.'
      : null;

  // Overall Risk Level & Warning Alert based on user's exact inputs
  let riskSeverity: 'CRITICAL' | 'WARNING' | 'MODERATE' | 'OPTIMAL' = 'CRITICAL';
  let simulatedRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'OPTIMAL' = 'HIGH';
  let isLowInterventionRisk = false;
  let warningTitle = '';
  let warningDescription = '';
  let riskScore = 85;

  const baseDeficitPercent = baseTarget > 0 ? (baseTargetGap / baseTarget) * 100 : 0;
  const baselineRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
    baseDeficitPercent > 10 || baseOee < 75 ? 'HIGH' : baseDeficitPercent > 0 ? 'MEDIUM' : 'LOW';

  if (simulatedTargetGap > 0 && (deficitPercent > 8 || totalIntervention < 18)) {
    riskSeverity = 'CRITICAL';
    simulatedRiskLevel = 'HIGH';
    isLowInterventionRisk = true;
    riskScore = Math.min(100, Math.round(50 + deficitPercent * 3.5));
    warningTitle = 'CRITICAL TARGET SHORTFALL RISK (High Deficit Warning)';
    warningDescription = `Warning: Your given lever settings (${totalIntervention}% total intervention) leave a projected shortfall of ${simulatedTargetGap.toLocaleString()} units (${deficitPercent.toFixed(1)}% of your target ${baseTarget.toLocaleString()} units). Increase recovery levers to close this quota deficit.`;
  } else if (simulatedTargetGap > 0 && deficitPercent <= 8) {
    riskSeverity = 'WARNING';
    simulatedRiskLevel = 'MEDIUM';
    isLowInterventionRisk = totalIntervention < 25;
    riskScore = Math.min(65, Math.max(35, Math.round(30 + deficitPercent * 4)));
    warningTitle = 'ELEVATED TARGET RISK (Moderate Shortfall Caution)';
    warningDescription = `Caution: Pacing is improving, but a residual shortfall of ${simulatedTargetGap.toLocaleString()} units remains from your target. Accelerate cycle time speed or increase downtime recovery to achieve complete quota security.`;
  } else {
    riskSeverity = 'OPTIMAL';
    simulatedRiskLevel = simulatedOutput >= baseTarget * 1.02 ? 'OPTIMAL' : 'LOW';
    isLowInterventionRisk = false;
    riskScore = Math.max(5, Math.round(20 - (totalOutputGain / Math.max(1, baseTarget)) * 100));
    warningTitle = 'TARGET SECURED - ZERO SHORTFALL RISK (Quota Achieved)';
    warningDescription = `Goal Achieved: Your given lever settings close 100% of the production gap! Projected output produces +${totalOutputGain.toLocaleString()} incremental units, elevating plant OEE to ${simulatedOee}%.`;
  }

  return {
    baseline: {
      oee: baseOee,
      availability: baseAvail,
      performance: basePerf,
      quality: baseQual,
      output: baseOutput,
      downtime: Math.round(baseDowntime * 10) / 10,
      defectRate: baseDefectRate,
      targetGap: baseTargetGap,
      targetTotal: baseTarget,
      riskLevel: baselineRiskLevel,
    },
    simulated: {
      oee: simulatedOee,
      availability: simulatedAvail,
      performance: simulatedPerf,
      quality: simulatedQuality,
      output: simulatedOutput,
      downtime: Math.round(simulatedDowntime * 10) / 10,
      defectRate: simulatedDefectRate,
      targetGap: simulatedTargetGap,
      riskLevel: simulatedRiskLevel,
      riskScore,
    },
    delta: {
      oeeChange,
      outputGain: totalOutputGain,
      downtimeSaved: Math.round(downtimeSavedMinutes * 10) / 10,
      defectReductionUnits,
      targetGapReduction,
    },
    riskAssessment: {
      isLowInterventionRisk,
      warningTitle,
      warningDescription,
      riskSeverity,
      leverWarnings: {
        downtime: downtimeWarning,
        cycle: cycleWarning,
        defect: defectWarning,
      },
      runRateImprovement: {
        baselineRate: baselineRunRate,
        simulatedRate: simulatedRunRate,
        requiredRate: requiredRunRate,
      },
    },
  };
};
