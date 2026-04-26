"use client";

import { useStore } from "@/lib/store";
import { useForecastWindow } from "@/lib/useForecastWindow";
import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine } from "recharts";
import { formatNumber, formatPct } from "@/lib/format";

export function HolidayAdjustmentsView() {
  const forecast = useStore((s) => s.forecast);
  const computed = useStore((s) => s.computed);
  const updateSTFInput = useStore((s) => s.updateSTFInput);
  const win = useForecastWindow();
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const chartData = useMemo(() => {
    if (!computed) return [];
    return computed.weekly
      .filter((w) => w.weekStart >= win.windowStart && w.weekStart <= win.windowEnd)
      .map((w) => ({
        week: w.weekStart,
        volume: w.totalVolume,
        isHoliday: forecast.stf.holidayCalendar.some((h) => Math.abs(diffDays(h.date, w.weekStart)) <= 7),
        isActual: w.isActual,
      }));
  }, [computed, forecast.stf.holidayCalendar, win]);

  function applyAll() {
    for (const [date, pct] of Object.entries(overrides)) {
      const wkStart = mondayOf(date);
      for (const sku of forecast.stf.skus.filter((s) => s.active)) {
        updateSTFInput(wkStart, sku.id, "holidayAdjPct", pct);
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-heading text-h3 text-secondary">Holiday Weeks</h3>
          <span className="text-xs text-muted">
            {win.historyWeeks}w history + {win.horizonWeeks}w horizon
          </span>
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(chartData.length / 13))} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip />
              <ReferenceLine x={win.cutoff} stroke="#C1423B" strokeDasharray="3 3" label={{ value: "Cutoff", fontSize: 10, fill: "#C1423B" }} />
              <Bar dataKey="volume">
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.isHoliday ? "#E5A04B" : d.isActual ? "#004466" : "#0A5C82"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Holiday</th>
              <th>Default Adj</th>
              <th>Override Adj</th>
            </tr>
          </thead>
          <tbody>
            {forecast.stf.holidayCalendar.map((h) => (
              <tr key={h.date}>
                <td className="font-mono text-xs">{h.date}</td>
                <td>{h.name}</td>
                <td className="font-mono">{formatPct(h.defaultAdjustmentPct, 1)}</td>
                <td>
                  <input
                    type="text"
                    placeholder={`${(h.defaultAdjustmentPct * 100).toFixed(1)}%`}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value.replace("%", "")) / 100;
                      if (Number.isFinite(v)) setOverrides((prev) => ({ ...prev, [h.date]: v }));
                    }}
                    className="input-cell w-20 text-right"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={applyAll} className="btn-secondary mt-3">
          Apply All Overrides
        </button>
      </div>
    </div>
  );
}

function diffDays(a: string, b: string) {
  return (new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}
function mondayOf(s: string) {
  const d = new Date(s);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
