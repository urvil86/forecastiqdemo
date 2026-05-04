import type { ConnectedForecast } from "@/lib/engine";
import type { UploadPayload } from "./types";

const DRIVER_TO_LRP_FIELD: Record<
  string,
  "classShare" | "productShare" | "grossPrice" | "gtnRate" | null
> = {
  "class share": "classShare",
  "product share": "productShare",
  "gross price": "grossPrice",
  "gtn rate": "gtnRate",
  "gtn": "gtnRate",
};

function mapDriverToField(driver: string) {
  const k = driver.toLowerCase();
  for (const [needle, field] of Object.entries(DRIVER_TO_LRP_FIELD)) {
    if (k.includes(needle)) return field;
  }
  return null;
}

/**
 * Produces a new ConnectedForecast with values from the upload merged in.
 * Pure function — does not write to the store. The store layer is responsible
 * for committing, recompute, and snapshot.
 */
export function applyUploadToForecast(
  payload: UploadPayload,
  active: ConnectedForecast,
): ConnectedForecast {
  // Start by spreading active so we keep all unchanged fields
  const next: ConnectedForecast = JSON.parse(
    JSON.stringify(active),
  ) as ConnectedForecast;

  // LRP assumptions — merge year values into matching LRP anchor fields
  for (const a of payload.lrpAssumptions) {
    const field = mapDriverToField(a.driver);
    if (!field) continue;
    const list = next.lrp[field];
    for (const yv of a.yearValues) {
      const idx = list.findIndex((p) => p.year === yv.year);
      if (idx >= 0) list[idx] = { year: yv.year, value: yv.value };
      else list.push({ year: yv.year, value: yv.value });
    }
    list.sort((x, y) => x.year - y.year);
  }

  // STF weekly inputs — forward weeks only
  const cutoff = new Date(active.stf.actualsCutoffDate).getTime();
  for (const w of payload.stfWeekly) {
    if (w.type === "History") continue;
    const wsTime = new Date(w.weekStart).getTime();
    if (Number.isFinite(wsTime) && wsTime < cutoff) continue;

    const existingIdx = next.stf.weeklyInputs.findIndex(
      (wi) => wi.weekStart === w.weekStart && wi.sku === w.sku,
    );
    const merged = {
      weekStart: w.weekStart,
      sku: w.sku,
      trendValue:
        existingIdx >= 0
          ? next.stf.weeklyInputs[existingIdx].trendValue || w.baselineOuts
          : w.baselineOuts,
      override:
        Math.abs(w.finalOuts - (w.baselineOuts + w.holidayAdj + w.eventImpact)) >
        0.5
          ? w.finalOuts
          : existingIdx >= 0
          ? next.stf.weeklyInputs[existingIdx].override
          : undefined,
      holidayAdjPct: w.holidayAdj,
      eventImpactUnits: w.eventImpact,
      grossPriceOverride: w.netPrice,
    };
    if (existingIdx >= 0) {
      next.stf.weeklyInputs[existingIdx] = {
        ...next.stf.weeklyInputs[existingIdx],
        ...merged,
      };
    } else {
      next.stf.weeklyInputs.push(merged);
    }
  }

  // Inventory — write tier totals (skip non-summary rows, since the store
  // models tier-level positions, not sub-account positions)
  const tierMap: Record<string, "wholesaler" | "specialty-pharmacy" | "hub"> = {
    wholesaler: "wholesaler",
    "specialty pharmacy": "specialty-pharmacy",
    hub: "hub",
  };
  for (const inv of payload.inventory) {
    if (!inv.isSummary) continue;
    const norm = inv.tier.toLowerCase();
    const tierId = Object.entries(tierMap).find(([k]) => norm.includes(k))?.[1];
    if (!tierId) continue;
    // Find first SKU that matches this tier and write the total to it
    const idx = next.stf.inventoryStart.findIndex((x) => x.tier === tierId);
    if (idx >= 0) {
      next.stf.inventoryStart[idx] = {
        ...next.stf.inventoryStart[idx],
        units: inv.units,
      };
    }
  }

  // Pricing — by week
  for (const p of payload.pricing) {
    const wsTime = new Date(p.weekStart).getTime();
    if (Number.isFinite(wsTime) && wsTime < cutoff) continue;
    const matches = next.stf.weeklyInputs.filter(
      (wi) => wi.weekStart === p.weekStart,
    );
    for (const m of matches) {
      m.grossPriceOverride = p.grossPrice;
      m.tradeDiscountOverride = p.tradeDiscountPct / 100;
      m.reserveRateOverride = p.reserveRatePct / 100;
    }
  }

  // Events — append events that don't already exist by name
  const existingNames = new Set(next.lrp.events.map((e) => e.name));
  for (const ev of payload.events) {
    if (existingNames.has(ev.name)) continue;
    next.lrp.events.push({
      id: `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: ev.name,
      type: ev.direction === "Negative" ? "negative" : "positive",
      enabled: true,
      launchDate: ev.startDate,
      peakImpact: ev.peakImpactPct / 100,
      timeToPeakMonths: Math.max(1, Math.round(ev.timeToPeakWeeks / 4)),
      curveShape:
        /fast/i.test(ev.decayShape)
          ? "fast"
          : /slow/i.test(ev.decayShape)
          ? "slow"
          : "moderate",
    });
  }

  // Phasing — daily pattern → standard daily profile (first profile)
  if (payload.phasing.dailyPattern.length > 0 && next.phasing.dailyProfiles[0]) {
    const total = payload.phasing.dailyPattern.reduce((a, p) => a + p.weight, 0);
    const norm = total > 1.5 ? 100 : 1; // detect % vs fraction
    const map = new Map<string, number>();
    for (const p of payload.phasing.dailyPattern) {
      const day = p.day.slice(0, 3) as "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
      map.set(day, p.weight / norm);
    }
    next.phasing.dailyProfiles[0] = {
      ...next.phasing.dailyProfiles[0],
      dayWeights: {
        Mon: map.get("Mon") ?? next.phasing.dailyProfiles[0].dayWeights.Mon,
        Tue: map.get("Tue") ?? next.phasing.dailyProfiles[0].dayWeights.Tue,
        Wed: map.get("Wed") ?? next.phasing.dailyProfiles[0].dayWeights.Wed,
        Thu: map.get("Thu") ?? next.phasing.dailyProfiles[0].dayWeights.Thu,
        Fri: map.get("Fri") ?? next.phasing.dailyProfiles[0].dayWeights.Fri,
        Sat: map.get("Sat") ?? next.phasing.dailyProfiles[0].dayWeights.Sat,
        Sun: map.get("Sun") ?? next.phasing.dailyProfiles[0].dayWeights.Sun,
      },
    };
  }

  return next;
}
