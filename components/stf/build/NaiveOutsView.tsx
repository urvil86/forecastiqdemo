"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useForecastWindow } from "@/lib/useForecastWindow";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import { EditableNumber } from "@/components/EditableNumber";
import { formatUsdShort, formatNumber, formatPct } from "@/lib/format";

export function NaiveOutsView() {
  const forecast = useStore((s) => s.forecast);
  const computed = useStore((s) => s.computed);
  const updateSTFInput = useStore((s) => s.updateSTFInput);
  const win = useForecastWindow();
  const [overrideFilter, setOverrideFilter] = useState<string>("all");

  const activeSkus = forecast.stf.skus.filter((s) => s.active);

  const chartData = useMemo(() => {
    if (!computed) return [];
    if (win.granularity === "daily") {
      return computed.daily
        .filter((d) => d.date >= win.windowStart && d.date <= win.windowEnd)
        .map((d) => ({ x: d.date, total: d.totalVolume }));
    }
    return computed.weekly
      .filter((w) => w.weekStart >= win.windowStart && w.weekStart <= win.windowEnd)
      .map((w) => {
        const row: Record<string, number | string> = { x: w.weekStart, total: w.totalVolume };
        for (const sv of w.skuValues) {
          row[`sku_${sv.sku}`] = sv.volume;
        }
        return row;
      });
  }, [computed, win]);

  const futureWeeks = useMemo(() => {
    if (!computed) return [];
    return computed.weekly
      .filter((w) => !w.isActual && !w.isPartial && w.weekStart >= win.cutoff && w.weekStart <= win.windowEnd)
      .slice(0, win.horizonWeeks);
  }, [computed, win]);

  const liveImpact = useMemo(() => {
    if (!computed) return null;
    const ytd = computed.monthly
      .filter((m) => m.year === 2026 && m.month <= "2026-04")
      .reduce((s, m) => s + m.netSales, 0);
    const q2 = computed.monthly.filter((m) => m.year === 2026 && m.quarter === 2).reduce((s, m) => s + m.netSales, 0);
    const q3 = computed.monthly.filter((m) => m.year === 2026 && m.quarter === 3).reduce((s, m) => s + m.netSales, 0);
    const annual = computed.annual.find((a) => a.year === 2026)?.netSales ?? 0;
    const lrpQ2 = computed.lrpStfDelta.find((d) => d.period === "2026-Q2")?.lrpForecast ?? q2;
    const lrpQ3 = computed.lrpStfDelta.find((d) => d.period === "2026-Q3")?.lrpForecast ?? q3;
    const lrpAnnual = computed.lrpStfDelta.find((d) => d.period === "2026-Annual")?.lrpForecast ?? annual;
    return { ytd, q2, q3, annual, q2Delta: q2 - lrpQ2, q3Delta: q3 - lrpQ3, annualDelta: annual - lrpAnnual };
  }, [computed]);

  if (!computed || !liveImpact) return <div className="shimmer h-64 rounded-xl" />;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
      <div className="space-y-4">
        <div className="card">
          <div className="flex justify-between items-baseline mb-2">
            <h3 className="font-heading text-h3 text-secondary">
              {win.granularity === "daily" ? "Daily" : "Weekly"} OUTs by SKU
            </h3>
            <span className="text-xs text-muted">
              {win.historyWeeks}w history + {win.horizonWeeks}w horizon · grain: {win.granularity}
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
                <XAxis dataKey="x" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(chartData.length / 13))} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip formatter={(v: number | string) => (typeof v === "number" ? formatNumber(v) : "—")} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine
                  x={forecast.stf.actualsCutoffDate}
                  stroke="#C1423B"
                  strokeDasharray="3 3"
                  label={{ value: "Cutoff", fontSize: 10, fill: "#C1423B" }}
                />
                <ReferenceLine
                  x={forecast.stf.latestPartialDate}
                  stroke="#C98B27"
                  strokeDasharray="3 3"
                  label={{ value: "Today", fontSize: 10, fill: "#C98B27" }}
                />
                {win.granularity === "weekly" &&
                  activeSkus.map((sku, i) => (
                    <Bar
                      key={sku.id}
                      dataKey={`sku_${sku.id}`}
                      stackId="vol"
                      fill={["#004466", "#C98B27", "#0A5C82"][i % 3]}
                      name={sku.displayName}
                    />
                  ))}
                <Line type="monotone" dataKey="total" stroke="#171717" strokeWidth={1.5} dot={false} name="Total" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <h4 className="font-heading text-h4 text-secondary">
              Override forward {win.horizonWeeks} weeks
            </h4>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Filter:</span>
              <select
                className="input-cell !font-sans"
                value={overrideFilter}
                onChange={(e) => setOverrideFilter(e.target.value)}
              >
                <option value="all">All SKUs</option>
                <option value="commercial">Commercial (Product)</option>
                <option value="sample">Sample</option>
                <option value="pap">PAP</option>
                {activeSkus.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <table className="data-table min-w-[800px]">
            <thead>
              <tr>
                <th>Week</th>
                <th>SKU</th>
                <th>Trend Volume</th>
                <th>Override</th>
                <th>Final</th>
                <th>Δ vs Trend</th>
              </tr>
            </thead>
            <tbody>
              {futureWeeks.flatMap((w) =>
                w.skuValues
                  .filter((sv) => {
                    if (overrideFilter === "all") return true;
                    const sku = activeSkus.find((s) => s.id === sv.sku);
                    if (!sku) return false;
                    if (overrideFilter === "commercial" || overrideFilter === "sample" || overrideFilter === "pap") {
                      return sku.category === overrideFilter;
                    }
                    return sv.sku === overrideFilter;
                  })
                  .map((sv) => {
                  const wi = forecast.stf.weeklyInputs.find((x) => x.weekStart === w.weekStart && x.sku === sv.sku);
                  const trend = wi?.trendValue || sv.volume / (1 + (wi?.holidayAdjPct ?? 0)) || sv.volume;
                  const final = sv.volume;
                  const delta = trend === 0 ? 0 : (final - trend) / trend;
                  return (
                    <tr key={`${w.weekStart}-${sv.sku}`}>
                      <td className="font-mono text-xs">{w.weekStart}</td>
                      <td className="text-xs">{sv.sku.replace("ocrevus-", "")}</td>
                      <td className="font-mono text-xs">{formatNumber(trend)}</td>
                      <td>
                        <EditableNumber
                          value={wi?.override}
                          onChange={(v) => updateSTFInput(w.weekStart, sv.sku, "override", v)}
                          format={(v) => formatNumber(v)}
                          parse={(s) => parseFloat(s.replace(/,/g, ""))}
                          className="input-cell w-24 text-right"
                        />
                      </td>
                      <td className="font-mono text-xs">{formatNumber(final)}</td>
                      <td
                        className={
                          "font-mono text-xs " + (delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-muted")
                        }
                      >
                        {delta === 0 ? "—" : formatPct(delta)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="space-y-3 xl:sticky xl:top-24 self-start">
        <div className="card">
          <h4 className="font-heading text-h4 text-secondary mb-3">Live Impact</h4>
          <ImpactRow label="Net Revenue YTD" value={formatUsdShort(liveImpact.ytd)} />
          <ImpactRow label="Q2 2026 Forecast" value={formatUsdShort(liveImpact.q2)} delta={liveImpact.q2Delta} />
          <ImpactRow label="Q3 2026 Forecast" value={formatUsdShort(liveImpact.q3)} delta={liveImpact.q3Delta} />
          <ImpactRow label="Annual 2026" value={formatUsdShort(liveImpact.annual)} delta={liveImpact.annualDelta} />
          <p className="text-xs text-muted mt-3">
            Saving overrides will create a reconciliation event if quarterly delta exceeds $25M.
          </p>
        </div>
      </aside>
    </div>
  );
}

function ImpactRow({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="flex justify-between items-baseline border-b border-border py-2 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-mono">
        {value}
        {typeof delta === "number" && (
          <span
            className={"ml-2 text-xs " + (Math.abs(delta) < 1e3 ? "text-muted" : delta > 0 ? "text-success" : "text-danger")}
          >
            {delta > 0 ? "+" : ""}
            {formatUsdShort(delta)}
          </span>
        )}
      </span>
    </div>
  );
}
