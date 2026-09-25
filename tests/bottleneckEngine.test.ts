import { describe, it, expect } from 'vitest';
import { calculateBottlenecks } from '../src/engine/bottleneckEngine';
import { ProductionRecord } from '../src/types/database';

describe('Bottleneck Scoring & Ranking Engine', () => {
  it('correctly ranks the asset with highest combined constraints as #1 bottleneck', () => {
    const records: ProductionRecord[] = [
      // Machine A: High downtime (120m), large target gap
      {
        dataset_id: 'test',
        machine_id: 'Machine-A',
        planned_time: 480,
        operating_time: 360,
        downtime: 120,
        target_quantity: 500,
        actual_quantity: 380,
        total_units: 380,
        ideal_cycle_time: 45,
        actual_cycle_time: 55,
      },
      // Machine B: Smooth operation (20m downtime)
      {
        dataset_id: 'test',
        machine_id: 'Machine-B',
        planned_time: 480,
        operating_time: 460,
        downtime: 20,
        target_quantity: 500,
        actual_quantity: 490,
        total_units: 490,
        ideal_cycle_time: 45,
        actual_cycle_time: 46,
      },
    ];

    const result = calculateBottlenecks(records);

    expect(result.scores.length).toBe(2);
    expect(result.currentBottleneck?.machineId).toBe('Machine-A');
    expect(result.currentBottleneck?.rank).toBe(1);
    expect(result.currentBottleneck?.bottleneckScore).toBeGreaterThan(result.scores[1].bottleneckScore);
  });
});
