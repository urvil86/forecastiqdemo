import type { ConnectedForecast } from "@/lib/engine";
import type { UploadDiff, UploadPayload } from "./types";

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

function mapDriverToField(
  driver: string,
): "classShare" | "productShare" | "grossPrice" | "gtnRate" | null {
  const k = driver.toLowerCase();
  for (const [needle, field] of Object.entries(DRIVER_TO_LRP_FIELD)) {
    if (k.includes(needle)) return field;
  }
  return null;
}

export function diffAgainstActive(
  payload: UploadPayload,
  active: ConnectedForecast,
): UploadDiff {
  const brandMatch =
    payload.brand.toLowerCase().includes(active.brand.toLowerCase()) ||
    active.brand.toLowerCase().includes(payload.brand.toLowerCase());

  const geographyMatch =
    !payload.geography ||
    payload.geography.toLowerCase().includes(active.geography.toLowerCase()) ||
    payload.geography.toLowerCase().includes(
      active.geography === "US" ? "united states" : active.geography.toLowerCase(),
    );

  const lrpDriverDiffs: UploadDiff["lrpDriverDiffs"] = [];
  for (const a of payload.lrpAssumptions) {
    const field = mapDriverToField(a.driver);
    if (!field) continue;
    const list = active.lrp[field];
    for (const yv of a.yearValues) {
      const cur = list.find((p) => p.year === yv.year)?.value ?? null;
      const delta = yv.value - (cur ?? 0);
      const deltaPct = cur && cur !== 0 ? delta / cur : null;
      if (cur === null || Math.abs(delta) > 1e-6) {
        lrpDriverDiffs.push({
          section: a.section,
          driver: a.driver,
          year: yv.year,
          currentValue: cur,
          uploadValue: yv.value,
          deltaAbs: delta,
          deltaPct,
        });
      }
    }
  }

  const stfWeeklyDiffs: UploadDiff["stfWeeklyDiffs"] = [];
  const cutoff = new Date(active.stf.actualsCutoffDate).getTime();
  for (const w of payload.stfWeekly) {
    if (w.type === "History") continue;
    const wsTime = new Date(w.weekStart).getTime();
    if (Number.isFinite(wsTime) && wsTime < cutoff) continue;

    const existing = active.stf.weeklyInputs.find(
      (wi) => wi.weekStart === w.weekStart && wi.sku === w.sku,
    );
    type Comparison = {
      field: UploadDiff["stfWeeklyDiffs"][number]["field"];
      cur: number;
      next: number;
    };
    const cmps: Comparison[] = [
      {
        field: "baselineOuts",
        cur: existing?.trendValue ?? 0,
        next: w.baselineOuts,
      },
      {
        field: "holidayAdj",
        cur: existing?.holidayAdjPct ?? 0,
        next: w.holidayAdj,
      },
      {
        field: "eventImpact",
        cur: existing?.eventImpactUnits ?? 0,
        next: w.eventImpact,
      },
      {
        field: "netPrice",
        cur: existing?.grossPriceOverride ?? 0,
        next: w.netPrice,
      },
    ];
    for (const c of cmps) {
      if (Math.abs(c.next - c.cur) > 0.5) {
        stfWeeklyDiffs.push({
          weekStart: w.weekStart,
          sku: w.sku,
          field: c.field,
          currentValue: c.cur,
          uploadValue: c.next,
          deltaAbs: c.next - c.cur,
        });
      }
    }
  }

  const inventoryDiffs: UploadDiff["inventoryDiffs"] = [];
  for (const i of payload.inventory) {
    if (!i.isSummary) continue;
    const tierKey = i.tier.toLowerCase();
    const tierMatch = (existingTier: string) =>
      tierKey.includes(existingTier.replace("-", " "));
    const totalForTier = active.stf.inventoryStart
      .filter((x) => tierMatch(x.tier))
      .reduce((a, x) => a + x.units, 0);
    if (Math.abs(i.units - totalForTier) > 50) {
      inventoryDiffs.push({
        tier: i.tier,
        subAccount: i.subAccount,
        field: "units",
        currentValue: totalForTier,
        uploadValue: i.units,
        deltaAbs: i.units - totalForTier,
      });
    }
  }

  // Events
  const existingEventNames = new Set(active.lrp.events.map((e) => e.name));
  let eventsAdded = 0;
  let eventsModified = 0;
  for (const ev of payload.events) {
    if (!existingEventNames.has(ev.name)) eventsAdded += 1;
    else eventsModified += 1;
  }

  return {
    brandMatch,
    geographyMatch,
    lrpDriverDiffs,
    stfWeeklyDiffs,
    inventoryDiffs,
    summary: {
      lrpDriversChanged: new Set(
        lrpDriverDiffs.map((d) => `${d.driver}:${d.year}`),
      ).size,
      stfWeeksChanged: new Set(stfWeeklyDiffs.map((d) => d.weekStart)).size,
      inventoryRowsChanged: inventoryDiffs.length,
      eventsAdded,
      eventsModified,
      eventsRemoved: 0,
    },
  };
}
