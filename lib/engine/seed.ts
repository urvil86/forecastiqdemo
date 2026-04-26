import type { ConnectedForecast, PhasingProfile } from "./types";

export function getSeedForecast(): ConnectedForecast {
  const erdByMonth: PhasingProfile["erdByMonth"] = [];
  for (let y = 2022; y <= 2035; y++) {
    const baselineMonths = [21, 20, 22, 22, 21, 22, 22, 21, 22, 22, 21, 22];
    const erdsMonths =
      y === 2026
        ? [21, 20, 22, 22, 20, 22, 22, 21, 21, 22, 19, 21]
        : baselineMonths;
    for (let m = 1; m <= 12; m++) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      erdByMonth.push({ month: key, erds: erdsMonths[m - 1], baseline: baselineMonths[m - 1] });
    }
  }

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
          peakImpact: 0.06, // +6% peak
          timeToPeakMonths: 8 / 4.345, // 8 weeks
          curveShape: "moderate",
        },
        {
          id: "competitor-dtc-spike",
          name: "Competitor DTC Spike",
          type: "negative",
          enabled: true,
          launchDate: "2026-05-01",
          peakImpact: 0.04, // -4% peak
          timeToPeakMonths: 6 / 4.345, // 6 weeks
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
        },
        {
          id: "ocrevus-600mg",
          displayName: "Ocrevus 600mg",
          category: "commercial",
          active: false,
          defaultMixPct: 0.2,
        },
        {
          id: "ocrevus-sample",
          displayName: "Ocrevus Sample",
          category: "sample",
          active: true,
          defaultMixPct: 0.02,
        },
      ],
      inventoryStart: [
        { sku: "ocrevus-300mg", tier: "wholesaler", units: 148000 },
        { sku: "ocrevus-300mg", tier: "specialty-pharmacy", units: 48000 },
        { sku: "ocrevus-300mg", tier: "hub", units: 8000 },
      ],
      holidayCalendar: [
        { date: "2026-05-25", name: "Memorial Day", defaultAdjustmentPct: -0.08 },
        { date: "2026-07-04", name: "July 4", defaultAdjustmentPct: -0.12 },
        { date: "2026-09-07", name: "Labor Day", defaultAdjustmentPct: -0.07 },
        { date: "2026-11-26", name: "Thanksgiving", defaultAdjustmentPct: -0.18 },
        { date: "2026-12-25", name: "Christmas/NY", defaultAdjustmentPct: -0.22 },
      ],
    },

    phasing: {
      dailyProfiles: [
        {
          id: "standard",
          name: "Standard week",
          dayWeights: {
            Mon: 0.0,
            Tue: 0.04,
            Wed: 0.88,
            Thu: 0.06,
            Fri: 0.02,
            Sat: 0.0,
            Sun: 0.0,
          },
        },
        {
          id: "post-holiday",
          name: "Post-holiday week",
          dayWeights: {
            Mon: 0.16,
            Tue: 0.01,
            Wed: 0.84,
            Thu: 0.0,
            Fri: 0.0,
            Sat: 0.0,
            Sun: 0.0,
          },
        },
        {
          id: "long-weekend",
          name: "Long weekend week",
          dayWeights: {
            Mon: 0.0,
            Tue: 0.0,
            Wed: 0.91,
            Thu: 0.04,
            Fri: 0.05,
            Sat: 0.0,
            Sun: 0.0,
          },
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
      erdByMonth,
    },

    version: 1,
    versionLabel: "Initial seed forecast",
  };
}
