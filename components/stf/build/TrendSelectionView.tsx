"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { TrendSelectionCard } from "@/components/lrp/TrendSelectionCard";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { formatNumber } from "@/lib/format";

export function TrendSelectionView() {
  const computed = useStore((s) => s.computed);
  const granularity = useStore((s) => s.forecast.stf.granularity);
  const cutoff = useStore((s) => s.forecast.stf.actualsCutoffDate);

  const chartData = useMemo(() => {
    if (!computed) return [];
    if (granularity === "daily") {
      return computed.daily.map((d) => {
        const isActual = d.date <= cutoff;
        return {
          period: d.date,
          actuals: isActual ? d.totalVolume : null,
          forecast: !isActual ? d.totalVolume : null,
        };
      });
    }
    return computed.weekly.map((w) => ({
      period: w.weekStart,
      actuals: w.isActual ? w.totalVolume : null,
      forecast: !w.isActual ? w.totalVolume : null,
    }));
  }, [computed, granularity, cutoff]);

  const tickInterval = granularity === "daily" ? Math.max(1, Math.floor(chartData.length / 12)) : 26;
  const grainLabel = granularity === "daily" ? "Daily" : "Weekly";
  const grainHint =
    granularity === "daily"
      ? "Daily granularity selected in Setup. Toggle in Setup → Forecast Configuration."
      : "Weekly granularity selected in Setup. Toggle in Setup → Forecast Configuration.";

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="font-heading text-h3 text-secondary mb-2">{grainLabel} Trend Forecast</h3>
        <p className="text-sm text-muted mb-3">{grainHint}</p>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} interval={tickInterval} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip formatter={(v: number | string) => (typeof v === "number" ? formatNumber(v) : "—")} />
              <ReferenceLine x={cutoff} stroke="#C98B27" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="actuals" stroke="#004466" strokeWidth={1.6} dot={false} name="Actuals" />
              <Line type="monotone" dataKey="forecast" stroke="#C98B27" strokeWidth={2} dot={false} name="Forecast" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <TrendSelectionCard chartGrain="stf" />
      <div className="card">
        <h4 className="font-heading text-h4 text-secondary mb-2">Trend Validator</h4>
        <p className="text-sm text-muted">
          Quick Expert ranks #1 of 6 by RMSE. Confidence: <span className="pill-success">HIGH</span>
        </p>
      </div>
    </div>
  );
}
