"use client";

import { useStore } from "@/lib/store";
import { useForecastWindow } from "@/lib/useForecastWindow";
import { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from "recharts";
import { formatPct } from "@/lib/format";

export function SkuMixView() {
  const computed = useStore((s) => s.computed);
  const skus = useStore((s) => s.forecast.stf.skus.filter((sku) => sku.active));
  const win = useForecastWindow();

  const chartData = useMemo(() => {
    if (!computed) return [];
    return computed.weekly
      .filter((w) => w.weekStart >= win.windowStart && w.weekStart <= win.windowEnd)
      .map((w) => {
        const total = w.totalVolume || 1;
        const row: Record<string, number | string> = { week: w.weekStart };
        for (const sv of w.skuValues) row[sv.sku] = (sv.volume / total) * 100;
        return row;
      });
  }, [computed, win]);

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-heading text-h3 text-secondary">SKU Mix Over Time</h3>
        <span className="text-xs text-muted">
          {win.historyWeeks}w history + {win.horizonWeeks}w horizon
        </span>
      </div>
      <div className="h-72">
        <ResponsiveContainer>
          <AreaChart data={chartData}>
            <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(chartData.length / 13))} />
            <YAxis unit="%" tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number | string) => (typeof v === "number" ? `${v.toFixed(1)}%` : "—")} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine x={win.cutoff} stroke="#C1423B" strokeDasharray="3 3" label={{ value: "Cutoff", fontSize: 10, fill: "#C1423B" }} />
            {skus.map((sku, i) => (
              <Area
                key={sku.id}
                dataKey={sku.id}
                stackId="mix"
                stroke={["#004466", "#C98B27", "#0A5C82"][i % 3]}
                fill={["#004466", "#C98B27", "#0A5C82"][i % 3]}
                fillOpacity={0.5}
                name={sku.displayName}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <table className="data-table mt-4">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Default Mix</th>
            <th>Method</th>
          </tr>
        </thead>
        <tbody>
          {skus.map((s) => (
            <tr key={s.id}>
              <td>{s.displayName}</td>
              <td className="font-mono">{formatPct(s.defaultMixPct)}</td>
              <td>Auto</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
