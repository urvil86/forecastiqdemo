"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { compute } from "@/lib/engine";
import { diffForecast, type ForecastDiff } from "@/components/forecast/input/diffForecast";
import { formatUsdShort } from "@/lib/format";

interface Props {
  /** When set, this version id drives the comparison. Otherwise latest snapshot. */
  compareToVersionId: string | null;
  /** Filter the displayed diffs to only this scope (lrp / stf). */
  scope?: "lrp" | "stf";
}

/**
 * Views-side change summary. Surfaces what changed in this forecast vs the
 * comparison version, plus the headline annual delta that resulted, so the
 * forecaster can read the trajectory chart with that context in mind.
 */
const LRP_DRIVERS = new Set([
  "Epidemiology",
  "Market Share",
  "Pricing",
  "Events",
  "Setup",
]);
const STF_DRIVERS = new Set(["STF Weekly", "STF Events", "Inventory"]);

export function ChangeSummaryCard({ compareToVersionId, scope }: Props) {
  const forecast = useStore((s) => s.forecast);
  const computed = useStore((s) => s.computed);
  const versions = useStore((s) => s.versionHistory);

  const baseline = useMemo(() => {
    if (versions.length === 0) return null;
    if (compareToVersionId === null || compareToVersionId === undefined) {
      return versions[0];
    }
    return versions.find((v) => v.id === compareToVersionId) ?? null;
  }, [versions, compareToVersionId]);

  const baselineComputed = useMemo(() => {
    if (!baseline) return null;
    return baseline.computedSnapshot ?? compute(baseline.forecastSnapshot ?? baseline.forecast);
  }, [baseline]);

  const diffs = useMemo<ForecastDiff[]>(() => {
    if (!baseline) return [];
    const all = diffForecast(baseline.forecastSnapshot ?? baseline.forecast, forecast);
    if (!scope) return all;
    if (scope === "lrp") return all.filter((d) => LRP_DRIVERS.has(d.driver));
    return all.filter((d) => STF_DRIVERS.has(d.driver));
  }, [baseline, forecast, scope]);

  // Headline trajectory deltas at peak / cycle year / endpoint
  const trajectory = useMemo(() => {
    if (!computed || !baselineComputed) return null;
    const yPeak = pickPeak(computed.annual);
    const yCycle = computed.annual.find(
      (a) => a.year === parseInt(forecast.timeframe.forecastStart.slice(0, 4)),
    );
    const yEnd = computed.annual.find(
      (a) => a.year === parseInt(forecast.timeframe.forecastEnd.slice(0, 4)),
    );
    const peakBaseline = baselineComputed.annual.find((a) => a.year === yPeak.year);
    const cycleBaseline = baselineComputed.annual.find((a) => a.year === yCycle?.year);
    const endBaseline = baselineComputed.annual.find((a) => a.year === yEnd?.year);
    return {
      peak: yPeak,
      peakBaseline: peakBaseline ?? null,
      cycle: yCycle ?? null,
      cycleBaseline: cycleBaseline ?? null,
      end: yEnd ?? null,
      endBaseline: endBaseline ?? null,
    };
  }, [computed, baselineComputed, forecast.timeframe.forecastStart, forecast.timeframe.forecastEnd]);

  const scopeName = scope === "lrp" ? "LRP" : scope === "stf" ? "STF" : "forecast";

  if (!baseline || !trajectory) {
    return (
      <div className="card border-l-4 border-muted">
        <div className="text-sm text-muted">
          No prior {scopeName} version to compare against. Submit the {scopeName}{" "}
          at least once with edits to see drift here.
        </div>
      </div>
    );
  }

  // Empty state — comparison version has no scope-relevant changes vs current.
  if (diffs.length === 0) {
    return (
      <div className="card border-l-4 border-muted bg-background">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-heading text-h3 text-secondary">
              No {scopeName} changes vs comparison
            </h3>
            <p className="text-xs text-muted mt-1">
              v{forecast.version} ·{" "}
              <span className="font-mono">{forecast.versionLabel}</span> matches
              v{baseline.version} ·{" "}
              <span className="font-mono">{baseline.label}</span> on{" "}
              {scopeName}-side assumptions.
            </p>
          </div>
          <span className="pill text-[10px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
            No drift
          </span>
        </div>
        <p className="text-[11px] text-muted mt-3">
          Pick a different version above (one with {scopeName} edits) to see
          drift, or edit and re-submit to create a new {scopeName} version.
        </p>
      </div>
    );
  }

  return (
    <div className="card border-l-4 border-amber-500 bg-amber-50/40">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <div>
          <h3 className="font-heading text-h3 text-secondary">
            {scope === "lrp"
              ? "LRP change since prior cycle"
              : scope === "stf"
              ? "STF change since prior cycle"
              : "Change since prior cycle"}
          </h3>
          <p className="text-xs text-muted">
            Comparing current against{" "}
            <span className="font-mono">{baseline.label}</span>
          </p>
        </div>
        <span className="pill text-[10px] bg-amber-500/20 text-amber-800 border border-amber-500/40">
          {diffs.length} changed assumption{diffs.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Headline deltas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <DeltaTile
          label={`${trajectory.cycle?.year ?? "—"} cycle year`}
          current={trajectory.cycle?.netSales ?? 0}
          baseline={trajectory.cycleBaseline?.netSales ?? 0}
        />
        <DeltaTile
          label={`Peak (${trajectory.peak.year})`}
          current={trajectory.peak.netSales}
          baseline={trajectory.peakBaseline?.netSales ?? 0}
        />
        <DeltaTile
          label={`Endpoint (${trajectory.end?.year ?? "—"})`}
          current={trajectory.end?.netSales ?? 0}
          baseline={trajectory.endBaseline?.netSales ?? 0}
        />
      </div>

      <p className="text-[11px] text-muted italic">
        See Input · Drift panel for the full list of changed assumptions.
      </p>
    </div>
  );
}

function pickPeak(
  annual: { year: number; netSales: number }[],
): { year: number; netSales: number } {
  let best = annual[0] ?? { year: 0, netSales: 0 };
  for (const a of annual) {
    if (a.netSales > best.netSales) best = { year: a.year, netSales: a.netSales };
  }
  return best;
}

function DeltaTile({
  label,
  current,
  baseline,
}: {
  label: string;
  current: number;
  baseline: number;
}) {
  const delta = current - baseline;
  const pct = baseline > 0 ? delta / baseline : 0;
  const positive = delta >= 0;
  return (
    <div className="card !p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
        {label}
      </div>
      <div className="font-heading text-h3 text-secondary">
        {formatUsdShort(current)}
      </div>
      <div className="text-[11px] text-muted">
        Prior: {formatUsdShort(baseline)}
      </div>
      <div
        className={
          "text-xs font-semibold mt-1 " +
          (positive ? "text-emerald-700" : "text-red-700")
        }
      >
        {positive ? "+" : ""}
        {formatUsdShort(delta)} ({positive ? "+" : ""}
        {(pct * 100).toFixed(1)}%)
      </div>
    </div>
  );
}
