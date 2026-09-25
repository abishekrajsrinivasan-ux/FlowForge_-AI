import { ProductionRecord } from '../types/database';

export interface RootCauseFactor {
  factor: 'Machine' | 'Shift' | 'Product' | 'Downtime Reason' | 'Cycle Speed' | 'Quality';
  factorValue: string;
  metricAnalyzed: string;
  metricValue: number;
  averageBaseline: number;
  differencePercent: number;
  contributionPercent: number;
  confidence: number;
  evidence: string;
}

/** Per-machine root cause breakdown */
export interface MachineRootCause {
  machineId: string;
  totalDowntime: number;
  downtimeShare: number;
  avgActualCycle: number | null;
  avgIdealCycle: number | null;
  cycleDeviation: number | null;   // %
  defectRate: number | null;        // %
  throughputGapUnits: number;       // target - actual
  throughputGapPct: number;         // %
  availabilityRate: number | null;  // %
  performanceRate: number | null;   // %
  qualityRate: number | null;       // %
  oeeEstimate: number | null;
  topDowntimeReason: string | null;
  topDowntimeReasonMinutes: number;
  downtimeReasonCount: number;
  totalRecords: number;
  totalTarget: number;
  totalActual: number;
  totalDefects: number;
  totalUnits: number;
  factors: RootCauseFactor[];
}

const safe = (n: number | null | undefined, fallback = 0): number => (n ?? fallback);

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeMachineStats(machineId: string, recs: ProductionRecord[]) {
  const mRecs = recs.filter((r) => r.machine_id === machineId);

  const totalDowntime = mRecs.reduce((s, r) => s + safe(r.downtime), 0);
  const totalPlanned  = mRecs.reduce((s, r) => s + safe(r.planned_time), 0);
  const totalOperating = mRecs.reduce((s, r) => s + safe(r.operating_time), 0);
  const totalTarget  = mRecs.reduce((s, r) => s + safe(r.target_quantity), 0);
  const totalActual  = mRecs.reduce((s, r) => s + safe(r.actual_quantity), 0);
  const totalUnits   = mRecs.reduce((s, r) => s + safe(r.total_units ?? r.actual_quantity), 0);
  const totalDefects = mRecs.reduce((s, r) => s + safe(r.defective_units), 0);

  // Cycle time
  const cycleRecs = mRecs.filter((r) => r.actual_cycle_time != null && r.ideal_cycle_time != null);
  const avgActualCycle = cycleRecs.length > 0
    ? cycleRecs.reduce((s, r) => s + safe(r.actual_cycle_time), 0) / cycleRecs.length : null;
  const avgIdealCycle = cycleRecs.length > 0
    ? cycleRecs.reduce((s, r) => s + safe(r.ideal_cycle_time), 0) / cycleRecs.length : null;
  const cycleDeviation = (avgActualCycle != null && avgIdealCycle != null && avgIdealCycle > 0)
    ? ((avgActualCycle - avgIdealCycle) / avgIdealCycle) * 100 : null;

  // Rates
  const availabilityRate = totalPlanned > 0 ? (totalOperating / totalPlanned) * 100 : null;
  const defectRate = totalUnits > 0 ? (totalDefects / totalUnits) * 100 : null;
  const qualityRate = defectRate !== null ? 100 - defectRate : null;
  const performanceRate = (avgActualCycle != null && avgIdealCycle != null && avgActualCycle > 0)
    ? Math.min(100, (avgIdealCycle / avgActualCycle) * 100) : null;

  const oeeEstimate = (availabilityRate !== null && performanceRate !== null && qualityRate !== null)
    ? Math.round((availabilityRate / 100) * (performanceRate / 100) * (qualityRate / 100) * 1000) / 10 : null;

  // Downtime reasons
  const reasonDt = new Map<string, number>();
  const reasonCnt = new Map<string, number>();
  for (const r of mRecs) {
    if (r.downtime_reason && safe(r.downtime) > 0) {
      reasonDt.set(r.downtime_reason, (reasonDt.get(r.downtime_reason) || 0) + safe(r.downtime));
      reasonCnt.set(r.downtime_reason, (reasonCnt.get(r.downtime_reason) || 0) + 1);
    }
  }
  let topReason: string | null = null;
  let topReasonDt = 0;
  let topReasonCnt = 0;
  for (const [reason, dt] of reasonDt.entries()) {
    if (dt > topReasonDt) { topReason = reason; topReasonDt = dt; topReasonCnt = reasonCnt.get(reason) || 0; }
  }

  return {
    records: mRecs,
    totalDowntime, totalPlanned, totalOperating, totalTarget, totalActual,
    totalUnits, totalDefects,
    avgActualCycle, avgIdealCycle, cycleDeviation,
    availabilityRate, performanceRate, qualityRate, defectRate, oeeEstimate,
    topReason, topReasonDt, topReasonCnt,
  };
}

// ─── Global (dataset-wide) root cause findings ───────────────────────────────

export const analyzeRootCauses = (records: ProductionRecord[]): RootCauseFactor[] => {
  if (!records || records.length === 0) return [];

  const findings: RootCauseFactor[] = [];
  const totalDowntime = records.reduce((sum, r) => sum + safe(r.downtime), 0);
  const totalDefects  = records.reduce((sum, r) => sum + safe(r.defective_units), 0);
  const totalTarget   = records.reduce((sum, r) => sum + safe(r.target_quantity), 0);
  const totalActual   = records.reduce((sum, r) => sum + safe(r.actual_quantity), 0);
  const totalUnitsAll = records.reduce((s, r) => s + safe(r.total_units ?? r.actual_quantity), 0);

  // ── 1. MACHINE: only highlight machines that are ABOVE AVERAGE by metric ──
  const machines = [...new Set(records.map((r) => r.machine_id))];
  const machineStats = machines.map((m) => ({ machineId: m, ...computeMachineStats(m, records) }));

  // Find worst machine by each key metric and flag it
  if (machineStats.length > 1) {
    // Worst downtime (significantly above average)
    const avgMachineDt = totalDowntime / machineStats.length;
    const worstDt = machineStats.sort((a, b) => b.totalDowntime - a.totalDowntime)[0];
    if (avgMachineDt > 0 && worstDt.totalDowntime > avgMachineDt * 1.15) {
      const diff = ((worstDt.totalDowntime - avgMachineDt) / avgMachineDt) * 100;
      const share = (worstDt.totalDowntime / totalDowntime) * 100;
      findings.push({
        factor: 'Machine',
        factorValue: worstDt.machineId,
        metricAnalyzed: 'Highest Downtime',
        metricValue: Math.round(worstDt.totalDowntime * 10) / 10,
        averageBaseline: Math.round(avgMachineDt * 10) / 10,
        differencePercent: Math.round(diff * 10) / 10,
        contributionPercent: Math.round(share * 10) / 10,
        confidence: Math.min(95, Math.round(70 + diff * 0.3)),
        evidence: `${worstDt.machineId} has the highest downtime at ${worstDt.totalDowntime.toFixed(0)} min — ${diff.toFixed(1)}% above the machine average of ${avgMachineDt.toFixed(0)} min. This single machine contributes ${share.toFixed(1)}% of total downtime across ${worstDt.records.length} production runs.${worstDt.availabilityRate != null ? ` Availability: ${worstDt.availabilityRate.toFixed(1)}%.` : ''}`,
      });
    }

    // Worst defect rate (significantly above average)
    const machinesWithDefects = machineStats.filter((m) => m.defectRate !== null && m.defectRate > 0);
    if (machinesWithDefects.length > 0) {
      const avgDefectRate = totalUnitsAll > 0 ? (totalDefects / totalUnitsAll) * 100 : 0;
      const worstDefect = machinesWithDefects.sort((a, b) => (b.defectRate ?? 0) - (a.defectRate ?? 0))[0];
      if (worstDefect.defectRate! > avgDefectRate * 1.2) {
        const diff = avgDefectRate > 0 ? ((worstDefect.defectRate! - avgDefectRate) / avgDefectRate) * 100 : 0;
        const share = totalDefects > 0 ? (worstDefect.totalDefects / totalDefects) * 100 : 0;
        findings.push({
          factor: 'Machine',
          factorValue: `${worstDefect.machineId} (Quality)`,
          metricAnalyzed: 'Highest Defect Rate',
          metricValue: Math.round(worstDefect.defectRate! * 100) / 100,
          averageBaseline: Math.round(avgDefectRate * 100) / 100,
          differencePercent: Math.round(diff * 10) / 10,
          contributionPercent: Math.round(share * 10) / 10,
          confidence: Math.min(93, Math.round(72 + share * 0.2)),
          evidence: `${worstDefect.machineId} has the highest defect rate at ${worstDefect.defectRate!.toFixed(2)}% vs the dataset average of ${avgDefectRate.toFixed(2)}% — ${diff.toFixed(1)}% above average. It produced ${worstDefect.totalDefects} defective units, accounting for ${share.toFixed(1)}% of all scrap.`,
        });
      }
    }

    // Worst cycle deviation (significantly above average)
    const machinesWithCycle = machineStats.filter((m) => m.cycleDeviation !== null);
    if (machinesWithCycle.length > 0) {
      const worstCycle = machinesWithCycle.sort((a, b) => (b.cycleDeviation ?? 0) - (a.cycleDeviation ?? 0))[0];
      if ((worstCycle.cycleDeviation ?? 0) > 5) {
        const affectedPct = (worstCycle.records.length / records.length) * 100;
        findings.push({
          factor: 'Machine',
          factorValue: `${worstCycle.machineId} (Speed)`,
          metricAnalyzed: 'Worst Cycle Deviation',
          metricValue: Math.round((worstCycle.avgActualCycle ?? 0) * 10) / 10,
          averageBaseline: Math.round((worstCycle.avgIdealCycle ?? 0) * 10) / 10,
          differencePercent: Math.round((worstCycle.cycleDeviation ?? 0) * 10) / 10,
          contributionPercent: Math.round(affectedPct * 10) / 10,
          confidence: 84,
          evidence: `${worstCycle.machineId} runs at ${(worstCycle.avgActualCycle ?? 0).toFixed(1)}s/cycle vs ${(worstCycle.avgIdealCycle ?? 0).toFixed(1)}s ideal — ${(worstCycle.cycleDeviation ?? 0).toFixed(1)}% slower than standard. This reduces performance rate and directly impacts OEE across ${worstCycle.records.length} records.`,
        });
      }
    }

    // Worst availability (significantly below average)
    const machinesWithAvail = machineStats.filter((m) => m.availabilityRate !== null);
    if (machinesWithAvail.length > 1) {
      const avgAvail = machinesWithAvail.reduce((s, m) => s + (m.availabilityRate ?? 0), 0) / machinesWithAvail.length;
      const worstAvail = machinesWithAvail.sort((a, b) => (a.availabilityRate ?? 100) - (b.availabilityRate ?? 100))[0];
      if ((worstAvail.availabilityRate ?? 100) < avgAvail * 0.95) {
        const diff = ((avgAvail - (worstAvail.availabilityRate ?? 0)) / avgAvail) * 100;
        findings.push({
          factor: 'Machine',
          factorValue: `${worstAvail.machineId} (Availability)`,
          metricAnalyzed: 'Lowest Availability',
          metricValue: Math.round((worstAvail.availabilityRate ?? 0) * 10) / 10,
          averageBaseline: Math.round(avgAvail * 10) / 10,
          differencePercent: Math.round(-diff * 10) / 10,
          contributionPercent: Math.round(diff * 10) / 10,
          confidence: Math.min(92, Math.round(68 + diff * 0.5)),
          evidence: `${worstAvail.machineId} has the lowest availability at ${(worstAvail.availabilityRate ?? 0).toFixed(1)}% — ${diff.toFixed(1)}% below the fleet average of ${avgAvail.toFixed(1)}%. This indicates disproportionate planned/unplanned downtime losses at this station.`,
        });
      }
    }
  }

  // ── 2. SHIFT vs DOWNTIME ──────────────────────────────────────────────────
  const shiftDowntime = new Map<string, { dt: number; count: number; defects: number; units: number }>();
  for (const r of records) {
    const shift = r.shift;
    if (!shift) continue;
    const e = shiftDowntime.get(shift) || { dt: 0, count: 0, defects: 0, units: 0 };
    e.dt += safe(r.downtime);
    e.count += 1;
    e.defects += safe(r.defective_units);
    e.units += safe(r.total_units ?? r.actual_quantity);
    shiftDowntime.set(shift, e);
  }

  if (shiftDowntime.size > 1 && totalDowntime > 0) {
    const avgDtPerShift = totalDowntime / shiftDowntime.size;
    for (const [shift, val] of shiftDowntime.entries()) {
      if (val.dt > avgDtPerShift * 1.1) {
        const share = (val.dt / totalDowntime) * 100;
        const diff = ((val.dt - avgDtPerShift) / avgDtPerShift) * 100;
        const shiftDefectRate = val.units > 0 ? (val.defects / val.units) * 100 : 0;
        findings.push({
          factor: 'Shift',
          factorValue: shift,
          metricAnalyzed: 'Downtime Concentration',
          metricValue: Math.round(val.dt * 10) / 10,
          averageBaseline: Math.round(avgDtPerShift * 10) / 10,
          differencePercent: Math.round(diff * 10) / 10,
          contributionPercent: Math.round(share * 10) / 10,
          confidence: Math.min(92, Math.round(60 + share * 0.3)),
          evidence: `${shift} accumulates ${val.dt.toFixed(0)} min of downtime across ${val.count} records — ${diff.toFixed(0)}% above the per-shift average of ${avgDtPerShift.toFixed(0)} min (${share.toFixed(1)}% of total). Shift defect rate: ${shiftDefectRate.toFixed(2)}%.`,
        });
      }
    }
  }

  // ── 3. DOWNTIME REASON ───────────────────────────────────────────────────
  const reasonMap = new Map<string, { dt: number; occurrences: number; machines: Set<string> }>();
  for (const r of records) {
    if (r.downtime_reason && safe(r.downtime) > 0) {
      const e = reasonMap.get(r.downtime_reason) || { dt: 0, occurrences: 0, machines: new Set() };
      e.dt += safe(r.downtime);
      e.occurrences += 1;
      e.machines.add(r.machine_id);
      reasonMap.set(r.downtime_reason, e);
    }
  }

  if (totalDowntime > 0 && reasonMap.size > 0) {
    const avgReasonDt = totalDowntime / Math.max(1, reasonMap.size);
    // Sort by impact and take top contributors
    const sortedReasons = [...reasonMap.entries()].sort((a, b) => b[1].dt - a[1].dt);
    for (const [reason, info] of sortedReasons.slice(0, 5)) {
      const share = (info.dt / totalDowntime) * 100;
      if (share >= 5) {
        findings.push({
          factor: 'Downtime Reason',
          factorValue: reason,
          metricAnalyzed: 'Stoppage Impact',
          metricValue: Math.round(info.dt * 10) / 10,
          averageBaseline: Math.round(avgReasonDt * 10) / 10,
          differencePercent: Math.round(((info.dt - avgReasonDt) / avgReasonDt) * 100 * 10) / 10,
          contributionPercent: Math.round(share * 10) / 10,
          confidence: Math.min(95, Math.round(70 + info.occurrences * 1.5)),
          evidence: `"${reason}" caused ${info.dt.toFixed(0)} min of lost production time (${share.toFixed(1)}% of total downtime) across ${info.occurrences} events on ${info.machines.size} machine(s). Targeted preventive action on this failure mode could recover the most downtime.`,
        });
      }
    }
  }

  // ── 4. PRODUCT vs DEFECT ─────────────────────────────────────────────────
  const productMap = new Map<string, { defects: number; total: number; dt: number; count: number }>();
  for (const r of records) {
    if (r.product_id) {
      const e = productMap.get(r.product_id) || { defects: 0, total: 0, dt: 0, count: 0 };
      e.defects += safe(r.defective_units);
      e.total += safe(r.total_units ?? r.actual_quantity);
      e.dt += safe(r.downtime);
      e.count += 1;
      productMap.set(r.product_id, e);
    }
  }

  if (totalDefects > 0 && productMap.size > 0) {
    const avgDefectRate = totalUnitsAll > 0 ? (totalDefects / totalUnitsAll) * 100 : 0;
    for (const [prod, info] of productMap.entries()) {
      if (info.total > 0) {
        const prodDefectRate = (info.defects / info.total) * 100;
        const share = totalDefects > 0 ? (info.defects / totalDefects) * 100 : 0;
        // Show if: above average by 20%, OR if single product with defects, OR if highest contributor
        if (prodDefectRate > avgDefectRate * 1.2 || productMap.size === 1) {
          const diff = avgDefectRate > 0 ? ((prodDefectRate - avgDefectRate) / avgDefectRate) * 100 : 0;
          findings.push({
            factor: 'Product',
            factorValue: prod,
            metricAnalyzed: 'Defect Rate',
            metricValue: Math.round(prodDefectRate * 100) / 100,
            averageBaseline: Math.round(avgDefectRate * 100) / 100,
            differencePercent: Math.round(diff * 10) / 10,
            contributionPercent: Math.round(share * 10) / 10,
            confidence: Math.min(92, Math.round(65 + share * 0.25)),
            evidence: `Product ${prod}: defect rate ${prodDefectRate.toFixed(2)}% vs dataset average ${avgDefectRate.toFixed(2)}%${diff > 0 ? ` (+${diff.toFixed(1)}% above mean)` : ''}. Produced ${info.defects} defective units across ${info.count} runs — ${share.toFixed(1)}% of total scrap. Possible causes: material batch variation, tooling setup, or operator method.`,
          });
        }
      }
    }
  }

  // ── 5. CYCLE SPEED (dataset-wide) ─────────────────────────────────────────
  const slowRecs = records.filter(
    (r) => r.actual_cycle_time != null && r.ideal_cycle_time != null &&
      safe(r.ideal_cycle_time) > 0 &&
      r.actual_cycle_time! > r.ideal_cycle_time! * 1.05
  );

  if (slowRecs.length >= 1) {
    const avgIdeal = slowRecs.reduce((s, r) => s + safe(r.ideal_cycle_time), 0) / slowRecs.length;
    const avgActual = slowRecs.reduce((s, r) => s + safe(r.actual_cycle_time), 0) / slowRecs.length;
    const devPct = avgIdeal > 0 ? ((avgActual - avgIdeal) / avgIdeal) * 100 : 0;
    const affectedPct = (slowRecs.length / records.length) * 100;
    const slowMachines = [...new Set(slowRecs.map((r) => r.machine_id))];
    findings.push({
      factor: 'Cycle Speed',
      factorValue: `${slowRecs.length} Records Affected`,
      metricAnalyzed: 'Cycle Time Deviation',
      metricValue: Math.round(avgActual * 10) / 10,
      averageBaseline: Math.round(avgIdeal * 10) / 10,
      differencePercent: Math.round(devPct * 10) / 10,
      contributionPercent: Math.round(affectedPct * 10) / 10,
      confidence: Math.min(90, Math.round(70 + devPct * 0.5)),
      evidence: `${slowRecs.length} of ${records.length} records (${affectedPct.toFixed(1)}%) show actual cycle time exceeding ideal by >5% — averaging ${avgActual.toFixed(1)}s vs ${avgIdeal.toFixed(1)}s ideal (+${(avgActual - avgIdeal).toFixed(1)}s, ${devPct.toFixed(1)}% slower). Affected machines: ${slowMachines.slice(0, 4).join(', ')}${slowMachines.length > 4 ? ` +${slowMachines.length - 4} more` : ''}.`,
    });
  }

  // Sort descending by contribution
  findings.sort((a, b) => b.contributionPercent - a.contributionPercent);
  return findings;
};

// ─── Per-machine deep analysis ────────────────────────────────────────────────

export const analyzeMachineRootCauses = (
  machineId: string,
  records: ProductionRecord[]
): MachineRootCause => {
  const allMachines = [...new Set(records.map((r) => r.machine_id))];
  const globalDt = records.reduce((s, r) => s + safe(r.downtime), 0);
  const ms = computeMachineStats(machineId, records);
  const downtimeShare = globalDt > 0 ? (ms.totalDowntime / globalDt) * 100 : 0;
  const throughputGapUnits = ms.totalTarget - ms.totalActual;
  const throughputGapPct = ms.totalTarget > 0 ? (throughputGapUnits / ms.totalTarget) * 100 : 0;

  // Cross-machine averages for comparison
  const allStats = allMachines.map((m) => computeMachineStats(m, records));
  const avgDt = allStats.reduce((s, m) => s + m.totalDowntime, 0) / Math.max(1, allStats.length);
  const avgAvail = allStats.filter(m => m.availabilityRate !== null).reduce((s, m) => s + (m.availabilityRate ?? 0), 0) / Math.max(1, allStats.filter(m => m.availabilityRate !== null).length);
  const avgDefectRate = allStats.filter(m => m.defectRate !== null).reduce((s, m) => s + (m.defectRate ?? 0), 0) / Math.max(1, allStats.filter(m => m.defectRate !== null).length);
  const avgCycleDev = allStats.filter(m => m.cycleDeviation !== null).reduce((s, m) => s + (m.cycleDeviation ?? 0), 0) / Math.max(1, allStats.filter(m => m.cycleDeviation !== null).length);

  // Build per-machine factors
  const factors: RootCauseFactor[] = [];

  // Downtime factor
  if (ms.totalDowntime > 0) {
    const dtDiff = avgDt > 0 ? ((ms.totalDowntime - avgDt) / avgDt) * 100 : 0;
    factors.push({
      factor: 'Machine',
      factorValue: machineId,
      metricAnalyzed: 'Total Downtime',
      metricValue: Math.round(ms.totalDowntime * 10) / 10,
      averageBaseline: Math.round(avgDt * 10) / 10,
      differencePercent: Math.round(dtDiff * 10) / 10,
      contributionPercent: Math.round(downtimeShare * 10) / 10,
      confidence: Math.min(95, Math.round(70 + Math.abs(dtDiff) * 0.2)),
      evidence: `${machineId} accumulated ${ms.totalDowntime.toFixed(0)} min of downtime across ${ms.records.length} production records (${downtimeShare.toFixed(1)}% of total). Fleet average: ${avgDt.toFixed(0)} min/machine (${dtDiff > 0 ? '+' : ''}${dtDiff.toFixed(1)}% vs avg). Availability: ${ms.availabilityRate != null ? ms.availabilityRate.toFixed(1) + '%' : 'N/A'}.`,
    });
  }

  // Top downtime reason
  if (ms.topReason) {
    const reasonShare = ms.totalDowntime > 0 ? (ms.topReasonDt / ms.totalDowntime) * 100 : 0;
    factors.push({
      factor: 'Downtime Reason',
      factorValue: ms.topReason,
      metricAnalyzed: 'Primary Stoppage Cause',
      metricValue: Math.round(ms.topReasonDt * 10) / 10,
      averageBaseline: 0,
      differencePercent: Math.round(reasonShare * 10) / 10,
      contributionPercent: Math.round(reasonShare * 10) / 10,
      confidence: Math.min(93, Math.round(74 + ms.topReasonCnt * 1.5)),
      evidence: `"${ms.topReason}" is the primary recorded failure for ${machineId} — ${ms.topReasonDt.toFixed(0)} min (${reasonShare.toFixed(1)}% of this machine's downtime) across ${ms.topReasonCnt} event(s). Addressing this root failure mode should yield the highest downtime recovery for this station.`,
    });
  }

  // Cycle speed factor
  if (ms.cycleDeviation !== null) {
    const cycleDiff = ms.cycleDeviation - avgCycleDev;
    factors.push({
      factor: 'Cycle Speed',
      factorValue: machineId,
      metricAnalyzed: 'Cycle Time vs Ideal',
      metricValue: Math.round((ms.avgActualCycle ?? 0) * 10) / 10,
      averageBaseline: Math.round((ms.avgIdealCycle ?? 0) * 10) / 10,
      differencePercent: Math.round(ms.cycleDeviation * 10) / 10,
      contributionPercent: Math.round(Math.abs(ms.cycleDeviation) * 10) / 10,
      confidence: 83,
      evidence: `${machineId} runs at ${(ms.avgActualCycle ?? 0).toFixed(1)}s/cycle vs ${(ms.avgIdealCycle ?? 0).toFixed(1)}s ideal — ${ms.cycleDeviation > 0 ? '+' : ''}${ms.cycleDeviation.toFixed(1)}% deviation. Fleet avg cycle deviation: ${avgCycleDev.toFixed(1)}%. Performance rate estimate: ${ms.performanceRate != null ? ms.performanceRate.toFixed(1) + '%' : 'N/A'}.`,
    });
  }

  // Quality / defect rate factor
  if (ms.defectRate !== null && ms.totalDefects > 0) {
    const defectDiff = avgDefectRate > 0 ? ((ms.defectRate - avgDefectRate) / avgDefectRate) * 100 : 0;
    factors.push({
      factor: 'Quality',
      factorValue: machineId,
      metricAnalyzed: 'Defect Rate',
      metricValue: Math.round(ms.defectRate * 100) / 100,
      averageBaseline: Math.round(avgDefectRate * 100) / 100,
      differencePercent: Math.round(defectDiff * 10) / 10,
      contributionPercent: Math.round(ms.defectRate * 100) / 100,
      confidence: 80,
      evidence: `${machineId} produced ${ms.totalDefects} defective units from ${ms.totalUnits.toFixed(0)} total (${ms.defectRate.toFixed(2)}% scrap rate). Fleet average: ${avgDefectRate.toFixed(2)}% (${defectDiff > 0 ? '+' : ''}${defectDiff.toFixed(1)}% vs avg). Quality rate: ${ms.qualityRate != null ? ms.qualityRate.toFixed(1) + '%' : 'N/A'}.`,
    });
  }

  // Throughput gap factor
  if (throughputGapUnits > 0) {
    const gapVsAvgPct = throughputGapPct;
    factors.push({
      factor: 'Machine',
      factorValue: `${machineId} — Output Gap`,
      metricAnalyzed: 'Throughput vs Target',
      metricValue: ms.totalActual,
      averageBaseline: ms.totalTarget,
      differencePercent: Math.round(-throughputGapPct * 10) / 10,
      contributionPercent: Math.round(throughputGapPct * 10) / 10,
      confidence: 88,
      evidence: `${machineId} produced ${ms.totalActual.toFixed(0)} units vs a target of ${ms.totalTarget.toFixed(0)} — a shortfall of ${throughputGapUnits.toFixed(0)} units (${throughputGapPct.toFixed(1)}% below target) across ${ms.records.length} production runs. This throughput gap directly constrains downstream flow.`,
    });
  }

  // Availability factor (if notably low vs fleet average)
  if (ms.availabilityRate !== null && avgAvail > 0 && ms.availabilityRate < avgAvail * 0.97) {
    const availDiff = ((ms.availabilityRate - avgAvail) / avgAvail) * 100;
    factors.push({
      factor: 'Machine',
      factorValue: `${machineId} — Availability`,
      metricAnalyzed: 'Availability Rate',
      metricValue: Math.round(ms.availabilityRate * 10) / 10,
      averageBaseline: Math.round(avgAvail * 10) / 10,
      differencePercent: Math.round(availDiff * 10) / 10,
      contributionPercent: Math.round(Math.abs(availDiff) * 10) / 10,
      confidence: 85,
      evidence: `${machineId} availability: ${ms.availabilityRate.toFixed(1)}% vs fleet average ${avgAvail.toFixed(1)}% (${availDiff.toFixed(1)}% below mean). Operating time: ${ms.totalOperating.toFixed(0)} min of ${ms.totalPlanned.toFixed(0)} min planned. This gap indicates disproportionate time lost to stoppages.`,
    });
  }

  factors.sort((a, b) => b.contributionPercent - a.contributionPercent);

  return {
    machineId,
    totalDowntime: Math.round(ms.totalDowntime * 10) / 10,
    downtimeShare: Math.round(downtimeShare * 10) / 10,
    avgActualCycle: ms.avgActualCycle != null ? Math.round(ms.avgActualCycle * 10) / 10 : null,
    avgIdealCycle: ms.avgIdealCycle != null ? Math.round(ms.avgIdealCycle * 10) / 10 : null,
    cycleDeviation: ms.cycleDeviation != null ? Math.round(ms.cycleDeviation * 10) / 10 : null,
    defectRate: ms.defectRate != null ? Math.round(ms.defectRate * 100) / 100 : null,
    throughputGapUnits,
    throughputGapPct: Math.round(throughputGapPct * 10) / 10,
    availabilityRate: ms.availabilityRate != null ? Math.round(ms.availabilityRate * 10) / 10 : null,
    performanceRate: ms.performanceRate != null ? Math.round(ms.performanceRate * 10) / 10 : null,
    qualityRate: ms.qualityRate != null ? Math.round(ms.qualityRate * 10) / 10 : null,
    oeeEstimate: ms.oeeEstimate,
    topDowntimeReason: ms.topReason,
    topDowntimeReasonMinutes: Math.round(ms.topReasonDt * 10) / 10,
    downtimeReasonCount: ms.topReasonCnt,
    totalRecords: ms.records.length,
    totalTarget: Math.round(ms.totalTarget),
    totalActual: Math.round(ms.totalActual),
    totalDefects: Math.round(ms.totalDefects),
    totalUnits: Math.round(ms.totalUnits),
    factors,
  };
};

/** All machines sorted by worst OEE-impact (downtime-first) */
export const getAllMachineRootCauses = (records: ProductionRecord[]): MachineRootCause[] => {
  const machines = [...new Set(records.map((r) => r.machine_id))];
  return machines
    .map((m) => analyzeMachineRootCauses(m, records))
    .sort((a, b) => {
      // Sort by: worst OEE first, then most downtime
      if (a.oeeEstimate !== null && b.oeeEstimate !== null) return a.oeeEstimate - b.oeeEstimate;
      return b.totalDowntime - a.totalDowntime;
    });
};
