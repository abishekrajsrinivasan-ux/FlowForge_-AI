import { describe, it, expect } from 'vitest';
import { calculateOee } from '../src/engine/oeeEngine';
import { ProductionRecord } from '../src/types/database';

describe('OEE Calculation Engine', () => {
  it('correctly calculates Availability, Performance, Quality, and OEE', () => {
    // 480 planned mins, 420 operating mins -> Availability = 420 / 480 = 87.5%
    // 45s ideal cycle, 460 units -> Ideal seconds = 20,700s. Operating seconds = 420 * 60 = 25,200s. Performance = 20,700 / 25,200 = 82.14%
    // 452 good units, 460 total units -> Quality = 452 / 460 = 98.26%
    const records: ProductionRecord[] = [
      {
        dataset_id: 'test_ds',
        machine_id: 'Press-101',
        planned_time: 480,
        operating_time: 420,
        downtime: 60,
        ideal_cycle_time: 45,
        actual_cycle_time: 49,
        target_quantity: 500,
        actual_quantity: 460,
        total_units: 460,
        good_units: 452,
        defective_units: 8,
      },
    ];

    const result = calculateOee(records);

    expect(result.availability).toBe(87.5);
    expect(result.performance).toBeCloseTo(82.1, 0.5);
    expect(result.quality).toBeCloseTo(98.3, 0.5);
    expect(result.oee).toBeCloseTo(70.6, 1.0);
    expect(result.productionGap).toBe(40);
  });

  it('safely handles empty records without division by zero', () => {
    const result = calculateOee([]);
    expect(result.oee).toBeNull();
    expect(result.availability).toBeNull();
    expect(result.totalActualQuantity).toBe(0);
  });

  it('reports missing data without inventing fake replacement values', () => {
    // Dataset with machine and actual output, but no planned/operating time
    const records: ProductionRecord[] = [
      {
        dataset_id: 'test_ds',
        machine_id: 'Packaging-01',
        actual_quantity: 1200,
      },
    ];

    const result = calculateOee(records);
    expect(result.availability).toBeNull();
    expect(result.oee).toBeNull();
    expect(result.unavailabilityReasons.length).toBeGreaterThan(0);
  });
});
