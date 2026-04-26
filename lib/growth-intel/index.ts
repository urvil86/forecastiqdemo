import type { ConnectedForecast, ComputedForecastConnected } from "../engine/types";
import { computeSensitivity } from "./sensitivity";
import { optimize } from "./optimizer";
import { explainAllocation } from "./explainer";
import { generateBreakdown as _generateBreakdown } from "./breakdown";
import {
  elasticityCurve,
  elasticityImpactPct,
  elasticityResponse,
  marginalImpact,
} from "./elasticity";
import { LEVERS, getLever } from "./levers";
import type {
  AllocationRequest,
  AllocationResult,
  LeverAllocation,
  LeverId,
  OptimizationConstraint,
} from "./types";

export {
  LEVERS,
  getLever,
  computeSensitivity,
  optimize,
  explainAllocation,
  elasticityCurve,
  elasticityImpactPct,
  elasticityResponse,
  marginalImpact,
};
export { generateBreakdown } from "./breakdown";

export * from "./types";

export interface RecommendationOptions {
  forecastYear?: number;
  timelineWeeks?: number;
  constraints?: OptimizationConstraint[];
  objective?: AllocationRequest["objective"];
  useLLM?: boolean;
  revenueTarget?: number;
  includeBreakdowns?: boolean;
}

/**
 * Manual mode: user specifies investment per lever, engine computes the resulting
 * forecast lift via the same elasticity curves and confidence model. No optimization.
 * Returns an AllocationResult shaped identically to the optimizer output so the same
 * results UI works for both modes.
 */
export function evaluateAllocation(
  forecast: ConnectedForecast,
  computed: ComputedForecastConnected,
  forecastYear: number,
  manualAllocations: { leverId: LeverId; investmentUsd: number }[],
  options: RecommendationOptions = {}
): AllocationResult {
  const annual = computed.annual.find((a) => a.year === forecastYear);
  const baselineRevenue = annual?.netSales ?? 0;

  const allocations: LeverAllocation[] = [];
  const excluded: LeverAllocation[] = [];

  for (const lever of LEVERS) {
    const manual = manualAllocations.find((m) => m.leverId === lever.id);
    const investmentUsd = manual?.investmentUsd ?? 0;
    if (investmentUsd <= 0) {
      excluded.push({
        leverId: lever.id,
        investmentUsd: 0,
        intensity: 0,
        expectedImpactPct: 0,
        expectedImpactUsd: 0,
        expectedImpactUsdLow: 0,
        expectedImpactUsdHigh: 0,
        confidenceInterval: 0,
        rampWeeks: lever.rampWeeks,
        fullEffectWeek: lever.rampWeeks,
        reasonExcluded: "No investment specified",
      });
      continue;
    }
    const intensity = Math.max(0, Math.min(lever.maxIntensity, investmentUsd / lever.unitCostUsd));
    const impactPct = elasticityImpactPct(lever, intensity);
    const impactUsd = impactPct * baselineRevenue;
    allocations.push({
      leverId: lever.id,
      investmentUsd,
      intensity,
      expectedImpactPct: impactPct,
      expectedImpactUsd: impactUsd,
      expectedImpactUsdLow: impactUsd * 0.65,
      expectedImpactUsdHigh: impactUsd * 1.4,
      confidenceInterval: lever.riskScore === "low" ? 0.85 : lever.riskScore === "medium" ? 0.7 : 0.55,
      rampWeeks: lever.rampWeeks,
      fullEffectWeek: lever.rampWeeks,
    });
  }

  // Sort by investment dollars descending (matches optimizer convention)
  allocations.sort((a, b) => b.investmentUsd - a.investmentUsd);

  const totalAllocatedUsd = allocations.reduce((s, a) => s + a.investmentUsd, 0);
  const mid = allocations.reduce((s, a) => s + a.expectedImpactUsd, 0);
  const variance = allocations.reduce((s, a) => {
    const range = (a.expectedImpactUsdHigh - a.expectedImpactUsdLow) / 2;
    return s + (range * range) / 6;
  }, 0);
  const std = Math.sqrt(variance);
  const low = Math.max(0, mid - 1.28 * std);
  const high = mid + 1.28 * std;
  const weightedConf =
    totalAllocatedUsd === 0
      ? 0
      : allocations.reduce((s, a) => s + a.confidenceInterval * a.investmentUsd, 0) / totalAllocatedUsd;
  const portfolioROI = totalAllocatedUsd === 0 ? 0 : mid / totalAllocatedUsd;
  const weightedRamp =
    totalAllocatedUsd === 0
      ? 0
      : allocations.reduce((s, a) => s + a.rampWeeks * a.investmentUsd, 0) / totalAllocatedUsd;
  const paybackWeeks = portfolioROI > 0 ? Math.round(weightedRamp + 52 / portfolioROI) : 99;

  const summary = {
    totalAllocatedUsd,
    totalExpectedImpactUsdLow: low,
    totalExpectedImpactUsdMid: mid,
    totalExpectedImpactUsdHigh: high,
    portfolioConfidence: Math.max(0.3, Math.min(0.95, weightedConf)),
    paybackWeeks: Math.max(2, paybackWeeks),
    portfolioROI,
  };

  // For manual mode, generate ONE alternative: "optimized at the same total budget"
  const altOpt =
    totalAllocatedUsd > 0
      ? optimize({
          forecast,
          computed,
          budgetUsd: totalAllocatedUsd,
          timelineWeeks: options.timelineWeeks ?? 52,
          forecastYear,
          constraints: [],
          objective: "max-revenue",
        })
      : null;
  const alternatives: AllocationResult["alternativeAllocations"] = altOpt
    ? [
        {
          label: "Optimizer pick",
          description: `What the optimizer would allocate with the same total budget (${formatM(totalAllocatedUsd)}). Compare to your manual split.`,
          allocations: altOpt.allocations,
          summary: altOpt.summary,
        },
      ]
    : [];

  const request: AllocationRequest = {
    forecast,
    computed,
    budgetUsd: totalAllocatedUsd,
    timelineWeeks: options.timelineWeeks ?? 52,
    forecastYear,
    constraints: [],
    objective: "max-revenue",
    useLLM: false,
  };

  // Compute realistic budget sensitivity: scale every manual allocation by the budget ratio,
  // capped at each lever's effective max. This shows "what if I doubled / halved my own split?"
  function evaluateAtScale(scale: number): { totalInvestmentUsd: number; expectedImpact: number } {
    let totalInv = 0;
    let totalImpact = 0;
    for (const lever of LEVERS) {
      const m = manualAllocations.find((x) => x.leverId === lever.id);
      if (!m || m.investmentUsd <= 0) continue;
      const cap = lever.elasticityShape === "capacity-bounded" && lever.elasticityParams.capacityThreshold !== undefined
        ? lever.elasticityParams.capacityThreshold * lever.unitCostUsd
        : lever.maxIntensity * lever.unitCostUsd;
      const scaledInv = Math.min(cap, m.investmentUsd * scale);
      const scaledIntensity = Math.min(lever.maxIntensity, scaledInv / lever.unitCostUsd);
      const impactPct = elasticityImpactPct(lever, scaledIntensity);
      totalInv += scaledInv;
      totalImpact += impactPct * baselineRevenue;
    }
    return { totalInvestmentUsd: totalInv, expectedImpact: totalImpact };
  }

  const half = evaluateAtScale(0.5);
  const dbl = evaluateAtScale(2);
  const quad = evaluateAtScale(4);
  const marginalPerUsd = dbl.totalInvestmentUsd > totalAllocatedUsd
    ? (dbl.expectedImpact - mid) / Math.max(1, dbl.totalInvestmentUsd - totalAllocatedUsd)
    : 0;

  const partial = {
    request,
    allocations,
    excluded,
    summary,
    budgetSensitivity: {
      halfBudget: half,
      fullBudget: { totalInvestmentUsd: totalAllocatedUsd, expectedImpact: mid },
      doubleBudget: dbl,
      quadrupleBudget: quad,
      marginalImpactPerUsd: marginalPerUsd,
    },
    bindingConstraints: [],
    alternativeAllocations: alternatives,
  };
  const rationale = explainAllocation(request, partial, { useFallback: true });
  return { ...partial, rationale };
}

function formatM(v: number): string {
  return `$${(v / 1e6).toFixed(1)}M`;
}

export function generateRecommendation(
  forecast: ConnectedForecast,
  computed: ComputedForecastConnected,
  budgetUsd: number,
  options: RecommendationOptions = {}
): AllocationResult {
  const forecastYear = options.forecastYear ?? 2027;
  const request: AllocationRequest = {
    forecast,
    computed,
    budgetUsd,
    timelineWeeks: options.timelineWeeks ?? 52,
    forecastYear,
    constraints: options.constraints ?? [],
    objective: options.objective ?? "max-revenue",
    revenueTarget: options.revenueTarget,
    useLLM: options.useLLM,
  };
  const optimized = optimize(request);
  const rationale = explainAllocation(request, optimized, { useFallback: !options.useLLM });
  const result: AllocationResult = { ...optimized, rationale };
  if (options.includeBreakdowns) {
    result.breakdowns = result.allocations.map((a) => _generateBreakdown(a, forecast, computed, forecastYear));
  }
  return result;
}
