import type { BrandConfig, BrandKey, DemoUser, ThresholdConfig } from "./types";

export const BRAND_CONFIGS: Record<BrandKey, BrandConfig> = {
  Ocrevus: {
    brand: "Ocrevus",
    defaultMethodology: "TrendFit",
    stfActive: true,
    defaultStage: "growth",
    defaultMethodologyV26: "epidemiology",
  },
  Zunovo: {
    brand: "Zunovo",
    defaultMethodology: "Hybrid",
    stfActive: true,
    defaultStage: "growth",
    defaultMethodologyV26: "market-share",
    hybridConfig: {
      primaryMethodology: "TrendFit",
      secondaryMethodology: "AnalogWeighted",
      blendWeights: { primary: 0.65, secondary: 0.35 },
    },
  },
  Fenebrutinib: {
    brand: "Fenebrutinib",
    defaultMethodology: "AnalogWeighted",
    stfActive: false,
    defaultStage: "pre-launch",
    defaultMethodologyV26: "epidemiology",
    analogConfig: {
      analogs: [
        { brand: "Kesimpta", weight: 0.45 },
        { brand: "Briumvi", weight: 0.30 },
        { brand: "Tysabri", weight: 0.25 },
      ],
      posMultiplier: 0.54,
    },
  },
};

export function getBrandConfig(brand: BrandKey): BrandConfig {
  return BRAND_CONFIGS[brand];
}

export const DEMO_USERS: DemoUser[] = [
  { id: "u1", name: "Sandra Chen", role: "Brand Operations Lead", initials: "SC" },
  { id: "u2", name: "Ashwin Rao", role: "Forecasting Lead", initials: "AR" },
  { id: "u3", name: "Sid Vaishnavi", role: "Principal Product Manager, DDA", initials: "SV" },
];

export const DEFAULT_DEMO_USER: DemoUser = DEMO_USERS[0];

export const DEFAULT_THRESHOLD: ThresholdConfig = {
  rollingWindow: "4-week",
  thresholdPct: 5,
  appliesTo: "rolling-variance",
};
