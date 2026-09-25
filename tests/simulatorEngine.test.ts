import { describe, it, expect } from 'vitest';
import { simulateScenario } from '../src/engine/simulatorEngine';
import { ProductionRecord } from '../src/types/database';

describe('What-If Scenario Simulator Engine', () => {
  it('correctly models output gain from downtime reduction and cycle improvement', () => {
    const records: ProductionRecord[] = [
      {
        dataset_id: 'test',
        machine_id: 'Stamping-01',
        planned_time: 480,
        operating_time: 400,
        downtime: 80,
        actual_quantity: 400,
        total_units: 400,
        good_units: 380,
        defective_units: 20,
        ideal_cycle_time: 50,
        actual_cycle_time: 60,
        target_quantity: 500,
      },
    ];

    // Simulate 25% downtime reduction and 10% cycle improvement
    const result = simulateScenario(records, {
      downtimeReductionPercent: 25,
      cycleTimeImprovementPercent: 10,
      defectReductionPercent: 50,
    });

    expect(result.delta.downtimeSaved).toBe(20); // 25% of 80m = 20m saved
    expect(result.simulated.downtime).toBe(60);
    expect(result.delta.outputGain).toBeGreaterThan(0);
    expect(result.simulated.output).toBeGreaterThan(result.baseline.output);
    expect(result.delta.defectReductionUnits).toBe(10); // 50% of 20 defects = 10 units preserved
  });
});
