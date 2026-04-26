"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { TrendSelectionCard } from "@/components/lrp/TrendSelectionCard";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { formatNumber } from "@/lib/format";

export function TrendSelectionView() {
  const computed = useStore((s) => s.computed);

  const chartData = useMemo(() => {
    if (!computed) return [];
    return computed.weekly.map((w) => ({
      week: w.weekStart,
      actuals: w.isActual ? w.totalVolume : null,
      forecast: !w.isActual ? w.totalVolume : null,
    }));
  }, [computed]);

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="font-heading text-h3 text-secondary mb-2">Weekly Trend Forecast</h3>
        <p className="text-sm text-muted mb-3">156 weeks history + 26 weeks forward.</p>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={26} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip formatter={(v: number | string) => (typeof v === "number" ? formatNumber(v) : "—")} />
              <ReferenceLine x="2026-04-13" stroke="#C98B27" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="actuals" stroke="#004466" strokeWidth={1.6} dot={false} name="Actuals" />
              <Line type="monotone" dataKey="forecast" stroke="#C98B27" strokeWidth={2} dot={false} name="Forecast" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <TrendSelectionCard />
      <div className="card">
        <h4 className="font-heading text-h4 text-secondary mb-2">Trend Validator</h4>
        <p className="text-sm text-muted">
          Quick Expert ranks #1 of 6 by RMSE. Confidence: <span className="pill-success">HIGH</span>
        </p>
      </div>
    </div>
  );
}
