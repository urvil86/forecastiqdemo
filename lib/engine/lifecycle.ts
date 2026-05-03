import type {
  AnnualDataPoint,
  ConnectedForecast,
  ExclusivityConfig,
  LifecycleMode,
  PostLoeConfig,
  PreLaunchConfig,
} from "./types";

// Analog launch curves (volume index, year 0 = launch year, normalized to peak=1.0)
// These are illustrative reference curves used by computeFromAnalogs.
const ANALOG_CURVES: Record<string, { years: number; values: number[]; peakRevenueY1: number }> = {
  Kesimpta: {
    years: 10,
    values: [0.05, 0.32, 0.62, 0.85, 0.98, 1.0, 0.95, 0.88, 0.78, 0.7],
    peakRevenueY1: 0.18, // $0.18B-equivalent at launch year (illustrative)
  },
  Briumvi: {
    years: 10,
    values: [0.04, 0.25, 0.5, 0.72, 0.88, 0.96, 1.0, 0.97, 0.9, 0.82],
    peakRevenueY1: 0.12,
  },
  Tysabri: {
    years: 10,
    values: [0.08, 0.45, 0.78, 0.96, 1.0, 0.97, 0.92, 0.86, 0.78, 0.72],
    peakRevenueY1: 0.22,
  },
  "Herceptin SC": {
    years: 8,
    values: [0.1, 0.35, 0.55, 0.7, 0.78, 0.83, 0.85, 0.85],
    peakRevenueY1: 0.0,
  },
  "Rituxan SC": {
    years: 8,
    values: [0.08, 0.28, 0.48, 0.65, 0.74, 0.8, 0.82, 0.83],
    peakRevenueY1: 0.0,
  },
  "Darzalex Faspro": {
    years: 8,
    values: [0.12, 0.4, 0.62, 0.75, 0.82, 0.86, 0.88, 0.88],
    peakRevenueY1: 0.0,
  },
};

// Approximate peak class revenue used to scale Pre-launch curves to a realistic dollar magnitude.
// (Treated as a single brand-level peak since the analog blend already encodes share dynamics.)
const PRE_LAUNCH_PEAK_NET_REVENUE_USD = 1.62e9;

function buildEmptyAnnual(year: number): AnnualDataPoint {
  return {
    year,
    volume: 0,
    grossSales: 0,
    netSales: 0,
    share: 0,
    classShare: 0,
    grossPrice: 0,
    gtnRate: 0,
    netPrice: 0,
  };
}

export function computeFromAnalogs(
  config: PreLaunchConfig,
  launchYear: number,
  endYear: number
): AnnualDataPoint[] {
  const out: AnnualDataPoint[] = [];

  // Normalize analog weights
  const totalWeight = config.analogs.reduce((s, a) => s + a.weight, 0) || 1;

  // Build the blended unit-curve (years from launch -> 0..1 index)
  const horizonYears = Math.max(1, endYear - launchYear + 1);
  const blendedIndex: number[] = new Array(horizonYears).fill(0);

  for (const a of config.analogs) {
    const w = a.weight / totalWeight;
    const adj =
      1 + a.adjustments.clinicalProfile + a.adjustments.competitiveContext + a.adjustments.marketAccess;
    const curve = ANALOG_CURVES[a.analogBrand];
    if (!curve) continue;
    for (let i = 0; i < horizonYears; i++) {
      const idx = i < curve.values.length ? curve.values[i] : curve.values[curve.values.length - 1];
      blendedIndex[i] += w * idx * adj;
    }
  }

  // Scale by reference peak revenue
  for (let y = launchYear; y <= endYear; y++) {
    const i = y - launchYear;
    const idx = blendedIndex[i] ?? 0;
    const netSales = idx * PRE_LAUNCH_PEAK_NET_REVENUE_USD;
    out.push({
      year: y,
      volume: Math.round((netSales / 33000) * 100) / 100, // illustrative net price ~$33K/dose
      grossSales: netSales / 0.6, // illustrative GTN ~40%
      netSales,
      share: idx,
      classShare: 0.97,
      grossPrice: 33000 / 0.6,
      gtnRate: 0.4,
      netPrice: 33000,
    });
  }
  return out;
}

export function applyPosMultiplier(
  baseCurve: AnnualDataPoint[],
  posModel: PreLaunchConfig["posModel"]
): AnnualDataPoint[] {
  const k = Math.max(0, Math.min(1, posModel.cumulativeApprovalProbability));
  return baseCurve.map((p) => ({
    ...p,
    volume: p.volume * k,
    grossSales: p.grossSales * k,
    netSales: p.netSales * k,
    share: p.share * k,
  }));
}

export function blendAnalogAndTrend(
  analogCurve: AnnualDataPoint[],
  trendCurve: AnnualDataPoint[],
  weights: ExclusivityConfig["blenderWeights"]
): AnnualDataPoint[] {
  const total = (weights.analogWeight ?? 0) + (weights.trendWeight ?? 0) || 1;
  const aw = (weights.analogWeight ?? 0) / total;
  const tw = (weights.trendWeight ?? 0) / total;
  const byYear = new Map<number, AnnualDataPoint>();
  for (const p of trendCurve) byYear.set(p.year, p);
  return analogCurve.map((a) => {
    const t = byYear.get(a.year);
    if (!t) return { ...a };
    return {
      ...a,
      volume: aw * a.volume + tw * t.volume,
      grossSales: aw * a.grossSales + tw * t.grossSales,
      netSales: aw * a.netSales + tw * t.netSales,
      share: aw * a.share + tw * t.share,
      netPrice: aw * a.netPrice + tw * t.netPrice,
      grossPrice: aw * a.grossPrice + tw * t.grossPrice,
      gtnRate: aw * a.gtnRate + tw * t.gtnRate,
      classShare: aw * a.classShare + tw * t.classShare,
    };
  });
}

export function computeBlenderWeights(monthsOfHistory: number): ExclusivityConfig["blenderWeights"] {
  if (monthsOfHistory < 6) return { analogWeight: 0.9, trendWeight: 0.1 };
  if (monthsOfHistory < 12) return { analogWeight: 0.7, trendWeight: 0.3 };
  if (monthsOfHistory < 24) return { analogWeight: 0.5, trendWeight: 0.5 };
  if (monthsOfHistory < 36) return { analogWeight: 0.3, trendWeight: 0.7 };
  return { analogWeight: 0.1, trendWeight: 0.9 };
}

export function rollUpAccountBased(
  accountForecasts: PostLoeConfig["accountBasedInputs"]["accountForecasts"],
  startYear: number,
  endYear: number,
  netPricePerUnit = 33000,
  gtnRate = 0.65,
  biosimilarEntry?: PostLoeConfig["biosimilarEntry"]
): AnnualDataPoint[] {
  const out: AnnualDataPoint[] = [];
  const horizonMonths = (endYear - startYear + 1) * 12;

  // Aggregate per-month total
  const monthlyTotals = new Array(horizonMonths).fill(0);
  for (const acc of accountForecasts) {
    for (let i = 0; i < horizonMonths; i++) {
      monthlyTotals[i] += acc.projectedMonthlyDemand[i] ?? acc.currentMonthlyDemand;
    }
  }

  // Apply biosimilar share + price erosion if present
  const entryYear = biosimilarEntry ? new Date(biosimilarEntry.expectedEntryDate).getUTCFullYear() : null;
  const entryMonth = biosimilarEntry ? new Date(biosimilarEntry.expectedEntryDate).getUTCMonth() : 0;

  for (let y = startYear; y <= endYear; y++) {
    let yearVolume = 0;
    for (let m = 0; m < 12; m++) {
      const idx = (y - startYear) * 12 + m;
      let v = monthlyTotals[idx] ?? 0;
      if (entryYear && (y > entryYear || (y === entryYear && m >= entryMonth))) {
        const yearsAfter = y - entryYear + (m - entryMonth) / 12;
        const shareCurve = biosimilarEntry!.shareLossCurve;
        const interp = interpCurve(shareCurve.map((x) => [x.yearsAfterEntry, x.remainingOriginatorSharePct]), yearsAfter);
        v *= interp;
      }
      yearVolume += v;
    }

    let effectiveNetPrice = netPricePerUnit;
    if (entryYear && y >= entryYear) {
      const yearsAfter = y - entryYear;
      const priceCurve = biosimilarEntry!.classPriceErosionCurve;
      const interp = interpCurve(priceCurve.map((x) => [x.yearsAfterEntry, x.remainingClassPricePct]), yearsAfter);
      effectiveNetPrice = netPricePerUnit * interp;
    }

    const netSales = yearVolume * effectiveNetPrice;
    out.push({
      year: y,
      volume: yearVolume,
      grossSales: netSales / gtnRate,
      netSales,
      share: 0,
      classShare: 0.95,
      grossPrice: netPricePerUnit / gtnRate,
      gtnRate,
      netPrice: effectiveNetPrice,
    });
  }
  return out;
}

function interpCurve(points: [number, number][], x: number): number {
  if (points.length === 0) return 1;
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  if (x <= sorted[0][0]) return sorted[0][1];
  if (x >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
  for (let i = 1; i < sorted.length; i++) {
    if (x <= sorted[i][0]) {
      const [x1, y1] = sorted[i - 1];
      const [x2, y2] = sorted[i];
      const t = (x - x1) / (x2 - x1);
      return y1 + t * (y2 - y1);
    }
  }
  return sorted[sorted.length - 1][1];
}

export interface ReverseCascadeResult {
  detectedDriftPct: number;
  impliedAnnualDelta: number;
  proposedRefresh: {
    affectedYears: number[];
    suggestedAnnualValues: { year: number; newValue: number }[];
    confidenceScore: number;
  };
  reconciliationEventId: string;
}

export function reverseCascade(
  forecast: ConnectedForecast,
  computedAnnual: AnnualDataPoint[],
  windowWeeks = 13,
  observedDriftPct = -0.06 // default simulated value used for the demo
): ReverseCascadeResult {
  const currentYear = new Date(forecast.timeframe.forecastStart).getUTCFullYear();
  const baseline = computedAnnual.find((p) => p.year === currentYear)?.netSales ?? 0;

  // Compute weeks remaining in the year
  const cutoff = new Date(forecast.stf.actualsCutoffDate);
  const yearEnd = new Date(`${currentYear}-12-31T00:00:00Z`);
  const weeksRemaining = Math.max(0, Math.round((yearEnd.getTime() - cutoff.getTime()) / (7 * 86400 * 1000)));

  // The drift, if sustained, applies to the remaining weeks of the year and proportionally to next-year LRP
  const annualWeight = weeksRemaining / 52;
  const impliedAnnualDelta = baseline * observedDriftPct * annualWeight;

  const affectedYears = [currentYear, currentYear + 1, currentYear + 2];
  const suggestedAnnualValues = affectedYears.map((y) => {
    const cur = computedAnnual.find((p) => p.year === y)?.netSales ?? 0;
    const factor = y === currentYear ? annualWeight : 0.5;
    return { year: y, newValue: cur + cur * observedDriftPct * factor };
  });

  return {
    detectedDriftPct: observedDriftPct,
    impliedAnnualDelta,
    proposedRefresh: {
      affectedYears,
      suggestedAnnualValues,
      confidenceScore: Math.min(0.95, 0.55 + windowWeeks / 52),
    },
    reconciliationEventId: `reverse-cascade-${Date.now().toString(36)}`,
  };
}

export function lifecycleModeOf(forecast: ConnectedForecast): LifecycleMode {
  return forecast.lifecycleContext?.mode ?? "exclusivity";
}
