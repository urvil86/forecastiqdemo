"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { reconcile } from "@/lib/engine";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  Legend,
  ComposedChart,
  Area,
} from "recharts";
import { SectionHeader } from "@/components/SectionHeader";
import { formatUsdShort, formatPct } from "@/lib/format";

export function VarianceMonitor() {
  const computed = useStore((s) => s.computed);
  const forecast = useStore((s) => s.forecast);
  const events = useMemo(() => (computed ? reconcile(forecast, computed) : []), [forecast, computed]);

  // Build a per-week LRP-derived series (clean monthly-to-weekly distribution, before STF overrides)
  const overlayData = useMemo(() => {
    if (!computed) return [];
    return computed.weekly
      .filter((w) => w.year === 2026)
      .map((w) => {
        // LRP-derived weekly = the engine's monthly value distributed evenly within the month.
        // For visualization, approximate it as the month-of-year average so the line is smooth.
        const monthly = computed.monthly.find((m) => m.month === w.month);
        const weeksInMonth = computed.weekly.filter((ww) => ww.month === w.month).length || 1;
        const lrpWeekly = monthly ? monthly.netSales / weeksInMonth : 0;
        return {
          week: w.weekStart,
          stf: w.totalNetSales,
          lrp: lrpWeekly,
          isActual: w.isActual,
        };
      });
  }, [computed]);

  const chartData = useMemo(() => {
    if (!computed) return [];
    const actuals = computed.weekly.filter((w) => w.isActual).slice(-26);
    return actuals.map((w, i) => ({
      week: w.weekStart,
      r4: i >= 3 ? rollingPct(actuals.slice(i - 3, i + 1)) : 0,
      r13: i >= 12 ? rollingPct(actuals.slice(i - 12, i + 1)) : 0,
      r26: i >= 25 ? rollingPct(actuals.slice(0, i + 1)) : 0,
    }));
  }, [computed]);

  const evt = events[0];

  return (
    <div>
      <SectionHeader
        title="Variance & Drift Monitor"
        subtitle={
          <>
            <span className="font-semibold text-secondary">LRP</span> = Long-Range Plan (annual cascade decomposed to weekly).{" "}
            <span className="font-semibold text-primary">STF</span> = Short-Term Forecast (operational weekly with overrides).
            Variance = (STF − LRP) ÷ LRP.
          </>
        }
      />

      {/* TOP — explicit LRP vs STF overlay */}
      <div className="card mb-4">
        <h4 className="font-heading text-h4 text-secondary mb-1">LRP vs STF — 2026 weekly overlay</h4>
        <p className="text-xs text-muted mb-2">
          The blue line is what the LRP implies for each week (annual cascade ÷ phasing). The gold line is the STF (actual where
          available, then forecast). Where the gold sits above blue, STF is outperforming the LRP; below means underperforming.
        </p>
        <div className="h-56">
          <ResponsiveContainer>
            <ComposedChart data={overlayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(overlayData.length / 12))} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatUsdShort(v)} />
              <Tooltip formatter={(v: number | string) => (typeof v === "number" ? formatUsdShort(v) : "—")} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine x={forecast.stf.actualsCutoffDate} stroke="#C1423B" strokeDasharray="3 3" label={{ value: "Cutoff", fontSize: 10, fill: "#C1423B" }} />
              <Area dataKey="lrp" stroke="#004466" fill="#004466" fillOpacity={0.08} strokeWidth={2} name="LRP-derived weekly" />
              <Line dataKey="stf" stroke="#C98B27" strokeWidth={2.5} dot={false} name="STF actual+forecast" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Card 2.1 — Rolling Variance */}
        <div className="card">
          <h4 className="font-heading text-h4 text-secondary mb-1">Rolling Variance %</h4>
          <p className="text-xs text-muted mb-2">
            Positive % = STF above LRP. Negative % = STF below LRP. Yellow band = ±5% normal range; red band = ±10% triggers a
            reconciliation event.
          </p>
          <div className="h-44">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
                <XAxis dataKey="week" tick={{ fontSize: 9 }} interval={5} />
                <YAxis tick={{ fontSize: 10 }} domain={[-0.15, 0.15]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <ReferenceArea y1={-0.05} y2={0.05} fill="#FFF3C4" fillOpacity={0.4} />
                <ReferenceArea y1={-0.1} y2={-0.05} fill="#C1423B" fillOpacity={0.08} />
                <ReferenceArea y1={0.05} y2={0.1} fill="#C1423B" fillOpacity={0.08} />
                <ReferenceLine y={0} stroke="#5C6770" />
                <Tooltip formatter={(v: number | string) => (typeof v === "number" ? `${(v * 100).toFixed(2)}%` : "—")} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="r4" stroke="#C1423B" strokeWidth={1.6} dot={false} name="4-week" />
                <Line dataKey="r13" stroke="#E5A04B" strokeWidth={1.6} dot={false} name="13-week" />
                <Line dataKey="r26" stroke="#1F8A5C" strokeWidth={1.6} dot={false} name="26-week" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {evt && (
            <div className="text-xs mt-3 space-y-1 font-mono">
              <div>
                4-week: <span className={evt.severity !== "info" ? "text-danger" : "text-success"}>{formatPct(evt.rolling4WeekVariancePct, 2)}</span>
              </div>
              <div>
                13-week: <span className="text-success">{formatPct(evt.rolling13WeekVariancePct, 2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Card 2.2 — Period Reconciliation */}
        <div className="card">
          <h4 className="font-heading text-h4 text-secondary mb-1">Period-by-Period Reconciliation</h4>
          <p className="text-xs text-muted mb-2">
            For each quarter: what the LRP says vs what the STF reports (actuals + forecast). Δ shows the gap.
          </p>
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>Period</th>
                <th>LRP $</th>
                <th>STF $</th>
                <th>Δ ($)</th>
                <th>Δ %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(computed?.lrpStfDelta ?? []).map((d) => (
                <tr key={d.period}>
                  <td className="font-mono">{d.period}</td>
                  <td className="font-mono">{formatUsdShort(d.lrpForecast)}</td>
                  <td className="font-mono">
                    {formatUsdShort(d.stfActualPlusForecast)}
                    {d.actualWeight > 0 && d.actualWeight < 1 && (
                      <span className="text-muted text-[10px] ml-1">({(d.actualWeight * 100).toFixed(0)}% actual)</span>
                    )}
                  </td>
                  <td className={"font-mono " + (Math.abs(d.deltaPct) > 0.03 ? "text-danger" : "text-muted")}>{formatUsdShort(d.deltaUsd)}</td>
                  <td className={"font-mono " + (Math.abs(d.deltaPct) > 0.03 ? "text-danger" : "text-muted")}>{formatPct(d.deltaPct)}</td>
                  <td>
                    <span className={Math.abs(d.deltaPct) <= 0.03 ? "pill-success" : Math.abs(d.deltaPct) <= 0.05 ? "pill-warning" : "pill-danger"}>
                      {Math.abs(d.deltaPct) <= 0.03 ? "Aligned" : Math.abs(d.deltaPct) <= 0.05 ? "Watching" : "Drift"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Card 2.3 — Active Reconciliation Events */}
        <div className="card">
          <h4 className="font-heading text-h4 text-secondary mb-1">Active Reconciliation Events</h4>
          <p className="text-xs text-muted mb-2">
            Engine raises an event when sustained variance exceeds threshold. Action buttons let you accept or defer the proposed
            response.
          </p>
          {evt ? (
            <div className="border border-border rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <span className={evt.severity === "info" ? "pill-success" : evt.severity === "warning" ? "pill-warning" : "pill-danger"}>
                  {evt.type.replace(/-/g, " ")}
                </span>
                <span className="text-xs text-muted">{evt.detectedAt}</span>
              </div>
              <p className="text-sm">{evt.message}</p>
              <p className="text-xs text-muted mt-1">Proposed: {evt.proposedAction}</p>
              <div className="flex gap-2 mt-3">
                <button className="btn-ghost !py-1 !px-3 text-xs">Refresh LRP</button>
                <button className="btn-ghost !py-1 !px-3 text-xs">Defer 30 days</button>
                <button className="btn-ghost !py-1 !px-3 text-xs">Reject</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">No active events.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function rollingPct(weeks: { weekStart: string; totalNetSales: number }[]): number {
  if (weeks.length === 0) return 0;
  const total = weeks.reduce((s, w) => s + w.totalNetSales, 0);
  const avg = total / weeks.length;
  if (avg === 0) return 0;
  return (weeks[weeks.length - 1].totalNetSales - avg) / avg;
}
