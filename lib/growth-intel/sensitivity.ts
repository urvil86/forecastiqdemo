import type { ConnectedForecast, ComputedForecastConnected } from "../engine/types";
import { LEVERS } from "./levers";
import { marginalImpact } from "./elasticity";
import type { LeverId, SensitivityResult } from "./types";

export function computeSensitivity(
  forecast: ConnectedForecast,
  computed: ComputedForecastConnected,
  forecastYear: number,
  currentIntensities?: Partial<Record<LeverId, number>>
): SensitivityResult {
  const annual = computed.annual.find((a) => a.year === forecastYear);
  const baselineRevenue = annual?.netSales ?? 0;

  const leverSensitivities = LEVERS.map((lever) => {
    const current = currentIntensities?.[lever.id] ?? lever.minIntensity;
    const marginalPct = marginalImpact(lever, current);
    const marginalUsd = marginalPct * baselineRevenue;
    const distanceFromBaseline = (current - lever.minIntensity) / Math.max(1e-9, lever.maxIntensity - lever.minIntensity);
    const confidence = Math.max(0.4, 0.85 - 0.05 * distanceFromBaseline);
    return {
      leverId: lever.id,
      marginalImpactPct: marginalPct,
      marginalImpactUsd: marginalUsd,
      currentIntensity: current,
      confidenceInterval: confidence,
    };
  });

  const rankedByImpact = [...leverSensitivities]
    .sort((a, b) => b.marginalImpactUsd - a.marginalImpactUsd)
    .map((s) => s.leverId);

  // ROI = marginal $ per dollar invested per unit
  const rankedByROI = [...leverSensitivities]
    .sort((a, b) => {
      const leverA = LEVERS.find((l) => l.id === a.leverId)!;
      const leverB = LEVERS.find((l) => l.id === b.leverId)!;
      const roiA = a.marginalImpactUsd / leverA.unitCostUsd;
      const roiB = b.marginalImpactUsd / leverB.unitCostUsd;
      return roiB - roiA;
    })
    .map((s) => s.leverId);

  return {
    forecastYear,
    scenarioId: null,
    leverSensitivities,
    rankedByImpact,
    rankedByROI,
  };
}
