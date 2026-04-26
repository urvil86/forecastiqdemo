"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { compute } from "@/lib/engine";
import { SectionHeader } from "@/components/SectionHeader";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend, ReferenceDot } from "recharts";
import { formatUsdShort, formatPct } from "@/lib/format";

interface VersionEntry { id: string; version: number; label: string; current: boolean }

export function NetSalesTrajectory({
  viewThroughYear,
  versions,
}: {
  viewThroughYear: number;
  versions: VersionEntry[];
}) {
  const forecast = useStore((s) => s.forecast);
  const computed = useStore((s) => s.computed);
  const versionHistory = useStore((s) => s.versionHistory);

  const data = useMemo(() => {
    if (!computed) return [];
    const rows: Record<string, number | string | null>[] = [];
    // Compute prior versions
    const priorComputed = versionHistory.slice(0, 4).map((v) => ({ v, c: compute(v.forecast) }));
    for (const a of computed.annual) {
      if (a.year > viewThroughYear) continue;
      const isHistorical = forecast.lrp.annualActuals.some((aa) => aa.year === a.year);
      const row: Record<string, number | string | null> = {
        year: a.year,
        current: a.netSales / 1e6,
        actual: isHistorical ? a.netSales / 1e6 : null,
      };
      priorComputed.forEach((p, i) => {
        const found = p.c.annual.find((aa) => aa.year === a.year);
        row[`v${i}`] = found ? found.netSales / 1e6 : null;
      });
      rows.push(row);
    }
    return rows;
  }, [computed, forecast, versionHistory, viewThroughYear]);

  const kpis = useMemo(() => {
    if (!computed) return null;
    const annualUpToView = computed.annual.filter((a) => a.year <= viewThroughYear);
    let peakYear = annualUpToView[0]?.year ?? 2026;
    let peak = 0;
    for (const a of annualUpToView) {
      if (a.netSales > peak) {
        peak = a.netSales;
        peakYear = a.year;
      }
    }
    const a26 = computed.annual.find((a) => a.year === 2026)?.netSales ?? 0;
    const a35 = computed.annual.find((a) => a.year === Math.min(2035, viewThroughYear))?.netSales ?? 0;
    const span = Math.min(2035, viewThroughYear) - 2026;
    const cagr = a26 > 0 && span > 0 ? Math.pow(a35 / a26, 1 / span) - 1 : 0;

    // Compare to most recent prior version
    const prior = versionHistory[0];
    let priorPeakYear: number | null = null;
    let priorPeak: number | null = null;
    if (prior) {
      const c = compute(prior.forecast);
      let pY = 2026, p = 0;
      for (const a of c.annual.filter((aa) => aa.year <= viewThroughYear)) {
        if (a.netSales > p) { p = a.netSales; pY = a.year; }
      }
      priorPeakYear = pY;
      priorPeak = p;
    }
    return { peakYear, peak, cagr, priorPeakYear, priorPeak };
  }, [computed, viewThroughYear, versionHistory]);

  const cutoffYear = parseInt(forecast.timeframe.forecastStart.slice(0, 4));

  return (
    <div>
      <SectionHeader title="Net Sales Trajectory · 2022–2035" subtitle="Current forecast vs prior versions, with historical actuals." />
      <div className="card">
        <div className="h-80">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(0)}M`} />
              <Tooltip formatter={(v: number | string) => (typeof v === "number" ? formatUsdShort(v * 1e6) : "—")} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine x={cutoffYear} stroke="#C98B27" strokeDasharray="4 4" label={{ value: "Today", fontSize: 11, fill: "#C98B27" }} />
              {versionHistory.slice(0, 4).map((v, i) => (
                <Line
                  key={v.id}
                  dataKey={`v${i}`}
                  stroke="#5C6770"
                  strokeOpacity={0.4}
                  strokeWidth={1.6}
                  dot={false}
                  name={`v${v.version} · ${v.label}`}
                />
              ))}
              <Line
                dataKey="current"
                stroke="#004466"
                strokeWidth={3}
                dot={false}
                name={`v${forecast.version} · ${forecast.versionLabel} (current)`}
              />
              <Line dataKey="actual" stroke="#1F8A5C" strokeWidth={0} dot={{ r: 4, fill: "#1F8A5C" }} name="Actuals" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <KpiTile
            label="Peak Year"
            value={String(kpis.peakYear)}
            sub={kpis.priorPeakYear !== null ? `was ${kpis.priorPeakYear} in prior` : "no prior version"}
          />
          <KpiTile
            label="Peak Net Sales"
            value={formatUsdShort(kpis.peak)}
            sub={kpis.priorPeak !== null ? `was ${formatUsdShort(kpis.priorPeak)} (${formatPct((kpis.peak - kpis.priorPeak) / kpis.priorPeak)})` : "no prior version"}
            positive={kpis.priorPeak !== null && kpis.peak >= kpis.priorPeak}
          />
          <KpiTile label={`${cutoffYear}–${Math.min(2035, viewThroughYear)} CAGR`} value={formatPct(kpis.cagr)} sub="annualized growth" />
        </div>
      )}
      <p className="text-xs text-muted mt-3">
        Versions: {versions.length}. Annotations on the current line indicate points where major assumptions changed (visible when
        you hover the inflection points). Historical actuals shown as green dots.
      </p>
    </div>
  );
}

function KpiTile({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="card flex-1">
      <div className="caption text-muted">{label}</div>
      <div className="font-heading text-h3 text-secondary">{value}</div>
      {sub && (
        <div className={"text-xs mt-1 " + (positive === true ? "text-success" : positive === false ? "text-danger" : "text-muted")}>
          {sub}
        </div>
      )}
    </div>
  );
}
