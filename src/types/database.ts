export type SemanticType =
  | 'timestamp'
  | 'date'
  | 'machine'
  | 'line'
  | 'shift'
  | 'product'
  | 'target_quantity'
  | 'actual_quantity'
  | 'planned_time'
  | 'operating_time'
  | 'downtime'
  | 'planned_downtime'
  | 'unplanned_downtime'
  | 'changeover_time'
  | 'idle_time'
  | 'ideal_cycle_time'
  | 'actual_cycle_time'
  | 'total_units'
  | 'good_units'
  | 'defective_units'
  | 'rework'
  | 'downtime_reason'
  | 'production_order'
  | 'ignore';

export type UserRole = 'Admin' | 'Operator';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  assigned_machine?: string | null;
  assigned_line?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Dataset {
  id: string;
  user_id?: string | null;
  name: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  row_count: number;
  upload_status: 'uploading' | 'processing' | 'completed' | 'error';
  processing_status: 'pending' | 'running' | 'completed' | 'failed';
  validation_status: 'pending' | 'valid' | 'invalid' | 'warnings';
  data_quality_score: number;
  created_at: string;
  updated_at: string;
}

export interface DatasetColumn {
  id?: string;
  dataset_id: string;
  original_name: string;
  normalized_name: string;
  detected_type: 'string' | 'number' | 'date' | 'boolean';
  semantic_type: SemanticType;
  nullable: boolean;
  sample_values?: string[];
}

export interface ProductionRecord {
  id?: string;
  dataset_id: string;
  timestamp?: string | null;
  date?: string | null;
  shift?: string | null;
  line_id?: string | null;
  machine_id: string;
  product_id?: string | null;
  target_quantity?: number | null;
  actual_quantity?: number | null;
  planned_time?: number | null; // in minutes
  operating_time?: number | null; // in minutes
  downtime?: number | null; // in minutes
  planned_downtime?: number | null;
  unplanned_downtime?: number | null;
  changeover_time?: number | null;
  idle_time?: number | null;
  ideal_cycle_time?: number | null; // in seconds
  actual_cycle_time?: number | null; // in seconds
  total_units?: number | null;
  good_units?: number | null;
  defective_units?: number | null;
  rework?: number | null;
  downtime_reason?: string | null;
  additional_metadata?: Record<string, unknown>;
}

export interface OeeMetricRecord {
  id?: string;
  dataset_id: string;
  date?: string | null;
  shift?: string | null;
  line_id?: string | null;
  machine_id?: string | null;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
  target_quantity?: number | null;
  actual_quantity?: number | null;
  production_gap?: number | null;
  production_rate?: number | null;
}

export interface LossAnalysisRecord {
  id?: string;
  dataset_id: string;
  machine_id?: string | null;
  line_id?: string | null;
  loss_category: 'Availability Loss' | 'Performance Loss' | 'Quality Loss';
  loss_reason: string;
  loss_value: number; // minutes or units
  percentage: number;
  impact_score: number;
}

export interface BottleneckRecord {
  id?: string;
  dataset_id: string;
  machine_id: string;
  line_id?: string | null;
  bottleneck_score: number; // 0 - 100
  oee_loss: number;
  downtime_contribution: number;
  throughput_loss: number;
  cycle_deviation: number;
  quality_loss: number;
  trend_score: number;
  rank: number;
  is_current_bottleneck: boolean;
}

export interface RootCauseRecord {
  id?: string;
  dataset_id: string;
  machine_id?: string | null;
  factor: string;
  factor_value: string;
  contribution: number;
  confidence: number;
  evidence: string;
  analysis_method: string;
}

export interface RecommendationRecord {
  id?: string;
  dataset_id: string;
  machine_id?: string | null;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  problem: string;
  evidence: string;
  recommendation: string;
  expected_impact?: string;
  confidence: number;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';
  created_at?: string;
}

export interface ScenarioRecord {
  id?: string;
  dataset_id: string;
  name: string;
  machine_id?: string | null;
  downtime_reduction: number;
  cycle_improvement: number;
  quality_improvement: number;
  baseline_oee: number;
  simulated_oee: number;
  baseline_output: number;
  simulated_output: number;
  potential_gain: number;
  created_at?: string;
}

export interface ActionRecord {
  id: string;
  dataset_id: string;
  recommendation_id?: string | null;
  machine_id?: string | null;
  action: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  owner?: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';
  created_at: string;
  completed_at?: string | null;
}

export interface ImprovementTrackingRecord {
  id: string;
  dataset_id: string;
  machine_id: string;
  intervention: string;
  before_oee: number;
  after_oee: number;
  before_downtime: number;
  after_downtime: number;
  before_output: number;
  after_output: number;
  observed_improvement: number;
  recorded_at: string;
}
