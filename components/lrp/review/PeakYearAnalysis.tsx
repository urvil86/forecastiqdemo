"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { compute, getSeedForecast } from "@/lib/engine";
import { SectionHeader } from "@/components/SectionHeader";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, ReferenceLine, Cell } from "recharts";
import { formatUsdShort, formatPct } from "@/lib/format";

export function PeakYearAnalysis({ viewThroughYear }: { viewThroughYear: number }) {
  const forecast = useStore((s) => s.forecast);
  const computed = useStore((s) => s.computed);
  const versionHistory = useStore((s) => s.versionHistory);

  // Compute peak year for seed + every saved version + current.
  // Seed always included so even a single saved version produces 3 distinct
  // data points (seed, save, current) and the drift visualization is meaningful.
  const versionPeaks = useMemo(() => {
    const all = [
      { versionLabel: "v0 seed", c: compute(getSeedForecast()) },
      ...versionHistory.slice().reverse().map((v) => ({ versionLabel: `v${v.version}`, c: compute(v.forecast) })),
      { versionLabel: `v${forecast.version} (current)`, c: computed ?? compute(forecast) },
    ];
    return all.map(({ versionLabel, c }) => {
      let peakYear = 2026;
      let peak = 0;
      for (const a of c.annual.filter((aa) => aa.year <= viewThroughYear)) {
        if (a.netSales > peak) {
          peak = a.netSales;
          peakYear = a.year;
        }
      }
      return { versionLabel, peakYear, peak };
    });
  }, [versionHistory, forecast, computed, viewThroughYear]);

  const currentPeak = versionPeaks[versionPeaks.length - 1];

  // Histogram of peak years across versions
  const histogram = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of versionPeaks) counts.set(p.peakYear, (counts.get(p.peakYear) ?? 0) + 1);
    const rows: { year: number; count: number; isCurrent: boolean }[] = [];
    for (let y = 2025; y <= Math.min(2032, viewThroughYear); y++) {
      rows.push({ year: y, count: counts.get(y) ?? 0, isCurrent: y === currentPeak?.peakYear });
    }
    return rows;
  }, [versionPeaks, currentPeak, viewThroughYear]);

  // Plateau computation (years within 5% of peak)
  const plateau = useMemo(() => {
    if (!computed || !currentPeak) return null;
    const within5 = computed.annual.filter((a) => a.year <= viewThroughYear && a.netSales >= 0.95 * currentPeak.peak);
    if (within5.length === 0) return null;
    return { startYear: within5[0].year, endYear: within5[within5.length - 1].year, count: within5.length };
  }, [computed, currentPeak, viewThroughYear]);

  // Decline rate post-peak
  const declineCagr = useMemo(() => {
    if (!computed || !currentPeak) return null;
    const after = computed.annual.filter((a) => a.year > currentPeak.peakYear && a.year <= Math.min(2032, viewThroughYear));
    if (after.length < 2) return null;
    const start = currentPeak.peak;
    const end = after[after.length - 1].netSales;
    const span = after[after.length - 1].year - currentPeak.peakYear;
    return Math.pow(end / start, 1 / span) - 1;
  }, [computed, currentPeak, viewThroughYear]);

  // Drift mini-chart: peak year over versions
  const driftData = useMemo(() => versionPeaks.map((p) => ({ vLabel: p.versionLabel, peakYear: p.peakYear })), [versionPeaks]);

  return (
    <div>
      <SectionHeader title="When Does the Brand Peak?" subtitle="Distribution of peak years across saved forecast versions, plus plateau and decline analytics." />
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <div className="card">
          <h4 className="font-heading text-h4 text-secondary mb-2">Peak year distribution across versions</h4>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={histogram}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count">
                  {histogram.map((h, i) => (
                    <Cell key={i} fill={h.isCurrent ? "#C98B27" : "#0A5C82"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {versionPeaks.length === 1 && (
            <p className="text-xs text-muted italic mt-2">
              Only one version available — variance not yet meaningful. Save additional versions to see peak-year stability.
            </p>
          )}

          {versionPeaks.length > 1 && (
            <div className="mt-4">
              <h4 className="font-heading text-h4 text-secondary mb-2">Peak year drift across versions</h4>
              <div className="h-32">
                <ResponsiveContainer>
                  <LineChart data={driftData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
                    <XAxis dataKey="vLabel" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                    <ReferenceLine y={currentPeak?.peakYear ?? 2027} stroke="#C98B27" strokeDasharray="3 3" />
                    <Tooltip />
                    <Line dataKey="peakYear" stroke="#004466" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted mt-2">
                Reveals whether the peak year is converging on a stable estimate or continuing to drift.
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <h4 className="font-heading text-h4 text-secondary mb-3">Peak metrics</h4>
          <Metric label="Current peak year" value={String(currentPeak?.peakYear ?? "—")} />
          <Metric label="Peak net sales" value={currentPeak ? formatUsdShort(currentPeak.peak) : "—"} />
          <Metric
            label="Years until peak"
            value={currentPeak ? `${Math.max(0, currentPeak.peakYear - 2026)} year${currentPeak.peakYear - 2026 === 1 ? "" : "s"}` : "—"}
          />
          {plateau && (
            <Metric
              label="Plateau (within 5% of peak)"
              value={`${plateau.count} year${plateau.count === 1 ? "" : "s"} (${plateau.startYear}–${plateau.endYear})`}
            />
          )}
          {declineCagr !== null && (
            <Metric
              label="Decline rate post-peak"
              value={formatPct(declineCagr)}
              sub="CAGR after peak"
              negative={declineCagr < 0}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, negative }: { label: string; value: string; sub?: string; negative?: boolean }) {
  return (
    <div className="border-b border-border py-2 last:border-0">
      <div className="caption text-muted">{label}</div>
      <div className={"font-mono font-semibold " + (negative ? "text-danger" : "text-secondary")}>{value}</div>
      {sub && <div className="text-[10px] text-muted">{sub}</div>}
    </div>
  );
}
