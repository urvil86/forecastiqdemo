import { fitLinear } from "./linear";
import { fitExpSmoothing } from "./exp-smoothing";
import { fitHoltWinterAdditive, fitHoltWinterMultiplicative } from "./holt-winter";
import { fitSmaAuto } from "./sma";
import { fitQuickExpert } from "./quick-expert";
import type { TrendAlgorithm } from "../types";

export interface TrendFit {
  projection: { year: number; value: number }[];
  rmse: number;
  rsq: number;
  mape: number;
  algorithmRun: TrendAlgorithm;
  comparisons?: { algorithm: TrendAlgorithm; rsq: number; rmse: number; mape: number }[];
}

export function trend(
  algorithm: TrendAlgorithm,
  actuals: { year: number; value: number }[],
  projectToYear: number,
  params: { alpha?: number; beta?: number; gamma?: number } = {},
  customizationCurve?: { year: number; value: number }[]
): TrendFit {
  if (actuals.length < 2 && algorithm !== "customization") {
    // Fall back to linear (which handles short histories gracefully)
    const r = fitLinear(actuals, projectToYear);
    return { ...r, mape: 0, algorithmRun: "linear" };
  }
  switch (algorithm) {
    case "linear": {
      const r = fitLinear(actuals, projectToYear);
      return { ...r, mape: mapeFromRmse(actuals, r.rmse), algorithmRun: "linear" };
    }
    case "exp-smoothing": {
      const r = fitExpSmoothing(actuals, projectToYear, params);
      return { ...r, mape: mapeFromRmse(actuals, r.rmse), algorithmRun: "exp-smoothing" };
    }
    case "holt-winter-add": {
      const r = fitHoltWinterAdditive(actuals, projectToYear, params);
      return { ...r, mape: mapeFromRmse(actuals, r.rmse), algorithmRun: "holt-winter-add" };
    }
    case "holt-winter-mul": {
      const r = fitHoltWinterMultiplicative(actuals, projectToYear, params);
      return { ...r, mape: mapeFromRmse(actuals, r.rmse), algorithmRun: "holt-winter-mul" };
    }
    case "sma-auto": {
      const r = fitSmaAuto(actuals, projectToYear);
      return { ...r, mape: mapeFromRmse(actuals, r.rmse), algorithmRun: "sma-auto" };
    }
    case "quick-expert": {
      const r = fitQuickExpert(actuals, projectToYear, params);
      return {
        projection: r.projection,
        rmse: r.rmse,
        rsq: r.rsq,
        mape: mapeFromRmse(actuals, r.rmse),
        algorithmRun: r.chosenAlgorithm,
        comparisons: r.comparisons,
      };
    }
    case "customization": {
      const projection = customizationCurve
        ? customizationCurve.filter((p) => p.year > (actuals[actuals.length - 1]?.year ?? -Infinity))
        : fitLinear(actuals, projectToYear).projection;
      return { projection, rmse: 0, rsq: 0, mape: 0, algorithmRun: "customization" };
    }
  }
}

function mapeFromRmse(actuals: { year: number; value: number }[], rmse: number): number {
  if (actuals.length === 0) return 0;
  const meanActual = actuals.reduce((s, a) => s + a.value, 0) / actuals.length;
  if (meanActual === 0) return 0;
  return rmse / meanActual;
}
