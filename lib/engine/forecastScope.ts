/**
 * v2.6.1 Scope detection — figures out whether a change between two
 * forecasts touches LRP-side assumptions, STF-side assumptions, both,
 * or neither.
 *
 * "LRP-side" = epidemiology inputs / market-share inputs / pricing /
 *              LRP events (lrp.events) / pre-launch overlay / LoE overlay /
 *              lifecycle stage / methodology
 * "STF-side" = STF weekly inputs / STF events / inventory / phasing /
 *              SKU mix / NFS / actuals cutoff / horizon / granularity
 */

import type { ConnectedForecast, ForecastScope } from "./types";

export interface ScopeChange {
  lrp: boolean;
  stf: boolean;
}

function eqShallow<T>(a: T, b: T): boolean {
  // Cheap structural equality via JSON. Sufficient for the demo-shape
  // forecasts; fine to upgrade to a proper deep-eq later.
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function detectScopeChanges(
  before: ConnectedForecast,
  after: ConnectedForecast,
): ScopeChange {
  // ── LRP side
  let lrp = false;
  if (
    !eqShallow(before.epidemiologyInputs, after.epidemiologyInputs) ||
    !eqShallow(before.marketShareInputs, after.marketShareInputs) ||
    !eqShallow(before.preLaunchOverlay, after.preLaunchOverlay) ||
    !eqShallow(before.loeOverlay, after.loeOverlay) ||
    !eqShallow(before.lrp?.events, after.lrp?.events) ||
    !eqShallow(before.lrp?.classShare, after.lrp?.classShare) ||
    !eqShallow(before.lrp?.productShare, after.lrp?.productShare) ||
    !eqShallow(before.lrp?.grossPrice, after.lrp?.grossPrice) ||
    !eqShallow(before.lrp?.gtnRate, after.lrp?.gtnRate) ||
    before.lifecycleStage !== after.lifecycleStage ||
    before.lrpMethodology !== after.lrpMethodology
  ) {
    lrp = true;
  }

  // ── STF side
  let stf = false;
  if (
    !eqShallow(before.stf?.weeklyInputs, after.stf?.weeklyInputs) ||
    !eqShallow(before.stf?.events, after.stf?.events) ||
    !eqShallow(before.stf?.inventoryStart, after.stf?.inventoryStart) ||
    !eqShallow(before.stf?.skus, after.stf?.skus) ||
    !eqShallow(before.stf?.nfs, after.stf?.nfs) ||
    !eqShallow(before.stf?.holidayCalendar, after.stf?.holidayCalendar) ||
    before.stf?.horizonWeeks !== after.stf?.horizonWeeks ||
    before.stf?.granularity !== after.stf?.granularity ||
    before.stf?.actualsCutoffDate !== after.stf?.actualsCutoffDate ||
    before.stf?.historyWeeksShown !== after.stf?.historyWeeksShown ||
    !eqShallow(before.stf?.trending, after.stf?.trending) ||
    !eqShallow(before.phasing, after.phasing)
  ) {
    stf = true;
  }

  return { lrp, stf };
}

/** Convert a ScopeChange into the snapshot-level ForecastScope label. */
export function scopeFromChanges(c: ScopeChange): ForecastScope | null {
  if (!c.lrp && !c.stf) return null;
  if (c.lrp && c.stf) return "full";
  if (c.lrp) return "lrp";
  return "stf";
}

/**
 * Filter snapshots to those whose scope is comparable for the given
 * scope target. LRP charts care about lrp + full snapshots; STF charts
 * care about stf + full snapshots; full charts care about everything.
 */
export function snapshotsInScope<T extends { scope?: ForecastScope }>(
  list: T[],
  target: ForecastScope,
): T[] {
  if (target === "full") return list;
  return list.filter(
    (s) => !s.scope || s.scope === target || s.scope === "full",
  );
}
