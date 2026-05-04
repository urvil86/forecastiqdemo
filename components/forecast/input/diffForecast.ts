import type { ConnectedForecast, EpidemiologyInputs, MarketShareInputs, PricingInputs } from "@/lib/engine";

export interface ForecastDiff {
  driver: string;
  field: string;
  /** e.g., "2027" or "2026 Q2" */
  period: string;
  before: number | string;
  after: number | string;
  /** Magnitude for sorting; absolute delta in same unit */
  magnitude: number;
  /** Optional formatted display (e.g., "+1.5pp") */
  display?: string;
}

function fmtPct(v: number, digits = 1): string {
  return `${v.toFixed(digits)}%`;
}

function diffEpidemiology(
  before: EpidemiologyInputs | undefined,
  after: EpidemiologyInputs | undefined,
): ForecastDiff[] {
  const out: ForecastDiff[] = [];
  if (!before || !after) return out;
  const fields: {
    field: keyof EpidemiologyInputs["yearly"][number];
    label: string;
    pct: boolean;
  }[] = [
    { field: "prevalence", label: "Prevalence (000s)", pct: false },
    { field: "diagnosisRatePct", label: "Diagnosis rate", pct: true },
    { field: "treatedRatePct", label: "Treated rate", pct: true },
    { field: "classSharePct", label: "Class share", pct: true },
    { field: "brandSharePct", label: "Brand share", pct: true },
    { field: "persistenceY1Pct", label: "Persistence Y1", pct: true },
    { field: "persistenceY2Pct", label: "Persistence Y2", pct: true },
    { field: "dosesPerPatientYear", label: "Doses/yr", pct: false },
  ];
  for (const a of after.yearly) {
    const b = before.yearly.find((x) => x.year === a.year);
    if (!b) continue;
    for (const f of fields) {
      const av = a[f.field] as number;
      const bv = b[f.field] as number;
      if (Math.abs(av - bv) < 0.001) continue;
      out.push({
        driver: "Epidemiology",
        field: f.label,
        period: String(a.year),
        before: bv,
        after: av,
        magnitude: Math.abs(av - bv),
        display: f.pct
          ? `${fmtPct(bv)} → ${fmtPct(av)} (${(av - bv >= 0 ? "+" : "")}${(av - bv).toFixed(1)}pp)`
          : `${bv.toFixed(0)} → ${av.toFixed(0)}`,
      });
    }
  }
  return out;
}

function diffMarketShare(
  before: MarketShareInputs | undefined,
  after: MarketShareInputs | undefined,
): ForecastDiff[] {
  const out: ForecastDiff[] = [];
  if (!before || !after) return out;
  for (const a of after.yearly) {
    const b = before.yearly.find((x) => x.year === a.year);
    if (!b) continue;
    if (Math.abs(a.totalMarketUsdM - b.totalMarketUsdM) > 0.5) {
      out.push({
        driver: "Market Share",
        field: "Total market ($M)",
        period: String(a.year),
        before: b.totalMarketUsdM,
        after: a.totalMarketUsdM,
        magnitude: Math.abs(a.totalMarketUsdM - b.totalMarketUsdM),
        display: `$${b.totalMarketUsdM.toFixed(0)}M → $${a.totalMarketUsdM.toFixed(0)}M`,
      });
    }
    if (Math.abs(a.brandSharePct - b.brandSharePct) > 0.05) {
      out.push({
        driver: "Market Share",
        field: "Brand share",
        period: String(a.year),
        before: b.brandSharePct,
        after: a.brandSharePct,
        magnitude: Math.abs(a.brandSharePct - b.brandSharePct),
        display: `${fmtPct(b.brandSharePct)} → ${fmtPct(a.brandSharePct)} (${a.brandSharePct - b.brandSharePct >= 0 ? "+" : ""}${(a.brandSharePct - b.brandSharePct).toFixed(1)}pp)`,
      });
    }
  }
  return out;
}

function diffPricing(
  before: PricingInputs | undefined,
  after: PricingInputs | undefined,
): ForecastDiff[] {
  const out: ForecastDiff[] = [];
  if (!before || !after) return out;
  for (const a of after.yearly) {
    const b = before.yearly.find((x) => x.year === a.year);
    if (!b) continue;
    if (Math.abs(a.grossPriceUsd - b.grossPriceUsd) > 50) {
      out.push({
        driver: "Pricing",
        field: "Gross price",
        period: String(a.year),
        before: b.grossPriceUsd,
        after: a.grossPriceUsd,
        magnitude: Math.abs(a.grossPriceUsd - b.grossPriceUsd),
        display: `$${b.grossPriceUsd.toFixed(0)} → $${a.grossPriceUsd.toFixed(0)}`,
      });
    }
    if (Math.abs(a.tradeDiscountPct - b.tradeDiscountPct) > 0.1) {
      out.push({
        driver: "Pricing",
        field: "Trade discount",
        period: String(a.year),
        before: b.tradeDiscountPct,
        after: a.tradeDiscountPct,
        magnitude: Math.abs(a.tradeDiscountPct - b.tradeDiscountPct),
        display: `${fmtPct(b.tradeDiscountPct)} → ${fmtPct(a.tradeDiscountPct)}`,
      });
    }
    if (Math.abs(a.reserveRatePct - b.reserveRatePct) > 0.1) {
      out.push({
        driver: "Pricing",
        field: "Reserve rate",
        period: String(a.year),
        before: b.reserveRatePct,
        after: a.reserveRatePct,
        magnitude: Math.abs(a.reserveRatePct - b.reserveRatePct),
        display: `${fmtPct(b.reserveRatePct)} → ${fmtPct(a.reserveRatePct)}`,
      });
    }
  }
  return out;
}

function diffEvents(
  before: ConnectedForecast["lrp"]["events"] | undefined,
  after: ConnectedForecast["lrp"]["events"] | undefined,
): ForecastDiff[] {
  const out: ForecastDiff[] = [];
  if (!before || !after) return out;
  const beforeMap = new Map(before.map((e) => [e.id, e]));
  const afterMap = new Map(after.map((e) => [e.id, e]));
  for (const [id, ev] of afterMap) {
    const prev = beforeMap.get(id);
    if (!prev) {
      out.push({
        driver: "Events",
        field: "added",
        period: ev.name,
        before: "—",
        after: `${ev.type} · peak ${(ev.peakImpact * 100).toFixed(1)}%`,
        magnitude: ev.peakImpact * 100,
        display: `New event "${ev.name}" (${ev.type}, peak ${(ev.peakImpact * 100).toFixed(1)}%)`,
      });
      continue;
    }
    if (prev.peakImpact !== ev.peakImpact) {
      out.push({
        driver: "Events",
        field: ev.name,
        period: "peak impact",
        before: prev.peakImpact,
        after: ev.peakImpact,
        magnitude: Math.abs(ev.peakImpact - prev.peakImpact) * 100,
        display: `${ev.name}: peak ${(prev.peakImpact * 100).toFixed(1)}% → ${(ev.peakImpact * 100).toFixed(1)}%`,
      });
    }
    if (prev.enabled !== ev.enabled) {
      out.push({
        driver: "Events",
        field: ev.name,
        period: "toggled",
        before: prev.enabled ? "on" : "off",
        after: ev.enabled ? "on" : "off",
        magnitude: 100,
        display: `${ev.name}: ${prev.enabled ? "enabled" : "disabled"} → ${ev.enabled ? "enabled" : "disabled"}`,
      });
    }
  }
  for (const [id, prev] of beforeMap) {
    if (!afterMap.has(id)) {
      out.push({
        driver: "Events",
        field: "removed",
        period: prev.name,
        before: `${prev.type} · peak ${(prev.peakImpact * 100).toFixed(1)}%`,
        after: "—",
        magnitude: prev.peakImpact * 100,
        display: `Removed event "${prev.name}"`,
      });
    }
  }
  return out;
}

function diffStfWeekly(
  before: ConnectedForecast["stf"]["weeklyInputs"] | undefined,
  after: ConnectedForecast["stf"]["weeklyInputs"] | undefined,
): ForecastDiff[] {
  const out: ForecastDiff[] = [];
  if (!before || !after) return out;
  const beforeMap = new Map(
    before.map((w) => [`${w.weekStart}|${w.sku}`, w] as const),
  );
  for (const w of after) {
    const prev = beforeMap.get(`${w.weekStart}|${w.sku}`);
    if (!prev) continue;
    if (
      w.override !== undefined &&
      prev.override !== undefined &&
      Math.abs(w.override - prev.override) > 0.5
    ) {
      out.push({
        driver: "STF Weekly",
        field: `Override (${w.sku})`,
        period: w.weekStart,
        before: prev.override,
        after: w.override,
        magnitude: Math.abs(w.override - prev.override),
        display: `${prev.override.toFixed(0)} → ${w.override.toFixed(0)}`,
      });
    }
    const ph = w.holidayAdjPct ?? 0;
    const phPrev = prev.holidayAdjPct ?? 0;
    if (Math.abs(ph - phPrev) > 0.001) {
      out.push({
        driver: "STF Weekly",
        field: `Holiday adj (${w.sku})`,
        period: w.weekStart,
        before: phPrev,
        after: ph,
        magnitude: Math.abs(ph - phPrev) * 100,
        display: `${(phPrev * 100).toFixed(1)}% → ${(ph * 100).toFixed(1)}%`,
      });
    }
  }
  // Override count change summary
  const beforeOverrideCount = before.filter((w) => w.override !== undefined).length;
  const afterOverrideCount = after.filter((w) => w.override !== undefined).length;
  if (beforeOverrideCount !== afterOverrideCount) {
    out.push({
      driver: "STF Weekly",
      field: "Override count",
      period: "all weeks",
      before: beforeOverrideCount,
      after: afterOverrideCount,
      magnitude: Math.abs(afterOverrideCount - beforeOverrideCount) * 10,
      display: `${beforeOverrideCount} → ${afterOverrideCount} weeks with manual override`,
    });
  }
  return out;
}

function diffStfEvents(
  before: ConnectedForecast["stf"]["events"] | undefined,
  after: ConnectedForecast["stf"]["events"] | undefined,
): ForecastDiff[] {
  const out: ForecastDiff[] = [];
  if (!before || !after) return out;
  const bMap = new Map(before.map((e) => [e.id, e]));
  const aMap = new Map(after.map((e) => [e.id, e]));
  for (const [id, ev] of aMap) {
    const prev = bMap.get(id);
    if (!prev) {
      out.push({
        driver: "STF Events",
        field: "added",
        period: ev.name,
        before: "—",
        after: `${ev.type} · peak ${(ev.peakImpact * 100).toFixed(1)}%`,
        magnitude: ev.peakImpact * 100,
        display: `New STF event "${ev.name}" (${ev.type}, peak ${(ev.peakImpact * 100).toFixed(1)}%)`,
      });
      continue;
    }
    if (Math.abs(prev.peakImpact - ev.peakImpact) > 0.001) {
      out.push({
        driver: "STF Events",
        field: ev.name,
        period: "peak impact",
        before: prev.peakImpact,
        after: ev.peakImpact,
        magnitude: Math.abs(ev.peakImpact - prev.peakImpact) * 100,
        display: `${ev.name}: peak ${(prev.peakImpact * 100).toFixed(1)}% → ${(ev.peakImpact * 100).toFixed(1)}%`,
      });
    }
  }
  for (const [id, prev] of bMap) {
    if (!aMap.has(id))
      out.push({
        driver: "STF Events",
        field: "removed",
        period: prev.name,
        before: prev.name,
        after: "—",
        magnitude: prev.peakImpact * 100,
        display: `Removed STF event "${prev.name}"`,
      });
  }
  return out;
}

function diffInventory(
  before: ConnectedForecast["stf"]["inventoryStart"] | undefined,
  after: ConnectedForecast["stf"]["inventoryStart"] | undefined,
): ForecastDiff[] {
  const out: ForecastDiff[] = [];
  if (!before || !after) return out;
  const sumByTier = (
    list: ConnectedForecast["stf"]["inventoryStart"],
  ): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const x of list) out[x.tier] = (out[x.tier] ?? 0) + x.units;
    return out;
  };
  const bSums = sumByTier(before);
  const aSums = sumByTier(after);
  const tiers = new Set([...Object.keys(bSums), ...Object.keys(aSums)]);
  for (const tier of tiers) {
    const b = bSums[tier] ?? 0;
    const a = aSums[tier] ?? 0;
    if (Math.abs(a - b) < 100) continue;
    out.push({
      driver: "Inventory",
      field: `${tier} starting units`,
      period: "cycle start",
      before: b,
      after: a,
      magnitude: Math.abs(a - b) / 1000,
      display: `${(b / 1000).toFixed(0)}K → ${(a / 1000).toFixed(0)}K (${a - b >= 0 ? "+" : ""}${((a - b) / 1000).toFixed(1)}K)`,
    });
  }
  return out;
}

function diffStage(
  before: ConnectedForecast,
  after: ConnectedForecast,
): ForecastDiff[] {
  const out: ForecastDiff[] = [];
  if (
    before.lifecycleStage &&
    after.lifecycleStage &&
    before.lifecycleStage !== after.lifecycleStage
  ) {
    out.push({
      driver: "Setup",
      field: "Lifecycle stage",
      period: "—",
      before: before.lifecycleStage,
      after: after.lifecycleStage,
      magnitude: 1000,
      display: `Stage: ${before.lifecycleStage} → ${after.lifecycleStage}`,
    });
  }
  if (
    before.lrpMethodology &&
    after.lrpMethodology &&
    before.lrpMethodology !== after.lrpMethodology
  ) {
    out.push({
      driver: "Setup",
      field: "Methodology",
      period: "—",
      before: before.lrpMethodology,
      after: after.lrpMethodology,
      magnitude: 900,
      display: `Methodology: ${before.lrpMethodology} → ${after.lrpMethodology}`,
    });
  }
  return out;
}

/** Compute a structured diff between two forecast snapshots. */
export function diffForecast(
  before: ConnectedForecast,
  after: ConnectedForecast,
): ForecastDiff[] {
  const diffs: ForecastDiff[] = [
    ...diffStage(before, after),
    ...diffEpidemiology(before.epidemiologyInputs, after.epidemiologyInputs),
    ...diffMarketShare(before.marketShareInputs, after.marketShareInputs),
    ...diffPricing(
      before.epidemiologyInputs?.pricing ?? before.marketShareInputs?.pricing,
      after.epidemiologyInputs?.pricing ?? after.marketShareInputs?.pricing,
    ),
    ...diffEvents(before.lrp?.events, after.lrp?.events),
    ...diffStfWeekly(before.stf?.weeklyInputs, after.stf?.weeklyInputs),
    ...diffStfEvents(before.stf?.events, after.stf?.events),
    ...diffInventory(before.stf?.inventoryStart, after.stf?.inventoryStart),
  ];
  // Sort by magnitude desc — biggest absolute change first
  diffs.sort((a, b) => b.magnitude - a.magnitude);
  return diffs;
}
