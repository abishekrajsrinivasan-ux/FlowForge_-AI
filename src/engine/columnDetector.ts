import { SemanticType } from '../types/database';
import { ColumnMappingItem } from '../types/analytics';

interface PatternRule {
  type: SemanticType;
  exactMatches: string[];
  partialPatterns: RegExp[];
  priority: number;
}

const RULES: PatternRule[] = [
  {
    type: 'timestamp',
    exactMatches: ['timestamp', 'datetime', 'date_time', 'time_stamp', 'event_time', 'log_time', 'recorded_at'],
    partialPatterns: [/timestamp/i, /datetime/i, /event_?time/i, /logged_?at/i],
    priority: 10,
  },
  {
    type: 'date',
    exactMatches: ['date', 'prod_date', 'production_date', 'work_date', 'shift_date', 'day'],
    partialPatterns: [/^date$/i, /production_?date/i, /work_?date/i],
    priority: 9,
  },
  {
    type: 'machine',
    exactMatches: ['machine', 'machine_id', 'machineid', 'equipment', 'equipment_id', 'station', 'station_id', 'workcenter', 'work_center', 'press', 'asset_id'],
    partialPatterns: [/machine/i, /equipment/i, /station/i, /work_?center/i, /asset/i],
    priority: 10,
  },
  {
    type: 'line',
    exactMatches: ['line', 'line_id', 'production_line', 'assembly_line', 'cell', 'area', 'bay'],
    partialPatterns: [/production_?line/i, /^line(_?id)?$/i, /assembly_?line/i],
    priority: 8,
  },
  {
    type: 'shift',
    exactMatches: ['shift', 'shift_id', 'work_shift', 'shift_name', 'team_shift'],
    partialPatterns: [/shift/i],
    priority: 8,
  },
  {
    type: 'product',
    exactMatches: ['product', 'product_id', 'part', 'part_number', 'part_no', 'part_id', 'sku', 'item', 'item_code', 'material', 'model'],
    partialPatterns: [/product/i, /part_?no/i, /part_?number/i, /^sku$/i, /item_?code/i],
    priority: 8,
  },
  {
    type: 'target_quantity',
    exactMatches: ['target', 'target_quantity', 'planned_quantity', 'planned_units', 'target_units', 'plan_qty', 'target_qty', 'quota'],
    partialPatterns: [/target_?(quantity|qty|units)?/i, /planned_?(quantity|qty|units)/i, /goal/i],
    priority: 9,
  },
  {
    type: 'actual_quantity',
    exactMatches: ['actual', 'actual_quantity', 'produced_quantity', 'actual_units', 'output', 'produced_units', 'actual_qty', 'prod_qty'],
    partialPatterns: [/actual_?(quantity|qty|units)?/i, /produced_?(quantity|qty|units)?/i, /^output$/i],
    priority: 9,
  },
  {
    type: 'planned_time',
    exactMatches: ['planned_time', 'planned_production_time', 'scheduled_time', 'planned_duration', 'operating_window', 'planned_minutes'],
    partialPatterns: [/planned_?(production_?)?time/i, /scheduled_?time/i, /planned_?minutes/i],
    priority: 8,
  },
  {
    type: 'operating_time',
    exactMatches: ['operating_time', 'runtime', 'run_time', 'actual_operating_time', 'production_time', 'uptime', 'run_minutes'],
    partialPatterns: [/operating_?time/i, /^run_?time/i, /actual_?runtime/i, /uptime/i],
    priority: 8,
  },
  {
    type: 'downtime',
    exactMatches: ['downtime', 'total_downtime', 'stop_time', 'down_time', 'stoppage_time', 'down_minutes', 'loss_time'],
    partialPatterns: [/total_?downtime/i, /^downtime/i, /down_?time/i, /stop_?time/i],
    priority: 9,
  },
  {
    type: 'planned_downtime',
    exactMatches: ['planned_downtime', 'scheduled_downtime', 'pm_time', 'maintenance_time', 'planned_stop'],
    partialPatterns: [/planned_?downtime/i, /scheduled_?downtime/i],
    priority: 8,
  },
  {
    type: 'unplanned_downtime',
    exactMatches: ['unplanned_downtime', 'breakdown_time', 'unscheduled_downtime', 'failure_time', 'breakdowns'],
    partialPatterns: [/unplanned_?downtime/i, /breakdown_?time/i, /unscheduled/i],
    priority: 8,
  },
  {
    type: 'changeover_time',
    exactMatches: ['changeover_time', 'changeover', 'setup_time', 'die_change', 'tooling_change', 'setup'],
    partialPatterns: [/changeover/i, /setup_?time/i, /tooling_?change/i],
    priority: 8,
  },
  {
    type: 'idle_time',
    exactMatches: ['idle_time', 'idle', 'starvation_time', 'blocked_time', 'waiting_time'],
    partialPatterns: [/idle/i, /starvation/i, /waiting_?time/i],
    priority: 7,
  },
  {
    type: 'ideal_cycle_time',
    exactMatches: ['ideal_cycle_time', 'standard_cycle_time', 'nominal_cycle_time', 'takt_time', 'design_cycle_time', 'target_cycle_time'],
    partialPatterns: [/ideal_?cycle/i, /standard_?cycle/i, /nominal_?cycle/i, /takt/i],
    priority: 9,
  },
  {
    type: 'actual_cycle_time',
    exactMatches: ['actual_cycle_time', 'measured_cycle_time', 'avg_cycle_time', 'cycle_time', 'cycle_duration'],
    partialPatterns: [/actual_?cycle/i, /measured_?cycle/i, /^cycle_?time$/i],
    priority: 8,
  },
  {
    type: 'total_units',
    exactMatches: ['total_units', 'total_count', 'gross_units', 'total_parts', 'parts_produced', 'gross_production', 'units_produced'],
    partialPatterns: [/total_?units/i, /gross_?(units|parts|count)/i, /parts_?produced/i],
    priority: 8,
  },
  {
    type: 'good_units',
    exactMatches: ['good_units', 'good_parts', 'passed_units', 'conforming_units', 'yield_units', 'good_count', 'passed_parts'],
    partialPatterns: [/good_?(units|parts|count)/i, /passed_?(units|parts)/i, /conforming/i],
    priority: 9,
  },
  {
    type: 'defective_units',
    exactMatches: ['defective_units', 'defects', 'scrap', 'scrap_units', 'rejected_units', 'rejects', 'bad_units', 'defect_count'],
    partialPatterns: [/defect/i, /scrap/i, /reject/i, /bad_?(units|parts)/i],
    priority: 9,
  },
  {
    type: 'rework',
    exactMatches: ['rework', 'rework_units', 'reworked_parts', 'rework_count'],
    partialPatterns: [/rework/i],
    priority: 7,
  },
  {
    type: 'downtime_reason',
    exactMatches: ['downtime_reason', 'reason', 'stop_reason', 'failure_reason', 'fault_code', 'alarm_description', 'error_reason', 'stoppage_reason'],
    partialPatterns: [/downtime_?reason/i, /stop_?reason/i, /fault/i, /alarm/i, /stoppage_?reason/i],
    priority: 8,
  },
  {
    type: 'production_order',
    exactMatches: ['production_order', 'order_id', 'work_order', 'batch_id', 'lot_number', 'job_id', 'order_number'],
    partialPatterns: [/order_?id/i, /work_?order/i, /batch/i, /lot/i, /job/i],
    priority: 7,
  }
];

export const normalizeHeader = (header: string): string => {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const inferDataType = (values: string[]): 'string' | 'number' | 'date' | 'boolean' => {
  const nonEmpties = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonEmpties.length === 0) return 'string';

  let numCount = 0;
  let dateCount = 0;
  let boolCount = 0;

  for (const val of nonEmpties) {
    const s = String(val).trim();
    if (s.toLowerCase() === 'true' || s.toLowerCase() === 'false') {
      boolCount++;
      continue;
    }
    if (!isNaN(Number(s)) && !isNaN(parseFloat(s))) {
      numCount++;
      continue;
    }
    const parsedDate = Date.parse(s);
    if (!isNaN(parsedDate) && s.length >= 8 && (s.includes('-') || s.includes('/') || s.includes(':'))) {
      dateCount++;
    }
  }

  const threshold = nonEmpties.length * 0.7;
  if (numCount >= threshold) return 'number';
  if (dateCount >= threshold) return 'date';
  if (boolCount >= threshold) return 'boolean';

  return 'string';
};

export const detectColumns = (
  headers: string[],
  rows: Record<string, unknown>[]
): ColumnMappingItem[] => {
  const assignedTypes = new Set<SemanticType>();
  const mappings: ColumnMappingItem[] = [];

  for (const rawHeader of headers) {
    const norm = normalizeHeader(rawHeader);
    const sampleValues = rows
      .slice(0, 10)
      .map((r) => String(r[rawHeader] ?? ''))
      .filter((v) => v !== '');

    const detectedType = inferDataType(sampleValues);

    let bestMatch: SemanticType = 'ignore';
    let bestScore = 0;

    for (const rule of RULES) {
      if (assignedTypes.has(rule.type)) continue;

      // Exact normalized match
      if (rule.exactMatches.includes(norm)) {
        if (rule.priority > bestScore) {
          bestScore = rule.priority * 10;
          bestMatch = rule.type;
        }
      } else {
        // Regex partial match
        for (const pattern of rule.partialPatterns) {
          if (pattern.test(norm) || pattern.test(rawHeader)) {
            const score = rule.priority * 5;
            if (score > bestScore) {
              bestScore = score;
              bestMatch = rule.type;
            }
          }
        }
      }
    }

    if (bestMatch !== 'ignore') {
      assignedTypes.add(bestMatch);
    }

    mappings.push({
      originalName: rawHeader,
      mappedField: bestMatch,
      detectedType,
      confidence: bestScore > 0 ? Math.min(100, bestScore) : 0,
      sampleValues: sampleValues.slice(0, 5),
    });
  }

  return mappings;
};
