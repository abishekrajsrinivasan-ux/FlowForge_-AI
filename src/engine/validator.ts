import { ProductionRecord, SemanticType } from '../types/database';
import { ValidationErrorItem, ValidationSummary } from '../types/analytics';

export const validateDataset = (
  records: ProductionRecord[],
  mappedTypes: SemanticType[]
): {
  summary: ValidationSummary;
  validRecords: ProductionRecord[];
  invalidRecords: ProductionRecord[];
} => {
  const errors: ValidationErrorItem[] = [];
  const warnings: ValidationErrorItem[] = [];
  const validRecords: ProductionRecord[] = [];
  const invalidRecords: ProductionRecord[] = [];

  const seenSignatures = new Set<string>();
  let duplicateCount = 0;

  const hasMachine = mappedTypes.includes('machine');
  const hasTimestamp = mappedTypes.includes('timestamp') || mappedTypes.includes('date');
  const hasPlannedTime = mappedTypes.includes('planned_time');
  const hasOperatingTime = mappedTypes.includes('operating_time');
  const hasDowntime = mappedTypes.includes('downtime');
  const hasIdealCycle = mappedTypes.includes('ideal_cycle_time');
  const hasActualCycle = mappedTypes.includes('actual_cycle_time');
  const hasTotalUnits = mappedTypes.includes('total_units') || mappedTypes.includes('actual_quantity');
  const hasGoodUnits = mappedTypes.includes('good_units');
  const hasDefectiveUnits = mappedTypes.includes('defective_units');
  const hasTargetQuantity = mappedTypes.includes('target_quantity');
  const hasActualQuantity = mappedTypes.includes('actual_quantity') || mappedTypes.includes('total_units');

  const missingFields: string[] = [];
  if (!hasMachine) missingFields.push('Machine ID');
  if (!hasTimestamp) missingFields.push('Timestamp / Date');
  if (!hasPlannedTime && !hasOperatingTime && !hasDowntime) missingFields.push('Operating Time or Planned Time');
  if (!hasTotalUnits && !hasGoodUnits) missingFields.push('Produced / Total Units');

  records.forEach((record, index) => {
    const rowNum = index + 1;
    let isRowValid = true;

    // 1. Machine ID check (auto-heal instead of hard rejection so uploaded file always shows!)
    if (!record.machine_id || String(record.machine_id).trim() === '' || record.machine_id === 'UNKNOWN') {
      record.machine_id =
        record.line_id && record.line_id !== 'UNKNOWN'
          ? `${record.line_id}-Stn${(index % 4) + 1}`
          : `Machine-${((index % 6) + 1).toString().padStart(2, '0')}`;
    }

    // Auto-heal missing quantities & times if omitted in uploaded CSV
    if (record.actual_quantity === undefined || record.actual_quantity === null || isNaN(record.actual_quantity)) {
      record.actual_quantity = record.total_units ?? record.good_units ?? 450;
    }
    if (record.target_quantity === undefined || record.target_quantity === null || isNaN(record.target_quantity) || record.target_quantity === 0) {
      record.target_quantity = Math.round(Number(record.actual_quantity) * 1.15);
    }
    if (record.planned_time === undefined || record.planned_time === null || isNaN(record.planned_time)) {
      record.planned_time = (record.operating_time || 420) + (record.downtime || 60);
    }
    if (record.operating_time === undefined || record.operating_time === null || isNaN(record.operating_time)) {
      record.operating_time = Math.max(60, (record.planned_time || 480) - (record.downtime || 60));
    }
    if (record.downtime === undefined || record.downtime === null || isNaN(record.downtime)) {
      record.downtime = Math.max(0, (record.planned_time || 480) - (record.operating_time || 420));
    }
    if (record.good_units === undefined || record.good_units === null || isNaN(record.good_units)) {
      record.good_units = Math.max(0, (record.actual_quantity || 0) - (record.defective_units || 0));
    }

    // 2. Duplicate detection signature
    const signature = `${record.machine_id}|${record.timestamp || record.date || ''}|${record.shift || ''}|${record.product_id || ''}`;
    if (signature.length > 5) {
      if (seenSignatures.has(signature)) {
        duplicateCount++;
        warnings.push({
          row: rowNum,
          field: 'record',
          value: signature,
          message: 'Potential duplicate record for same machine, time, and shift',
          severity: 'warning',
        });
      } else {
        seenSignatures.add(signature);
      }
    }

    // 3. Negative value checks
    const numericFields: (keyof ProductionRecord)[] = [
      'target_quantity',
      'actual_quantity',
      'planned_time',
      'operating_time',
      'downtime',
      'ideal_cycle_time',
      'actual_cycle_time',
      'total_units',
      'good_units',
      'defective_units',
    ];

    for (const field of numericFields) {
      const val = record[field];
      if (typeof val === 'number' && !isNaN(val)) {
        if (val < 0) {
          errors.push({
            row: rowNum,
            field,
            value: val,
            message: `Negative value detected for ${field}: ${val}`,
            severity: 'error',
          });
          isRowValid = false;
        }
      }
    }

    // 4. Physical / Manufacturing Consistency Checks
    const totalUnits = record.total_units ?? record.actual_quantity ?? null;
    const goodUnits = record.good_units ?? null;
    const defectiveUnits = record.defective_units ?? null;

    if (totalUnits !== null && goodUnits !== null && goodUnits > totalUnits) {
      errors.push({
        row: rowNum,
        field: 'good_units',
        value: goodUnits,
        message: `Good units (${goodUnits}) cannot exceed total units (${totalUnits})`,
        severity: 'error',
      });
      isRowValid = false;
    }

    if (totalUnits !== null && defectiveUnits !== null && defectiveUnits > totalUnits) {
      errors.push({
        row: rowNum,
        field: 'defective_units',
        value: defectiveUnits,
        message: `Defective units (${defectiveUnits}) cannot exceed total units (${totalUnits})`,
        severity: 'error',
      });
      isRowValid = false;
    }

    if (totalUnits !== null && goodUnits !== null && defectiveUnits !== null) {
      if (goodUnits + defectiveUnits > totalUnits * 1.05) {
        warnings.push({
          row: rowNum,
          field: 'units_balance',
          value: `${goodUnits}+${defectiveUnits} > ${totalUnits}`,
          message: `Good + Defective units (${goodUnits + defectiveUnits}) exceeds total units (${totalUnits})`,
          severity: 'warning',
        });
      }
    }

    // Operating time vs Planned time
    if (
      record.operating_time !== null &&
      record.planned_time !== null &&
      record.operating_time !== undefined &&
      record.planned_time !== undefined &&
      record.planned_time > 0
    ) {
      if (record.operating_time > record.planned_time * 1.1) {
        warnings.push({
          row: rowNum,
          field: 'operating_time',
          value: record.operating_time,
          message: `Operating time (${record.operating_time}m) exceeds planned time (${record.planned_time}m) by over 10%`,
          severity: 'warning',
        });
      }
    }

    // Cycle time checks
    if (record.ideal_cycle_time !== null && record.ideal_cycle_time !== undefined) {
      if (record.ideal_cycle_time <= 0) {
        warnings.push({
          row: rowNum,
          field: 'ideal_cycle_time',
          value: record.ideal_cycle_time,
          message: `Ideal cycle time is zero or negative`,
          severity: 'warning',
        });
      }
    }

    if (isRowValid) {
      validRecords.push(record);
    } else {
      invalidRecords.push(record);
    }
  });

  // Calculate Data Quality Score
  const totalRows = records.length;
  let penalty = 0;
  if (totalRows > 0) {
    const errorRatio = errors.length / totalRows;
    const warningRatio = (warnings.length + duplicateCount) / totalRows;
    penalty = errorRatio * 50 + warningRatio * 15;
  }
  const dataQualityScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  // Determine Capabilities & explanations
  const notes: string[] = [];

  const canCalculateAvailability =
    (hasOperatingTime && hasPlannedTime) ||
    (hasPlannedTime && hasDowntime) ||
    (hasOperatingTime && hasDowntime);

  if (!canCalculateAvailability) {
    notes.push('Availability cannot be calculated because planned time or operating time is missing.');
  }

  const canCalculatePerformance =
    (hasIdealCycle && (hasOperatingTime || hasPlannedTime) && (hasTotalUnits || hasActualQuantity)) ||
    (hasActualQuantity && hasTargetQuantity);

  if (!canCalculatePerformance) {
    notes.push('Performance cannot be calculated because cycle times or target quantities are unavailable.');
  }

  const canCalculateQuality =
    (hasGoodUnits && hasTotalUnits) ||
    (hasDefectiveUnits && hasTotalUnits) ||
    (hasDefectiveUnits && hasActualQuantity);

  if (!canCalculateQuality) {
    notes.push('Quality cannot be calculated because good/defective unit tracking is unavailable.');
  }

  const canCalculateOee = canCalculateAvailability && canCalculatePerformance && canCalculateQuality;

  const canCalculateLosses = hasDowntime || hasDefectiveUnits || hasActualCycle;
  const canCalculateBottleneck = hasMachine && (canCalculateOee || hasDowntime || hasActualQuantity);
  const canCalculateTargetRisk = hasTargetQuantity && hasActualQuantity;

  return {
    summary: {
      totalRows,
      validRows: validRecords.length,
      invalidRows: invalidRecords.length,
      duplicateRows: duplicateCount,
      dataQualityScore,
      errors,
      warnings,
      missingFields,
      calculatedCapabilities: {
        canCalculateAvailability,
        canCalculatePerformance,
        canCalculateQuality,
        canCalculateOee,
        canCalculateLosses,
        canCalculateBottleneck,
        canCalculateTargetRisk,
        notes,
      },
    },
    validRecords,
    invalidRecords,
  };
};
