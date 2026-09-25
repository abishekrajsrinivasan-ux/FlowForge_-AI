import { ProductionRecord } from '../types/database';
import { TargetRiskForecast } from '../types/analytics';

export interface TargetRiskThresholds {
  highRiskDeficitPercent: number; // e.g., > 10% deficit is HIGH
  mediumRiskDeficitPercent: number; // e.g., 0% to 10% deficit is MEDIUM
}

export const calculateTargetRisk = (
  records: ProductionRecord[],
  thresholds: TargetRiskThresholds = { highRiskDeficitPercent: 10, mediumRiskDeficitPercent: 0 }
): TargetRiskForecast => {
  if (!records || records.length === 0) {
    return {
      target: 0,
      currentOutput: 0,
      remainingTarget: 0,
      projectedOutput: 0,
      projectedDeficit: 0,
      currentRunRate: 0,
      requiredRunRate: 0,
      riskLevel: 'LOW',
      confidence: 0,
      reasoning: 'No production records available to calculate target risk.',
      sufficientData: false,
    };
  }

  const totalTarget = records.reduce((s, r) => s + (r.target_quantity ?? 0), 0);
  const currentOutput = records.reduce((s, r) => s + (r.actual_quantity ?? r.total_units ?? 0), 0);
  const totalOperatingMinutes = records.reduce((s, r) => s + (r.operating_time ?? (r.planned_time ?? 60)), 0);
  const totalPlannedMinutes = records.reduce((s, r) => s + (r.planned_time ?? 0), 0);

  if (totalTarget === 0) {
    return {
      target: 0,
      currentOutput,
      remainingTarget: 0,
      projectedOutput: currentOutput,
      projectedDeficit: 0,
      currentRunRate: 0,
      requiredRunRate: 0,
      riskLevel: 'LOW',
      confidence: 50,
      reasoning: 'Target quantities are not specified in the uploaded dataset. Risk forecasting requires planned targets.',
      sufficientData: false,
    };
  }

  const remainingTarget = Math.max(0, totalTarget - currentOutput);

  // Time calculations
  const elapsedMinutes = totalOperatingMinutes > 0 ? totalOperatingMinutes : records.length * 60;
  const currentRunRate = elapsedMinutes > 0 ? (currentOutput / (elapsedMinutes / 60)) : 0; // units/hour

  // Inferred remaining schedule: either planned time - elapsed, or standard remaining production window
  const remainingMinutes = totalPlannedMinutes > elapsedMinutes
    ? (totalPlannedMinutes - elapsedMinutes)
    : Math.max(120, elapsedMinutes * 0.35); // estimated remaining run window

  const remainingHours = remainingMinutes / 60;
  const projectedOutput = Math.round(currentOutput + currentRunRate * remainingHours);
  const projectedDeficit = totalTarget - projectedOutput;

  const requiredRunRate = remainingHours > 0 ? Math.round((remainingTarget / remainingHours) * 10) / 10 : 0;

  // Deficit percentage relative to target
  const deficitPercent = (projectedDeficit / totalTarget) * 100;

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  let reasoning = '';

  if (projectedOutput >= totalTarget) {
    riskLevel = 'LOW';
    reasoning = `Current production velocity (${currentRunRate.toFixed(1)} units/hr) comfortably sustains target completion. Projected output is ${projectedOutput} against a target of ${totalTarget}.`;
  } else if (deficitPercent <= thresholds.highRiskDeficitPercent) {
    riskLevel = 'MEDIUM';
    reasoning = `Production is closely trailing schedule with a projected shortfall of ${projectedDeficit} units (${deficitPercent.toFixed(1)}%). Current velocity is ${currentRunRate.toFixed(1)} units/hr; accelerating to ${requiredRunRate} units/hr would recover the gap.`;
  } else {
    riskLevel = 'HIGH';
    reasoning = `Target is at high risk of shortfall (${projectedDeficit} projected unproduced units, ${deficitPercent.toFixed(1)}% deficit). A run rate of ${requiredRunRate} units/hr is required compared to actual velocity of ${currentRunRate.toFixed(1)} units/hr.`;
  }

  return {
    target: totalTarget,
    currentOutput,
    remainingTarget,
    projectedOutput,
    projectedDeficit: Math.max(0, projectedDeficit),
    currentRunRate: Math.round(currentRunRate * 10) / 10,
    requiredRunRate,
    riskLevel,
    confidence: records.length >= 5 ? 88 : 65,
    reasoning,
    sufficientData: true,
  };
};
