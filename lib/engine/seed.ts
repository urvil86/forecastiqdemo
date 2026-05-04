import type {
  ConnectedForecast,
  PhasingProfile,
  LifecycleContext,
  AccountForecast,
} from "./types";

export type ForecastSeedKey =
  | "ocrevus-exclusivity"
  | "fenebrutinib-prelaunch"
  | "zunovo-exclusivity"
  | "ocrevus-postloe";

export const SEED_LIFECYCLE_KEYS: Record<
  Exclude<ForecastSeedKey, "ocrevus-exclusivity">,
  ForecastSeedKey
> = {
  "fenebrutinib-prelaunch": "fenebrutinib-prelaunch",
  "zunovo-exclusivity": "zunovo-exclusivity",
  "ocrevus-postloe": "ocrevus-postloe",
};

function buildErdByMonth(): PhasingProfile["erdByMonth"] {
  const erdByMonth: PhasingProfile["erdByMonth"] = [];
  for (let y = 2022; y <= 2035; y++) {
    const baselineMonths = [21, 20, 22, 22, 21, 22, 22, 21, 22, 22, 21, 22];
    const erdsMonths =
      y === 2026 ? [21, 20, 22, 22, 20, 22, 22, 21, 21, 22, 19, 21] : baselineMonths;
    for (let m = 1; m <= 12; m++) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      erdByMonth.push({ month: key, erds: erdsMonths[m - 1], baseline: baselineMonths[m - 1] });
    }
  }
  return erdByMonth;
}

function defaultPhasingProfile(): PhasingProfile {
  return {
    dailyProfiles: [
      {
        id: "standard",
        name: "Standard week",
        dayWeights: { Mon: 0.0, Tue: 0.04, Wed: 0.88, Thu: 0.06, Fri: 0.02, Sat: 0.0, Sun: 0.0 },
      },
      {
        id: "post-holiday",
        name: "Post-holiday week",
        dayWeights: { Mon: 0.16, Tue: 0.01, Wed: 0.84, Thu: 0.0, Fri: 0.0, Sat: 0.0, Sun: 0.0 },
      },
      {
        id: "long-weekend",
        name: "Long weekend week",
        dayWeights: { Mon: 0.0, Tue: 0.0, Wed: 0.91, Thu: 0.04, Fri: 0.05, Sat: 0.0, Sun: 0.0 },
      },
    ],
    weeklyProfileMap: [
      { weekStart: "2026-05-25", profileId: "long-weekend" },
      { weekStart: "2026-07-06", profileId: "post-holiday" },
      { weekStart: "2026-09-07", profileId: "long-weekend" },
      { weekStart: "2026-11-23", profileId: "long-weekend" },
      { weekStart: "2026-12-21", profileId: "long-weekend" },
      { weekStart: "2026-12-28", profileId: "post-holiday" },
    ],
    weeklyOfMonth: [
      { weekOfMonth: 1, weight: 0.22 },
      { weekOfMonth: 2, weight: 0.25 },
      { weekOfMonth: 3, weight: 0.27 },
      { weekOfMonth: 4, weight: 0.26 },
    ],
    erdByMonth: buildErdByMonth(),
  };
}

const ocrevusExclusivityLifecycle: LifecycleContext = {
  mode: "exclusivity",
  expectedTransitionDate: "2028-04-01",
  expectedNextMode: "post-loe",
  exclusivityConfig: {
    monthsOfHistory: 96,
    blenderWeights: { analogWeight: 0.0, trendWeight: 1.0 },
  },
};

export function getOcrevusExclusivitySeed(): ConnectedForecast {
  return {
    id: "ocrevus-us-2026",
    brand: "Ocrevus",
    geography: "US",
    currency: "USD",
    cycle: "LRP",
    timeframe: {
      historicalStart: "2022-01-03",
      forecastStart: "2026-04-13",
      forecastEnd: "2035-12-31",
    },
    lrp: {
      annualActuals: [
        { year: 2022, value: 432000 },
        { year: 2023, value: 478000 },
        { year: 2024, value: 520000 },
        { year: 2025, value: 552000 },
      ],
      selectedAlgorithm: "quick-expert",
      algorithmParams: { alpha: 0.4, beta: 0.2 },
      events: [
        {
          id: "kesimpta-pressure",
          name: "Kesimpta Competitive Pressure",
          type: "negative",
          enabled: true,
          launchDate: "2024-01-01",
          peakImpact: 0.18,
          timeToPeakMonths: 60,
          curveShape: "slow",
        },
        {
          id: "biosimilar-entry",
          name: "Biosimilar Entry",
          type: "negative",
          enabled: true,
          launchDate: "2027-04-01",
          peakImpact: 0.45,
          timeToPeakMonths: 36,
          curveShape: "fast",
        },
        {
          id: "market-access-win",
          name: "Market Access Win",
          type: "positive",
          enabled: true,
          launchDate: "2022-01-01",
          peakImpact: 0.08,
          timeToPeakMonths: 36,
          curveShape: "moderate",
        },
      ],
      classShare: [
        { year: 2022, value: 0.92 },
        { year: 2025, value: 0.94 },
        { year: 2030, value: 0.96 },
        { year: 2035, value: 0.97 },
      ],
      productShare: [
        { year: 2022, value: 0.26 },
        { year: 2025, value: 0.248 },
        { year: 2027, value: 0.235 },
        { year: 2030, value: 0.198 },
        { year: 2035, value: 0.15 },
      ],
      grossPrice: [
        { year: 2022, value: 72000 },
        { year: 2025, value: 76800 },
        { year: 2030, value: 84800 },
        { year: 2035, value: 93600 },
      ],
      gtnRate: [
        { year: 2022, value: 0.55 },
        { year: 2025, value: 0.58 },
        { year: 2027, value: 0.585 },
        { year: 2030, value: 0.62 },
        { year: 2035, value: 0.65 },
      ],
    },
    stf: {
      horizonWeeks: 13,
      granularity: "weekly",
      historyWeeksShown: 26,
      actualsCutoffDate: "2026-04-12",
      latestPartialDate: "2026-04-22",
      trending: {
        method: "quick-expert",
        fitStartWeek: "2024-01-01",
        fitEndWeek: "2026-04-12",
        inputSlots: [],
        selectedSlot: 1,
      },
      weeklyInputs: [],
      events: [
        {
          id: "spring-activation",
          name: "Spring Activation Push",
          type: "positive",
          enabled: true,
          launchDate: "2026-04-06",
          peakImpact: 0.06,
          timeToPeakMonths: 8 / 4.345,
          curveShape: "moderate",
        },
        {
          id: "competitor-dtc-spike",
          name: "Competitor DTC Spike",
          type: "negative",
          enabled: true,
          launchDate: "2026-05-01",
          peakImpact: 0.04,
          timeToPeakMonths: 6 / 4.345,
          curveShape: "fast",
        },
      ],
      nfs: {
        samplesPerWeek: 320,
        papPerWeek: 180,
        bridgePerWeek: 75,
        samplesConversionRate: 0.124,
        papConversionRate: 0.88,
        bridgeConversionRate: 0.94,
      },
      skus: [
        {
          id: "ocrevus-300mg",
          displayName: "Ocrevus 300mg",
          category: "commercial",
          active: true,
          defaultMixPct: 0.78,
          // Initial-dose presentation; ~half the price of the 600mg
          // maintenance dose. Multipliers are normalized so the baseline
          // mix (78/20/2) gives a weighted-avg of 1.0.
          relativePriceMultiplier: 0.85,
        },
        {
          id: "ocrevus-600mg",
          displayName: "Ocrevus 600mg",
          category: "commercial",
          active: true,
          defaultMixPct: 0.2,
          // Maintenance dose; ~2× the 300mg per-unit price.
          relativePriceMultiplier: 1.70,
        },
        {
          id: "ocrevus-sample",
          displayName: "Ocrevus Sample",
          category: "sample",
          active: true,
          defaultMixPct: 0.02,
          // Samples don't contribute to net revenue.
          relativePriceMultiplier: 0,
        },
      ],
      inventoryStart: [
        { sku: "ocrevus-300mg", tier: "wholesaler", units: 148000 },
        { sku: "ocrevus-300mg", tier: "specialty-pharmacy", units: 48000 },
        { sku: "ocrevus-300mg", tier: "hub", units: 8000 },
        // 600mg presentation — ~20% of total volume
        { sku: "ocrevus-600mg", tier: "wholesaler", units: 38000 },
        { sku: "ocrevus-600mg", tier: "specialty-pharmacy", units: 12000 },
        { sku: "ocrevus-600mg", tier: "hub", units: 2000 },
      ],
      holidayCalendar: [
        { date: "2026-05-25", name: "Memorial Day", defaultAdjustmentPct: -0.08 },
        { date: "2026-07-04", name: "July 4", defaultAdjustmentPct: -0.12 },
        { date: "2026-09-07", name: "Labor Day", defaultAdjustmentPct: -0.07 },
        { date: "2026-11-26", name: "Thanksgiving", defaultAdjustmentPct: -0.18 },
        { date: "2026-12-25", name: "Christmas/NY", defaultAdjustmentPct: -0.22 },
      ],
    },
    phasing: defaultPhasingProfile(),
    lifecycleContext: ocrevusExclusivityLifecycle,
    version: 1,
    versionLabel: "Initial seed forecast",
  };
}

export function getFenebrutinibPreLaunchSeed(): ConnectedForecast {
  const base = getOcrevusExclusivitySeed();
  return {
    ...base,
    id: "fenebrutinib-us-prelaunch",
    brand: "Fenebrutinib",
    cycle: "LRP",
    timeframe: {
      historicalStart: "2024-01-01",
      forecastStart: "2027-12-01",
      forecastEnd: "2037-12-31",
    },
    lrp: {
      ...base.lrp,
      annualActuals: [],
      selectedAlgorithm: "customization",
      events: [],
      classShare: [
        { year: 2027, value: 0.95 },
        { year: 2037, value: 0.97 },
      ],
      productShare: [
        { year: 2027, value: 0.02 },
        { year: 2031, value: 0.16 },
        { year: 2037, value: 0.12 },
      ],
      grossPrice: [
        { year: 2027, value: 78000 },
        { year: 2037, value: 95000 },
      ],
      gtnRate: [
        { year: 2027, value: 0.42 },
        { year: 2037, value: 0.55 },
      ],
    },
    stf: {
      ...base.stf,
      weeklyInputs: [],
      actualsCutoffDate: "2027-11-30",
      latestPartialDate: "2027-11-30",
      events: [],
      skus: [
        {
          id: "fenebrutinib-150mg",
          displayName: "Fenebrutinib 150mg (oral, daily)",
          category: "commercial",
          // Active so the engine emits weekly/daily volumes for the
          // post-launch window. Pre-launch products still need an
          // active SKU to derive a trend; "no actuals" is captured
          // by the empty annualActuals + future actualsCutoffDate,
          // not by deactivating the SKU.
          active: true,
          defaultMixPct: 1.0,
          relativePriceMultiplier: 1.0,
        },
      ],
      inventoryStart: [
        // Seed an opening inventory position at launch so DOH / inventory
        // visualizations don't render empty post-activation.
        { sku: "fenebrutinib-150mg", tier: "wholesaler", units: 18000 },
        { sku: "fenebrutinib-150mg", tier: "specialty-pharmacy", units: 6000 },
      ],
    },
    lifecycleContext: {
      mode: "pre-launch",
      expectedTransitionDate: "2027-12-01",
      expectedNextMode: "exclusivity",
      preLaunchConfig: {
        analogs: [
          {
            analogBrand: "Kesimpta",
            weight: 0.45,
            adjustments: { clinicalProfile: 0.05, competitiveContext: -0.1, marketAccess: 0 },
          },
          {
            analogBrand: "Briumvi",
            weight: 0.3,
            adjustments: { clinicalProfile: -0.05, competitiveContext: -0.05, marketAccess: 0 },
          },
          {
            analogBrand: "Tysabri",
            weight: 0.25,
            adjustments: { clinicalProfile: -0.1, competitiveContext: 0.05, marketAccess: 0 },
          },
        ],
        posModel: {
          currentStage: "phase3",
          milestoneProbabilities: [
            { milestone: "Phase 3 primary endpoint readout", expectedDate: "2026-09-15", probability: 0.72 },
            { milestone: "FDA filing acceptance", expectedDate: "2027-01-30", probability: 0.95 },
            { milestone: "FDA approval", expectedDate: "2027-11-15", probability: 0.78 },
          ],
          cumulativeApprovalProbability: 0.54,
        },
        tacticalInputs: {
          msldDeploymentMonths: 9,
          dtcBuildSpend: 0,
          formularyTier: "unknown",
          expectedLaunchDate: "2027-12-01",
        },
      },
    },
    version: 1,
    versionLabel: "Fenebrutinib Pre-launch seed",
  };
}

export function getZunovoExclusivitySeed(): ConnectedForecast {
  const base = getOcrevusExclusivitySeed();
  return {
    ...base,
    id: "zunovo-us-exclusivity",
    brand: "Zunovo",
    cycle: "SRP",
    timeframe: {
      historicalStart: "2024-10-01",
      forecastStart: "2026-04-13",
      forecastEnd: "2032-12-31",
    },
    lrp: {
      ...base.lrp,
      annualActuals: [
        { year: 2024, value: 18000 },
        { year: 2025, value: 196000 },
      ],
      selectedAlgorithm: "quick-expert",
      events: [
        {
          id: "iv-to-sc-conversion",
          name: "IV-to-SC Conversion Tailwind",
          type: "positive",
          enabled: true,
          launchDate: "2024-10-01",
          peakImpact: 0.35,
          timeToPeakMonths: 48,
          curveShape: "moderate",
        },
        {
          id: "competitor-launch",
          name: "Competitor Class Entrant",
          type: "negative",
          enabled: true,
          launchDate: "2027-06-01",
          peakImpact: 0.08,
          timeToPeakMonths: 24,
          curveShape: "moderate",
        },
      ],
      classShare: [
        { year: 2024, value: 0.4 },
        { year: 2032, value: 0.62 },
      ],
      productShare: [
        { year: 2024, value: 0.04 },
        { year: 2026, value: 0.18 },
        { year: 2028, value: 0.36 },
        { year: 2032, value: 0.46 },
      ],
      grossPrice: [
        { year: 2024, value: 88000 },
        { year: 2032, value: 102000 },
      ],
      gtnRate: [
        { year: 2024, value: 0.42 },
        { year: 2032, value: 0.55 },
      ],
    },
    stf: {
      ...base.stf,
      actualsCutoffDate: "2026-04-12",
      latestPartialDate: "2026-04-22",
      skus: [
        {
          id: "zunovo-sc-vial",
          displayName: "Zunovo SC 920mg",
          category: "commercial",
          active: true,
          defaultMixPct: 0.96,
        },
        {
          id: "zunovo-sample",
          displayName: "Zunovo Starter Sample",
          category: "sample",
          active: true,
          defaultMixPct: 0.04,
        },
      ],
      inventoryStart: [
        { sku: "zunovo-sc-vial", tier: "wholesaler", units: 42000 },
        { sku: "zunovo-sc-vial", tier: "specialty-pharmacy", units: 11000 },
        { sku: "zunovo-sc-vial", tier: "hub", units: 2400 },
      ],
    },
    lifecycleContext: {
      mode: "exclusivity",
      expectedTransitionDate: "2034-01-01",
      expectedNextMode: "post-loe",
      exclusivityConfig: {
        monthsOfHistory: 18,
        blenderWeights: { analogWeight: 0.35, trendWeight: 0.65 },
        scReformulationConfig: {
          parentIvBrand: "Ocrevus IV",
          conversionAnalogs: ["Herceptin SC", "Rituxan SC", "Darzalex Faspro"],
          targetConversionRate: 0.55,
          conversionCurveYears: 4,
        },
      },
    },
    version: 1,
    versionLabel: "Zunovo Exclusivity seed",
  };
}

function generatePostLoeAccounts(startMonths = 84): AccountForecast[] {
  const tiers: { tier: string; share: number; basePerAccount: number; segment: string; count: number }[] = [
    { tier: "Top 50 IDNs", share: 0.55, basePerAccount: 3200, segment: "Hospital Outpatient Infusion", count: 12 },
    { tier: "Academic MS Centers", share: 0.22, basePerAccount: 950, segment: "Academic MS Center", count: 14 },
    { tier: "Community Neuro", share: 0.18, basePerAccount: 220, segment: "Community Infusion Suite", count: 18 },
    { tier: "Long-tail Accounts", share: 0.05, basePerAccount: 35, segment: "Home Infusion", count: 6 },
  ];

  const accounts: AccountForecast[] = [];
  let n = 0;
  for (const t of tiers) {
    for (let i = 0; i < t.count; i++) {
      n += 1;
      const variance = 0.7 + Math.sin(n * 1.7) * 0.25 + 0.3 * ((n % 5) / 5);
      const baseDemand = Math.round(t.basePerAccount * variance);
      const projection: number[] = [];
      for (let m = 0; m < startMonths; m++) {
        const yearsIn = m / 12;
        // gradual baseline drift -3% per year + biosimilar shock after month 24 (2028)
        let factor = 1 - 0.03 * yearsIn;
        if (m >= 24) {
          const yearsAfter = (m - 24) / 12;
          factor *= Math.max(0.18, 1 - 0.36 * yearsAfter);
        }
        projection.push(Math.max(0, Math.round(baseDemand * factor)));
      }
      accounts.push({
        accountId: `acct-${n.toString().padStart(3, "0")}`,
        accountName: `${t.tier.split(" ")[0]} ${i + 1}`,
        tier: t.tier,
        currentMonthlyDemand: baseDemand,
        projectedMonthlyDemand: projection,
        siteOfCareSegment: t.segment,
      });
    }
  }
  return accounts;
}

export function getOcrevusPostLoeSeed(): ConnectedForecast {
  const base = getOcrevusExclusivitySeed();
  return {
    ...base,
    id: "ocrevus-us-postloe",
    brand: "Ocrevus",
    cycle: "SRP",
    timeframe: {
      historicalStart: "2026-01-01",
      forecastStart: "2028-04-01",
      forecastEnd: "2034-12-31",
    },
    lrp: {
      ...base.lrp,
      annualActuals: [
        { year: 2026, value: 552000 },
        { year: 2027, value: 540000 },
      ],
      selectedAlgorithm: "customization",
      customizationCurve: [
        { year: 2026, value: 552000 },
        { year: 2027, value: 540000 },
        { year: 2028, value: 470000 },
        { year: 2029, value: 355000 },
        { year: 2030, value: 252000 },
        { year: 2031, value: 184000 },
        { year: 2032, value: 140000 },
      ],
      events: [
        {
          id: "biosim-entry",
          name: "Biosimilar Entry",
          type: "negative",
          enabled: true,
          launchDate: "2028-04-01",
          peakImpact: 0.6,
          timeToPeakMonths: 36,
          curveShape: "fast",
        },
      ],
    },
    stf: {
      ...base.stf,
      actualsCutoffDate: "2028-03-30",
      latestPartialDate: "2028-04-12",
    },
    lifecycleContext: {
      mode: "post-loe",
      postLoeConfig: {
        biosimilarEntry: {
          expectedEntryDate: "2028-04-01",
          entrantCount: 3,
          classPriceErosionCurve: [
            { yearsAfterEntry: 0, remainingClassPricePct: 1.0 },
            { yearsAfterEntry: 1, remainingClassPricePct: 0.65 },
            { yearsAfterEntry: 2, remainingClassPricePct: 0.45 },
            { yearsAfterEntry: 3, remainingClassPricePct: 0.35 },
          ],
          shareLossCurve: [
            { yearsAfterEntry: 0, remainingOriginatorSharePct: 1.0 },
            { yearsAfterEntry: 1, remainingOriginatorSharePct: 0.62 },
            { yearsAfterEntry: 2, remainingOriginatorSharePct: 0.38 },
            { yearsAfterEntry: 3, remainingOriginatorSharePct: 0.25 },
          ],
        },
        siteOfCareErosion: {
          sourceOfCareSegments: [
            {
              segmentName: "Hospital Outpatient Infusion",
              currentSharePct: 0.58,
              erosionRatePerYear: -0.04,
              destinationSegment: "Community Infusion Suite",
            },
            {
              segmentName: "Academic MS Center",
              currentSharePct: 0.22,
              erosionRatePerYear: -0.01,
              destinationSegment: "Community Infusion Suite",
            },
            {
              segmentName: "Community Infusion Suite",
              currentSharePct: 0.18,
              erosionRatePerYear: 0.04,
            },
            {
              segmentName: "Home Infusion",
              currentSharePct: 0.02,
              erosionRatePerYear: 0.01,
            },
          ],
        },
        accountBasedInputs: {
          fairShareMethodology: "access-weighted",
          allocationRatios: [
            {
              tierName: "Top 50 IDNs",
              ratioName: "80/20",
              capUnits: 4500,
              floorUnits: 1800,
            },
            { tierName: "Academic MS Centers", ratioName: "70/30", capUnits: 1200 },
            { tierName: "Community Neuro", ratioName: "60/40" },
            { tierName: "Long-tail Accounts", ratioName: "60/40", baselineCarveout: true },
          ],
          accountForecasts: generatePostLoeAccounts(),
        },
      },
    },
    version: 1,
    versionLabel: "Ocrevus Post-LoE seed",
  };
}

/**
 * v2.6: post-process a v2.5 seed to add the new Input-First fields.
 * The legacy lifecycleContext is preserved (engine internals still use it),
 * but the v2.6 UI reads from `lifecycleStage`, `lrpMethodology`, and the
 * new methodology input bundles.
 */
function withV26Fields(forecast: ConnectedForecast): ConnectedForecast {
  // Lazy import to avoid circular module load
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { v26InputsForBrand } =
    require("./seedV26") as typeof import("./seedV26");
  const { BRAND_CONFIGS } =
    require("./brands") as typeof import("./brands");
  /* eslint-enable @typescript-eslint/no-var-requires */
  const cfg = BRAND_CONFIGS[forecast.brand];
  const inputs = v26InputsForBrand(forecast.brand);
  return {
    ...forecast,
    lifecycleStage: cfg.defaultStage,
    lrpMethodology: cfg.defaultMethodologyV26,
    epidemiologyInputs: inputs.epidemiologyInputs,
    marketShareInputs: inputs.marketShareInputs,
    preLaunchOverlay: inputs.preLaunchOverlay,
    loeOverlay: inputs.loeOverlay,
    draftStatus: "submitted",
    lastSubmittedAt: new Date().toISOString(),
    cycleName: "2026 Q2 S&OP",
    cycleHorizonYears: 10,
  };
}

export function getSeedForecastByKey(key: ForecastSeedKey): ConnectedForecast {
  let f: ConnectedForecast;
  switch (key) {
    case "fenebrutinib-prelaunch":
      f = getFenebrutinibPreLaunchSeed();
      break;
    case "zunovo-exclusivity":
      f = getZunovoExclusivitySeed();
      break;
    case "ocrevus-postloe":
      f = getOcrevusPostLoeSeed();
      break;
    case "ocrevus-exclusivity":
    default:
      f = getOcrevusExclusivitySeed();
      break;
  }
  return withV26Fields(f);
}

// Backwards-compatible default seed used by existing callers (StoreInit / resetToSeed).
export function getSeedForecast(): ConnectedForecast {
  return withV26Fields(getOcrevusExclusivitySeed());
}
