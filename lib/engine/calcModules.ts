import type { CalcModule } from "./types";

export const DEFAULT_CALC_MODULES: CalcModule[] = [
  {
    moduleId: "doh",
    moduleName: "Days on Hand",
    description:
      "Inventory coverage in days. Used by STF Inventory & DOH sub-view to compute target stocking levels per channel tier.",
    formula: {
      expression: "starting_units / daily_consumption_rate",
      variables: [
        {
          varName: "starting_units",
          source: "auto-pipelined",
          sourceDetail: "Inventory Master · last sync 2026-04-22 09:30 PT",
        },
        {
          varName: "daily_consumption_rate",
          source: "derived",
          sourceDetail: "weekly OUTs / 7",
        },
      ],
    },
    brandOverrides: [
      {
        brand: "Ocrevus",
        overrideFormula:
          "starting_units / (rolling_4wk_avg_outs / effective_business_days_per_week)",
        overrideReason:
          "Ocrevus consumption is Wednesday-heavy (88% of weekly volume on Wed). Standard daily average understates true DOH because most weekdays have near-zero consumption. Genentech's calculation uses effective business days that exclude near-zero days from the denominator.",
      },
    ],
    geoOverrides: [],
    constraints: { minValue: 0, maxValue: 365, unitLabel: "days" },
    defaultValue: 0,
  },
  {
    moduleId: "erd",
    moduleName: "Effective Revenue Days",
    description:
      "Business days in the period adjusted for federal holidays, plant shutdowns, and special calendar events. Drives the variance like 'this April has 22 business days vs baseline 21'.",
    formula: {
      expression:
        "business_days_in_period - federal_holidays - plant_shutdowns - special_calendar_adjustments",
      variables: [
        { varName: "business_days_in_period", source: "derived", sourceDetail: "calendar engine" },
        { varName: "federal_holidays", source: "auto-pipelined", sourceDetail: "Holiday Calendar feed" },
        { varName: "plant_shutdowns", source: "manual" },
        { varName: "special_calendar_adjustments", source: "manual" },
      ],
    },
    brandOverrides: [],
    geoOverrides: [],
    constraints: { minValue: 0, maxValue: 31, unitLabel: "days" },
  },
  {
    moduleId: "calpac",
    moduleName: "Calendar Pacing Adjustment (Calpac)",
    description:
      "Ratio of current period ERD to baseline period ERD. Used to scale pacing comparisons in Review.",
    formula: {
      expression: "current_period_erd / baseline_period_erd",
      variables: [
        { varName: "current_period_erd", source: "derived", sourceDetail: "ERD module output" },
        { varName: "baseline_period_erd", source: "auto-pipelined", sourceDetail: "Baseline Calendar" },
      ],
    },
    brandOverrides: [
      {
        brand: "Ocrevus",
        overrideFormula:
          "current_period_business_wednesdays / baseline_period_business_wednesdays",
        overrideReason:
          "For Ocrevus, the true pacing driver is the count of business Wednesdays in the period (since infusions are Wed-heavy), not all business days. Genentech uses Wednesday-count Calpac for Ocrevus and standard Calpac for Zunovo (SC, no infusion-day concentration).",
      },
    ],
    geoOverrides: [],
    constraints: { minValue: 0.5, maxValue: 2.0, unitLabel: "ratio" },
    defaultValue: 1.0,
  },
  {
    moduleId: "inventory-tier-allocation",
    moduleName: "Inventory Tier Allocation",
    description:
      "Allocates total channel inventory across wholesaler, specialty pharmacy, and hub tiers using configurable share percentages.",
    formula: {
      expression: "total_inventory * tier_share_pct",
      variables: [
        { varName: "total_inventory", source: "derived", sourceDetail: "sum of all tiers" },
        { varName: "tier_share_pct", source: "manual" },
      ],
    },
    brandOverrides: [],
    geoOverrides: [],
    constraints: { minValue: 0, maxValue: 1_000_000, unitLabel: "units" },
  },
];

export function getActiveFormula(module: CalcModule, brand?: string, geography?: string): string {
  const brandOverride = brand ? module.brandOverrides.find((o) => o.brand === brand) : undefined;
  if (brandOverride?.overrideFormula) return brandOverride.overrideFormula;
  const geoOverride = geography ? module.geoOverrides.find((o) => o.geography === geography) : undefined;
  if (geoOverride?.overrideFormula) return geoOverride.overrideFormula;
  return module.formula.expression;
}
