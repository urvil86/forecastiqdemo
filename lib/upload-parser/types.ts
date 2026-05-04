export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  sheet: string;
  cell?: string;
  severity: ValidationSeverity;
  message: string;
}

export interface UploadPayload {
  // Metadata from Brand_Config sheet
  brand: string;
  geography: string;
  cycleName: string;
  cycleStartDate: string;
  lifecycleStage: string;
  defaultMethodology: string;
  stfHorizonWeeks: number;

  // LRP assumption rows from LRP_Assumptions sheet
  lrpAssumptions: {
    section: string;
    driver: string;
    yearValues: { year: number; value: number }[];
    notes: string;
  }[];

  // LRP output (annual) from LRP_Output sheet
  lrpOutput: {
    metric: string;
    yearValues: { year: number; value: number }[];
  }[];

  // STF weekly inputs from STF_Weekly sheet
  stfWeekly: {
    weekStart: string;
    weekNumber: string;
    type: "History" | "Partial" | "Forecast";
    sku: string;
    baselineOuts: number;
    holidayAdj: number;
    eventImpact: number;
    finalOuts: number;
    netPrice: number;
    netRevenueM: number;
    notes: string;
  }[];

  // Inventory from STF_Inventory sheet
  inventory: {
    tier: string;
    subAccount: string;
    units: number;
    dailyConsumption: number;
    dohComputed: number;
    dohTargetRange: string;
    status: string;
    isSummary: boolean;
  }[];

  // Pricing from STF_Pricing sheet
  pricing: {
    weekStart: string;
    weekNumber: string;
    grossPrice: number;
    tradeDiscountPct: number;
    reserveRatePct: number;
    reserveAdjPct: number;
    netPrice: number;
    notes: string;
  }[];

  // Events from Events sheet
  events: {
    name: string;
    type: string;
    startDate: string;
    peakImpactPct: number;
    timeToPeakWeeks: number;
    decayShape: string;
    direction: "Positive" | "Negative";
    notes: string;
  }[];

  // Phasing from Phasing sheet
  phasing: {
    dailyPattern: { day: string; weight: number }[];
    weeklyOfMonth: { week: string; weight: number }[];
    erdByMonth: {
      month: string;
      businessDays: number;
      federalHolidays: number;
      plantShutdowns: number;
      specialAdj: number;
      erd: number;
      baselineErd: number;
      calpacRatio: number;
    }[];
  };

  // Validation results
  validation: {
    status: "valid" | "warnings" | "errors";
    issues: ValidationIssue[];
  };

  // Source filename for display
  filename: string;
  parsedAt: string;
}

export interface UploadDiff {
  brandMatch: boolean;
  geographyMatch: boolean;

  lrpDriverDiffs: {
    section: string;
    driver: string;
    year: number;
    currentValue: number | null;
    uploadValue: number;
    deltaAbs: number;
    deltaPct: number | null;
  }[];

  stfWeeklyDiffs: {
    weekStart: string;
    sku: string;
    field: "baselineOuts" | "holidayAdj" | "eventImpact" | "netPrice";
    currentValue: number;
    uploadValue: number;
    deltaAbs: number;
  }[];

  inventoryDiffs: {
    tier: string;
    subAccount: string;
    field: "units" | "dohTarget";
    currentValue: number;
    uploadValue: number;
    deltaAbs: number;
  }[];

  summary: {
    lrpDriversChanged: number;
    stfWeeksChanged: number;
    inventoryRowsChanged: number;
    eventsAdded: number;
    eventsModified: number;
    eventsRemoved: number;
  };
}
