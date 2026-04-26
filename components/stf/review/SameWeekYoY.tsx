"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { SectionHeader } from "@/components/SectionHeader";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend } from "recharts";
import { formatUsdShort, formatNumber, formatPct } from "@/lib/format";

export function SameWeekYoY() {
  const computed = useStore((s) => s.computed);
  const [metric, setMetric] = useState<"volume" | "revenue">("revenue");

  const data = useMemo(() => {
    if (!computed) return [];
    const out = new Map<number, { week: number; y2024?: number; y2025?: number; y2026?: number; y2027?: number }>();
    for (const w of computed.weekly) {
      const wk = w.isoWeek;
      if (!out.has(wk)) out.set(wk, { week: wk });
      const row = out.get(wk)!;
      const value = metric === "revenue" ? w.totalNetSales / 1e6 : w.totalVolume;
      const yearKey = `y${w.year}` as "y2024" | "y2025" | "y2026" | "y2027";
      if (yearKey === "y2024" || yearKey === "y2025" || yearKey === "y2026" || yearKey === "y2027") {
        row[yearKey] = value;
      }
    }
    return Array.from(out.values()).sort((a, b) => a.week - b.week);
  }, [computed, metric]);

  // Quarterly comparison
  const quarterly = useMemo<Record<string, { q1: number; q2: number; q3: number; q4: number; total: number }>>(() => {
    if (!computed) return {};
    const out: Record<string, { q1: number; q2: number; q3: number; q4: number; total: number }> = {};
    for (const m of computed.monthly) {
      if (m.year < 2024) continue;
      if (m.year > 2027) continue;
      const yearKey = String(m.year);
      if (!out[yearKey]) out[yearKey] = { q1: 0, q2: 0, q3: 0, q4: 0, total: 0 };
      const value = metric === "revenue" ? m.netSales : m.volume;
      const qKey = `q${m.quarter}` as "q1" | "q2" | "q3" | "q4";
      out[yearKey][qKey] += value;
      out[yearKey].total += value;
    }
    return out;
  }, [computed, metric]);

  return (
    <div>
      <SectionHeader
        title="Year-over-Year Pacing · Same Week, Different Years"
        subtitle="Multi-year overlay reveals seasonality and YoY growth at a single glance."
        right={
          <div className="inline-flex bg-background border border-border rounded-full p-1 text-xs">
            <button onClick={() => setMetric("revenue")} className={"px-3 py-1 rounded-full " + (metric === "revenue" ? "bg-secondary text-white" : "text-muted")}>Net revenue ($M)</button>
            <button onClick={() => setMetric("volume")} className={"px-3 py-1 rounded-full " + (metric === "volume" ? "bg-secondary text-white" : "text-muted")}>Volume (units)</button>
          </div>
        }
      />
      <div className="card">
        <div className="h-80">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 28, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11 }}
                label={{ value: "Week of year", position: "insideBottom", offset: -18, fontSize: 11, fill: "#5C6770" }}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => metric === "revenue" ? `$${v.toFixed(0)}M` : formatNumber(v)} />
              <Tooltip formatter={(v: number | string) => (typeof v === "number" ? (metric === "revenue" ? formatUsdShort(v * 1e6) : formatNumber(v)) : "—")} />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 6 }} />
              <ReferenceLine x={16} stroke="#C98B27" strokeDasharray="3 3" label={{ value: "Today", fontSize: 10, fill: "#C98B27" }} />
              <Line dataKey="y2024" stroke="#C98B27" strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="2024" />
              <Line dataKey="y2025" stroke="#C98B27" strokeOpacity={0.7} strokeWidth={1.5} dot={false} name="2025" />
              <Line dataKey="y2026" stroke="#004466" strokeWidth={2.5} dot={false} name="2026" />
              <Line dataKey="y2027" stroke="#C98B27" strokeWidth={2} strokeDasharray="6 3" dot={false} name="2027 forecast" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted mt-2">
          Week 16 of 2026 vs Week 16 of 2025: hover the lines to see exact deltas. Vertical line marks today.
        </p>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <h4 className="font-heading text-h4 text-secondary mb-2">Quarter-over-quarter</h4>
        <table className="data-table min-w-[600px] text-xs">
          <thead>
            <tr>
              <th>Period</th>
              {["2024", "2025", "2026", "2027"].map((y) => (
                <th key={y}>{y}</th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            {(["q1", "q2", "q3", "q4", "total"] as const).map((q) => (
              <tr key={q}>
                <td>{q === "total" ? "Annual" : q.toUpperCase()}</td>
                {["2024", "2025", "2026", "2027"].map((y) => {
                  const v = quarterly[y]?.[q] ?? 0;
                  const prev = quarterly[String(parseInt(y) - 1)]?.[q] ?? 0;
                  const yoy = prev > 0 ? (v - prev) / prev : null;
                  return (
                    <td key={y}>
                      {metric === "revenue" ? formatUsdShort(v) : formatNumber(v)}
                      {yoy !== null && (
                        <span className={"ml-1 text-[10px] " + (yoy >= 0 ? "text-success" : "text-danger")}>
                          {formatPct(yoy)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
