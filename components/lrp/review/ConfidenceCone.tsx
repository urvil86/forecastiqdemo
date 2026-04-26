"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { computeConfidenceCone } from "@/lib/lrpSensitivity";
import { SectionHeader } from "@/components/SectionHeader";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend } from "recharts";
import { formatUsdShort, formatPct } from "@/lib/format";

export function ConfidenceCone({ viewThroughYear }: { viewThroughYear: number }) {
  const forecast = useStore((s) => s.forecast);
  const cutoffYear = parseInt(forecast.timeframe.forecastStart.slice(0, 4));

  const cone = useMemo(() => computeConfidenceCone(forecast, 2022, viewThroughYear), [forecast, viewThroughYear]);

  // Data prep for the fan chart — use stacked deltas so Recharts renders bands
  const chartData = useMemo(() => {
    return cone.map((c) => ({
      year: c.year,
      p50: c.p50 / 1e6,
      // Outer band (P5–P95)
      p5: c.p5 / 1e6,
      p95Span: (c.p95 - c.p5) / 1e6,
      // Middle band (P10–P90)
      p10: c.p10 / 1e6,
      p90Span: (c.p90 - c.p10) / 1e6,
      // Inner band (P25–P75)
      p25: c.p25 / 1e6,
      p75Span: (c.p75 - c.p25) / 1e6,
    }));
  }, [cone]);

  const c2030 = cone.find((c) => c.year === Math.min(2030, viewThroughYear));
  const rangePct = c2030 && c2030.p50 > 0 ? (c2030.p90 - c2030.p10) / 2 / c2030.p50 : 0;

  return (
    <div>
      <SectionHeader
        title="Forecast Uncertainty · Confidence Bands"
        subtitle="Computed from sensitivity analysis assuming ±10% variance on top drivers, with horizon-widening spread. For Monte Carlo-based confidence, see the Range Forecast module (when available)."
      />
      <div className="card">
        <div className="h-80">
          <ResponsiveContainer>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(0)}M`} />
              <Tooltip formatter={(v: number | string) => (typeof v === "number" ? formatUsdShort(v * 1e6) : "—")} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine x={cutoffYear} stroke="#C98B27" strokeDasharray="4 4" label={{ value: "Today", fontSize: 11, fill: "#C98B27" }} />
              {/* Outer band P5-P95 (stacked: invisible base + visible span) */}
              <Area dataKey="p5" stackId="outer" stroke="transparent" fill="transparent" name="" legendType="none" />
              <Area dataKey="p95Span" stackId="outer" stroke="transparent" fill="#C98B27" fillOpacity={0.18} name="P5–P95" />
              {/* Middle band P10-P90 */}
              <Area dataKey="p10" stackId="mid" stroke="transparent" fill="transparent" name="" legendType="none" />
              <Area dataKey="p90Span" stackId="mid" stroke="transparent" fill="#C98B27" fillOpacity={0.30} name="P10–P90" />
              {/* Inner band P25-P75 */}
              <Area dataKey="p25" stackId="inner" stroke="transparent" fill="transparent" name="" legendType="none" />
              <Area dataKey="p75Span" stackId="inner" stroke="transparent" fill="#C98B27" fillOpacity={0.45} name="P25–P75" />
              {/* P50 line */}
              <Line dataKey="p50" stroke="#004466" strokeWidth={2.5} dot={false} name="P50 (deterministic baseline)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {c2030 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <KpiTile label={`P10 ${c2030.year} (downside)`} value={formatUsdShort(c2030.p10)} sub="Conservative scenario" negative />
          <KpiTile label={`P50 ${c2030.year} (mid)`} value={formatUsdShort(c2030.p50)} sub="Deterministic baseline" />
          <KpiTile label={`P90 ${c2030.year} (upside)`} value={formatUsdShort(c2030.p90)} sub="Optimistic scenario" positive />
          <KpiTile label="Range as % of mid" value={`±${formatPct(rangePct)}`} sub="(P90 − P10) / 2P50" />
        </div>
      )}

      <div className="card mt-3 text-sm text-muted">
        Uncertainty expands meaningfully post-2027 as biosimilar variance compounds — the further out, the wider the cone. The
        deterministic P50 line is the same forecast you saw on the trajectory chart; the bands are perturbation-derived 1.28σ
        (P10/P90) and 1.645σ (P5/P95) confidence intervals around it.
      </div>
    </div>
  );
}

function KpiTile({ label, value, sub, positive, negative }: { label: string; value: string; sub?: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="card">
      <div className="caption text-muted">{label}</div>
      <div className={"font-mono font-bold text-h4 " + (positive ? "text-success" : negative ? "text-danger" : "text-secondary")}>{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
