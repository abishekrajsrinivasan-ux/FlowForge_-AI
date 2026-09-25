import { ProductionRecord } from '../types/database';
import {
  ProductionRiskRadarResult,
  RiskRadarItem,
  MachineHeatmapRow,
  RiskTrendPoint,
  RiskSeverity,
  RiskCategory,
  EvidenceMetricItem,
  RiskEvidenceHighlight,
  MachineHeatmapCell,
} from '../types/analytics';
import { calculateOee } from './oeeEngine';
import { calculateBottlenecks } from './bottleneckEngine';
import { calculateLosses } from './lossEngine';

/**
 * Classifies a 0-100 risk score into standard severity tiers:
 * 0–29    LOW
 * 30–59   MEDIUM
 * 60–79   HIGH
 * 80–100  CRITICAL
 */
export const classifyRiskScore = (score: number): RiskSeverity => {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
};

/**
 * Core Production Risk Radar Calculation Engine
 * Strictly evidence-based, 100% deterministic, grounded in real uploaded data.
 */
export const calculateProductionRiskRadar = (
  records: ProductionRecord[]
): ProductionRiskRadarResult => {
  const missingDataNotes: string[] = [];

  if (!records || records.length === 0) {
    return {
      summary: {
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        stableCount: 0,
        totalActiveMachines: 0,
      },
      risks: [],
      heatmap: [],
      trend: [],
      hasSufficientHistoricalData: false,
      missingDataNotes: ['No production records provided for active filter selection.'],
    };
  }

  // 1. Group records by Machine
  const machineGroups = new Map<string, ProductionRecord[]>();
  for (const r of records) {
    const mId = r.machine_id;
    if (!mId) continue;
    if (!machineGroups.has(mId)) {
      machineGroups.set(mId, []);
    }
    machineGroups.get(mId)!.push(r);
  }

  const machineIds = Array.from(machineGroups.keys()).sort();

  if (machineIds.length === 0) {
    return {
      summary: {
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        stableCount: 0,
        totalActiveMachines: 0,
      },
      risks: [],
      heatmap: [],
      trend: [],
      hasSufficientHistoricalData: false,
      missingDataNotes: ['No identified machine identifiers in current dataset records.'],
    };
  }

  // Check dataset-wide data availability
  const hasAnyDowntime = records.some(
    (r) => r.downtime !== null && r.downtime !== undefined && !isNaN(Number(r.downtime))
  );
  const hasAnyIdealCycle = records.some(
    (r) =>
      r.ideal_cycle_time !== null &&
      r.ideal_cycle_time !== undefined &&
      Number(r.ideal_cycle_time) > 0
  );
  const hasAnyQuality = records.some(
    (r) =>
      (r.defective_units !== null && r.defective_units !== undefined) ||
      (r.rework !== null && r.rework !== undefined) ||
      (r.good_units !== null && r.good_units !== undefined && r.total_units !== null)
  );
  const hasAnyTarget = records.some(
    (r) =>
      r.target_quantity !== null &&
      r.target_quantity !== undefined &&
      Number(r.target_quantity) > 0
  );

  if (!hasAnyDowntime) {
    missingDataNotes.push('Downtime risk unavailable — downtime data not provided.');
  }
  if (!hasAnyIdealCycle) {
    missingDataNotes.push('Cycle-time risk unavailable — ideal cycle-time data not provided.');
  }
  if (!hasAnyQuality) {
    missingDataNotes.push('Quality risk unavailable — quality data not provided.');
  }
  if (!hasAnyTarget) {
    missingDataNotes.push('Target achievement risk unavailable — target quantity data not provided.');
  }

  // Check historical timestamp availability
  const datedRecords = records.filter((r) => r.timestamp || r.date);
  const hasSufficientHistoricalData =
    datedRecords.length >= 2 ||
    Array.from(machineGroups.values()).some((recs) => recs.length >= 2);

  if (!hasSufficientHistoricalData) {
    missingDataNotes.push('Insufficient historical data for trend-based risk detection.');
  }

  const generatedRisks: RiskRadarItem[] = [];
  const heatmapRows: MachineHeatmapRow[] = [];

  // Ground Risk Radar in FLOWFORGE AI's established bottleneck and loss analysis engines
  const bottleneckResult = calculateBottlenecks(records);
  const lossResult = calculateLosses(records);
  const bScoreMap = new Map(bottleneckResult.scores.map((s) => [s.machineId, s]));
  const topParetoReason = lossResult.paretoReasons.length > 0 ? lossResult.paretoReasons[0] : null;

  // Helper to split a machine's records into previous and current halves chronologically
  const splitChronologically = (recs: ProductionRecord[]) => {
    const sorted = [...recs].sort((a, b) => {
      const timeA = new Date(a.timestamp || a.date || 0).getTime();
      const timeB = new Date(b.timestamp || b.date || 0).getTime();
      return timeA - timeB;
    });

    if (sorted.length <= 1) {
      return { prev: sorted, curr: sorted, isSplit: false };
    }

    const midpoint = Math.floor(sorted.length / 2);
    const prev = sorted.slice(0, midpoint);
    const curr = sorted.slice(midpoint);
    return { prev, curr, isSplit: true };
  };

  // 2. Analyze Each Machine
  for (const mId of machineIds) {
    const mRecords = machineGroups.get(mId)!;
    const lineId = mRecords[0]?.line_id ?? null;
    const { prev, curr, isSplit } = splitChronologically(mRecords);

    const prevOee = calculateOee(prev);
    const currOee = calculateOee(curr);
    const totalOee = calculateOee(mRecords);
    const bScore = bScoreMap.get(mId);

    // ====================================================
    // A. BOTTLENECK RISK
    // ====================================================
    let bottleneckScore = 15; // baseline low
    const bottleneckHighlights: RiskEvidenceHighlight[] = [];
    const bottleneckEvidenceMetrics: EvidenceMetricItem[] = [];

    // Base score derived directly from FLOWFORGE AI Bottleneck Engine
    if (bScore) {
      if (bScore.rank === 1 || bScore.isCurrentBottleneck) {
        if (bScore.bottleneckScore >= 45) {
          bottleneckScore = Math.min(95, Math.round(80 + (bScore.bottleneckScore - 45) * 0.4));
        } else if (bScore.bottleneckScore >= 25) {
          bottleneckScore = Math.min(79, Math.round(65 + (bScore.bottleneckScore - 25) * 0.7));
        } else {
          bottleneckScore = 45;
        }
      } else if (bScore.rank === 2) {
        if (bScore.bottleneckScore >= 40) {
          bottleneckScore = Math.min(78, Math.round(62 + (bScore.bottleneckScore - 40) * 0.5));
        } else {
          bottleneckScore = Math.min(58, Math.round(35 + bScore.bottleneckScore * 0.5));
        }
      } else if (bScore.bottleneckScore >= 30) {
        bottleneckScore = Math.min(59, Math.round(30 + (bScore.bottleneckScore - 30) * 0.6));
      } else {
        bottleneckScore = Math.max(10, Math.round(bScore.bottleneckScore * 0.8));
      }
    }

    // OEE Comparison
    const pOee = prevOee.oee ?? 75;
    const cOee = currOee.oee ?? 75;
    const oeeDiff = Math.round((cOee - pOee) * 10) / 10;

    bottleneckEvidenceMetrics.push({
      name: 'OEE',
      previous: `${pOee.toFixed(1)}%`,
      current: `${cOee.toFixed(1)}%`,
      change: `${oeeDiff >= 0 ? '+' : ''}${oeeDiff.toFixed(1)} percentage points`,
      isDeteriorating: oeeDiff < -2,
    });

    if (bScore && (bScore.rank === 1 || bScore.bottleneckScore >= 35)) {
      bottleneckHighlights.push({
        label: 'Constraint Rank',
        change: `#${bScore.rank} Bottleneck`,
        isDeteriorating: true,
        prefix: '↑',
      });
      bottleneckHighlights.push({
        label: 'Bottleneck Score',
        change: `${bScore.bottleneckScore}/100`,
        isDeteriorating: true,
        prefix: '↑',
      });
    }

    if (oeeDiff < -2) {
      bottleneckHighlights.push({
        label: 'OEE Trend',
        change: `${oeeDiff.toFixed(1)}%`,
        isDeteriorating: true,
        prefix: '↓',
      });
      bottleneckScore += Math.min(15, Math.abs(oeeDiff) * 1.5);
    } else if (oeeDiff > 2) {
      bottleneckHighlights.push({
        label: 'OEE Trend',
        change: `+${oeeDiff.toFixed(1)}%`,
        isDeteriorating: false,
        prefix: '↑',
      });
      bottleneckScore = Math.max(10, bottleneckScore - 10);
    }

    // Downtime Comparison
    const pDt = prevOee.totalDowntime;
    const cDt = currOee.totalDowntime;
    let dtPctChange = 0;
    if (pDt > 0) {
      dtPctChange = Math.round(((cDt - pDt) / pDt) * 100);
    } else if (cDt > 0) {
      dtPctChange = 100;
    }

    bottleneckEvidenceMetrics.push({
      name: 'Downtime',
      previous: `${(pDt / 60).toFixed(1)}h (${Math.round(pDt)}m)`,
      current: `${(cDt / 60).toFixed(1)}h (${Math.round(cDt)}m)`,
      change: `${dtPctChange >= 0 ? '+' : ''}${dtPctChange}%`,
      isDeteriorating: dtPctChange > 5,
    });

    if (dtPctChange > 5 && isSplit) {
      bottleneckHighlights.push({
        label: 'Downtime Variance',
        change: `+${dtPctChange}%`,
        isDeteriorating: true,
        prefix: '↑',
      });
      bottleneckScore += Math.min(15, (dtPctChange / 100) * 15);
    }

    if (bScore && bScore.totalDowntime > 0) {
      bottleneckEvidenceMetrics.push({
        name: 'Total Stoppage Time',
        previous: 'Nominal Standard',
        current: `${Math.round(bScore.totalDowntime)}m (${(bScore.totalDowntime / 60).toFixed(1)}h)`,
        change: `Dominant loss: ${bScore.primaryObservedLoss}`,
        isDeteriorating: bScore.totalDowntime > 500,
      });
    }

    // Output / Throughput Loss
    const pOut = prevOee.totalActualQuantity;
    const cOut = currOee.totalActualQuantity;
    let outPctChange = 0;
    if (pOut > 0) {
      outPctChange = Math.round(((cOut - pOut) / pOut) * 100);
    }

    bottleneckEvidenceMetrics.push({
      name: 'Throughput Output',
      previous: `${pOut.toLocaleString()} units`,
      current: `${cOut.toLocaleString()} units`,
      change: `${outPctChange >= 0 ? '+' : ''}${outPctChange}%`,
      isDeteriorating: outPctChange < -5,
    });

    if (outPctChange < -3) {
      bottleneckHighlights.push({
        label: 'Output',
        change: `${outPctChange}%`,
        isDeteriorating: true,
        prefix: '↓',
      });
      bottleneckScore += Math.min(15, Math.abs(outPctChange) * 1.0);
    }

    bottleneckScore = Math.min(100, Math.max(5, Math.round(bottleneckScore)));
    const bottleneckSeverity = classifyRiskScore(bottleneckScore);

    const bottleneckCell: MachineHeatmapCell = {
      severity: bottleneckSeverity,
      score: bottleneckScore,
      available: true,
    };

    if (bottleneckScore >= 30) {
      const isTopConstraint = bScore?.rank === 1 || bScore?.isCurrentBottleneck;
      generatedRisks.push({
        id: `risk-bottleneck-${mId}`,
        machineId: mId,
        lineId,
        category: 'bottleneck',
        categoryLabel: 'Bottleneck Risk',
        title: isTopConstraint
          ? `Primary Production Constraint on Machine ${mId}`
          : `Bottleneck Throttling on Machine ${mId}`,
        riskScore: bottleneckScore,
        severity: bottleneckSeverity,
        evidenceHighlights: bottleneckHighlights,
        evidenceMetrics: bottleneckEvidenceMetrics,
        recommendation: `Conduct focused kaizen on ${mId}. Prioritize root-cause elimination for ${bScore?.primaryObservedLoss || 'downtime & stoppages'} and implement buffer management upstream.`,
        details: isTopConstraint
          ? `Machine ${mId} ranks #1 constraint with a FLOWFORGE AI Bottleneck Score of ${bScore?.bottleneckScore ?? bottleneckScore}/100. Recorded ${Math.round(bScore?.totalDowntime ?? (cDt + pDt))}m downtime and ${cOee.toFixed(1)}% OEE. Primary observed loss: ${bScore?.primaryObservedLoss || 'Downtime & Stoppages'}.`
          : `Machine ${mId} exhibits bottleneck constraint characteristics with elevated stoppage time (${Math.round(bScore?.totalDowntime ?? (cDt + pDt))}m) and ${cOee.toFixed(1)}% OEE.`,
        isDataAvailable: true,
        suggestedSimLever: {
          downtimeReductionPercent: 25,
          cycleImprovementPercent: 10,
        },
      });
    }

    // ====================================================
    // B. DOWNTIME RISK
    // ====================================================
    const machineHasDowntime = mRecords.some(
      (r) => r.downtime !== null && r.downtime !== undefined && !isNaN(Number(r.downtime))
    );

    let downtimeCell: MachineHeatmapCell;
    if (!machineHasDowntime) {
      downtimeCell = {
        severity: 'LOW',
        score: 0,
        available: false,
        unavailableReason: 'Downtime risk unavailable — downtime data not provided.',
      };
    } else {
      let dtScore = 15;
      const mDowntime = totalOee.totalDowntime;
      const mDowntimeHours = mDowntime / 60;
      const totalPlanned = totalOee.totalPlannedTime || (totalOee.totalOperatingTime + mDowntime);
      const dtRatio = totalPlanned > 0 ? (mDowntime / totalPlanned) * 100 : 0;

      // Heavy chronic downtime detection based on total recorded lost time & proportion
      if (mDowntime >= 4000 || dtRatio >= 35) {
        dtScore = Math.min(95, Math.round(80 + Math.min(15, (mDowntime - 4000) / 200)));
      } else if (mDowntime >= 2000 || dtRatio >= 20) {
        dtScore = Math.min(79, Math.round(60 + Math.min(19, (mDowntime - 2000) / 100)));
      } else if (mDowntime >= 500 || dtRatio >= 10) {
        dtScore = Math.min(59, Math.round(35 + Math.min(24, (mDowntime - 500) / 50)));
      }

      const prevDtHours = prevOee.totalDowntime / 60;
      const currDtHours = currOee.totalDowntime / 60;
      let dtTrend: 'Increasing' | 'Stable' | 'Decreasing' = 'Stable';

      let dtTrendPct = 0;
      if (prevDtHours > 0) {
        dtTrendPct = Math.round(((currDtHours - prevDtHours) / prevDtHours) * 100);
      } else if (currDtHours > 0) {
        dtTrendPct = 100;
      }

      if (dtTrendPct > 10) {
        dtTrend = 'Increasing';
        dtScore = Math.min(100, dtScore + Math.min(20, Math.round(dtTrendPct * 0.4)));
      } else if (dtTrendPct < -10) {
        dtTrend = 'Decreasing';
        dtScore = Math.max(10, dtScore - 10);
      }

      dtScore = Math.min(100, Math.max(5, Math.round(dtScore)));
      const dtSeverity = classifyRiskScore(dtScore);

      downtimeCell = {
        severity: dtSeverity,
        score: dtScore,
        available: true,
      };

      if (dtScore >= 30) {
        const dtHighlights: RiskEvidenceHighlight[] = [
          {
            label: 'Recorded Downtime',
            change: `${Math.round(mDowntime)}m (${mDowntimeHours.toFixed(1)}h)`,
            isDeteriorating: mDowntime > 500,
            prefix: '↑',
          },
        ];

        if (dtRatio > 10) {
          dtHighlights.push({
            label: 'Downtime Ratio',
            change: `${dtRatio.toFixed(1)}% of planned time`,
            isDeteriorating: dtRatio > 20,
            prefix: '↑',
          });
        }

        if (dtTrendPct !== 0 && isSplit) {
          dtHighlights.push({
            label: 'Trend Variance',
            change: `${dtTrendPct >= 0 ? '+' : ''}${dtTrendPct}%`,
            isDeteriorating: dtTrend === 'Increasing',
            prefix: dtTrend === 'Increasing' ? '↑' : '↓',
          });
        }

        const stoppageTitle =
          topParetoReason && topParetoReason.percentage >= 30 && dtScore >= 70
            ? `Dominant Stoppage Cause: "${topParetoReason.reason}" on Machine ${mId}`
            : `Elevated Downtime & Stoppage Risk (${Math.round(mDowntime)}m) on Machine ${mId}`;

        generatedRisks.push({
          id: `risk-downtime-${mId}`,
          machineId: mId,
          lineId,
          category: 'downtime',
          categoryLabel: 'Downtime Risk',
          title: stoppageTitle,
          riskScore: dtScore,
          severity: dtSeverity,
          evidenceHighlights: dtHighlights,
          evidenceMetrics: [
            {
              name: 'Total Cumulative Downtime',
              previous: isSplit ? `${prevDtHours.toFixed(1)}h` : 'Baseline Threshold',
              current: `${mDowntimeHours.toFixed(1)} hours (${Math.round(mDowntime)} mins)`,
              change: isSplit ? `${dtTrendPct >= 0 ? '+' : ''}${dtTrendPct}% (${dtTrend})` : `${Math.round(mDowntime)} mins recorded`,
              isDeteriorating: mDowntime > 500,
            },
            {
              name: 'Downtime / Operating Ratio',
              previous: 'Target: <10%',
              current: `${dtRatio.toFixed(1)}%`,
              change: `${dtRatio > 10 ? '+' : ''}${(dtRatio - 10).toFixed(1)}% above nominal threshold`,
              isDeteriorating: dtRatio > 10,
            },
            ...(topParetoReason
              ? [
                  {
                    name: 'Dominant Stoppage Mode',
                    previous: 'Pareto #1',
                    current: topParetoReason.reason,
                    change: `${topParetoReason.value} mins (${topParetoReason.percentage}% of all stoppages)`,
                    isDeteriorating: true,
                  },
                ]
              : []),
          ],
          recommendation: `Investigate recurring downtime events and deploy 5-Why problem-solving on ${mId}. Establish standard operating procedures (SOPs) and verify sensor/mechanical calibration.`,
          details: `Machine ${mId} recorded ${Math.round(mDowntime)} minutes of lost production time (${dtRatio.toFixed(1)}% of planned time). ${topParetoReason ? `Pareto analysis identifies "${topParetoReason.reason}" as dominant stoppage cause responsible for ${topParetoReason.value}m (${topParetoReason.percentage}% of all recorded lost production time).` : ''}`,
          isDataAvailable: true,
          suggestedSimLever: {
            downtimeReductionPercent: 25,
          },
        });
      }
    }

    // ====================================================
    // C. CYCLE-TIME RISK
    // ====================================================
    const machineHasIdealCycle = mRecords.some(
      (r) =>
        r.ideal_cycle_time !== null &&
        r.ideal_cycle_time !== undefined &&
        Number(r.ideal_cycle_time) > 0
    );

    let cycleCell: MachineHeatmapCell;
    if (!machineHasIdealCycle) {
      cycleCell = {
        severity: 'LOW',
        score: 0,
        available: false,
        unavailableReason: 'Cycle-time risk unavailable — ideal cycle-time data not provided.',
      };
    } else {
      let cycleScore = 10;
      const prevActCycle = prevOee.averageActualCycleTime ?? 0;
      const prevIdealCycle = prevOee.averageIdealCycleTime ?? 0;
      const currActCycle = currOee.averageActualCycleTime ?? 0;
      const currIdealCycle = currOee.averageIdealCycleTime ?? 0;

      const prevDevPct =
        prevIdealCycle > 0 ? ((prevActCycle - prevIdealCycle) / prevIdealCycle) * 100 : 0;
      const currDevPct =
        currIdealCycle > 0 ? ((currActCycle - currIdealCycle) / currIdealCycle) * 100 : 0;

      const devDiff = Math.round((currDevPct - prevDevPct) * 10) / 10;

      if (currDevPct > 0) {
        cycleScore += Math.min(50, currDevPct * 2);
      }
      if (devDiff > 2) {
        cycleScore += Math.min(30, devDiff * 2.5);
      } else if (devDiff < -2) {
        cycleScore = Math.max(5, cycleScore - 10);
      }

      cycleScore = Math.min(100, Math.max(5, Math.round(cycleScore)));
      const cycleSeverity = classifyRiskScore(cycleScore);

      cycleCell = {
        severity: cycleSeverity,
        score: cycleScore,
        available: true,
      };

      if (cycleScore >= 30) {
        generatedRisks.push({
          id: `risk-cycle-${mId}`,
          machineId: mId,
          lineId,
          category: 'cycle_time',
          categoryLabel: 'Cycle-Time Risk',
          title: 'Cycle-Time Deviation Escalation',
          riskScore: cycleScore,
          severity: cycleSeverity,
          evidenceHighlights: [
            {
              label: 'Cycle deviation',
              change: `${currDevPct >= 0 ? '+' : ''}${currDevPct.toFixed(1)}%`,
              isDeteriorating: currDevPct > 5,
              prefix: '↑',
            },
            {
              label: 'Deviation Δ',
              change: `${devDiff >= 0 ? '+' : ''}${devDiff.toFixed(1)}%`,
              isDeteriorating: devDiff > 2,
              prefix: devDiff > 0 ? '↑' : '↓',
            },
          ],
          evidenceMetrics: [
            {
              name: 'Previous Cycle Deviation',
              previous: `${prevActCycle.toFixed(1)}s (Ideal: ${prevIdealCycle.toFixed(1)}s)`,
              current: `${currActCycle.toFixed(1)}s (Ideal: ${currIdealCycle.toFixed(1)}s)`,
              change: `${devDiff >= 0 ? '+' : ''}${devDiff.toFixed(1)} percentage points`,
              isDeteriorating: devDiff > 2,
            },
            {
              name: 'Cycle Deviation %',
              previous: `${prevDevPct.toFixed(1)}%`,
              current: `${currDevPct.toFixed(1)}%`,
              change: `${(currDevPct - prevDevPct).toFixed(1)}%`,
              isDeteriorating: currDevPct > prevDevPct,
            },
          ],
          recommendation: `Consider reviewing feed speeds, tooling wear, and sensor timing on ${mId} to normalize cycle rate.`,
          details: `Cycle deviation increased from ${prevDevPct.toFixed(1)}% to ${currDevPct.toFixed(1)}% against standard ideal cycle time of ${currIdealCycle.toFixed(1)}s.`,
          isDataAvailable: true,
          suggestedSimLever: {
            cycleImprovementPercent: 15,
          },
        });
      }
    }

    // ====================================================
    // D. QUALITY RISK
    // ====================================================
    const machineHasQuality = mRecords.some(
      (r) =>
        (r.defective_units !== null && r.defective_units !== undefined) ||
        (r.rework !== null && r.rework !== undefined) ||
        (r.good_units !== null && r.good_units !== undefined)
    );

    let qualityCell: MachineHeatmapCell;
    if (!machineHasQuality) {
      qualityCell = {
        severity: 'LOW',
        score: 0,
        available: false,
        unavailableReason: 'Quality risk unavailable — quality data not provided.',
      };
    } else {
      let qScore = 10;
      const prevDefectRate = prevOee.defectRate ?? 0;
      const currDefectRate = currOee.defectRate ?? 0;
      const defectDiff = Math.round((currDefectRate - prevDefectRate) * 10) / 10;

      // Score proportional to defect rate level and trend
      qScore += Math.min(60, currDefectRate * 12);
      if (defectDiff > 0.5) {
        qScore += Math.min(30, defectDiff * 15);
      } else if (defectDiff < -0.5) {
        qScore = Math.max(5, qScore - 10);
      }

      qScore = Math.min(100, Math.max(5, Math.round(qScore)));
      const qSeverity = classifyRiskScore(qScore);

      qualityCell = {
        severity: qSeverity,
        score: qScore,
        available: true,
      };

      if (qScore >= 30) {
        generatedRisks.push({
          id: `risk-quality-${mId}`,
          machineId: mId,
          lineId,
          category: 'quality',
          categoryLabel: 'Quality Risk',
          title: 'Defect & Scrap Rate Deterioration',
          riskScore: qScore,
          severity: qSeverity,
          evidenceHighlights: [
            {
              label: 'Defect Rate',
              change: `${currDefectRate.toFixed(2)}%`,
              isDeteriorating: currDefectRate > 2,
              prefix: '↑',
            },
            {
              label: 'Defect Δ',
              change: `${defectDiff >= 0 ? '+' : ''}${defectDiff.toFixed(2)}%`,
              isDeteriorating: defectDiff > 0.5,
              prefix: defectDiff > 0 ? '↑' : '↓',
            },
          ],
          evidenceMetrics: [
            {
              name: 'Defect Rate',
              previous: `${prevDefectRate.toFixed(2)}% (${prevOee.totalDefectiveUnits} units)`,
              current: `${currDefectRate.toFixed(2)}% (${currOee.totalDefectiveUnits} units)`,
              change: `${defectDiff >= 0 ? '+' : ''}${defectDiff.toFixed(2)} percentage points`,
              isDeteriorating: defectDiff > 0.5,
            },
            {
              name: 'Good Production Yield',
              previous: `${prevOee.quality !== null ? prevOee.quality.toFixed(1) : 'N/A'}%`,
              current: `${currOee.quality !== null ? currOee.quality.toFixed(1) : 'N/A'}%`,
              change: `${currOee.quality !== null && prevOee.quality !== null ? (currOee.quality - prevOee.quality >= 0 ? '+' : '') + (currOee.quality - prevOee.quality).toFixed(1) + '%' : 'N/A'}`,
              isDeteriorating: (currOee.quality ?? 100) < (prevOee.quality ?? 100),
            },
          ],
          recommendation: `Review scrap and reject logs for ${mId}. Investigate parameter drift or raw material batch variance.`,
          details: `Defect rate observed at ${currDefectRate.toFixed(2)}% (changed from ${prevDefectRate.toFixed(2)}%), indicating potential quality containment risk.`,
          isDataAvailable: true,
          suggestedSimLever: {
            defectReductionPercent: 30,
          },
        });
      }
    }

    // ====================================================
    // E. TARGET ACHIEVEMENT RISK
    // ====================================================
    const machineHasTarget = mRecords.some(
      (r) =>
        r.target_quantity !== null &&
        r.target_quantity !== undefined &&
        Number(r.target_quantity) > 0
    );

    let targetCell: MachineHeatmapCell;
    if (!machineHasTarget) {
      targetCell = {
        severity: 'LOW',
        score: 0,
        available: false,
        unavailableReason: 'Target achievement risk unavailable — target quantity data not provided.',
      };
    } else {
      let tScore = 15;
      const targetQty = totalOee.totalTargetQuantity;
      const actualQty = totalOee.totalActualQuantity;
      const plannedTimeHours = Math.max(0.5, totalOee.totalPlannedTime / 60);
      const operatingTimeHours = Math.max(0.5, totalOee.totalOperatingTime / 60);

      const requiredRate = Math.round(targetQty / plannedTimeHours);
      const currentRate = Math.round(actualQty / operatingTimeHours);

      const shortfallRate = requiredRate > 0 ? ((requiredRate - currentRate) / requiredRate) * 100 : 0;
      const quantityGap = Math.max(0, targetQty - actualQty);

      if (shortfallRate > 0) {
        tScore += Math.min(65, shortfallRate * 1.3);
      } else {
        tScore = Math.max(5, tScore - 10);
      }

      tScore = Math.min(100, Math.max(5, Math.round(tScore)));
      const tSeverity = classifyRiskScore(tScore);

      targetCell = {
        severity: tSeverity,
        score: tScore,
        available: true,
      };

      if (tScore >= 30) {
        generatedRisks.push({
          id: `risk-target-${mId}`,
          machineId: mId,
          lineId,
          category: 'target_achievement',
          categoryLabel: 'Target Risk',
          title: 'Elevated risk of missing the selected production target',
          riskScore: tScore,
          severity: tSeverity,
          evidenceHighlights: [
            {
              label: 'Pace Shortfall',
              change: `-${Math.round(shortfallRate)}%`,
              isDeteriorating: shortfallRate > 5,
              prefix: '↓',
            },
            {
              label: 'Unit Gap',
              change: `-${quantityGap.toLocaleString()} units`,
              isDeteriorating: quantityGap > 0,
              prefix: '↓',
            },
          ],
          evidenceMetrics: [
            {
              name: 'Target Quantity',
              previous: `${targetQty.toLocaleString()} units`,
              current: `${actualQty.toLocaleString()} actual`,
              change: `Shortfall of ${quantityGap.toLocaleString()} units`,
              isDeteriorating: quantityGap > 0,
            },
            {
              name: 'Pace Comparison',
              previous: `${requiredRate} units/hr (Required)`,
              current: `${currentRate} units/hr (Current)`,
              change: `${currentRate < requiredRate ? '-' : '+'}${Math.abs(currentRate - requiredRate)} units/hr`,
              isDeteriorating: currentRate < requiredRate,
            },
          ],
          recommendation: `Consider line pace rebalancing and minimizing switchover interruptions to recover target volume on ${mId}.`,
          details: `Target: ${targetQty.toLocaleString()} units. Current rate: ${currentRate} units/hour vs Required rate: ${requiredRate} units/hour. Elevated risk of missing the selected production target.`,
          isDataAvailable: true,
          suggestedSimLever: {
            downtimeReductionPercent: 20,
            cycleImprovementPercent: 10,
          },
        });
      }
    }

    // Calculate Machine Composite Score
    const availableScores = [
      bottleneckCell.score,
      downtimeCell.available ? downtimeCell.score : null,
      cycleCell.available ? cycleCell.score : null,
      qualityCell.available ? qualityCell.score : null,
      targetCell.available ? targetCell.score : null,
    ].filter((s): s is number => s !== null);

    const maxScore = Math.max(...availableScores);
    const avgScore =
      availableScores.length > 0
        ? availableScores.reduce((a, b) => a + b, 0) / availableScores.length
        : bottleneckCell.score;

    // The machine's composite score is weighted towards its primary constraint (70% peak constraint, 30% average)
    const compositeScore = Math.round(maxScore * 0.7 + avgScore * 0.3);
    const compositeSeverity =
      maxScore >= 80 ? 'CRITICAL' : maxScore >= 60 ? 'HIGH' : classifyRiskScore(compositeScore);

    heatmapRows.push({
      machineId: mId,
      lineId,
      bottleneck: bottleneckCell,
      downtime: downtimeCell,
      cycle: cycleCell,
      quality: qualityCell,
      target: targetCell,
      compositeScore,
      compositeSeverity,
    });
  }

  // Sort risks by highest risk score first
  generatedRisks.sort((a, b) => b.riskScore - a.riskScore);

  // Sort heatmap rows by highest composite score first
  heatmapRows.sort((a, b) => b.compositeScore - a.compositeScore);

  // 3. Calculate Summary Counts
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let stableCount = 0;

  for (const row of heatmapRows) {
    if (row.compositeSeverity === 'CRITICAL') criticalCount++;
    else if (row.compositeSeverity === 'HIGH') highCount++;
    else if (row.compositeSeverity === 'MEDIUM') mediumCount++;
    else stableCount++;
  }

  // 4. Calculate Risk Trend Time-Series
  const trendPoints: RiskTrendPoint[] = [];

  if (datedRecords.length >= 2) {
    const sortedDated = [...datedRecords].sort((a, b) => {
      const tA = new Date(a.timestamp || a.date || 0).getTime();
      const tB = new Date(b.timestamp || b.date || 0).getTime();
      return tA - tB;
    });

    const bucketCount = Math.min(6, Math.max(2, Math.floor(sortedDated.length / 3)));
    const bucketSize = Math.ceil(sortedDated.length / bucketCount);

    for (let i = 0; i < bucketCount; i++) {
      const slice = sortedDated.slice(i * bucketSize, (i + 1) * bucketSize);
      if (slice.length === 0) continue;

      const representative = slice[Math.floor(slice.length / 2)];
      const rawDateStr = representative.date || representative.timestamp || `Period ${i + 1}`;
      let label = rawDateStr;
      try {
        const d = new Date(rawDateStr);
        if (!isNaN(d.getTime())) {
          label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        }
      } catch {
        label = `Period ${i + 1}`;
      }

      // Calculate localized risk scores for this historical slice
      const sliceOee = calculateOee(slice);
      const machineScores: Record<string, number> = {};

      for (const mId of machineIds) {
        const mSlice = slice.filter((r) => r.machine_id === mId);
        if (mSlice.length > 0) {
          const mOee = calculateOee(mSlice);
          const dtLoss = mOee.totalPlannedTime > 0 ? (mOee.totalDowntime / mOee.totalPlannedTime) * 100 : 20;
          const oeeLoss = mOee.oee !== null ? Math.max(0, 100 - mOee.oee) : 30;
          const mScore = Math.min(100, Math.max(5, Math.round(oeeLoss * 0.6 + dtLoss * 0.4)));
          machineScores[mId] = mScore;
        } else {
          machineScores[mId] = 20;
        }
      }

      const oeeLossOverall = sliceOee.oee !== null ? Math.max(0, 100 - sliceOee.oee) : 35;
      const dtLossOverall =
        sliceOee.totalPlannedTime > 0
          ? (sliceOee.totalDowntime / sliceOee.totalPlannedTime) * 100
          : 25;

      const overallScore = Math.min(
        100,
        Math.max(10, Math.round(oeeLossOverall * 0.55 + dtLossOverall * 0.45))
      );

      const categoryScores: Record<RiskCategory, number> = {
        bottleneck: Math.min(100, Math.max(10, Math.round(oeeLossOverall * 0.8 + 10))),
        downtime: Math.min(100, Math.max(10, Math.round(dtLossOverall * 1.5 + 5))),
        cycle_time:
          sliceOee.cycleTimeDeviation !== null
            ? Math.min(100, Math.max(5, Math.round(sliceOee.cycleTimeDeviation * 2.5 + 10)))
            : 0,
        quality:
          sliceOee.defectRate !== null
            ? Math.min(100, Math.max(5, Math.round(sliceOee.defectRate * 10 + 10)))
            : 0,
        target_achievement:
          sliceOee.targetAchievementRate !== null
            ? Math.min(100, Math.max(5, Math.round(Math.max(0, 100 - sliceOee.targetAchievementRate))))
            : 20,
      };

      trendPoints.push({
        timestamp: rawDateStr,
        label,
        overallScore,
        machineScores,
        categoryScores,
      });
    }
  }

  return {
    summary: {
      criticalCount,
      highCount,
      mediumCount,
      stableCount,
      totalActiveMachines: machineIds.length,
    },
    risks: generatedRisks,
    heatmap: heatmapRows,
    trend: trendPoints,
    hasSufficientHistoricalData,
    missingDataNotes,
  };
};
