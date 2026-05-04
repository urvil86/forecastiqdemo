"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { compute } from "@/lib/engine";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { formatUsdShort } from "@/lib/format";

interface Props {
  /** When set, this version drives the comparison. Otherwise latest snapshot. */
  compareToVersionId: string | null;
}

/**
 * STF cycle comparison: weekly net sales for the current 13-week forecast
 * window plotted against the same calendar weeks from the prior cycle's
 * forecast (or actuals where available). Two lines, matching the LRP
 * trajectory comparison style.
 */
export function StfCycleCompareChart({ compareToVersionId }: Props) {
  const forecast = useStore((s) => s.forecast);
  const computed = useStore((s) => s.computed);
  const versions = useStore((s) => s.versionHistory);

  const baseline = useMemo(() => {
    if (versions.length === 0) return null;
    if (!compareToVersionId) return versions[0];
    return versions.find((v) => v.id === compareToVersionId) ?? null;
  }, [versions, compareToVersionId]);

  const baselineComputed = useMemo(() => {
    if (!baseline) return null;
    return baseline.computedSnapshot ?? compute(baseline.forecastSnapshot ?? baseline.forecast);
  }, [baseline]);

  const data = useMemo(() => {
    if (!computed) return [];
    // Pull 13 forward weeks from current forecast cycle
    const cutoff = new Date(forecast.stf.actualsCutoffDate).getTime();
    const forward = computed.weekly
      .filter((w) => new Date(w.weekStart).getTime() >= cutoff)
      .slice(0, 13);
    return forward.map((w, idx) => {
      const prior = baselineComputed?.weekly.find(
        (pw) => pw.weekStart === w.weekStart,
      );
      return {
        week: `W${idx + 1}`,
        weekStart: w.weekStart,
        current: w.totalNetSales / 1e6,
        prior: prior ? prior.totalNetSales / 1e6 : null,
      };
    });
  }, [computed, baselineComputed, forecast.stf.actualsCutoffDate]);

  if (!data.length) return null;

  const totalCurrent = data.reduce((s, r) => s + (r.current ?? 0), 0);
  const totalPrior = data.reduce((s, r) => s + (r.prior ?? 0), 0);
  const delta = totalCurrent - totalPrior;
  const pct = totalPrior > 0 ? delta / totalPrior : 0;
  const isIdentical =
    baseline !== null &&
    Math.abs(totalCurrent - totalPrior) < 0.001;

  return (
    <div>
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
        <div>
          <h3 className="font-heading text-h3 text-secondary">
            STF Cycle Comparison
          </h3>
          <p className="text-xs text-muted">
            Current 13-week forecast vs same period in{" "}
            {baseline ? `v${baseline.version} · ${baseline.label}` : "prior cycle"}
          </p>
        </div>
        <div className="text-right text-xs">
          <div className="text-muted">13-week total</div>
          <div className="font-heading text-h4 text-secondary">
            {formatUsdShort(totalCurrent * 1e6)}
          </div>
          {baseline && (
            <div
              className={
                "text-xs font-semibold " +
                (delta >= 0 ? "text-emerald-700" : "text-red-700")
              }
            >
              {delta >= 0 ? "+" : ""}
              {formatUsdShort(delta * 1e6)} ({delta >= 0 ? "+" : ""}
              {(pct * 100).toFixed(1)}%)
            </div>
          )}
        </div>
      </div>

      {isIdentical && (
        <div className="mb-2 p-2 rounded border border-amber-300 bg-amber-50 text-[11px] text-amber-800">
          The selected comparison version has identical 13-week values — both
          lines overlap. Pick a different version to see drift.
        </div>
      )}

      <div className="card">
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `$${v.toFixed(1)}M`}
              />
              <Tooltip
                formatter={(v: number | string) =>
                  typeof v === "number" ? formatUsdShort(v * 1e6) : "—"
                }
                labelFormatter={(label, payload) => {
                  const ws = payload && payload[0]
                    ? (payload[0].payload as { weekStart?: string }).weekStart
                    : null;
                  return ws ? `${label} · ${ws}` : String(label);
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#E6E1D6" />
              <Line
                dataKey="prior"
                stroke="#C98B27"
                strokeWidth={2.5}
                strokeDasharray="5 3"
                dot={{ r: 3, fill: "#C98B27" }}
                name={
                  baseline
                    ? `v${baseline.version} · ${baseline.label} (comparison)`
                    : "Prior cycle"
                }
              />
              <Line
                dataKey="current"
                stroke="#004466"
                strokeWidth={3}
                dot={false}
                name={`v${forecast.version} · ${forecast.versionLabel} (current)`}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="text-[11px] text-muted mt-2">
        Forward 13-week net sales for the current cycle plotted against the
        prior cycle&apos;s forecast for the same calendar weeks.
      </p>
    </div>
  );
}
