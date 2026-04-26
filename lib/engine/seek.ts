import type {
  ConnectedForecast,
  ComputedForecastConnected,
  SeekOptions,
  SeekResult,
  AchievabilityFlag,
} from "./types";
import { compute } from "./compute";
import { monthlyToWeekly, generateWeekStarts } from "./phasing";

const SUGGESTED_ACTIONS = [
  "Field force concentration: redirect reps to top-30 infusion centers",
  "Sample allocation push: deploy additional samples to high-conversion regions",
  "Patient services acceleration: prioritize enrollment-to-first-infusion compression",
  "DTC awareness: short-burst campaign in target geographies",
  "Channel investment: targeted infusion suite expansion",
  "Speaker programs: tier-1 KOL engagement in 8 priority markets",
  "Co-pay assistance expansion: lower out-of-pocket barriers for new patients",
];

function flagFor(
  multiplier: number,
  thresholds: SeekOptions["achievabilityThresholds"]
): AchievabilityFlag {
  if (multiplier <= thresholds.achievable) return "achievable";
  if (multiplier <= thresholds.stretch) return "stretch";
  return "requires-intervention";
}

function pickActionsForWeek(weekIdx: number): string[] {
  const out: string[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < 3; i++) {
    const idx = (weekIdx * 3 + i * 5) % SUGGESTED_ACTIONS.length;
    let pick = idx;
    while (seen.has(pick)) pick = (pick + 1) % SUGGESTED_ACTIONS.length;
    seen.add(pick);
    out.push(SUGGESTED_ACTIONS[pick]);
  }
  return out;
}

export function seekToForecast(
  forecast: ConnectedForecast,
  target: { year: number; targetNetSales: number },
  options: SeekOptions,
  precomputed?: ComputedForecastConnected
): SeekResult {
  const computed = precomputed ?? compute(forecast);
  const annual = computed.annual.find((a) => a.year === target.year);
  const baselineNetSales = annual ? annual.netSales : 0;
  const requiredLift = target.targetNetSales - baselineNetSales;
  const liftPct = baselineNetSales === 0 ? 0 : requiredLift / baselineNetSales;

  const months: { month: string; netSales: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${target.year}-${String(m).padStart(2, "0")}`;
    const found = computed.monthly.find((mm) => mm.month === key);
    months.push({ month: key, netSales: found ? found.netSales : 0 });
  }

  // Distribute annual lift to months
  const totalBaselineMonths = months.reduce((s, m) => s + m.netSales, 0);
  const erdsByMonth = forecast.phasing.erdByMonth.filter((e) =>
    e.month.startsWith(`${target.year}-`)
  );
  const totalErds = erdsByMonth.reduce((s, e) => s + e.erds, 0);

  const monthlyDecomposition: SeekResult["monthlyDecomposition"] = months.map((m, i) => {
    let additional = 0;
    if (options.distributionMethod === "flat") {
      const erds = erdsByMonth[i]?.erds ?? 21;
      additional = totalErds === 0 ? requiredLift / 12 : (requiredLift * erds) / totalErds;
    } else if (options.distributionMethod === "historical-pattern") {
      additional =
        totalBaselineMonths === 0
          ? requiredLift / 12
          : (requiredLift * m.netSales) / totalBaselineMonths;
    } else {
      // event-weighted: concentrate in months without negative events near
      additional = totalBaselineMonths === 0 ? requiredLift / 12 : (requiredLift * m.netSales) / totalBaselineMonths;
      // Slight tilt: boost first half of year
      const monthIdx = i + 1;
      const tilt = monthIdx <= 6 ? 1.15 : 0.85;
      additional *= tilt;
    }
    const required = m.netSales + additional;
    const multiplier = m.netSales === 0 ? (additional > 0 ? Infinity : 1) : required / m.netSales;
    return {
      month: m.month,
      baseline: m.netSales,
      required,
      additional,
      runRateMultiplier: Number.isFinite(multiplier) ? multiplier : 999,
      achievabilityFlag: flagFor(multiplier, options.achievabilityThresholds),
    };
  });

  // Normalize monthly additional to exactly equal requiredLift
  const sumAdd = monthlyDecomposition.reduce((s, m) => s + m.additional, 0);
  if (Math.abs(sumAdd - requiredLift) > 1 && sumAdd !== 0) {
    const scale = requiredLift / sumAdd;
    for (const m of monthlyDecomposition) {
      m.additional *= scale;
      m.required = m.baseline + m.additional;
      m.runRateMultiplier = m.baseline === 0 ? (m.additional > 0 ? 999 : 1) : m.required / m.baseline;
      m.achievabilityFlag = flagFor(m.runRateMultiplier, options.achievabilityThresholds);
    }
  }

  // Decompose to weekly per active SKU
  const weekStarts = generateWeekStarts(`${target.year}-01-05`, `${target.year}-12-28`);
  const activeSkus = forecast.stf.skus.filter((s) => s.active);
  const totalActiveMix = activeSkus.reduce((s, sku) => s + sku.defaultMixPct, 0) || 1;
  const weeklyDecomposition: SeekResult["weeklyDecomposition"] = [];

  for (const m of monthlyDecomposition) {
    const baselineWeeks = monthlyToWeekly(m.baseline, m.month, weekStarts, forecast.phasing.weeklyOfMonth);
    const requiredWeeks = monthlyToWeekly(m.required, m.month, weekStarts, forecast.phasing.weeklyOfMonth);
    for (let i = 0; i < baselineWeeks.length; i++) {
      const ws = baselineWeeks[i].weekStart;
      const baseTotal = baselineWeeks[i].value;
      const reqTotal = requiredWeeks[i].value;
      for (const sku of activeSkus) {
        const baseSku = (baseTotal * sku.defaultMixPct) / totalActiveMix;
        const reqSku = (reqTotal * sku.defaultMixPct) / totalActiveMix;
        const additional = reqSku - baseSku;
        const multiplier = baseSku === 0 ? (additional > 0 ? 999 : 1) : reqSku / baseSku;
        weeklyDecomposition.push({
          weekStart: ws,
          sku: sku.id,
          baseline: baseSku,
          required: reqSku,
          additional,
          runRateMultiplier: multiplier,
          achievabilityFlag: flagFor(multiplier, options.achievabilityThresholds),
        });
      }
    }
  }

  const interventionWeeks: SeekResult["interventionWeeks"] = [];
  let weekIdx = 0;
  for (const w of weeklyDecomposition) {
    if (w.achievabilityFlag === "requires-intervention" && w.additional > 0) {
      interventionWeeks.push({
        weekStart: w.weekStart,
        sku: w.sku,
        gap: w.additional / Math.max(1, computed.annual.find((a) => a.year === target.year)?.netPrice ?? 1),
        gapUsd: w.additional,
        suggestedActions: pickActionsForWeek(weekIdx++),
      });
    }
  }
  interventionWeeks.sort((a, b) => b.gapUsd - a.gapUsd);

  const summary = {
    weeksAchievable: weeklyDecomposition.filter((w) => w.achievabilityFlag === "achievable").length,
    weeksStretch: weeklyDecomposition.filter((w) => w.achievabilityFlag === "stretch").length,
    weeksRequireIntervention: weeklyDecomposition.filter((w) => w.achievabilityFlag === "requires-intervention").length,
    totalAdditionalRevenue: weeklyDecomposition.reduce((s, w) => s + w.additional, 0),
    estimatedConfidence: Math.max(
      0,
      Math.min(1, 1 - Math.abs(liftPct) * 2)
    ),
  };

  return {
    target,
    baseline: { year: target.year, baselineNetSales },
    requiredLift: { absoluteUsd: requiredLift, pct: liftPct },
    monthlyDecomposition,
    weeklyDecomposition,
    interventionWeeks,
    summary,
  };
}
