import { ProductionRecord, RecommendationRecord } from '../types/database';
import { MachineBottleneckScore } from '../types/analytics';
import { LossBreakdownResult } from './lossEngine';

export const generateRecommendations = (
  datasetId: string,
  records: ProductionRecord[],
  bottlenecks: MachineBottleneckScore[],
  losses: LossBreakdownResult
): RecommendationRecord[] => {
  const recommendations: RecommendationRecord[] = [];
  if (!records || records.length === 0) return [];

  // 1. Current Bottleneck Machine Recommendation
  const topBottleneck = bottlenecks[0];
  if (topBottleneck && topBottleneck.bottleneckScore > 25) {
    const oeeLossTxt = topBottleneck.oee !== null ? `OEE is ${topBottleneck.oee.toFixed(1)}%` : 'unplanned downtime is elevated';
    recommendations.push({
      dataset_id: datasetId,
      machine_id: topBottleneck.machineId,
      priority: 'CRITICAL',
      problem: `Primary Production Constraint on Machine ${topBottleneck.machineId}`,
      evidence: `Machine ${topBottleneck.machineId} ranks #1 constraint with a FLOWFORGE AI Bottleneck Score of ${topBottleneck.bottleneckScore}/100. Recorded ${topBottleneck.totalDowntime}m downtime and ${oeeLossTxt}. Primary observed loss: ${topBottleneck.primaryObservedLoss}.`,
      recommendation: `Conduct focused kaizen on ${topBottleneck.machineId}. Prioritize root-cause elimination for ${topBottleneck.primaryObservedLoss.toLowerCase()} and implement buffer management upstream.`,
      expected_impact: `Estimated +${Math.round(topBottleneck.bottleneckScore * 0.12)}% line throughput gain if ${topBottleneck.machineId} downtime is reduced by 25%.`,
      confidence: 91,
      status: 'OPEN',
    });
  }

  // 2. Top Downtime Reason Recommendation
  const topReason = losses.paretoReasons[0];
  if (topReason && topReason.percentage >= 15) {
    recommendations.push({
      dataset_id: datasetId,
      machine_id: topBottleneck?.machineId ?? null,
      priority: topReason.percentage > 30 ? 'CRITICAL' : 'HIGH',
      problem: `Dominant Stoppage Cause: "${topReason.reason}"`,
      evidence: `Pareto analysis identifies "${topReason.reason}" as the largest single loss factor, responsible for ${topReason.value} minutes (${topReason.percentage}% of all recorded lost production time).`,
      recommendation: `Deploy 5-Why problem-solving on "${topReason.reason}". Establish standard operating procedures (SOPs) and verify sensor/mechanical calibration to prevent recurrence.`,
      expected_impact: `Eliminating half of this stoppage mode recovers approximately ${Math.round(topReason.value * 0.5)} minutes of active production time.`,
      confidence: 88,
      status: 'OPEN',
    });
  }

  // 3. Cycle Time Deterioration
  const slowMachines = bottlenecks.filter((b) => b.cycleDeviation > 3);
  if (slowMachines.length > 0) {
    const targetM = slowMachines[0];
    recommendations.push({
      dataset_id: datasetId,
      machine_id: targetM.machineId,
      priority: 'HIGH',
      problem: `Speed Loss on Machine ${targetM.machineId}`,
      evidence: `Observed cycle time exceeds nominal ideal standard by ${targetM.cycleDeviation}s per cycle, generating cumulative performance loss across batches.`,
      recommendation: `Inspect tooling wear, motor feed drive rates, and operator handling routines. Re-baseline takt time with engineering standard.`,
      expected_impact: `Restoring cycle velocity yields approximately +${Math.round(targetM.output * 0.08)} incremental units per production window.`,
      confidence: 82,
      status: 'OPEN',
    });
  }

  // 4. Quality Defects / Scrap Spike
  const defectLoss = losses.tree.children?.find((c) => c.category === 'Quality Loss');
  if (defectLoss && defectLoss.value > 10) {
    recommendations.push({
      dataset_id: datasetId,
      machine_id: null,
      priority: 'MEDIUM',
      problem: `Scrap & Rectification Waste Accumulation`,
      evidence: `Quality defects contributed equivalent of ${defectLoss.value} lost production minutes (${defectLoss.percentage}% of overall production loss).`,
      recommendation: `Institute tightened first-piece validation at shift start. Audit raw material lot consistency and thermal/pressure tolerances.`,
      expected_impact: `Cutting scrap by 30% avoids wasted cycle time and improves final yield to customers.`,
      confidence: 85,
      status: 'OPEN',
    });
  }

  return recommendations;
};
