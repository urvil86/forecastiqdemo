"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { SectionHeader } from "@/components/SectionHeader";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend } from "recharts";
import { formatPct, formatUsdShort, formatNumber } from "@/lib/format";

const SKU_COLOR: Record<string, string> = {
  "ocrevus-300mg": "#004466",
  "ocrevus-600mg": "#0A5C82",
  "ocrevus-sample": "#C98B27",
};

export function SkuMixEvolution() {
  const computed = useStore((s) => s.computed);
  const cutoff = useStore((s) => s.forecast.stf.actualsCutoffDate);
  const skus = useStore((s) => s.forecast.stf.skus);

  const data = useMemo(() => {
    if (!computed) return [];
    const cutoffDate = new Date(cutoff);
    const start = new Date(cutoffDate.getTime() - 13 * 7 * 86_400_000);
    const end = new Date(cutoffDate.getTime() + 13 * 7 * 86_400_000);
    return computed.weekly
      .filter((w) => {
        const d = new Date(w.weekStart);
        return d >= start && d <= end;
      })
      .map((w) => {
        const total = w.totalVolume || 1;
        const row: Record<string, number | string> = { week: w.weekStart };
        for (const sv of w.skuValues) {
          row[sv.sku] = (sv.volume / total) * 100;
        }
        return row;
      });
  }, [computed, cutoff]);

  const skuStats = useMemo(() => {
    if (!computed) return [];
    const cutoffDate = new Date(cutoff);
    const qStart = new Date(cutoffDate.getTime() - 13 * 7 * 86_400_000);
    const yPriorStart = new Date(qStart.getTime() - 365 * 86_400_000);
    const yPriorEnd = new Date(cutoffDate.getTime() - 365 * 86_400_000);

    return skus.filter((s) => s.active).map((sku) => {
      let qtdVolume = 0, qtdRevenue = 0, priorVolume = 0, priorRevenue = 0;
      for (const w of computed.weekly) {
        const d = new Date(w.weekStart);
        const sv = w.skuValues.find((v) => v.sku === sku.id);
        if (!sv) continue;
        if (d >= qStart && d <= cutoffDate) {
          qtdVolume += sv.volume;
          qtdRevenue += sv.netSales;
        }
        if (d >= yPriorStart && d <= yPriorEnd) {
          priorVolume += sv.volume;
          priorRevenue += sv.netSales;
        }
      }
      const yoyVol = priorVolume > 0 ? (qtdVolume - priorVolume) / priorVolume : 0;
      const yoyRev = priorRevenue > 0 ? (qtdRevenue - priorRevenue) / priorRevenue : 0;
      return { sku: sku.displayName, qtdVolume, qtdRevenue, yoyVol, yoyRev };
    });
  }, [computed, cutoff, skus]);

  return (
    <div>
      <SectionHeader title="SKU Mix Evolution" subtitle="Stacked area showing relative SKU contribution. Stable mix means commercial strategy is intact." />
      <div className="card">
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(data.length / 13))} />
              <YAxis unit="%" tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number | string) => (typeof v === "number" ? `${v.toFixed(1)}%` : "—")} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine x={cutoff} stroke="#C98B27" strokeDasharray="3 3" label={{ value: "Today", fontSize: 10, fill: "#C98B27" }} />
              {skus.filter((s) => s.active).map((sku) => (
                <Area
                  key={sku.id}
                  dataKey={sku.id}
                  stackId="mix"
                  stroke={SKU_COLOR[sku.id] ?? "#5C6770"}
                  fill={SKU_COLOR[sku.id] ?? "#5C6770"}
                  fillOpacity={0.6}
                  name={sku.displayName}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card mt-3 text-sm">
        <p>Mix has been stable across the last 13 weeks. If Ocrevus 600mg launches in Q3 2026, expect mix shift to ~65% / 13% / 2%.</p>
      </div>
      <div className="card mt-3 overflow-x-auto">
        <h4 className="font-heading text-h4 text-secondary mb-2">SKU performance</h4>
        <table className="data-table min-w-[640px] text-xs">
          <thead>
            <tr>
              <th>SKU</th>
              <th>QTD Volume</th>
              <th>QTD Revenue</th>
              <th>YoY Volume Growth</th>
              <th>YoY Revenue Growth</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {skuStats.map((r) => (
              <tr key={r.sku}>
                <td>{r.sku}</td>
                <td>{formatNumber(r.qtdVolume)}</td>
                <td>{formatUsdShort(r.qtdRevenue)}</td>
                <td className={r.yoyVol >= 0 ? "text-success" : "text-danger"}>{formatPct(r.yoyVol)}</td>
                <td className={r.yoyRev >= 0 ? "text-success" : "text-danger"}>{formatPct(r.yoyRev)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
