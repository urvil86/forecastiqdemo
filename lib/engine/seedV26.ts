import type {
  EpidemiologyInputs,
  LoeOverlay,
  MarketShareInputs,
  PreLaunchOverlay,
  PricingInputs,
  BrandKey,
} from "./types";

const HORIZON_YEARS = 10;
const START_YEAR = 2026;

function years(): number[] {
  return Array.from({ length: HORIZON_YEARS }, (_, i) => START_YEAR + i);
}

function ocrevusPricing(): PricingInputs {
  return {
    yearly: years().map((y, i) => ({
      year: y,
      grossPriceUsd: 75000 + i * 1500, // ~2% annual price escalation
      tradeDiscountPct: 4.5,
      reserveRatePct: 56, // GTN ~56%, leaves ~44% net
    })),
  };
}

function fenebrutinibPricing(): PricingInputs {
  return {
    yearly: years().map((y, i) => ({
      year: y,
      grossPriceUsd: 80000 + i * 1700,
      tradeDiscountPct: 4,
      reserveRatePct: 55,
    })),
  };
}

function zunovoPricing(): PricingInputs {
  return {
    yearly: years().map((y, i) => ({
      year: y,
      grossPriceUsd: 78000 + i * 1600,
      tradeDiscountPct: 4.2,
      reserveRatePct: 54,
    })),
  };
}

/**
 * Ocrevus Growth-stage epidemiology seed.
 * Targets ~$5.0B peak in 2027 to match v2.5 Ocrevus seed.
 */
export function seedOcrevusEpidemiology(): EpidemiologyInputs {
  return {
    yearly: years().map((y, i) => ({
      year: y,
      // Multiple sclerosis US prevalence: ~1,000K diagnosed candidates,
      // ramping mildly with population
      prevalence: 1000 + i * 8,
      diagnosisRatePct: 92,
      treatedRatePct: 78,
      // Class share (anti-CD20s): rising as DMTs evolve
      classSharePct: 32 + i * 1.0,
      // Brand share within class — Ocrevus dominant pre-LoE, declines post-LoE
      brandSharePct: i <= 1 ? 58 : 56 - i,
      persistenceY1Pct: 88,
      persistenceY2Pct: 79,
      // Ocrevus 600mg ~2 doses/year (Q6M)
      dosesPerPatientYear: 2,
    })),
    pricing: ocrevusPricing(),
  };
}

/**
 * Zunovo (Zu-norovirus) — IV-to-SC reformulation.
 * Default methodology: market-share (within the IV class).
 */
export function seedZunovoMarketShare(): MarketShareInputs {
  return {
    yearly: years().map((y, i) => {
      // Total IV class market in $M (declining as SC reformulations enter)
      const totalMarketUsdM = 12500 - i * 200;
      // Brand share ramps as SC conversion takes hold
      const brandSharePct = 18 + i * 1.8; // 18% → 34%
      return { year: y, totalMarketUsdM, brandSharePct };
    }),
    pricing: zunovoPricing(),
  };
}

/**
 * Fenebrutinib pre-launch — epidemiology seed reflecting expected
 * post-launch trajectory (BTK inhibitor for MS).
 */
export function seedFenebrutinibEpidemiology(): EpidemiologyInputs {
  return {
    yearly: years().map((y, i) => ({
      year: y,
      prevalence: 1000 + i * 8,
      diagnosisRatePct: 92,
      treatedRatePct: 78,
      classSharePct: i < 2 ? 0 : 5 + (i - 2) * 3, // 0 pre-launch, ramps after
      brandSharePct: i < 2 ? 0 : 22 + (i - 2) * 2,
      persistenceY1Pct: 80,
      persistenceY2Pct: 70,
      dosesPerPatientYear: 365, // BTK inhibitors are oral daily
    })),
    pricing: fenebrutinibPricing(),
  };
}

export function seedFenebrutinibPreLaunchOverlay(): PreLaunchOverlay {
  return {
    analogs: [
      {
        brand: "Kesimpta",
        weightPct: 45,
        clinicalAdjPct: 0,
        competitiveAdjPct: -5,
        marketAccessAdjPct: 5,
      },
      {
        brand: "Briumvi",
        weightPct: 30,
        clinicalAdjPct: 5,
        competitiveAdjPct: 0,
        marketAccessAdjPct: 0,
      },
      {
        brand: "Tysabri",
        weightPct: 25,
        clinicalAdjPct: -10,
        competitiveAdjPct: 5,
        marketAccessAdjPct: -5,
      },
    ],
    posModel: {
      currentStage: "phase3",
      phase3ReadoutProb: 0.72,
      fdaFilingProb: 0.95,
      fdaApprovalProb: 0.78,
      cumulativePoS: 0.72 * 0.95 * 0.78, // ≈ 0.534
    },
    launchTrajectory: {
      expectedLaunchDate: "2027-12-01",
      timeToPeakYears: 5,
      peakSharePct: 22,
      rampShape: "moderate",
    },
  };
}

/**
 * Ocrevus LoE overlay — for the alternative narrative where stage
 * is switched to 'loe'. Biosimilar entry 2028-04, 3 entrants, standard
 * erosion curves, hold pricing posture.
 */
export function seedOcrevusLoeOverlay(): LoeOverlay {
  return {
    biosimilarEntry: {
      expectedEntryDate: "2028-04-01",
      entrantCount: 3,
      classPriceErosionByYear: [
        { yearsAfterEntry: 0, remainingClassPricePct: 100 },
        { yearsAfterEntry: 1, remainingClassPricePct: 65 },
        { yearsAfterEntry: 2, remainingClassPricePct: 45 },
        { yearsAfterEntry: 3, remainingClassPricePct: 35 },
        { yearsAfterEntry: 4, remainingClassPricePct: 30 },
      ],
      originatorShareRetentionByYear: [
        { yearsAfterEntry: 0, remainingOriginatorSharePct: 100 },
        { yearsAfterEntry: 1, remainingOriginatorSharePct: 62 },
        { yearsAfterEntry: 2, remainingOriginatorSharePct: 38 },
        { yearsAfterEntry: 3, remainingOriginatorSharePct: 25 },
        { yearsAfterEntry: 4, remainingOriginatorSharePct: 18 },
      ],
    },
    defenseStrategy: {
      pricingPosture: "hold",
      contractingInvestmentUsdM: years().map((y, i) => ({
        year: y,
        amount: i >= 2 ? 8 + (i - 2) * 2 : 0,
      })),
      patientRetentionInvestmentUsdM: years().map((y, i) => ({
        year: y,
        amount: i >= 2 ? 4 + (i - 2) : 0,
      })),
    },
  };
}

/** Returns a v2.6 input bundle pre-populated for the given brand. */
export function v26InputsForBrand(brand: BrandKey): {
  epidemiologyInputs?: EpidemiologyInputs;
  marketShareInputs?: MarketShareInputs;
  preLaunchOverlay?: PreLaunchOverlay;
  loeOverlay?: LoeOverlay;
} {
  if (brand === "Ocrevus") {
    return { epidemiologyInputs: seedOcrevusEpidemiology() };
  }
  if (brand === "Zunovo") {
    return { marketShareInputs: seedZunovoMarketShare() };
  }
  // Fenebrutinib pre-launch
  return {
    epidemiologyInputs: seedFenebrutinibEpidemiology(),
    preLaunchOverlay: seedFenebrutinibPreLaunchOverlay(),
  };
}
