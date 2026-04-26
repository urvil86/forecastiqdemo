export type TrendAlgorithm =
  | "linear"
  | "exp-smoothing"
  | "holt-winter-add"
  | "holt-winter-mul"
  | "sma-auto"
  | "quick-expert"
  | "customization";

export interface Event {
  id: string;
  name: string;
  type: "positive" | "negative";
  enabled: boolean;
  launchDate: string;
  peakImpact: number;
  timeToPeakMonths: number;
  curveShape: "slow" | "moderate" | "fast";
}

export interface TrendFitInputs {
  annualActuals: { year: number; value: number }[];
  selectedAlgorithm: TrendAlgorithm;
  algorithmParams: { alpha?: number; beta?: number; gamma?: number };
  customizationCurve?: { year: number; value: number }[];
  events: Event[];
  classShare: { year: number; value: number }[];
  productShare: { year: number; value: number }[];
  grossPrice: { year: number; value: number }[];
  gtnRate: { year: number; value: number }[];
}

export interface SkuDefinition {
  id: string;
  displayName: string;
  category: "commercial" | "sample" | "pap";
  active: boolean;
  defaultMixPct: number;
}

export interface WeeklyInput {
  weekStart: string;
  sku: string;
  trendValue: number;
  override?: number;
  holidayAdjPct?: number;
  eventImpactUnits?: number;
  skuMixOverride?: number;
  nfsUnits?: number;
  dohTargetOverride?: number;
  grossPriceOverride?: number;
  tradeDiscountOverride?: number;
  reserveRateOverride?: number;
}

export interface TrendSlot {
  slotNumber: number;
  description: string;
  algorithm: TrendAlgorithm;
  fitStart: string;
  fitEnd: string;
  rsq: number;
  mape: number;
  rmse: number;
  projectedValues: { weekStart: string; value: number }[];
}

export interface STFInputs {
  horizonWeeks: number;
  granularity: "weekly" | "daily";
  historyWeeksShown: number;
  actualsCutoffDate: string;
  latestPartialDate: string;
  trending: {
    method: TrendAlgorithm;
    fitStartWeek: string;
    fitEndWeek: string;
    inputSlots: TrendSlot[];
    selectedSlot: number;
  };
  weeklyInputs: WeeklyInput[];
  skus: SkuDefinition[];
  events: Event[];
  nfs: {
    samplesPerWeek: number;
    papPerWeek: number;
    bridgePerWeek: number;
    samplesConversionRate: number;
    papConversionRate: number;
    bridgeConversionRate: number;
  };
  inventoryStart: {
    sku: string;
    tier: "wholesaler" | "specialty-pharmacy" | "hub";
    units: number;
  }[];
  holidayCalendar: {
    date: string;
    name: string;
    defaultAdjustmentPct: number;
    overrideAdjustmentPct?: number;
  }[];
}

export interface DailyProfile {
  id: string;
  name: string;
  dayWeights: {
    Mon: number;
    Tue: number;
    Wed: number;
    Thu: number;
    Fri: number;
    Sat: number;
    Sun: number;
  };
}

export interface PhasingProfile {
  dailyProfiles: DailyProfile[];
  weeklyProfileMap: { weekStart: string; profileId: string }[];
  weeklyOfMonth: { weekOfMonth: number; weight: number }[];
  erdByMonth: { month: string; erds: number; baseline: number }[];
}

export interface ConnectedForecast {
  id: string;
  brand: "Ocrevus" | "Zunovo" | "Fenebrutinib";
  geography: "US" | "EU5" | "Japan" | "RoW";
  currency: "USD";
  cycle: "LRP" | "SRP";
  timeframe: {
    historicalStart: string;
    forecastStart: string;
    forecastEnd: string;
  };
  lrp: TrendFitInputs;
  stf: STFInputs;
  phasing: PhasingProfile;
  version: number;
  versionLabel: string;
}

export interface AnnualDataPoint {
  year: number;
  volume: number;
  grossSales: number;
  netSales: number;
  share: number;
  classShare: number;
  grossPrice: number;
  gtnRate: number;
  netPrice: number;
}

export interface MonthlyDataPoint {
  month: string;
  year: number;
  quarter: number;
  volume: number;
  netSales: number;
  grossSales: number;
  share: number;
  netPrice: number;
  source: "stf-actual" | "stf-forecast" | "lrp-derived";
}

export interface WeeklyDataPoint {
  weekStart: string;
  year: number;
  isoWeek: number;
  month: string;
  skuValues: {
    sku: string;
    volume: number;
    netSales: number;
    grossSales: number;
    netPrice: number;
  }[];
  totalVolume: number;
  totalNetSales: number;
  isActual: boolean;
  isPartial: boolean;
  source: "stf-actual" | "stf-forecast" | "lrp-derived";
}

export interface DailyDataPoint {
  date: string;
  weekStart: string;
  dayOfWeek: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  totalVolume: number;
  totalNetSales: number;
}

export interface ComputedForecastConnected {
  forecastId: string;
  computedAt: string;
  daily: DailyDataPoint[];
  weekly: WeeklyDataPoint[];
  monthly: MonthlyDataPoint[];
  annual: AnnualDataPoint[];
  grainConsistency: {
    weeklyToMonthlyMaxDriftPct: number;
    monthlyToAnnualMaxDriftPct: number;
    dailyToWeeklyMaxDriftPct: number;
  };
  lrpStfDelta: {
    period: string;
    lrpForecast: number;
    stfActualPlusForecast: number;
    deltaUsd: number;
    deltaPct: number;
    actualWeight: number;
  }[];
  trendDiagnostics: {
    fitStart: string;
    fitEnd: string;
    algorithmsCompared: {
      algorithm: TrendAlgorithm;
      rsq: number;
      mape: number;
      rmse: number;
    }[];
    selectedAlgorithm: TrendAlgorithm;
  };
}

export interface SeekOptions {
  distributionMethod: "flat" | "historical-pattern" | "event-weighted";
  interventionMode: "allow-stf-overrides" | "lrp-only" | "optimize";
  achievabilityThresholds: {
    achievable: number;
    stretch: number;
  };
}

export type AchievabilityFlag =
  | "achievable"
  | "stretch"
  | "requires-intervention";

export interface SeekResult {
  target: { year: number; targetNetSales: number };
  baseline: { year: number; baselineNetSales: number };
  requiredLift: { absoluteUsd: number; pct: number };
  monthlyDecomposition: {
    month: string;
    baseline: number;
    required: number;
    additional: number;
    runRateMultiplier: number;
    achievabilityFlag: AchievabilityFlag;
  }[];
  weeklyDecomposition: {
    weekStart: string;
    sku: string;
    baseline: number;
    required: number;
    additional: number;
    runRateMultiplier: number;
    achievabilityFlag: AchievabilityFlag;
  }[];
  interventionWeeks: {
    weekStart: string;
    sku: string;
    gap: number;
    gapUsd: number;
    suggestedActions: string[];
  }[];
  summary: {
    weeksAchievable: number;
    weeksStretch: number;
    weeksRequireIntervention: number;
    totalAdditionalRevenue: number;
    estimatedConfidence: number;
  };
}

export interface ReconciliationEvent {
  id: string;
  detectedAt: string;
  type:
    | "sustained-positive-variance"
    | "sustained-negative-variance"
    | "aligned"
    | "minor-drift"
    | "critical-drift";
  severity: "info" | "warning" | "critical";
  rolling4WeekVariancePct: number;
  rolling13WeekVariancePct: number;
  message: string;
  proposedAction: string;
}

export interface VersionSnapshot {
  id: string;
  version: number;
  label: string;
  timestamp: string;
  forecast: ConnectedForecast;
}
