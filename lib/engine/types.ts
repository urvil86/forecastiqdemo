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
  /**
   * Relative net-price weight for this SKU vs the brand's average dose price.
   * Compute uses it to scale per-SKU revenue so that mix shifts change the
   * brand's effective price (and therefore total net sales). Multipliers
   * should be normalized so that the seeded baseline mix produces a
   * weighted-avg of 1.0; that way unchanged mix means unchanged forecast.
   *
   * Examples (Ocrevus):
   *   300mg presentation → 0.85
   *   600mg presentation → 1.70 (≈ 2× dose, ≈ 2× price)
   *   Sample             → 0    (no revenue contribution)
   *
   * If undefined, treated as 1.0 (legacy behavior — pure proportional split).
   */
  relativePriceMultiplier?: number;
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
    // Optional forward plan: overrides the per-week samples/PAP/bridge values for a window
    plan?: {
      samplesPerWeek: number;
      papPerWeek: number;
      bridgePerWeek: number;
      weeks: number;
      fromWeek: string; // ISO Monday from which the plan applies
    };
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

export type LifecycleMode = "pre-launch" | "exclusivity" | "post-loe";

export interface PreLaunchAnalog {
  analogBrand: string;
  weight: number;
  adjustments: {
    clinicalProfile: number;
    competitiveContext: number;
    marketAccess: number;
  };
}

export interface PreLaunchConfig {
  analogs: PreLaunchAnalog[];
  posModel: {
    currentStage: "preclinical" | "phase1" | "phase2" | "phase3" | "filed" | "approved";
    milestoneProbabilities: {
      milestone: string;
      expectedDate: string;
      probability: number;
    }[];
    cumulativeApprovalProbability: number;
  };
  tacticalInputs: {
    msldDeploymentMonths: number;
    dtcBuildSpend: number;
    formularyTier: "preferred" | "covered" | "pa-required" | "unknown";
    expectedLaunchDate: string;
  };
}

export interface ExclusivityConfig {
  monthsOfHistory: number;
  blenderWeights: {
    analogWeight: number;
    trendWeight: number;
  };
  scReformulationConfig?: {
    parentIvBrand: string;
    conversionAnalogs: string[];
    targetConversionRate: number;
    conversionCurveYears: number;
  };
}

export interface AccountForecast {
  accountId: string;
  accountName: string;
  tier: string;
  currentMonthlyDemand: number;
  projectedMonthlyDemand: number[];
  siteOfCareSegment: string;
}

export interface PostLoeConfig {
  biosimilarEntry: {
    expectedEntryDate: string;
    entrantCount: number;
    classPriceErosionCurve: {
      yearsAfterEntry: number;
      remainingClassPricePct: number;
    }[];
    shareLossCurve: {
      yearsAfterEntry: number;
      remainingOriginatorSharePct: number;
    }[];
  };
  siteOfCareErosion: {
    sourceOfCareSegments: {
      segmentName: string;
      currentSharePct: number;
      erosionRatePerYear: number;
      destinationSegment?: string;
    }[];
  };
  accountBasedInputs: {
    fairShareMethodology: "historical-baseline" | "access-weighted" | "capacity-constrained" | "custom";
    allocationRatios: {
      tierName: string;
      ratioName: "80/20" | "70/30" | "60/40" | "custom";
      customRatio?: { numerator: number; denominator: number };
      capUnits?: number;
      floorUnits?: number;
      baselineCarveout?: boolean;
    }[];
    accountForecasts: AccountForecast[];
  };
}

export interface LifecycleContext {
  mode: LifecycleMode;
  preLaunchConfig?: PreLaunchConfig;
  exclusivityConfig?: ExclusivityConfig;
  postLoeConfig?: PostLoeConfig;
  expectedTransitionDate?: string;
  expectedNextMode?: LifecycleMode;
}

export type DataSourceTag =
  | "auto-pipelined"
  | "manual"
  | "analog-derived"
  | "override"
  | "derived";

export interface InputCellMetadata {
  cellId: string;
  fieldName: string;
  source: DataSourceTag;
  sourceDetail?: string;
  overrideOriginalValue?: number | string;
  overrideChangedAt?: string;
  overrideChangedBy?: string;
  overrideReason?: string;
  analogDerivation?: {
    analogs: { analog: string; weight: number }[];
    formula: string;
  };
  pipelineSource?: {
    system: string;
    lastSync: string;
    nextScheduledRefresh: string;
    isStale: boolean;
  };
}

export interface CalcModule {
  moduleId: string;
  moduleName: string;
  description: string;
  formula: {
    expression: string;
    variables: {
      varName: string;
      source: DataSourceTag;
      sourceDetail?: string;
    }[];
  };
  brandOverrides: {
    brand: string;
    overrideFormula?: string;
    overrideReason?: string;
  }[];
  geoOverrides: {
    geography: string;
    overrideFormula?: string;
    overrideReason?: string;
  }[];
  constraints: {
    minValue?: number;
    maxValue?: number;
    unitLabel: string;
  };
  defaultValue?: number;
}

// ─── v2.6 Lifecycle stage and LRP methodology types ──────────────

export type LifecycleStage = "pre-launch" | "growth" | "loe";

/** v2.6: TrendFit dropped from LRP. Two top-down methodologies remain. */
export type LrpMethodologyV26 = "epidemiology" | "market-share";

export interface PricingInputs {
  yearly: {
    year: number;
    grossPriceUsd: number;
    tradeDiscountPct: number;
    /** GTN reserve as % */
    reserveRatePct: number;
  }[];
}

export interface EpidemiologyInputs {
  /** Patient funnel year by year — 10-year horizon */
  yearly: {
    year: number;
    /** Total addressable patient population (US, in 000s) */
    prevalence: number;
    /** % of prevalence diagnosed */
    diagnosisRatePct: number;
    /** % of diagnosed treated */
    treatedRatePct: number;
    /** % of treated on this drug class */
    classSharePct: number;
    /** % within class on this brand */
    brandSharePct: number;
    /** Year 1 persistence */
    persistenceY1Pct: number;
    /** Year 2 persistence */
    persistenceY2Pct: number;
    /** Average doses per persistent patient */
    dosesPerPatientYear: number;
  }[];
  pricing: PricingInputs;
}

export interface MarketShareInputs {
  yearly: {
    year: number;
    /** Total addressable market in $M */
    totalMarketUsdM: number;
    /** Optional alternative input: total addressable units in 000s */
    totalMarketUnitsK?: number;
    /** Brand market share % */
    brandSharePct: number;
  }[];
  pricing: PricingInputs;
}

export interface PreLaunchOverlay {
  analogs: {
    brand: string;
    /** 0-100, analogs sum to 100 */
    weightPct: number;
    clinicalAdjPct: number;
    competitiveAdjPct: number;
    marketAccessAdjPct: number;
  }[];
  posModel: {
    currentStage: "phase2" | "phase3" | "filed" | "approved";
    phase3ReadoutProb: number;
    fdaFilingProb: number;
    fdaApprovalProb: number;
    /** 0-1, computed = product of applicable stage probs */
    cumulativePoS: number;
  };
  launchTrajectory: {
    expectedLaunchDate: string;
    timeToPeakYears: number;
    peakSharePct: number;
    rampShape: "slow" | "moderate" | "fast";
  };
}

export interface LoeOverlay {
  biosimilarEntry: {
    expectedEntryDate: string;
    entrantCount: number;
    classPriceErosionByYear: {
      yearsAfterEntry: number;
      remainingClassPricePct: number;
    }[];
    originatorShareRetentionByYear: {
      yearsAfterEntry: number;
      remainingOriginatorSharePct: number;
    }[];
  };
  defenseStrategy: {
    pricingPosture: "hold" | "match" | "discount";
    contractingInvestmentUsdM: { year: number; amount: number }[];
    patientRetentionInvestmentUsdM: { year: number; amount: number }[];
  };
}

export type DraftStatus = "draft" | "submitted";

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
  /**
   * v2.5: lifecycleContext is retained internally so the existing engine
   * (computeWithLifecycle, lifecycle.ts, postLoeConfig flows) continues to
   * power compute paths. v2.5 UI does not surface lifecycle as a mode —
   * brand defaults are read from BrandConfig instead.
   */
  lifecycleContext: LifecycleContext;
  version: number;
  versionLabel: string;

  // ── v2.6 Input-First additions ──
  /** Forecasting stage chosen by the user per cycle. Drives Input visibility. */
  lifecycleStage?: LifecycleStage;
  /** Top-down LRP methodology. v2.6 drops TrendFit; two options remain. */
  lrpMethodology?: LrpMethodologyV26;
  /** Populated when lrpMethodology === 'epidemiology'. */
  epidemiologyInputs?: EpidemiologyInputs;
  /** Populated when lrpMethodology === 'market-share'. */
  marketShareInputs?: MarketShareInputs;
  /** Populated only when lifecycleStage === 'pre-launch'. */
  preLaunchOverlay?: PreLaunchOverlay;
  /** Populated only when lifecycleStage === 'loe'. */
  loeOverlay?: LoeOverlay;
  /** Draft / submitted state — gates Views surface. */
  draftStatus?: DraftStatus;
  lastSubmittedAt?: string;
  lastSubmittedBy?: DemoUser;
  /** Forecast cycle name (e.g., "2026 Q2 S&OP") */
  cycleName?: string;
  /** Cycle horizon in years */
  cycleHorizonYears?: number;

  /**
   * v2.6.1 Scoped versioning. LRP and STF travel on independent version
   * counters because they're authored on different cadences (LRP is
   * quarterly / annual; STF is weekly). The umbrella `version` field
   * above remains as a max-of-the-two for legacy callers.
   */
  lrpVersion?: number;
  lrpVersionLabel?: string;
  lrpLastSubmittedAt?: string;
  stfVersion?: number;
  stfVersionLabel?: string;
  stfLastSubmittedAt?: string;
}

/** Scope of a forecast change / snapshot. */
export type ForecastScope = "lrp" | "stf" | "full";

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

// ─── v2.5 Brand / Threshold / Demo User / Snapshot types ──────────

export type BrandKey = "Ocrevus" | "Zunovo" | "Fenebrutinib";

export type LrpMethodology =
  | "TrendFit"
  | "PatientBased"
  | "AnalogWeighted"
  | "Hybrid";

export interface BrandConfig {
  brand: BrandKey;
  /** v2.5 legacy: kept for backwards compatibility with existing callers. */
  defaultMethodology: LrpMethodology;
  /** Whether STF section is active or shows "no actuals yet" */
  stfActive: boolean;
  /** v2.6: default stage when this brand is loaded fresh */
  defaultStage: LifecycleStage;
  /** v2.6: default LRP methodology (epidemiology / market-share) */
  defaultMethodologyV26: LrpMethodologyV26;
  /** v2.5 legacy: hybrid blender config (no longer surfaced in v2.6 UI) */
  hybridConfig?: {
    primaryMethodology: "TrendFit" | "AnalogWeighted";
    secondaryMethodology: "TrendFit" | "AnalogWeighted";
    blendWeights: { primary: number; secondary: number };
  };
  /** v2.5 legacy: analog config (now superseded by PreLaunchOverlay in v2.6) */
  analogConfig?: {
    analogs: { brand: string; weight: number }[];
    posMultiplier?: number;
  };
}

export interface ThresholdConfig {
  rollingWindow: "4-week" | "8-week" | "13-week";
  /** e.g., 5 means ±5% */
  thresholdPct: number;
  appliesTo: "rolling-variance" | "period-variance" | "both";
}

export interface DemoUser {
  id: string;
  name: string;
  /** "Brand Operations Lead", "Forecasting Lead", etc. */
  role: string;
  initials: string;
}

export type ReconciliationAction =
  | "refresh-lrp"
  | "adjust-stf"
  | "document-accept";

export interface VersionSnapshot {
  /** unique snapshot id */
  id: string;
  /** which forecast this snapshots */
  forecastId: string;

  /**
   * v2.6.1 What scope of the forecast this snapshot represents.
   * "lrp" — only LRP-side assumptions changed
   * "stf" — only STF-side assumptions changed
   * "full" — both, or initial baseline / pre-scope migration snapshot
   */
  scope?: ForecastScope;

  // Attribution
  createdBy: DemoUser;
  createdAt: string;

  // Trigger
  triggerType: "reconciliation" | "manual-save" | "scheduled";
  triggerReason: "variance-breach" | "planned-checkpoint" | "user-initiated";

  /** Action taken at reconciliation (only when triggerType === 'reconciliation') */
  reconciliationAction?: ReconciliationAction;

  /** Free-text reason (required for document-accept, optional otherwise) */
  reasonNote?: string;

  /** Notify list (display only — production wires to email) */
  notifyList?: { name: string; email: string }[];

  // Threshold context at time of save
  thresholdAtSave: ThresholdConfig;
  varianceAtSave: {
    rolling4Week: number;
    rolling13Week: number;
    ytd: number;
  };

  // Full snapshot of the forecast state at time of save
  forecastSnapshot: ConnectedForecast;
  computedSnapshot: ComputedForecastConnected;

  // Legacy / display fields preserved for backwards compatibility
  version: number;
  label: string;
  /** Alias for createdAt — kept so existing UI continues to work */
  timestamp: string;
  /** Alias for forecastSnapshot — kept for backwards compatibility */
  forecast: ConnectedForecast;
}
