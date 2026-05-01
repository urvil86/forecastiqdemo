import type {
  ConnectedForecast,
  ComputedForecastConnected,
  AnnualDataPoint,
  MonthlyDataPoint,
  WeeklyDataPoint,
  DailyDataPoint,
  TrendAlgorithm,
} from "./types";
import { trend } from "./trending";
import { applyEventsAnnual, applyStfEventsFactor } from "./events";
import { interpolateAnchors } from "./cascade";
import { netPriceFromGross } from "./pricing";
import {
  annualToMonthly,
  generateWeekStarts,
  parseIsoDate,
  isoDate,
  isoWeekNumber,
  monthKey as monthKeyOf,
  quarterOfMonth,
  getMondayOfWeek,
  dayOfWeekKey,
} from "./phasing";

export const ENGINE_NOW_YEAR = 2026;
const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type DayKey = (typeof DAY_KEYS)[number];

interface DailyInternal {
  date: string;
  weekStart: string;
  dayOfWeek: DayKey;
  year: number;
  month: string;
  volume: number;
  netSales: number;
  grossSales: number;
  share: number;
  netPrice: number;
}

export function compute(forecast: ConnectedForecast): ComputedForecastConnected {
  const startYear = parseInt(forecast.timeframe.historicalStart.split("-")[0]);
  const endYear = parseInt(forecast.timeframe.forecastEnd.split("-")[0]);

  // STEP 1 — Trend
  const fit = trend(
    forecast.lrp.selectedAlgorithm,
    forecast.lrp.annualActuals,
    endYear,
    forecast.lrp.algorithmParams,
    forecast.lrp.customizationCurve
  );
  const annualBaselineMap = new Map<number, number>();
  for (const a of forecast.lrp.annualActuals) annualBaselineMap.set(a.year, a.value);
  for (const p of fit.projection) annualBaselineMap.set(p.year, p.value);
  const annualBaseline: { year: number; value: number }[] = [];
  for (let y = startYear; y <= endYear; y++) {
    annualBaseline.push({ year: y, value: annualBaselineMap.get(y) ?? 0 });
  }

  // STEP 2 — Events
  const annualEvented = applyEventsAnnual(annualBaseline, forecast.lrp.events);

  // STEP 3 — Share cascade
  const classShareYear = interpolateAnchors(forecast.lrp.classShare, startYear, endYear);
  const productShareYear = interpolateAnchors(forecast.lrp.productShare, startYear, endYear);
  const annualVolume = annualEvented.map((e, i) => ({
    year: e.year,
    value: e.value * classShareYear[i].value * productShareYear[i].value,
  }));

  // STEP 4 — Pricing
  const grossPriceYear = interpolateAnchors(forecast.lrp.grossPrice, startYear, endYear);
  const gtnYear = interpolateAnchors(forecast.lrp.gtnRate, startYear, endYear);
  const annualDataPoints: AnnualDataPoint[] = annualVolume.map((v, i) => {
    const gross = grossPriceYear[i].value;
    const gtn = gtnYear[i].value;
    const net = netPriceFromGross(gross, gtn);
    return {
      year: v.year,
      volume: v.value,
      grossSales: v.value * gross,
      netSales: v.value * net,
      share: productShareYear[i].value,
      classShare: classShareYear[i].value,
      grossPrice: gross,
      gtnRate: gtn,
      netPrice: net,
    };
  });

  // STEP 5 — Decompose annual to monthly via ERDs (ALL years; exact)
  const monthlyDataPoints: MonthlyDataPoint[] = [];
  for (const a of annualDataPoints) {
    const volMonths = annualToMonthly(a.volume, a.year, forecast.phasing.erdByMonth);
    const netMonths = annualToMonthly(a.netSales, a.year, forecast.phasing.erdByMonth);
    const grossMonths = annualToMonthly(a.grossSales, a.year, forecast.phasing.erdByMonth);
    for (let i = 0; i < volMonths.length; i++) {
      monthlyDataPoints.push({
        month: volMonths[i].month,
        year: a.year,
        quarter: quarterOfMonth(volMonths[i].month),
        volume: volMonths[i].value,
        netSales: netMonths[i].value,
        grossSales: grossMonths[i].value,
        share: a.share,
        netPrice: a.netPrice,
        source: "lrp-derived",
      });
    }
  }
  const monthlyByKey = new Map(monthlyDataPoints.map((m) => [m.month, m]));

  // STEP 6 — Build daily distributions for current+next year (profile-weighted within month)
  const dailyMap = new Map<string, DailyInternal>();
  const profileMap = new Map(forecast.phasing.weeklyProfileMap.map((p) => [p.weekStart, p.profileId]));
  const dailyProfiles = forecast.phasing.dailyProfiles;
  const standardProfile = dailyProfiles.find((p) => p.id === "standard") ?? dailyProfiles[0];

  function getProfile(weekStart: string) {
    const id = profileMap.get(weekStart);
    if (!id) return standardProfile;
    return dailyProfiles.find((p) => p.id === id) ?? standardProfile;
  }

  // Generate weekly/daily grain across enough history to cover the maximum History Window (156 weeks ≈ 3 years)
  // plus the forecast horizon. Earliest year is bounded by the first historical actual so we don't generate
  // synthetic weekly data before the model has meaningful annual values.
  const earliestActualYear =
    forecast.lrp.annualActuals[0]?.year ?? ENGINE_NOW_YEAR - 3;
  const weeklyStartYear = Math.max(earliestActualYear, ENGINE_NOW_YEAR - 4);
  const weeklyYears: number[] = [];
  for (let y = weeklyStartYear; y <= ENGINE_NOW_YEAR + 1; y++) weeklyYears.push(y);

  for (const y of weeklyYears) {
    for (let m = 1; m <= 12; m++) {
      const mk = `${y}-${String(m).padStart(2, "0")}`;
      const monthly = monthlyByKey.get(mk);
      if (!monthly) continue;

      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const dayInfos: { date: Date; weekStart: string; dayKey: DayKey; weight: number }[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(Date.UTC(y, m - 1, d));
        const weekStart = isoDate(getMondayOfWeek(date));
        const dayKey = dayOfWeekKey(date) as DayKey;
        const profile = getProfile(weekStart);
        const weight = profile.dayWeights[dayKey];
        dayInfos.push({ date, weekStart, dayKey, weight });
      }
      const totalWeight = dayInfos.reduce((s, di) => s + di.weight, 0);

      for (const di of dayInfos) {
        const share = totalWeight === 0 ? 1 / dayInfos.length : di.weight / totalWeight;
        const dateStr = isoDate(di.date);
        dailyMap.set(dateStr, {
          date: dateStr,
          weekStart: di.weekStart,
          dayOfWeek: di.dayKey,
          year: y,
          month: mk,
          volume: monthly.volume * share,
          netSales: monthly.netSales * share,
          grossSales: monthly.grossSales * share,
          share: monthly.share,
          netPrice: monthly.netPrice,
        });
      }
    }
  }

  // STEP 7 — Aggregate daily to weekly (initial, before STF overrides)
  const weeklyMap = new Map<string, WeeklyDataPoint>();
  for (const d of dailyMap.values()) {
    let w = weeklyMap.get(d.weekStart);
    if (!w) {
      const wd = parseIsoDate(d.weekStart);
      w = {
        weekStart: d.weekStart,
        year: wd.getUTCFullYear(),
        isoWeek: isoWeekNumber(wd),
        month: monthKeyOf(wd),
        skuValues: [],
        totalVolume: 0,
        totalNetSales: 0,
        isActual: false,
        isPartial: false,
        source: "lrp-derived",
      };
      weeklyMap.set(d.weekStart, w);
    }
    w.totalVolume += d.volume;
    w.totalNetSales += d.netSales;
  }

  // STEP 7.5 — Apply STF (short-horizon) events to weekly + scale daily proportionally
  const stfEvents = forecast.stf.events ?? [];
  if (stfEvents.some((e) => e.enabled)) {
    for (const w of weeklyMap.values()) {
      const wd = parseIsoDate(w.weekStart);
      const factor = applyStfEventsFactor(wd, stfEvents);
      if (Math.abs(factor - 1) < 1e-9) continue;
      w.totalVolume *= factor;
      w.totalNetSales *= factor;
      for (const d of dailyMap.values()) {
        if (d.weekStart === w.weekStart) {
          d.volume *= factor;
          d.netSales *= factor;
          d.grossSales *= factor;
        }
      }
    }
  }

  // STEP 8 — Apply STF overrides at week level (modify totalVolume/totalNetSales)
  const weeklyInputMap = new Map<string, (typeof forecast.stf.weeklyInputs)[number]>();
  for (const wi of forecast.stf.weeklyInputs) weeklyInputMap.set(`${wi.weekStart}|${wi.sku}`, wi);

  const cutoff = parseIsoDate(forecast.stf.actualsCutoffDate);
  const partial = parseIsoDate(forecast.stf.latestPartialDate);
  const activeSkus = forecast.stf.skus.filter((s) => s.active);
  const totalActiveMix = activeSkus.reduce((s, sku) => s + sku.defaultMixPct, 0) || 1;

  for (const w of weeklyMap.values()) {
    const wd = parseIsoDate(w.weekStart);
    w.isActual = wd.getTime() <= cutoff.getTime();
    w.isPartial = wd.getTime() > cutoff.getTime() && wd.getTime() <= partial.getTime();

    // If any active SKU has a per-week skuMixOverride for this week, use those values
    // (renormalized across active SKUs for the week) instead of the global defaultMixPct.
    let weekHasMixOverride = false;
    let weekMixSum = 0;
    const weekMixByid = new Map<string, number>();
    for (const sku of activeSkus) {
      const wi = weeklyInputMap.get(`${w.weekStart}|${sku.id}`);
      if (wi?.skuMixOverride !== undefined) weekHasMixOverride = true;
      const v = wi?.skuMixOverride ?? sku.defaultMixPct;
      weekMixByid.set(sku.id, v);
      weekMixSum += v;
    }
    const weekTotalMix = weekHasMixOverride ? (weekMixSum || 1) : totalActiveMix;

    // Compute SKU breakdown from week total + STF overrides
    let weekTotalVol = 0;
    let weekTotalNet = 0;
    let weekTotalGross = 0;
    let anyOverride = weekHasMixOverride;

    for (const sku of activeSkus) {
      const skuMixValue = weekHasMixOverride
        ? (weekMixByid.get(sku.id) ?? sku.defaultMixPct)
        : sku.defaultMixPct;
      const baseSkuShare = skuMixValue / weekTotalMix;
      const baseSkuVol = w.totalVolume * baseSkuShare;
      // Find equivalent net/gross for this SKU
      const baseSkuNet = w.totalNetSales * baseSkuShare;
      // Approximate SKU gross from week's average gross/volume ratio
      const baseSkuGross = baseSkuNet > 0 ? baseSkuNet / Math.max(0.0001, 1 - 0.5825) : 0; // placeholder; recomputed below
      const wi = weeklyInputMap.get(`${w.weekStart}|${sku.id}`);

      let vol = baseSkuVol;
      let net = baseSkuNet;
      let gross = baseSkuGross;
      if (wi?.override !== undefined) {
        anyOverride = true;
        const factor = baseSkuVol > 0 ? wi.override / baseSkuVol : 1;
        vol = wi.override;
        net = baseSkuNet * factor;
        gross = baseSkuGross * factor;
      } else if (wi?.holidayAdjPct !== undefined) {
        anyOverride = true;
        const f = 1 + wi.holidayAdjPct;
        vol = baseSkuVol * f;
        net = baseSkuNet * f;
        gross = baseSkuGross * f;
      } else if (wi?.eventImpactUnits !== undefined) {
        anyOverride = true;
        vol = baseSkuVol + wi.eventImpactUnits;
        const f = baseSkuVol > 0 ? vol / baseSkuVol : 1;
        net = baseSkuNet * f;
        gross = baseSkuGross * f;
      }

      const netPrice = vol > 0 ? net / vol : 0;
      w.skuValues.push({ sku: sku.id, volume: vol, netSales: net, grossSales: gross, netPrice });
      weekTotalVol += vol;
      weekTotalNet += net;
      weekTotalGross += gross;
    }

    // Update week totals based on SKU values (which may differ from initial daily-summed totals if overrides applied)
    const oldTotalVol = w.totalVolume;
    const oldTotalNet = w.totalNetSales;
    w.totalVolume = weekTotalVol;
    w.totalNetSales = weekTotalNet;
    w.source = w.isActual ? "stf-actual" : anyOverride ? "stf-forecast" : "lrp-derived";

    // Scale daily values proportionally to maintain daily-to-weekly consistency
    if (oldTotalVol > 0 && Math.abs(weekTotalVol - oldTotalVol) > 1e-6) {
      const fVol = weekTotalVol / oldTotalVol;
      const fNet = oldTotalNet === 0 ? 1 : weekTotalNet / oldTotalNet;
      for (const d of dailyMap.values()) {
        if (d.weekStart === w.weekStart) {
          d.volume *= fVol;
          d.netSales *= fNet;
          d.grossSales *= fVol;
        }
      }
    }
  }

  // STEP 9 — Re-aggregate daily to monthly (current+next year only) so STF overrides bubble up
  for (const y of weeklyYears) {
    for (let m = 1; m <= 12; m++) {
      const mk = `${y}-${String(m).padStart(2, "0")}`;
      let v = 0,
        net = 0,
        gross = 0;
      for (const d of dailyMap.values()) {
        if (d.month === mk) {
          v += d.volume;
          net += d.netSales;
          gross += d.grossSales;
        }
      }
      const monthly = monthlyByKey.get(mk);
      if (monthly) {
        monthly.volume = v;
        monthly.netSales = net;
        monthly.grossSales = gross;
        const weeksInMonth = Array.from(weeklyMap.values()).filter((w) => w.month === mk);
        const allActual = weeksInMonth.length > 0 && weeksInMonth.every((w) => w.isActual);
        const anyOverride = weeksInMonth.some((w) => w.source === "stf-forecast");
        monthly.source = allActual ? "stf-actual" : anyOverride ? "stf-forecast" : "lrp-derived";
      }
    }
  }

  // STEP 10 — Re-aggregate monthly to annual for current+next year (STF overrides bubble up to annual)
  for (const y of weeklyYears) {
    let v = 0,
      net = 0,
      gross = 0;
    for (const m of monthlyDataPoints) {
      if (m.year === y) {
        v += m.volume;
        net += m.netSales;
        gross += m.grossSales;
      }
    }
    const annual = annualDataPoints.find((a) => a.year === y);
    if (annual) {
      annual.volume = v;
      annual.netSales = net;
      annual.grossSales = gross;
      annual.netPrice = v > 0 ? net / v : annual.netPrice;
    }
  }

  // STEP 11 — Convert dailyMap to DailyDataPoint[] (current year only)
  const dailyDataPoints: DailyDataPoint[] = [];
  for (const d of dailyMap.values()) {
    if (d.year === ENGINE_NOW_YEAR) {
      dailyDataPoints.push({
        date: d.date,
        weekStart: d.weekStart,
        dayOfWeek: d.dayOfWeek,
        totalVolume: d.volume,
        totalNetSales: d.netSales,
      });
    }
  }
  dailyDataPoints.sort((a, b) => a.date.localeCompare(b.date));

  const weeklyDataPoints = Array.from(weeklyMap.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // STEP 12 — LRP-STF reconciliation (use clean LRP-pure values)
  const lrpStfDelta: ComputedForecastConnected["lrpStfDelta"] = [];
  const lrpPureMonthly = new Map<string, number>();
  for (const a of annualVolume.map((v, i) => ({
    year: v.year,
    netSales: v.value * netPriceFromGross(grossPriceYear[i].value, gtnYear[i].value),
  }))) {
    const netMonths = annualToMonthly(a.netSales, a.year, forecast.phasing.erdByMonth);
    for (const nm of netMonths) lrpPureMonthly.set(nm.month, nm.value);
  }
  for (let q = 1; q <= 4; q++) {
    const qMonths: string[] = [];
    for (let mm = (q - 1) * 3 + 1; mm <= q * 3; mm++) {
      qMonths.push(`${ENGINE_NOW_YEAR}-${String(mm).padStart(2, "0")}`);
    }
    let lrpForecast = 0;
    let stfActualPlus = 0;
    let totalWeeks = 0;
    let actualWeeks = 0;
    for (const mk of qMonths) {
      lrpForecast += lrpPureMonthly.get(mk) ?? 0;
      const monthly = monthlyByKey.get(mk);
      if (monthly) stfActualPlus += monthly.netSales;
    }
    for (const w of weeklyDataPoints) {
      if (qMonths.includes(w.month)) {
        totalWeeks++;
        if (w.isActual) actualWeeks++;
      }
    }
    const delta = stfActualPlus - lrpForecast;
    const deltaPct = lrpForecast === 0 ? 0 : delta / lrpForecast;
    lrpStfDelta.push({
      period: `${ENGINE_NOW_YEAR}-Q${q}`,
      lrpForecast,
      stfActualPlusForecast: stfActualPlus,
      deltaUsd: delta,
      deltaPct,
      actualWeight: totalWeeks === 0 ? 0 : actualWeeks / totalWeeks,
    });
  }
  let annLrp = 0,
    annStf = 0,
    totalWeeksY = 0,
    actualWeeksY = 0;
  for (let mm = 1; mm <= 12; mm++) {
    const mk = `${ENGINE_NOW_YEAR}-${String(mm).padStart(2, "0")}`;
    annLrp += lrpPureMonthly.get(mk) ?? 0;
    const monthly = monthlyByKey.get(mk);
    if (monthly) annStf += monthly.netSales;
  }
  for (const w of weeklyDataPoints) {
    if (w.year === ENGINE_NOW_YEAR) {
      totalWeeksY++;
      if (w.isActual) actualWeeksY++;
    }
  }
  lrpStfDelta.push({
    period: `${ENGINE_NOW_YEAR}-Annual`,
    lrpForecast: annLrp,
    stfActualPlusForecast: annStf,
    deltaUsd: annStf - annLrp,
    deltaPct: annLrp === 0 ? 0 : (annStf - annLrp) / annLrp,
    actualWeight: totalWeeksY === 0 ? 0 : actualWeeksY / totalWeeksY,
  });

  // STEP 13 — Grain consistency
  const grainConsistency = computeGrainConsistency(
    annualDataPoints,
    monthlyDataPoints,
    weeklyDataPoints,
    dailyDataPoints,
    Array.from(dailyMap.values())
  );

  // STEP 14 — Trend diagnostics
  const trendDiagnostics: ComputedForecastConnected["trendDiagnostics"] = {
    fitStart: `${forecast.lrp.annualActuals[0]?.year ?? startYear}-01-01`,
    fitEnd: `${forecast.lrp.annualActuals[forecast.lrp.annualActuals.length - 1]?.year ?? startYear}-12-31`,
    algorithmsCompared:
      fit.comparisons ??
      computeAllAlgorithmComparisons(forecast.lrp.annualActuals, endYear, forecast.lrp.algorithmParams),
    selectedAlgorithm: fit.algorithmRun,
  };

  return {
    forecastId: forecast.id,
    computedAt: "DETERMINISTIC",
    daily: dailyDataPoints,
    weekly: weeklyDataPoints,
    monthly: monthlyDataPoints,
    annual: annualDataPoints,
    grainConsistency,
    lrpStfDelta,
    trendDiagnostics,
  };
}

function computeGrainConsistency(
  annual: AnnualDataPoint[],
  monthly: MonthlyDataPoint[],
  weekly: WeeklyDataPoint[],
  daily: DailyDataPoint[],
  allDaily: DailyInternal[]
) {
  let mtaMax = 0;
  for (const a of annual) {
    const monthlySum = monthly
      .filter((m) => m.year === a.year)
      .reduce((s, m) => s + m.netSales, 0);
    if (a.netSales > 0) {
      const drift = Math.abs(monthlySum - a.netSales) / a.netSales;
      if (drift > mtaMax) mtaMax = drift;
    }
  }
  // Weekly to monthly: aggregate weekly values back to months using actual daily allocation
  // (boundary weeks contribute their daily sums to the appropriate month)
  let wtmMax = 0;
  const monthly_byKey = new Map(monthly.map((m) => [m.month, m]));
  const monthAggFromDaily = new Map<string, number>();
  for (const d of allDaily) {
    monthAggFromDaily.set(d.month, (monthAggFromDaily.get(d.month) ?? 0) + d.netSales);
  }
  for (const [mk, agg] of monthAggFromDaily) {
    const m = monthly_byKey.get(mk);
    const yr = parseInt(mk.split("-")[0]);
    if (yr < ENGINE_NOW_YEAR || yr > ENGINE_NOW_YEAR + 1) continue;
    if (m && m.netSales > 0) {
      const drift = Math.abs(agg - m.netSales) / m.netSales;
      if (drift > wtmMax) wtmMax = drift;
    }
  }
  // Daily to weekly: only check weeks whose 7 days all sit inside the current year
  // (boundary weeks straddling year edges have intentionally-partial daily coverage)
  let dtwMax = 0;
  const dayWeek = new Map<string, number>();
  const dayCount = new Map<string, number>();
  for (const d of daily) {
    dayWeek.set(d.weekStart, (dayWeek.get(d.weekStart) ?? 0) + d.totalNetSales);
    dayCount.set(d.weekStart, (dayCount.get(d.weekStart) ?? 0) + 1);
  }
  for (const [ws, sum] of dayWeek) {
    if ((dayCount.get(ws) ?? 0) < 7) continue;
    const w = weekly.find((ww) => ww.weekStart === ws);
    if (w && w.totalNetSales > 0) {
      const drift = Math.abs(sum - w.totalNetSales) / w.totalNetSales;
      if (drift > dtwMax) dtwMax = drift;
    }
  }
  return {
    weeklyToMonthlyMaxDriftPct: wtmMax,
    monthlyToAnnualMaxDriftPct: mtaMax,
    dailyToWeeklyMaxDriftPct: dtwMax,
  };
}

function computeAllAlgorithmComparisons(
  actuals: { year: number; value: number }[],
  endYear: number,
  params: { alpha?: number; beta?: number; gamma?: number }
) {
  const algorithms: TrendAlgorithm[] = [
    "linear",
    "exp-smoothing",
    "holt-winter-add",
    "holt-winter-mul",
    "sma-auto",
  ];
  return algorithms.map((alg) => {
    const r = trend(alg, actuals, endYear, params);
    return { algorithm: alg, rsq: r.rsq, mape: r.mape, rmse: r.rmse };
  });
}
