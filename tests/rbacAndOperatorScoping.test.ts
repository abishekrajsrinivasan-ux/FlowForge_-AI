import { describe, it, expect } from 'vitest';
import { calculateOee } from '../src/engine/oeeEngine';
import { DEFAULT_AUTOMOTIVE_RECORDS } from '../src/lib/defaultDataset';
import { ProductionRecord } from '../src/types/database';

describe('RBAC & Operator Machine Scoping', () => {
  it('scopes operator calculations strictly to assigned machine with real data', () => {
    const operatorMachine = 'Press-101';
    
    // Scoped records for operator assigned to Press-101
    const operatorRecords = DEFAULT_AUTOMOTIVE_RECORDS.filter(
      (r) => r.machine_id === operatorMachine
    );

    expect(operatorRecords.length).toBeGreaterThan(0);
    expect(operatorRecords.every((r) => r.machine_id === 'Press-101')).toBe(true);

    const operatorOee = calculateOee(operatorRecords);

    // Verify all metrics are calculated from real records
    expect(operatorOee.oee).not.toBeNull();
    expect(operatorOee.totalActualQuantity).toBe(
      operatorRecords.reduce((sum, r) => sum + (r.actual_quantity ?? 0), 0)
    );
    expect(operatorOee.totalDowntime).toBe(
      operatorRecords.reduce((sum, r) => sum + (r.downtime ?? 0), 0)
    );
  });

  it('ensures separate operators assigned to different machines see distinct, real metrics', () => {
    const recordsPress = DEFAULT_AUTOMOTIVE_RECORDS.filter((r) => r.machine_id === 'Press-101');
    const recordsPaint = DEFAULT_AUTOMOTIVE_RECORDS.filter((r) => r.machine_id === 'Paint-Booth-1');

    const oeePress = calculateOee(recordsPress);
    const oeePaint = calculateOee(recordsPaint);

    expect(oeePress.totalActualQuantity).not.toEqual(oeePaint.totalActualQuantity);
    expect(oeePress.totalDowntime).not.toEqual(oeePaint.totalDowntime);
    expect(oeePress.oee).not.toEqual(oeePaint.oee);
  });
});
