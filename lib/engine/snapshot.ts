import type {
  ConnectedForecast,
  ComputedForecastConnected,
  DemoUser,
  ThresholdConfig,
  VersionSnapshot,
  ReconciliationAction,
} from "./types";

export interface SaveSnapshotContext {
  user: DemoUser;
  triggerType: VersionSnapshot["triggerType"];
  triggerReason: VersionSnapshot["triggerReason"];
  action?: ReconciliationAction;
  reason?: string;
  notify?: { name: string; email: string }[];
  threshold: ThresholdConfig;
  variance: {
    rolling4Week: number;
    rolling13Week: number;
    ytd: number;
  };
  /** Optional override: label to display in version log */
  label?: string;
  /** Optional version number override */
  version?: number;
}

function defaultLabelFor(ctx: SaveSnapshotContext): string {
  if (ctx.triggerType === "reconciliation") {
    if (ctx.action === "refresh-lrp") return "Refreshed LRP from STF";
    if (ctx.action === "adjust-stf") return "Adjusted STF to LRP target";
    if (ctx.action === "document-accept") return "Documented & accepted variance";
  }
  if (ctx.triggerType === "manual-save") return "Manual checkpoint";
  return "Scheduled snapshot";
}

export function saveSnapshot(
  forecast: ConnectedForecast,
  computed: ComputedForecastConnected,
  context: SaveSnapshotContext,
): VersionSnapshot {
  const id = `snap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();
  const label = context.label ?? defaultLabelFor(context);
  const version = context.version ?? forecast.version;
  return {
    id,
    forecastId: forecast.id,
    createdBy: context.user,
    createdAt,
    triggerType: context.triggerType,
    triggerReason: context.triggerReason,
    reconciliationAction: context.action,
    reasonNote: context.reason,
    notifyList: context.notify,
    thresholdAtSave: context.threshold,
    varianceAtSave: context.variance,
    forecastSnapshot: forecast,
    computedSnapshot: computed,
    // Legacy display fields
    version,
    label,
    timestamp: createdAt,
    forecast,
  };
}

export function listSnapshots(
  snapshots: VersionSnapshot[],
  forecastId: string,
): VersionSnapshot[] {
  return snapshots
    .filter((s) => s.forecastId === forecastId)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function restoreFromSnapshot(
  snapshot: VersionSnapshot,
  user: DemoUser,
  threshold: ThresholdConfig,
): { newForecastState: ConnectedForecast; newSnapshot: VersionSnapshot } {
  const restoredForecast = snapshot.forecastSnapshot;
  const newSnapshot = saveSnapshot(restoredForecast, snapshot.computedSnapshot, {
    user,
    triggerType: "manual-save",
    triggerReason: "user-initiated",
    threshold,
    variance: snapshot.varianceAtSave,
    label: `Restored from ${snapshot.label}`,
    reason: `Restored snapshot ${snapshot.id} (originally saved by ${snapshot.createdBy.name} at ${snapshot.createdAt})`,
  });
  return { newForecastState: restoredForecast, newSnapshot };
}

/**
 * Variance computation against a configured threshold.
 * Returns rolling 4-week, 13-week, and YTD variance percentages plus a status.
 */
export function computeVariance(
  computed: ComputedForecastConnected | null,
): { rolling4Week: number; rolling13Week: number; ytd: number } {
  if (!computed)
    return { rolling4Week: 0, rolling13Week: 0, ytd: 0 };
  const c: ComputedForecastConnected = computed;
  const actualWeeks = c.weekly.filter((w) => w.isActual);
  if (actualWeeks.length === 0)
    return { rolling4Week: 0, rolling13Week: 0, ytd: 0 };

  function rolling(n: number): number {
    const slice = actualWeeks.slice(-n);
    if (slice.length === 0) return 0;
    const actSum = slice.reduce((a, w) => a + w.totalNetSales, 0);
    // Compare actual to the computed monthly trajectory at the same period
    // (proxy: pull lrpStfDelta entries that match these months)
    const months = new Set(slice.map((w) => w.month));
    const deltaTotals = c.lrpStfDelta
      .filter((d) => months.has(d.period))
      .reduce(
        (acc, d) => {
          acc.lrp += d.lrpForecast;
          acc.stf += d.stfActualPlusForecast;
          return acc;
        },
        { lrp: 0, stf: 0 },
      );
    const denom = deltaTotals.lrp || actSum || 1;
    return (actSum - deltaTotals.lrp) / denom;
  }

  const rolling4Week = rolling(4);
  const rolling13Week = rolling(13);
  // YTD: aggregate all actual weeks of current year
  const currentYear = actualWeeks[actualWeeks.length - 1].year;
  const ytdActuals = actualWeeks.filter((w) => w.year === currentYear);
  const ytdActualSum = ytdActuals.reduce((a, w) => a + w.totalNetSales, 0);
  const ytdMonths = new Set(ytdActuals.map((w) => w.month));
  const ytdDelta = c.lrpStfDelta
    .filter((d) => ytdMonths.has(d.period))
    .reduce((a, d) => a + d.lrpForecast, 0);
  const ytd = ytdDelta > 0 ? (ytdActualSum - ytdDelta) / ytdDelta : 0;
  return { rolling4Week, rolling13Week, ytd };
}

export type VarianceStatus = "aligned" | "watching" | "drift";

export function statusForVariance(
  variancePct: number,
  threshold: ThresholdConfig,
): VarianceStatus {
  const t = threshold.thresholdPct / 100;
  const abs = Math.abs(variancePct);
  if (abs <= t) return "aligned";
  if (abs <= 1.5 * t) return "watching";
  return "drift";
}
