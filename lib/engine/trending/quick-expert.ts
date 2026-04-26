import { fitLinear } from "./linear";
import { fitExpSmoothing } from "./exp-smoothing";
import { fitHoltWinterAdditive, fitHoltWinterMultiplicative } from "./holt-winter";
import { fitSmaAuto } from "./sma";
import type { TrendAlgorithm } from "../types";

export interface QuickExpertResult {
  projection: { year: number; value: number }[];
  rmse: number;
  rsq: number;
  chosenAlgorithm: TrendAlgorithm;
  comparisons: { algorithm: TrendAlgorithm; rsq: number; rmse: number; mape: number }[];
}

export function fitQuickExpert(
  actuals: { year: number; value: number }[],
  projectToYear: number,
  params: { alpha?: number; beta?: number } = {}
): QuickExpertResult {
  const candidates: { algorithm: TrendAlgorithm; result: ReturnType<typeof fitLinear> }[] = [
    { algorithm: "linear", result: fitLinear(actuals, projectToYear) },
    { algorithm: "exp-smoothing", result: fitExpSmoothing(actuals, projectToYear, params) },
    { algorithm: "holt-winter-add", result: fitHoltWinterAdditive(actuals, projectToYear, params) },
    { algorithm: "holt-winter-mul", result: fitHoltWinterMultiplicative(actuals, projectToYear, params) },
    { algorithm: "sma-auto", result: fitSmaAuto(actuals, projectToYear) },
  ];

  const comparisons = candidates.map((c) => ({
    algorithm: c.algorithm,
    rsq: c.result.rsq,
    rmse: c.result.rmse,
    mape: computeMape(actuals, c.result),
  }));

  // Pick lowest RMSE
  let best = candidates[0];
  for (const c of candidates) {
    if (c.result.rmse < best.result.rmse) best = c;
  }

  return {
    projection: best.result.projection,
    rmse: best.result.rmse,
    rsq: best.result.rsq,
    chosenAlgorithm: best.algorithm,
    comparisons,
  };
}

function computeMape(
  actuals: { year: number; value: number }[],
  result: { projection: { year: number; value: number }[]; rmse: number }
): number {
  // Approximate: derive in-sample MAPE from RMSE / mean actual
  if (actuals.length === 0) return 0;
  const meanActual = actuals.reduce((s, a) => s + a.value, 0) / actuals.length;
  if (meanActual === 0) return 0;
  return result.rmse / meanActual;
}
