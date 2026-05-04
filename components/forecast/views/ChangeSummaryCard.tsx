"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { compute } from "@/lib/engine";
import { diffForecast, type ForecastDiff } from "@/components/forecast/input/diffForecast";
import { formatUsdShort } from "@/lib/format";

interface Props {
  /** When set, this version id drives the comparison. Otherwise latest snapshot. */
  compareToVersionId: string | null;
}

/**
 * Views-side change summary. Surfaces what changed in this forecast vs the
 * comparison version, plus the headline annual delta that resulted, so the
 * forecaster can read the trajectory chart with that context in mind.
 */
export function ChangeSummaryCard({ compareToVersionId }: Props) {
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
    return diffForecast(baseline.forecastSnapshot ?? baseline.forecast, forecast);
  }, [baseline, forecast]);

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

  if (!baseline || !trajectory) {
    return (
      <div className="card border-l-4 border-muted">
        <div className="text-sm text-muted">
          No prior version to compare against. Submit the forecast at least
          twice to see drift here.
        </div>
      </div>
    );
  }

  const grouped = diffs.reduce<Record<string, ForecastDiff[]>>((acc, d) => {
    (acc[d.driver] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div className="card border-l-4 border-amber-500 bg-amber-50/40">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <div>
          <h3 className="font-heading text-h3 text-secondary">
            Change since prior cycle
          </h3>
          <p className="text-xs text-muted">
            Comparing v{forecast.version} ·{" "}
            <span className="font-mono">{forecast.versionLabel}</span> against v
            {baseline.version} ·{" "}
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

      {/* Per-driver counts + top 8 changes */}
      {diffs.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-1 mb-2 text-[10px]">
            {Object.entries(grouped).map(([driver, items]) => (
              <span
                key={driver}
                className="pill bg-background border border-border text-muted"
              >
                {driver}: {items.length}
              </span>
            ))}
          </div>
          <ul className="space-y-1 text-xs">
            {diffs.slice(0, 8).map((d, i) => (
              <li
                key={`${d.driver}-${d.field}-${d.period}-${i}`}
                className="flex items-baseline justify-between gap-2 p-2 border border-border bg-surface rounded"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-secondary">
                    {d.driver}
                  </span>
                  <span className="text-muted"> · </span>
                  <span>{d.field}</span>
                  <span className="text-muted"> · </span>
                  <span className="font-mono text-[11px]">{d.period}</span>
                </div>
                <span className="font-mono text-[11px] shrink-0">
                  {d.display ?? `${String(d.before)} → ${String(d.after)}`}
                </span>
              </li>
            ))}
          </ul>
          {diffs.length > 8 && (
            <p className="text-[11px] text-muted mt-1 italic">
              {diffs.length - 8} more changes — see Input · Drift panel for the
              full list.
            </p>
          )}
        </>
      ) : (
        <div className="text-xs text-muted italic">
          No assumption changes vs the comparison version.
        </div>
      )}
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
