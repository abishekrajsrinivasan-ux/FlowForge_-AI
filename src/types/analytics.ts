import { SemanticType } from './database';

export interface GlobalFilters {
  datasetId: string | null;
  dateRange: { start: string | null; end: string | null };
  machineId: string | 'ALL';
  lineId: string | 'ALL';
  shift: string | 'ALL';
  productId: string | 'ALL';
}

export interface ValidationErrorItem {
  row: number;
  field: string;
  value: unknown;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  dataQualityScore: number;
  errors: ValidationErrorItem[];
  warnings: ValidationErrorItem[];
  missingFields: string[];
  calculatedCapabilities: {
    canCalculateAvailability: boolean;
    canCalculatePerformance: boolean;
    canCalculateQuality: boolean;
    canCalculateOee: boolean;
    canCalculateLosses: boolean;
    canCalculateBottleneck: boolean;
    canCalculateTargetRisk: boolean;
    notes: string[];
  };
}

export interface ColumnMappingItem {
  originalName: string;
  mappedField: SemanticType;
  detectedType: 'string' | 'number' | 'date' | 'boolean';
  confidence: number;
  sampleValues: string[];
}

export interface OeeCalculationResult {
  availability: number | null; // 0 - 100
  performance: number | null; // 0 - 100
  quality: number | null; // 0 - 100
  oee: number | null; // 0 - 100
  totalPlannedTime: number; // minutes
  totalOperatingTime: number; // minutes
  totalDowntime: number; // minutes
  totalTargetQuantity: number;
  totalActualQuantity: number;
  totalGoodUnits: number;
  totalDefectiveUnits: number;
  productionGap: number;
  targetAchievementRate: number | null; // 0 - 100
  defectRate: number | null; // 0 - 100
  averageActualCycleTime: number | null;
  averageIdealCycleTime: number | null;
  cycleTimeDeviation: number | null;
  unavailabilityReasons: string[];
}

export interface MachineBottleneckScore {
  machineId: string;
  lineId?: string | null;
  bottleneckScore: number;
  oeeLoss: number;           // % loss from 100% OEE
  downtimeContribution: number; // downtime as % of planned time
  throughputLoss: number;    // output gap as % of target
  cycleDeviation: number;    // actual vs ideal cycle % deviation
  qualityLoss: number;       // defect rate %
  trendScore: number;
  rank: number;
  isCurrentBottleneck: boolean;
  totalDowntime: number;
  oee: number | null;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  output: number;
  throughputGapUnits: number;
  primaryObservedLoss: string;
}

export interface PredictiveBottleneckResult {
  machineId: string;
  riskProbability: number; // 0 - 100
  trendSlope: number;
  evidence: string;
  sufficientData: boolean;
  historicalPointsCount: number;
}

export interface LossTreeItem {
  name: string;
  value: number; // minutes or count
  percentage: number;
  category: 'Availability Loss' | 'Performance Loss' | 'Quality Loss';
  children?: LossTreeItem[];
  details?: {
    machineId?: string;
    shift?: string;
    reason?: string;
    occurrences: number;
  };
}

export interface TargetRiskForecast {
  target: number;
  currentOutput: number;
  remainingTarget: number;
  projectedOutput: number;
  projectedDeficit: number;
  currentRunRate: number; // units / hour or unit / minute
  requiredRunRate: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  reasoning: string;
  sufficientData: boolean;
}

export interface CustomBaselineInputs {
  targetQuota?: number;
  actualOutput?: number;
  downtimeMinutes?: number;
  baselineOee?: number;
  defectUnits?: number;
  operatingMinutes?: number;
}

export interface SimulationParameters {
  downtimeReductionPercent: number; // 0 - 60
  cycleTimeImprovementPercent: number; // 0 - 50
  defectReductionPercent: number; // 0 - 80
  capacityBoostPercent?: number; // 0 - 40
  customBaseline?: CustomBaselineInputs;
}

export interface SimulationComparison {
  baseline: {
    oee: number | null;
    availability: number | null;
    performance: number | null;
    quality: number | null;
    output: number;
    downtime: number;
    defectRate: number | null;
    targetGap: number;
    targetTotal: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  simulated: {
    oee: number | null;
    availability: number | null;
    performance: number | null;
    quality: number | null;
    output: number;
    downtime: number;
    defectRate: number | null;
    targetGap: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'OPTIMAL';
    riskScore: number;
  };
  delta: {
    oeeChange: number;
    outputGain: number;
    downtimeSaved: number;
    defectReductionUnits: number;
    targetGapReduction: number;
  };
  riskAssessment: {
    isLowInterventionRisk: boolean;
    warningTitle: string;
    warningDescription: string;
    riskSeverity: 'CRITICAL' | 'WARNING' | 'MODERATE' | 'OPTIMAL';
    leverWarnings: {
      downtime: string | null;
      cycle: string | null;
      defect: string | null;
    };
    runRateImprovement: {
      baselineRate: number;
      simulatedRate: number;
      requiredRate: number;
    };
  };
}

// ==========================================
// PRODUCTION RISK RADAR TYPES
// ==========================================

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RiskCategory =
  | 'bottleneck'
  | 'downtime'
  | 'cycle_time'
  | 'quality'
  | 'target_achievement';

export interface EvidenceMetricItem {
  name: string;
  previous: string;
  current: string;
  change: string;
  isDeteriorating: boolean;
}

export interface RiskEvidenceHighlight {
  label: string;
  change: string;
  isDeteriorating: boolean;
  prefix: '↑' | '↓' | '→';
}

export interface RiskRadarItem {
  id: string;
  machineId: string;
  lineId?: string | null;
  category: RiskCategory;
  categoryLabel: string;
  title: string;
  riskScore: number; // 0 - 100
  severity: RiskSeverity;
  evidenceHighlights: RiskEvidenceHighlight[];
  evidenceMetrics: EvidenceMetricItem[];
  recommendation: string;
  details: string;
  isDataAvailable: boolean;
  unavailableReason?: string;
  suggestedSimLever?: {
    downtimeReductionPercent?: number;
    cycleImprovementPercent?: number;
    defectReductionPercent?: number;
  };
}

export interface MachineHeatmapCell {
  severity: RiskSeverity;
  score: number;
  available: boolean;
  unavailableReason?: string;
}

export interface MachineHeatmapRow {
  machineId: string;
  lineId?: string | null;
  bottleneck: MachineHeatmapCell;
  downtime: MachineHeatmapCell;
  cycle: MachineHeatmapCell;
  quality: MachineHeatmapCell;
  target: MachineHeatmapCell;
  compositeScore: number;
  compositeSeverity: RiskSeverity;
}

export interface RiskTrendPoint {
  timestamp: string;
  label: string;
  overallScore: number;
  machineScores: Record<string, number>;
  categoryScores: Record<RiskCategory, number>;
}

export interface ProductionRiskRadarResult {
  summary: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    stableCount: number;
    totalActiveMachines: number;
  };
  risks: RiskRadarItem[];
  heatmap: MachineHeatmapRow[];
  trend: RiskTrendPoint[];
  hasSufficientHistoricalData: boolean;
  missingDataNotes: string[];
}

