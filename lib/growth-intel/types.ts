import type { ConnectedForecast, ComputedForecastConnected } from "../engine/types";

export type LeverId =
  | "field-force-expansion"
  | "field-force-reallocation"
  | "sample-allocation"
  | "patient-services-capacity"
  | "dtc-spend"
  | "account-targeting";

export type LeverCategory =
  | "commercial-investment"
  | "commercial-optimization"
  | "operations-investment";

export type ElasticityShape =
  | "logarithmic"
  | "s-curve"
  | "linear-bounded"
  | "capacity-bounded";

export interface ElasticityParams {
  baselineImpact: number;
  saturationImpact: number;
  decayRate?: number;
  midpoint?: number;
  steepness?: number;
  capacityThreshold?: number;
}

export interface Lever {
  id: LeverId;
  category: LeverCategory;
  displayName: string;
  description: string;
  unitOfInvestment: string;
  minIntensity: number;
  maxIntensity: number;
  unitCostUsd: number;
  elasticityShape: ElasticityShape;
  elasticityParams: ElasticityParams;
  rampWeeks: number;
  durationWeeks: number;
  riskScore: "low" | "medium" | "high";
  geographicScope?: string[];
  benchmarkSource: string;
}

export interface SensitivityResult {
  forecastYear: number;
  scenarioId: string | null;
  leverSensitivities: {
    leverId: LeverId;
    marginalImpactPct: number;
    marginalImpactUsd: number;
    currentIntensity: number;
    confidenceInterval: number;
  }[];
  rankedByImpact: LeverId[];
  rankedByROI: LeverId[];
}

export interface ElasticityResponse {
  leverId: LeverId;
  curvePoints: { intensity: number; impactPct: number }[];
  marginalImpactAtCurrent: number;
  marginalImpactAtMax: number;
  diminishingReturnsRatio: number;
  saturationIntensity: number;
}

export type OptimizationConstraintType =
  | "budget"
  | "timeline"
  | "category-cap"
  | "lever-exclude"
  | "min-confidence"
  | "geographic-restriction";

export interface OptimizationConstraint {
  type: OptimizationConstraintType;
  value: unknown;
  description: string;
}

export interface AllocationRequest {
  forecast: ConnectedForecast;
  computed: ComputedForecastConnected;
  budgetUsd: number;
  timelineWeeks: number;
  forecastYear: number;
  constraints: OptimizationConstraint[];
  objective: "max-revenue" | "max-roi" | "min-risk-revenue-target" | "max-confidence";
  revenueTarget?: number;
  useLLM?: boolean;
}

export interface LeverAllocation {
  leverId: LeverId;
  investmentUsd: number;
  intensity: number;
  expectedImpactPct: number;
  expectedImpactUsd: number;
  expectedImpactUsdLow: number;
  expectedImpactUsdHigh: number;
  confidenceInterval: number;
  rampWeeks: number;
  fullEffectWeek: number;
  reasonExcluded?: string;
}

export interface AllocationSummary {
  totalAllocatedUsd: number;
  totalExpectedImpactUsdLow: number;
  totalExpectedImpactUsdMid: number;
  totalExpectedImpactUsdHigh: number;
  portfolioConfidence: number;
  paybackWeeks: number;
  portfolioROI: number;
}

export interface AllocationRationale {
  headline: string;
  reasoning: string;
  leverJustifications: { leverId: LeverId; justification: string }[];
  risks: string[];
  watchList: string[];
  generatedBy: "llm" | "deterministic-fallback";
}

export type BreakdownInputSource =
  | "user-input"
  | "lever-config"
  | "benchmark"
  | "forecast-engine"
  | "computed";

export interface BreakdownInput {
  label: string;
  value: number | string;
  unit: string;
  source: BreakdownInputSource;
  precision?: number;
}

export interface BreakdownStep {
  description: string;
  formula: string;
  computation: string;
}

export interface BreakdownOutput {
  label: string;
  value: number;
  unit: string;
  precision: number;
}

export interface BreakdownCitation {
  source: string;
  url?: string;
  relevance: string;
}

export interface BreakdownLayer {
  title: string;
  inputs: BreakdownInput[];
  steps: BreakdownStep[];
  outputs: BreakdownOutput[];
  citations: BreakdownCitation[];
}

export interface BreakdownUncertainty {
  layer: "investment" | "reach" | "outcome" | "revenue";
  description: string;
  impactOnEstimate: "low" | "medium" | "high";
}

export interface CalculationBreakdown {
  leverId: LeverId;
  leverName: string;
  investmentUsd: number;
  expectedImpactUsd: number;
  layers: {
    investmentToActivity: BreakdownLayer;
    activityToReach: BreakdownLayer;
    activityToOutcome: BreakdownLayer;
    outcomeToRevenue: BreakdownLayer;
  };
  summaryLine: string;
  uncertainties: BreakdownUncertainty[];
}

export interface AllocationResult {
  request: AllocationRequest;
  allocations: LeverAllocation[];
  excluded: LeverAllocation[];
  summary: AllocationSummary;
  budgetSensitivity: {
    halfBudget: { totalInvestmentUsd: number; expectedImpact: number };
    fullBudget: { totalInvestmentUsd: number; expectedImpact: number };
    doubleBudget: { totalInvestmentUsd: number; expectedImpact: number };
    quadrupleBudget: { totalInvestmentUsd: number; expectedImpact: number };
    marginalImpactPerUsd: number;
  };
  bindingConstraints: {
    constraintType: string;
    leverId?: LeverId;
    impact: string;
  }[];
  alternativeAllocations: {
    label: string;
    description: string;
    allocations: LeverAllocation[];
    summary: AllocationSummary;
  }[];
  rationale: AllocationRationale;
  breakdowns?: CalculationBreakdown[];
}
