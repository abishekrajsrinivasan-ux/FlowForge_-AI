import { describe, it, expect } from 'vitest';
import { validateDataset } from '../src/engine/validator';
import { ProductionRecord } from '../src/types/database';

describe('Dataset Validation Engine', () => {
  it('flags missing machine IDs and invalid units', () => {
    const invalidRecords: ProductionRecord[] = [
      {
        dataset_id: 'test',
        machine_id: '', // Error: missing machine ID
        total_units: 100,
        good_units: 120, // Error: good > total
      },
      {
        dataset_id: 'test',
        machine_id: 'M-01',
        total_units: 100,
        good_units: 95,
        defective_units: -5, // Error: negative value
      },
    ];

    const result = validateDataset(invalidRecords, ['machine', 'total_units', 'good_units', 'defective_units']);

    expect(result.summary.invalidRows).toBe(2);
    expect(result.summary.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.summary.dataQualityScore).toBeLessThan(70);
  });

  it('calculates a 100% Data Quality Score for clean valid records', () => {
    const cleanRecords: ProductionRecord[] = [
      {
        dataset_id: 'test',
        machine_id: 'Press-1',
        planned_time: 480,
        operating_time: 420,
        total_units: 400,
        good_units: 395,
        defective_units: 5,
      },
    ];

    const result = validateDataset(cleanRecords, ['machine', 'planned_time', 'operating_time', 'total_units', 'good_units', 'defective_units']);

    expect(result.summary.dataQualityScore).toBe(100);
    expect(result.summary.validRows).toBe(1);
    expect(result.summary.errors.length).toBe(0);
  });
});
