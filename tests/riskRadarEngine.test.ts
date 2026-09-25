import { describe, it, expect } from 'vitest';
import { calculateProductionRiskRadar, classifyRiskScore } from '../src/engine/riskRadarEngine';
import { ProductionRecord } from '../src/types/database';

describe('riskRadarEngine', () => {
  it('correctly classifies risk score boundaries', () => {
    expect(classifyRiskScore(15)).toBe('LOW');
    expect(classifyRiskScore(29)).toBe('LOW');
    expect(classifyRiskScore(30)).toBe('MEDIUM');
    expect(classifyRiskScore(59)).toBe('MEDIUM');
    expect(classifyRiskScore(60)).toBe('HIGH');
    expect(classifyRiskScore(79)).toBe('HIGH');
    expect(classifyRiskScore(80)).toBe('CRITICAL');
    expect(classifyRiskScore(100)).toBe('CRITICAL');
  });

  it('handles empty production records safely without crashing', () => {
    const result = calculateProductionRiskRadar([]);
    expect(result.summary.totalActiveMachines).toBe(0);
    expect(result.risks).toHaveLength(0);
    expect(result.heatmap).toHaveLength(0);
    expect(result.hasSufficientHistoricalData).toBe(false);
  });

  it('accurately identifies unavailable categories when columns are absent', () => {
    // Only basic machine and output, no downtime, no ideal cycle, no quality, no target
    const records: ProductionRecord[] = [
      {
        dataset_id: 'ds-test',
        machine_id: 'CNC-01',
        actual_quantity: 100,
        planned_time: 480,
        operating_time: 480,
      },
    ];

    const result = calculateProductionRiskRadar(records);
    expect(result.summary.totalActiveMachines).toBe(1);
    expect(result.heatmap).toHaveLength(1);

    const mRow = result.heatmap[0];
    expect(mRow.downtime.available).toBe(false);
    expect(mRow.cycle.available).toBe(false);
    expect(mRow.quality.available).toBe(false);
    expect(mRow.target.available).toBe(false);
    expect(result.missingDataNotes.length).toBeGreaterThan(0);
  });

  it('calculates dynamic risk scores and evidence grounded in real historical trend', () => {
    // Machine M1: deteriorating downtime and declining output
    const records: ProductionRecord[] = [
      {
        dataset_id: 'ds-1',
        machine_id: 'M1',
        timestamp: '2026-09-01T08:00:00Z',
        planned_time: 480,
        operating_time: 440,
        downtime: 40,
        ideal_cycle_time: 10,
        actual_cycle_time: 11,
        good_units: 95,
        defective_units: 5,
        actual_quantity: 100,
        target_quantity: 120,
      },
      {
        dataset_id: 'ds-1',
        machine_id: 'M1',
        timestamp: '2026-09-02T08:00:00Z',
        planned_time: 480,
        operating_time: 430,
        downtime: 50,
        ideal_cycle_time: 10,
        actual_cycle_time: 12,
        good_units: 90,
        defective_units: 10,
        actual_quantity: 100,
        target_quantity: 120,
      },
      {
        dataset_id: 'ds-1',
        machine_id: 'M1',
        timestamp: '2026-09-03T08:00:00Z',
        planned_time: 480,
        operating_time: 320,
        downtime: 160, // Large downtime surge
        ideal_cycle_time: 10,
        actual_cycle_time: 16, // Cycle degradation
        good_units: 60,
        defective_units: 20, // Defect spike
        actual_quantity: 80,
        target_quantity: 120,
      },
    ];

    const result = calculateProductionRiskRadar(records);
    expect(result.hasSufficientHistoricalData).toBe(true);
    expect(result.summary.totalActiveMachines).toBe(1);
    expect(result.heatmap[0].machineId).toBe('M1');
    expect(result.heatmap[0].downtime.available).toBe(true);
    expect(result.heatmap[0].cycle.available).toBe(true);
    expect(result.heatmap[0].quality.available).toBe(true);
    expect(result.heatmap[0].target.available).toBe(true);

    // M1 has severe deterioration, so it should generate elevated risk scores
    expect(result.heatmap[0].compositeScore).toBeGreaterThanOrEqual(30);
    expect(result.risks.length).toBeGreaterThan(0);

    const downtimeRisk = result.risks.find((r) => r.category === 'downtime');
    expect(downtimeRisk).toBeDefined();
    expect(downtimeRisk?.evidenceMetrics.length).toBeGreaterThan(0);
    expect(downtimeRisk?.recommendation).toContain('Investigate recurring downtime events');
  });
});
