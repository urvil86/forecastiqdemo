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
import { applyEventsAnnual, applyStfEventsFactor, sigmoidImpact } from "./events";
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

// ──────────────────────────────────────────────────────────────
//  HELPER — compute the combined multiplicative event factor
//  for a given year (uses mid-year month=6, same as applyEventsAnnual)
// ──────────────────────────────────────────────────────────────
function eventFactorForYear(year: number, events: ConnectedForecast["lrp"]["events"]): number {
  const enabled = events.filter((e) => e.enabled);
  let factor = 1;
  for (const e of enabled) {
    const f = sigmoidImpact(year, 6, e);
    const direction = e.type === "positive" ? 1 : -1;
    factor *= 1 + direction * e.peakImpact * f;
  }
  return factor;
}

// ──────────────────────────────────────────────────────────────
//  HELPER — blend the transition from historical clean-baseline
//  to trend projection over a short window to avoid a visible
//  bump at the actual→forecast boundary.
//
//  blendWindow = number of years to smooth over (default 2).
//  For years before the window  → 100% trend value
//  For years inside the window  → weighted average
//  The blend only affects forecast years immediately after the
//  last actual; historical years use the trend value as-is
//  (so the round-trip QC remains valid).
// ──────────────────────────────────────────────────────────────
function blendBoundary(
  cleanBaseline: { year: number; value: number }[],
  trendValues: Map<number, number>,
  lastActualYear: number,
  blendWindow: number = 2
): Map<number, number> {
  const blended = new Map<number, number>();
  const lastClean = cleanBaseline.find((c) => c.year === lastActualYear)?.value ?? 0;

  for (const [year, trendVal] of trendValues) {
    if (year <= lastActualYear) {
      // Historical: use pure trend (for QC comparison against actuals)
      blended.set(year, trendVal);
    } else if (year <= lastActualYear + blendWindow) {
      // Transition zone: blend from last actual clean value to trend
      const t = (year - lastActualYear) / (blendWindow + 1); // 0→1
      const blendedVal = lastClean * (1 - t) + trendVal * t;
      blended.set(year, blendedVal);
    } else {
      // Pure forecast: use trend as-is
      blended.set(year, trendVal);
    }
  }
  return blended;
}

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
  const lastActualYear = forecast.lrp.annualActuals[forecast.lrp.annualActuals.length - 1]?.year ?? ENGINE_NOW_YEAR - 1;

  // ────────────────────────────────────────────────────────
  //  STEP 1 — STRIP event impacts from actuals to get
  //  a "clean" baseline that the trend algorithm can fit.
  //
  //  cleanBaseline = actuals / eventFactor
  //
  //  This removes the known event effects so the trend
  //  captures only the underlying organic growth.
  // ────────────────────────────────────────────────────────
  const cleanBaseline: { year: number; value: number }[] = forecast.lrp.annualActuals.map(
    ({ year, value }) => {
      const ef = eventFactorForYear(year, forecast.lrp.events);
      return { year, value: ef !== 0 ? value / ef : value };
    }
  );

  // ────────────────────────────────────────────────────────
  //  STEP 2 — FIT trend on the clean (event-free) baseline.
  //  The trend now captures pure organic trajectory.
  // ────────────────────────────────────────────────────────
  const fit = trend(
    forecast.lrp.selectedAlgorithm,
    cleanBaseline,
    endYear,
    forecast.lrp.algorithmParams,
    forecast.lrp.customizationCurve
  );

  // Build a map of trend-fitted values for ALL years
  const trendFittedMap = new Map<number, number>();
  for (const a of cleanBaseline) trendFittedMap.set(a.year, a.value); // historical: use stripped actual
  for (const p of fit.projection) trendFittedMap.set(p.year, p.value); // forecast: use trend projection

  // Apply boundary blending for smooth actual→forecast handoff
  const blendedBaseline = blendBoundary(cleanBaseline, trendFittedMap, lastActualYear, 2);

  // Assemble the full annual baseline timeline
  const annualBaseline: { year: number; value: number }[] = [];
  for (let y = startYear; y <= endYear; y++) {
    annualBaseline.push({ year: y, value: blendedBaseline.get(y) ?? 0 });
  }

  // ────────────────────────────────────────────────────────
  //  STEP 3 — REAPPLY events to the full timeline.
  //
  //  For historical years:
  //    output = cleanBaseline × eventFactor
  //           = (actuals / eventFactor) × eventFactor
  //           = actuals  ← EXACT round-trip, blue line is immovable
  //
  //  For forecast years:
  //    output = trendProjection × eventFactor
  //           = organic trend shaped by future events
  // ────────────────────────────────────────────────────────
  const annualEvented = applyEventsAnnual(annualBaseline, forecast.lrp.events);

  // ────────────────────────────────────────────────────────
  //  QC — Round-trip check: verify historical years match
  //  actuals within floating-point tolerance.
  //  Log warnings if drift exceeds threshold.
  // ────────────────────────────────────────────────────────
  const actualsMap = new Map(forecast.lrp.annualActuals.map((a) => [a.year, a.value]));
  const roundTripDrifts: { year: number; actual: number; computed: number; driftPct: number }[] = [];
  for (const ae of annualEvented) {
    const actual = actualsMap.get(ae.year);
    if (actual !== undefined && actual > 0) {
      const driftPct = Math.abs(ae.value - actual) / actual;
      if (driftPct > 1e-9) {
        roundTripDrifts.push({
          year: ae.year,
          actual,
          computed: ae.value,
          driftPct,
        });
      }
    }
  }
  if (roundTripDrifts.length > 0) {
    console.warn(
      "[compute] Round-trip QC FAILED — historical actuals not preserved after event strip/reapply:",
      roundTripDrifts
    );
  }

  // STEP 4 — Share cascade (unchanged)
  const classShareYear = interpolateAnchors(forecast.lrp.classShare, startYear, endYear);
  const productShareYear = interpolateAnchors(forecast.lrp.productShare, startYear, endYear);
  const annualVolume = annualEvented.map((e, i) => ({
    year: e.year,
    value: e.value * classShareYear[i].value * productShareYear[i].value,
  }));

  // STEP 5 — Pricing (unchanged)
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

  // STEP 6 — Decompose annual to monthly via ERDs (ALL years; exact)
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

  // STEP 7 — Build daily distributions for current+next year (profile-weighted within month)
  const dailyMap = new Map<string, DailyInternal>();
  const profileMap = new Map(forecast.phasing.weeklyProfileMap.map((p) => [p.weekStart, p.profileId]));
  const dailyProfiles = forecast.phasing.dailyProfiles;
  const standardProfile = dailyProfiles.find((p) => p.id === "standard") ?? dailyProfiles[0];

  function getProfile(weekStart: string) {
    const id = profileMap.get(weekStart);
    if (!id) return standardProfile;
    return dailyProfiles.find((p) => p.id === id) ?? standardProfile;
  }

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

  // STEP 8 — Aggregate daily to weekly (initial, before STF overrides)
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

  // STEP 8.5 — Apply STF (short-horizon) events to weekly + scale daily proportionally
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

  // STEP 9 — Apply STF overrides at week level (modify totalVolume/totalNetSales)
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

    let weekTotalVol = 0;
    let weekTotalNet = 0;
    let weekTotalGross = 0;
    let anyOverride = false;

    for (const sku of activeSkus) {
      const baseSkuShare = sku.defaultMixPct / totalActiveMix;
      const baseSkuVol = w.totalVolume * baseSkuShare;
      const baseSkuNet = w.totalNetSales * baseSkuShare;
      const baseSkuGross = baseSkuNet > 0 ? baseSkuNet / Math.max(0.0001, 1 - 0.5825) : 0;
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

    const oldTotalVol = w.totalVolume;
    const oldTotalNet = w.totalNetSales;
    w.totalVolume = weekTotalVol;
    w.totalNetSales = weekTotalNet;
    w.source = w.isActual ? "stf-actual" : anyOverride ? "stf-forecast" : "lrp-derived";

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

  // STEP 10 — Re-aggregate daily to monthly (current+next year only) so STF overrides bubble up
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

  // STEP 11 — Re-aggregate monthly to annual for current+next year (STF overrides bubble up to annual)
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

  // STEP 12 — Convert dailyMap to DailyDataPoint[] (current year only)
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

  // STEP 13 — LRP-STF reconciliation (use clean LRP-pure values)
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

  // STEP 14 — Grain consistency
  const grainConsistency = computeGrainConsistency(
    annualDataPoints,
    monthlyDataPoints,
    weeklyDataPoints,
    dailyDataPoints,
    Array.from(dailyMap.values())
  );

  // STEP 15 — Trend diagnostics (now reflects trend fit on CLEAN baseline)
  const trendDiagnostics: ComputedForecastConnected["trendDiagnostics"] = {
    fitStart: `${forecast.lrp.annualActuals[0]?.year ?? startYear}-01-01`,
    fitEnd: `${forecast.lrp.annualActuals[forecast.lrp.annualActuals.length - 1]?.year ?? startYear}-12-31`,
    algorithmsCompared:
      fit.comparisons ??
      computeAllAlgorithmComparisons(cleanBaseline, endYear, forecast.lrp.algorithmParams),
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
    // NEW: expose round-trip QC for frontend display
    roundTripQC: {
      passed: roundTripDrifts.length === 0,
      drifts: roundTripDrifts,
    },
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
  // NOTE: comparisons now run on clean (event-stripped) baseline
  return algorithms.map((alg) => {
    const r = trend(alg, actuals, endYear, params);
    return { algorithm: alg, rsq: r.rsq, mape: r.mape, rmse: r.rmse };
  });
}
