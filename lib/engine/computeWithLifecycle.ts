import type { AnnualDataPoint, ComputedForecastConnected, ConnectedForecast } from "./types";
import { compute } from "./compute";
import {
  applyPosMultiplier,
  blendAnalogAndTrend,
  computeFromAnalogs,
  rollUpAccountBased,
} from "./lifecycle";

// Lifecycle-aware compute. Dispatches to mode-specific paths but always returns the
// existing ComputedForecastConnected shape so downstream consumers stay simple.
//
// Pre-launch: synthesizes annual + monthly grain from analog blend × PoS, leaves weekly empty.
// Exclusivity: existing v2.3 compute, optionally blended with analog curve when scReformulationConfig is set.
// Post-LoE: account-based rollup is the canonical, weekly is regenerated from the existing engine over
//   the same baseline so the connect/STF surfaces still have a weekly grain to render.
export function computeWithLifecycle(forecast: ConnectedForecast): ComputedForecastConnected {
  const mode = forecast.lifecycleContext?.mode ?? "exclusivity";

  if (mode === "pre-launch") {
    const cfg = forecast.lifecycleContext.preLaunchConfig;
    if (!cfg) return compute(forecast);
    const launchYear = new Date(cfg.tacticalInputs.expectedLaunchDate).getUTCFullYear();
    const endYear = parseInt(forecast.timeframe.forecastEnd.split("-")[0]);
    const base = computeFromAnalogs(cfg, launchYear, endYear);
    const annual = applyPosMultiplier(base, cfg.posModel);

    return synthesizeComputed(forecast, annual);
  }

  if (mode === "post-loe") {
    const cfg = forecast.lifecycleContext.postLoeConfig;
    const startYear = parseInt(forecast.timeframe.forecastStart.split("-")[0]);
    const endYear = parseInt(forecast.timeframe.forecastEnd.split("-")[0]);
    if (cfg) {
      const annual = rollUpAccountBased(
        cfg.accountBasedInputs.accountForecasts,
        startYear,
        endYear,
        33000,
        0.65,
        cfg.biosimilarEntry
      );
      const computed = compute(forecast);
      // Replace the annual portion with the account-rollup-derived series for years it covers.
      const annualMap = new Map<number, AnnualDataPoint>();
      for (const a of computed.annual) annualMap.set(a.year, a);
      for (const a of annual) annualMap.set(a.year, a);
      const merged = Array.from(annualMap.values()).sort((a, b) => a.year - b.year);
      return { ...computed, annual: merged };
    }
    return compute(forecast);
  }

  // exclusivity (default): if SC reformulation config exists, blend; else just compute
  const computed = compute(forecast);
  const exCfg = forecast.lifecycleContext.exclusivityConfig;
  if (exCfg?.scReformulationConfig) {
    const launchYear = parseInt(forecast.timeframe.historicalStart.split("-")[0]);
    const endYear = parseInt(forecast.timeframe.forecastEnd.split("-")[0]);
    // Build a synthetic analog curve by averaging the SC analogs and scaling to current year baseline
    const analogConfig = {
      analogs: exCfg.scReformulationConfig.conversionAnalogs.map((b) => ({
        analogBrand: b,
        weight: 1 / exCfg.scReformulationConfig!.conversionAnalogs.length,
        adjustments: { clinicalProfile: 0, competitiveContext: 0, marketAccess: 0 },
      })),
      posModel: {
        currentStage: "approved" as const,
        milestoneProbabilities: [],
        cumulativeApprovalProbability: 1,
      },
      tacticalInputs: {
        msldDeploymentMonths: 0,
        dtcBuildSpend: 0,
        formularyTier: "covered" as const,
        expectedLaunchDate: forecast.timeframe.historicalStart,
      },
    };
    const analogCurve = computeFromAnalogs(analogConfig, launchYear, endYear);
    const blended = blendAnalogAndTrend(analogCurve, computed.annual, exCfg.blenderWeights);
    return { ...computed, annual: blended };
  }
  return computed;
}

function synthesizeComputed(
  forecast: ConnectedForecast,
  annual: AnnualDataPoint[]
): ComputedForecastConnected {
  // Spread each year evenly across 12 months for monthly view; weekly stays empty.
  const monthly = annual.flatMap((a) => {
    const m: ComputedForecastConnected["monthly"] = [];
    for (let i = 1; i <= 12; i++) {
      const month = `${a.year}-${String(i).padStart(2, "0")}`;
      const quarter = Math.floor((i - 1) / 3) + 1;
      m.push({
        month,
        year: a.year,
        quarter,
        volume: a.volume / 12,
        netSales: a.netSales / 12,
        grossSales: a.grossSales / 12,
        share: a.share,
        netPrice: a.netPrice,
        source: "lrp-derived" as const,
      });
    }
    return m;
  });

  return {
    forecastId: forecast.id,
    computedAt: new Date().toISOString(),
    daily: [],
    weekly: [],
    monthly,
    annual,
    grainConsistency: {
      weeklyToMonthlyMaxDriftPct: 0,
      monthlyToAnnualMaxDriftPct: 0,
      dailyToWeeklyMaxDriftPct: 0,
    },
    lrpStfDelta: [],
    trendDiagnostics: {
      fitStart: forecast.timeframe.historicalStart,
      fitEnd: forecast.timeframe.forecastEnd,
      algorithmsCompared: [],
      selectedAlgorithm: forecast.lrp.selectedAlgorithm,
    },
  };
}
