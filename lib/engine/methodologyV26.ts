/**
 * v2.6 Input-First methodology helpers.
 *
 * Computes annual revenue ($) from the new top-down inputs:
 *   - Epidemiology: prevalence × diagnosis × treated × class × brand × dosing × price
 *   - Market share: total market × brand share, with optional unit-based pricing override
 *
 * Stage overlays (PreLaunchOverlay, LoeOverlay) are applied after the base
 * methodology computes its annual curve.
 *
 * Pragmatic design note: the existing v2.5 engine (compute.ts, lifecycle.ts)
 * still drives the actual ConnectedForecast → ComputedForecastConnected
 * pipeline. The functions in this file are used to seed default LRP anchor
 * values (classShare, productShare, etc.) on the existing TrendFitInputs
 * shape, so the new methodology UI maps cleanly into the existing compute
 * path without rewriting it.
 */

import type {
  EpidemiologyInputs,
  MarketShareInputs,
  PreLaunchOverlay,
  LoeOverlay,
} from "./types";

export interface AnnualRevenueRow {
  year: number;
  netSalesUsd: number;
  /** Brand patient population at year (epidemiology only) */
  patients?: number;
  /** Brand units / doses at year */
  units?: number;
  /** Net price at year */
  netPriceUsd?: number;
}

function pricingNetPrice(
  pricing: { yearly: { year: number; grossPriceUsd: number; tradeDiscountPct: number; reserveRatePct: number }[] },
  year: number,
): number {
  const p =
    pricing.yearly.find((y) => y.year === year) ??
    pricing.yearly[pricing.yearly.length - 1];
  if (!p) return 0;
  const td = p.tradeDiscountPct / 100;
  const rr = p.reserveRatePct / 100;
  return p.grossPriceUsd * (1 - td) * (1 - rr);
}

/**
 * Patient funnel × pricing. Output: annual net sales in dollars.
 *
 * Patient pool at year =
 *   prevalence (in 000s) * 1000
 *   × diagnosisRatePct/100
 *   × treatedRatePct/100
 *   × classSharePct/100
 *   × brandSharePct/100
 *
 * Persistence is applied as a simple 2-year average factor:
 *   persistenceFactor = (Y1 + Y2) / 200
 *
 * Units = patients × dosesPerPatientYear × persistenceFactor.
 * Net sales = units × netPrice.
 */
export function computeEpidemiology(inputs: EpidemiologyInputs): AnnualRevenueRow[] {
  return inputs.yearly.map((y) => {
    const patientsTreatedBrand =
      y.prevalence *
      1000 *
      (y.diagnosisRatePct / 100) *
      (y.treatedRatePct / 100) *
      (y.classSharePct / 100) *
      (y.brandSharePct / 100);
    const persistenceFactor =
      (y.persistenceY1Pct + y.persistenceY2Pct) / 200;
    const units = patientsTreatedBrand * y.dosesPerPatientYear * persistenceFactor;
    const netPriceUsd = pricingNetPrice(inputs.pricing, y.year);
    const netSalesUsd = units * netPriceUsd;
    return {
      year: y.year,
      netSalesUsd,
      patients: patientsTreatedBrand,
      units,
      netPriceUsd,
    };
  });
}

/**
 * Total market × brand share. Output: annual net sales in dollars.
 *
 * If totalMarketUnitsK is provided, uses unit-based math:
 *   units = totalMarketUnitsK * 1000 * brandShare
 *   netSales = units * netPrice
 * Otherwise uses dollar-based math:
 *   netSales = totalMarketUsdM * 1e6 * brandShare * (1 - GTN_factor)
 *   (the GTN factor is implicit in market dollars; we apply pricing reserveRate
 *    once more to get net.)
 */
export function computeMarketShare(inputs: MarketShareInputs): AnnualRevenueRow[] {
  return inputs.yearly.map((y) => {
    const brandShare = y.brandSharePct / 100;
    const netPriceUsd = pricingNetPrice(inputs.pricing, y.year);
    if (y.totalMarketUnitsK !== undefined && y.totalMarketUnitsK > 0) {
      const units = y.totalMarketUnitsK * 1000 * brandShare;
      return {
        year: y.year,
        netSalesUsd: units * netPriceUsd,
        units,
        netPriceUsd,
      };
    }
    // Dollar-based: assume market is gross; apply reserve to get net
    const grossUsd = y.totalMarketUsdM * 1e6 * brandShare;
    const reservePct =
      inputs.pricing.yearly.find((p) => p.year === y.year)?.reserveRatePct ?? 0;
    const netSalesUsd = grossUsd * (1 - reservePct / 100);
    return { year: y.year, netSalesUsd, netPriceUsd };
  });
}

/**
 * Apply a Pre-launch overlay to a base annual curve.
 * 1. Cumulative PoS scales the entire curve.
 * 2. Launch trajectory peakSharePct & timeToPeakYears can be used to
 *    re-shape the curve (S-curve / linear / fast-ramp). For now we
 *    apply only a simple ramp-shape multiplier so that values before
 *    expectedLaunchDate are zeroed and post-launch values follow the
 *    chosen ramp.
 * 3. Analog blending is informational here — analog selections feed
 *    into the seed values directly when a forecaster initializes a
 *    pre-launch product.
 */
export function applyPreLaunchOverlay(
  base: AnnualRevenueRow[],
  overlay: PreLaunchOverlay,
): AnnualRevenueRow[] {
  const launchYear = parseInt(
    overlay.launchTrajectory.expectedLaunchDate.slice(0, 4),
  );
  const ttp = Math.max(1, overlay.launchTrajectory.timeToPeakYears);
  const ramp = overlay.launchTrajectory.rampShape;
  const pos = overlay.posModel.cumulativePoS;

  return base.map((row) => {
    const yearsSinceLaunch = row.year - launchYear;
    if (yearsSinceLaunch < 0) return { ...row, netSalesUsd: 0 };
    const t = Math.min(1, yearsSinceLaunch / ttp);
    let rampFactor: number;
    if (ramp === "fast") {
      // Heavy front-load
      rampFactor = 1 - Math.exp(-3 * t);
    } else if (ramp === "slow") {
      // Backloaded S-curve
      rampFactor = Math.pow(t, 1.5);
    } else {
      // Moderate logistic
      rampFactor = 1 / (1 + Math.exp(-6 * (t - 0.5)));
    }
    return {
      ...row,
      netSalesUsd: row.netSalesUsd * rampFactor * pos,
    };
  });
}

/**
 * Apply an LoE overlay to a base annual curve.
 * Post biosimilar entry, the curve is multiplied by:
 *   priceDecline(yearsAfterEntry) * shareRetention(yearsAfterEntry)
 *
 * Defense strategy modifies the share retention by a small bump per $M
 * of patient retention investment (approximated).
 */
export function applyLoeOverlay(
  base: AnnualRevenueRow[],
  overlay: LoeOverlay,
): AnnualRevenueRow[] {
  const entryYear = parseInt(
    overlay.biosimilarEntry.expectedEntryDate.slice(0, 4),
  );
  function lookup(
    curves: { yearsAfterEntry: number; remainingClassPricePct?: number; remainingOriginatorSharePct?: number }[],
    field: "remainingClassPricePct" | "remainingOriginatorSharePct",
    yearsAfter: number,
  ): number {
    if (yearsAfter <= 0) return 100;
    const sorted = curves.slice().sort((a, b) => a.yearsAfterEntry - b.yearsAfterEntry);
    let prev = sorted[0];
    for (const c of sorted) {
      if (c.yearsAfterEntry > yearsAfter) {
        // Linear interp between prev and c
        const span = c.yearsAfterEntry - prev.yearsAfterEntry || 1;
        const t = (yearsAfter - prev.yearsAfterEntry) / span;
        const pv = (prev as Record<string, number>)[field] ?? 100;
        const cv = (c as Record<string, number>)[field] ?? 100;
        return pv + (cv - pv) * t;
      }
      prev = c;
    }
    return ((prev as Record<string, number>)[field] ?? 100);
  }

  const investmentBumpPerYear = overlay.defenseStrategy.patientRetentionInvestmentUsdM
    .reduce<Record<number, number>>((acc, x) => {
      acc[x.year] = (acc[x.year] ?? 0) + x.amount;
      return acc;
    }, {});

  return base.map((row) => {
    const yearsAfter = row.year - entryYear;
    if (yearsAfter < 0) return row;
    const pricePct =
      lookup(overlay.biosimilarEntry.classPriceErosionByYear, "remainingClassPricePct", yearsAfter) /
      100;
    const sharePct =
      lookup(
        overlay.biosimilarEntry.originatorShareRetentionByYear,
        "remainingOriginatorSharePct",
        yearsAfter,
      ) / 100;
    // Defense: each $M of retention investment bumps share retention by 0.5%
    const bump = (investmentBumpPerYear[row.year] ?? 0) * 0.005;
    const adjShare = Math.min(1, sharePct + bump);
    return {
      ...row,
      netSalesUsd: row.netSalesUsd * pricePct * adjShare,
    };
  });
}

/**
 * Compute total annual revenue from a forecast's v2.6 inputs and overlays.
 * Returns null if v2.6 inputs are not populated (caller should fall back to
 * the existing TrendFit engine path).
 */
export function computeV26Annual(forecast: {
  lifecycleStage?: "pre-launch" | "growth" | "loe";
  lrpMethodology?: "epidemiology" | "market-share";
  epidemiologyInputs?: EpidemiologyInputs;
  marketShareInputs?: MarketShareInputs;
  preLaunchOverlay?: PreLaunchOverlay;
  loeOverlay?: LoeOverlay;
}): AnnualRevenueRow[] | null {
  let base: AnnualRevenueRow[] | null = null;
  if (forecast.lrpMethodology === "epidemiology" && forecast.epidemiologyInputs) {
    base = computeEpidemiology(forecast.epidemiologyInputs);
  } else if (
    forecast.lrpMethodology === "market-share" &&
    forecast.marketShareInputs
  ) {
    base = computeMarketShare(forecast.marketShareInputs);
  }
  if (!base) return null;
  if (forecast.lifecycleStage === "pre-launch" && forecast.preLaunchOverlay) {
    base = applyPreLaunchOverlay(base, forecast.preLaunchOverlay);
  } else if (forecast.lifecycleStage === "loe" && forecast.loeOverlay) {
    base = applyLoeOverlay(base, forecast.loeOverlay);
  }
  return base;
}
