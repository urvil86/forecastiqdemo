"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { compute, getSeedForecast } from "@/lib/engine";
import { SectionHeader } from "@/components/SectionHeader";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { formatUsdShort, formatPct } from "@/lib/format";

const FOCUS_YEAR = 2030;

export function ForecastEvolution({ viewThroughYear }: { viewThroughYear: number }) {
  const forecast = useStore((s) => s.forecast);
  const versionHistory = useStore((s) => s.versionHistory);

  // Build versions in chronological order. Always start with the unedited seed
  // (v0) so drift columns are meaningful even when only one version has been saved.
  const versionsChrono = useMemo(() => {
    const seedSnapshot = {
      id: "__seed__",
      version: 0,
      label: "Initial seed",
      forecast: getSeedForecast(),
    };
    const saved = [...versionHistory].reverse(); // store keeps newest-first
    return [
      seedSnapshot,
      ...saved,
      { id: "current", version: forecast.version, label: forecast.versionLabel, forecast },
    ];
  }, [versionHistory, forecast]);

  const computedByVersion = useMemo(() => versionsChrono.map((v) => ({ v, c: compute(v.forecast) })), [versionsChrono]);

  // Heatmap data: [year][version] = % delta vs prior version
  const heatmap = useMemo(() => {
    const years: number[] = [];
    for (let y = 2026; y <= viewThroughYear; y++) years.push(y);
    return years.map((y) => {
      const row: { year: number; cells: { vIdx: number; pct: number; ns: number; pct_label: string }[] } = { year: y, cells: [] };
      for (let i = 1; i < computedByVersion.length; i++) {
        const cur = computedByVersion[i].c.annual.find((a) => a.year === y)?.netSales ?? 0;
        const prev = computedByVersion[i - 1].c.annual.find((a) => a.year === y)?.netSales ?? 0;
        const pct = prev === 0 ? 0 : (cur - prev) / prev;
        row.cells.push({ vIdx: i, pct, ns: cur, pct_label: formatPct(pct) });
      }
      return row;
    });
  }, [computedByVersion, viewThroughYear]);

  // Cumulative line for FOCUS_YEAR (2030)
  const cumulative = useMemo(() => {
    if (computedByVersion.length === 0) return [];
    const baseline = computedByVersion[0].c.annual.find((a) => a.year === FOCUS_YEAR)?.netSales ?? 0;
    return computedByVersion.map((entry, i) => {
      const ns = entry.c.annual.find((a) => a.year === FOCUS_YEAR)?.netSales ?? 0;
      return { vLabel: `v${entry.v.version}`, cumDelta: (ns - baseline) / 1e6, ns: ns / 1e6, idx: i };
    });
  }, [computedByVersion]);


  function colorForPct(p: number): string {
    // map -10%..+10% to red..green
    const clamped = Math.max(-0.10, Math.min(0.10, p));
    const intensity = Math.abs(clamped) / 0.10;
    if (clamped >= 0) {
      // green
      const alpha = 0.15 + intensity * 0.65;
      return `rgba(31, 138, 92, ${alpha.toFixed(2)})`;
    } else {
      const alpha = 0.15 + intensity * 0.65;
      return `rgba(193, 66, 59, ${alpha.toFixed(2)})`;
    }
  }

  // Compute summary line for FOCUS_YEAR
  const focusSummary = useMemo(() => {
    if (cumulative.length === 0) return null;
    const last = cumulative[cumulative.length - 1];
    const first = cumulative[0];
    const sign = last.cumDelta >= 0 ? "up" : "down";
    return {
      revisions: cumulative.length - 1,
      cumDeltaUsd: last.cumDelta * 1e6,
      cumDeltaPct: first.ns === 0 ? 0 : ((last.ns - first.ns) / first.ns),
      direction: sign,
    };
  }, [cumulative]);

  return (
    <div>
      <SectionHeader
        title="Forecast Evolution · Tracking Drift Over Time"
        subtitle={`Heatmap of version-over-version drift, plus a focused line on ${FOCUS_YEAR} cumulative drift.`}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Heatmap */}
        <div className="card overflow-x-auto">
          <h4 className="font-heading text-h4 text-secondary mb-2">Drift heatmap (v-over-v % change)</h4>
          <table className="text-[10px] border-collapse">
            <thead>
              <tr>
                <th className="px-2 py-1 text-muted text-left">Year ↓ / Version →</th>
                {versionsChrono.slice(1).map((v) => (
                  <th key={v.id} className="px-2 py-1 font-mono text-muted">v{v.version}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.map((row) => (
                <tr key={row.year}>
                  <td className="px-2 py-1 font-mono text-muted">{row.year}</td>
                  {row.cells.map((c) => (
                    <td
                      key={c.vIdx}
                      className="px-2 py-1 font-mono text-center border border-white"
                      style={{ background: colorForPct(c.pct), minWidth: 60 }}
                      title={`${row.year} v${c.vIdx}: ${formatUsdShort(c.ns)} (${c.pct_label} vs prior)`}
                    >
                      {c.pct_label}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-muted mt-2">
            Green = positive revision (forecast went up). Red = negative revision. Uniform red column = pessimistic version. Uniform
            red row = year keeps getting revised down.
          </p>
        </div>

        {/* Cumulative line for FOCUS_YEAR */}
        <div className="card">
          <h4 className="font-heading text-h4 text-secondary mb-2">{FOCUS_YEAR} net sales · cumulative drift</h4>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={cumulative}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
                <XAxis dataKey="vLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v >= 0 ? "+" : ""}$${v.toFixed(0)}M`} />
                <ReferenceLine y={0} stroke="#5C6770" />
                <Tooltip formatter={(v: number | string) => (typeof v === "number" ? `${v >= 0 ? "+" : ""}${formatUsdShort(v * 1e6)}` : "—")} />
                <Line dataKey="cumDelta" stroke="#004466" strokeWidth={2.5} dot={{ r: 3, fill: "#C98B27" }} name="Cumulative delta vs v1" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {focusSummary && (
            <div className="mt-3 text-sm bg-background rounded-md p-3">
              <p className="text-secondary">
                <strong>{FOCUS_YEAR} net sales</strong> has been revised <strong>{focusSummary.revisions}</strong> time
                {focusSummary.revisions === 1 ? "" : "s"} across saved versions, cumulative{" "}
                <span className={focusSummary.cumDeltaUsd >= 0 ? "text-success" : "text-danger"}>
                  {focusSummary.cumDeltaUsd >= 0 ? "+" : ""}{formatUsdShort(focusSummary.cumDeltaUsd)} ({formatPct(focusSummary.cumDeltaPct)})
                </span>
                . Trend: persistently {focusSummary.direction === "up" ? "optimistic" : "pessimistic"} on this year.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
