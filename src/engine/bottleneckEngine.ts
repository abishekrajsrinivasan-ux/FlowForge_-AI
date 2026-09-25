import { ProductionRecord, BottleneckRecord } from '../types/database';
import { MachineBottleneckScore, PredictiveBottleneckResult } from '../types/analytics';
import { calculateOee } from './oeeEngine';

export interface BottleneckWeights {
  oeeLoss: number;
  availabilityLoss: number;
  performanceLoss: number;
  qualityLoss: number;
  throughputLoss: number;
  trendScore: number;
}

export const DEFAULT_BOTTLENECK_WEIGHTS: BottleneckWeights = {
  oeeLoss: 0.30,          // OEE loss is the primary driver
  availabilityLoss: 0.20, // Downtime-driven availability gap
  performanceLoss: 0.20,  // Speed loss
  qualityLoss: 0.15,      // Defect-driven quality gap
  throughputLoss: 0.10,   // Output vs target gap
  trendScore: 0.05,       // Deterioration trend
};

const safe = (n: number | null | undefined, fallback = 0): number => n ?? fallback;

export const calculateBottlenecks = (
  records: ProductionRecord[],
  weights: BottleneckWeights = DEFAULT_BOTTLENECK_WEIGHTS
): {
  scores: MachineBottleneckScore[];
  currentBottleneck: MachineBottleneckScore | null;
  predictiveBottlenecks: PredictiveBottleneckResult[];
  dbRecords: BottleneckRecord[];
} => {
  if (!records || records.length === 0) {
    return { scores: [], currentBottleneck: null, predictiveBottlenecks: [], dbRecords: [] };
  }

  // 1. Group records by machine
  const machineGroups = new Map<string, ProductionRecord[]>();
  for (const r of records) {
    if (!r.machine_id) continue;
    if (!machineGroups.has(r.machine_id)) machineGroups.set(r.machine_id, []);
    machineGroups.get(r.machine_id)!.push(r);
  }

  if (machineGroups.size === 0) {
    return { scores: [], currentBottleneck: null, predictiveBottlenecks: [], dbRecords: [] };
  }

  // 2. Compute per-machine absolute metrics
  interface RawStats {
    machineId: string;
    lineId: string | null;
    records: ProductionRecord[];
    // OEE components (0-100, null = not available)
    oee: number | null;
    availability: number | null;
    performance: number | null;
    quality: number | null;
    // Absolute losses (0-100 scale directly)
    oeeLossPct: number;         // 100 - OEE  → direct loss %
    availLossPct: number;       // 100 - Availability
    perfLossPct: number;        // 100 - Performance
    qualLossPct: number;        // 100 - Quality (= defect rate %)
    // Throughput gap
    throughputGapPct: number;   // (target - actual) / target × 100
    throughputGapUnits: number;
    // Downtime
    totalDowntime: number;      // raw minutes
    downtimeRatePct: number;    // downtime / planned_time × 100
    // Cycle time
    actualCycleAvg: number;
    idealCycleAvg: number;
    cycleDeviationSec: number;  // actual - ideal (seconds)
    cycleDeviationPct: number;  // (actual-ideal)/ideal × 100
    // Trend
    trendScore: number;         // 0-30
  }

  const rawList: RawStats[] = [];

  for (const [mId, mRecords] of machineGroups.entries()) {
    const oeeRes = calculateOee(mRecords);
    const lineId = mRecords[0]?.line_id ?? null;

    // OEE components as absolute loss percentages
    const oee = oeeRes.oee;
    const availability = oeeRes.availability;
    const performance = oeeRes.performance;
    const quality = oeeRes.quality;

    // World-class benchmark = 85% OEE. Losses measured from 100% (perfect)
    const oeeLossPct = oee !== null ? Math.max(0, 100 - oee) : 30;
    const availLossPct = availability !== null ? Math.max(0, 100 - availability) : 10;
    const perfLossPct = performance !== null ? Math.max(0, 100 - Math.min(100, performance)) : 10;
    const qualLossPct = quality !== null ? Math.max(0, 100 - quality) : 0;

    // Throughput gap as % of target
    const target = oeeRes.totalTargetQuantity;
    const actual = oeeRes.totalActualQuantity;
    const throughputGapUnits = Math.max(0, target - actual);
    const throughputGapPct = target > 0 ? (throughputGapUnits / target) * 100 : 0;

    // Downtime rate (downtime as % of planned time)
    const totalDowntime = oeeRes.totalDowntime;
    const plannedTime = oeeRes.totalPlannedTime;
    const downtimeRatePct = plannedTime > 0 ? (totalDowntime / plannedTime) * 100 : 0;

    // Cycle deviation
    const actualCycleAvg = oeeRes.averageActualCycleTime ?? 0;
    const idealCycleAvg = oeeRes.averageIdealCycleTime ?? 0;
    const cycleDeviationSec = Math.max(0, actualCycleAvg - idealCycleAvg);
    const cycleDeviationPct = idealCycleAvg > 0 ? (cycleDeviationSec / idealCycleAvg) * 100 : 0;

    // Trend: compare first half vs second half downtime avg
    let trendScore = 5;
    if (mRecords.length >= 3) {
      const sorted = [...mRecords].sort((a, b) =>
        new Date(a.timestamp || a.date || 0).getTime() - new Date(b.timestamp || b.date || 0).getTime()
      );
      const mid = Math.floor(sorted.length / 2);
      const dt1 = sorted.slice(0, mid).reduce((s, r) => s + safe(r.downtime), 0) / Math.max(1, mid);
      const dt2 = sorted.slice(mid).reduce((s, r) => s + safe(r.downtime), 0) / Math.max(1, sorted.length - mid);
      if (dt2 > dt1 * 1.2) trendScore = 30;
      else if (dt2 > dt1 * 1.05) trendScore = 15;
      else if (dt1 > dt2 * 1.2) trendScore = 0;
    }

    rawList.push({
      machineId: mId,
      lineId,
      records: mRecords,
      oee, availability, performance, quality,
      oeeLossPct, availLossPct, perfLossPct, qualLossPct,
      throughputGapPct, throughputGapUnits,
      totalDowntime, downtimeRatePct,
      actualCycleAvg, idealCycleAvg, cycleDeviationSec, cycleDeviationPct,
      trendScore,
    });
  }

  // 3. Compute composite ABSOLUTE bottleneck score
  //    Each component is already 0-100 (a genuine loss %).
  //    Score = weighted sum of absolute losses → meaningful on its own.
  const scores: MachineBottleneckScore[] = rawList.map((m) => {
    // Use OEE loss as primary signal; supplement with component details
    // availLossPct, perfLossPct, qualLossPct are each 0-100
    // throughputGapPct is 0-100
    // trendScore is 0-30, normalize to 0-100
    const normTrend = Math.min(100, m.trendScore * (100 / 30));

    const compositeScore = Math.round(
      (m.oeeLossPct   * weights.oeeLoss +
       m.availLossPct * weights.availabilityLoss +
       m.perfLossPct  * weights.performanceLoss +
       m.qualLossPct  * weights.qualityLoss +
       m.throughputGapPct * weights.throughputLoss +
       normTrend      * weights.trendScore) * 10
    ) / 10;

    // Primary observed loss: the component with the highest absolute loss
    const components = [
      { name: 'Downtime & Stoppages',   val: m.availLossPct },
      { name: 'Reduced Speed / Performance', val: m.perfLossPct },
      { name: 'Quality Scrap & Defects', val: m.qualLossPct },
      { name: 'Throughput Deficit',      val: m.throughputGapPct },
    ].sort((a, b) => b.val - a.val);

    const primaryObservedLoss =
      components[0].val > 1 ? components[0].name : 'Within Normal Range';

    // Cycle deviation display: show % if available, else raw seconds
    const cycleDevDisplay = m.idealCycleAvg > 0
      ? m.cycleDeviationPct
      : 0;

    return {
      machineId: m.machineId,
      lineId: m.lineId,
      bottleneckScore: compositeScore,
      // Store absolute values that the UI can display meaningfully
      oeeLoss: Math.round(m.oeeLossPct * 10) / 10,
      downtimeContribution: Math.round(m.downtimeRatePct * 10) / 10, // now = downtime rate %
      throughputLoss: Math.round(m.throughputGapPct * 10) / 10,
      cycleDeviation: Math.round(cycleDevDisplay * 10) / 10,          // now = % above ideal
      qualityLoss: Math.round(m.qualLossPct * 10) / 10,
      trendScore: Math.round(normTrend * 10) / 10,
      rank: 1,
      isCurrentBottleneck: false,
      totalDowntime: Math.round(m.totalDowntime * 10) / 10,
      oee: m.oee,
      availability: m.availability,
      performance: m.performance,
      quality: m.quality,
      output: Math.round(m.records.reduce((s, r) => s + safe(r.actual_quantity), 0)),
      throughputGapUnits: Math.round(m.throughputGapUnits),
      primaryObservedLoss,
    };
  });

  // 4. Sort descending by composite score, assign ranks
  scores.sort((a, b) => b.bottleneckScore - a.bottleneckScore);
  scores.forEach((s, i) => {
    s.rank = i + 1;
    s.isCurrentBottleneck = i === 0;
  });

  const currentBottleneck = scores.length > 0 ? scores[0] : null;

  // 5. Predictive bottleneck trend (linear regression on downtime time series)
  const predictiveBottlenecks: PredictiveBottleneckResult[] = [];

  for (const m of rawList) {
    const datedRecords = m.records
      .filter((r) => r.timestamp || r.date)
      .sort((a, b) => new Date(a.timestamp || a.date!).getTime() - new Date(b.timestamp || b.date!).getTime());

    if (datedRecords.length < 3) {
      predictiveBottlenecks.push({
        machineId: m.machineId,
        riskProbability: 0,
        trendSlope: 0,
        evidence: `Insufficient historical time-series intervals for predictive bottleneck trend analysis. Requires at least 3 timestamped sequence points.`,
        sufficientData: false,
        historicalPointsCount: datedRecords.length,
      });
      continue;
    }

    const bucketCount = Math.min(5, datedRecords.length);
    const bucketSize = Math.ceil(datedRecords.length / bucketCount);
    const pts: number[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const slice = datedRecords.slice(i * bucketSize, (i + 1) * bucketSize);
      if (!slice.length) continue;
      pts.push(slice.reduce((s, r) => s + safe(r.downtime), 0) / slice.length);
    }

    const n = pts.length;
    let sx = 0, sy = 0, sxy = 0, sx2 = 0;
    for (let x = 0; x < n; x++) { sx += x; sy += pts[x]; sxy += x * pts[x]; sx2 += x * x; }
    const denom = n * sx2 - sx * sx;
    const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;

    let riskProbability = 15;
    if (slope > 0.5) riskProbability = Math.min(95, Math.round(35 + slope * 15));
    else if (slope < -0.5) riskProbability = Math.max(5, Math.round(20 + slope * 10));

    let evidence = `Historical slope: ${slope >= 0 ? '+' : ''}${slope.toFixed(2)} min/interval over ${datedRecords.length} events.`;
    if (riskProbability >= 70) evidence += ` Steady upward downtime drift detected — elevated constraint risk.`;
    else if (riskProbability >= 40) evidence += ` Moderate fluctuation across consecutive shifts.`;
    else evidence += ` Downtime pattern is stable or improving.`;

    predictiveBottlenecks.push({
      machineId: m.machineId,
      riskProbability,
      trendSlope: Math.round(slope * 100) / 100,
      evidence,
      sufficientData: true,
      historicalPointsCount: datedRecords.length,
    });
  }

  predictiveBottlenecks.sort((a, b) => b.riskProbability - a.riskProbability);

  const dbRecords: BottleneckRecord[] = scores.map((s) => ({
    dataset_id: records[0]?.dataset_id || '',
    machine_id: s.machineId,
    line_id: s.lineId,
    bottleneck_score: s.bottleneckScore,
    oee_loss: s.oeeLoss,
    downtime_contribution: s.downtimeContribution,
    throughput_loss: s.throughputLoss,
    cycle_deviation: s.cycleDeviation,
    quality_loss: s.qualityLoss,
    trend_score: s.trendScore,
    rank: s.rank,
    is_current_bottleneck: s.isCurrentBottleneck,
  }));

  return { scores, currentBottleneck, predictiveBottlenecks, dbRecords };
};
