import type {
  ConnectedForecast,
  ComputedForecastConnected,
  ReconciliationEvent,
  ThresholdConfig,
} from "./types";
import { compute } from "./compute";

export function reconcile(
  forecast: ConnectedForecast,
  computed?: ComputedForecastConnected,
  threshold?: ThresholdConfig,
): ReconciliationEvent[] {
  const t = threshold ?? {
    rollingWindow: "4-week" as const,
    thresholdPct: 5,
    appliesTo: "rolling-variance" as const,
  };
  const tFrac = t.thresholdPct / 100;
  const c = computed ?? compute(forecast);
  // Compute "trend implied" weekly values by re-running compute with all weekly overrides cleared
  const cleared: ConnectedForecast = {
    ...forecast,
    stf: { ...forecast.stf, weeklyInputs: [] },
  };
  const cleanComputed = compute(cleared);

  const actualWeeks = c.weekly.filter((w) => w.isActual).slice(-26);
  if (actualWeeks.length === 0) {
    return [
      {
        id: "rc-aligned-default",
        detectedAt: "2026-04-22",
        type: "aligned",
        severity: "info",
        rolling4WeekVariancePct: 0,
        rolling13WeekVariancePct: 0,
        message: "No recent actuals to evaluate",
        proposedAction: "None",
      },
    ];
  }

  function rollingVariance(windowSize: number): number {
    const slice = actualWeeks.slice(-windowSize);
    if (slice.length === 0) return 0;
    let act = 0;
    let trend = 0;
    for (const w of slice) {
      act += w.totalNetSales;
      const trendW = cleanComputed.weekly.find((cw) => cw.weekStart === w.weekStart);
      if (trendW) trend += trendW.totalNetSales;
    }
    if (trend === 0) return 0;
    return (act - trend) / trend;
  }

  const r4 = rollingVariance(4);
  const r13 = rollingVariance(13);
  const abs = Math.abs(r4);

  let type: ReconciliationEvent["type"];
  let severity: ReconciliationEvent["severity"];
  let message: string;
  let proposedAction: string;

  if (abs <= tFrac) {
    type = "aligned";
    severity = "info";
    message = `Rolling 4-week variance at ${(r4 * 100).toFixed(1)}% — within threshold (±${t.thresholdPct}%).`;
    proposedAction = "None";
  } else if (abs <= 1.5 * tFrac) {
    type = r4 > 0 ? "sustained-positive-variance" : "sustained-negative-variance";
    severity = "warning";
    message = `Rolling 4-week variance at ${(r4 * 100).toFixed(1)}% — beyond ±${t.thresholdPct}% threshold. Reconciliation recommended.`;
    proposedAction = "Reconcile";
  } else {
    type = "critical-drift";
    severity = "critical";
    message = `Rolling 4-week variance at ${(r4 * 100).toFixed(1)}% — critical drift (>${(1.5 * t.thresholdPct).toFixed(1)}%). Immediate reconciliation required.`;
    proposedAction = "Immediate reconciliation";
  }

  return [
    {
      id: `rc-${Date.now().toString(36)}`,
      detectedAt: "2026-04-22",
      type,
      severity,
      rolling4WeekVariancePct: r4,
      rolling13WeekVariancePct: r13,
      message,
      proposedAction,
    },
  ];
}
