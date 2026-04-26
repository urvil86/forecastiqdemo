"use client";

import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { getAccounts, getRegionColor, type AccountPerf } from "@/lib/stfReviewSeed";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, ReferenceLine, Cell } from "recharts";
import { formatUsdShort } from "@/lib/format";

export function AccountPerformanceBubble() {
  const accounts = useMemo(() => getAccounts(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  // Quadrant filter at 100% target × 0% growth
  const data = accounts.map((a) => ({
    ...a,
    x: a.qtdPctOfTarget,
    y: a.qoqGrowthPct,
    z: a.revenueUsd,
  }));

  const topPerformers = [...accounts]
    .sort((a, b) => b.qtdPctOfTarget * (1 + b.qoqGrowthPct / 100) - a.qtdPctOfTarget * (1 + a.qoqGrowthPct / 100))
    .slice(0, 5);
  const atRisk = [...accounts]
    .filter((a) => a.qtdPctOfTarget < 92 || a.qoqGrowthPct < -3)
    .sort((a, b) => b.revenueUsd - a.revenueUsd)
    .slice(0, 5);

  return (
    <div>
      <SectionHeader
        title="Top Accounts · Performance Quadrant"
        subtitle="QTD attainment vs Q-over-Q growth, sized by revenue. Colored by region. Click any bubble for drilldown."
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="card">
          <div className="h-80 relative">
            {/* Quadrant labels — positioned inside the actual plot area
                (Recharts default ScatterChart leaves ~60px on left for Y-axis ticks
                and ~30px on bottom for X-axis ticks, so we inset accordingly) */}
            <div className="absolute z-10 pointer-events-none text-[11px] font-semibold" style={{ top: 24, right: 24, color: "#1F8A5C" }}>
              ★ Stars
            </div>
            <div className="absolute z-10 pointer-events-none text-[11px] font-semibold" style={{ top: 24, left: 78, color: "#3B82C4" }}>
              ↑ Emerging
            </div>
            <div className="absolute z-10 pointer-events-none text-[11px] font-semibold" style={{ bottom: 70, right: 24, color: "#E5A04B" }}>
              ⏸ Mature
            </div>
            <div className="absolute z-10 pointer-events-none text-[11px] font-semibold" style={{ bottom: 70, left: 78, color: "#C1423B" }}>
              ⚠ Underperforming
            </div>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 16, right: 16, bottom: 16, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="QTD % of target"
                  unit="%"
                  domain={[70, 120]}
                  tick={{ fontSize: 11 }}
                  label={{ value: "QTD % of target →", position: "bottom", fontSize: 11, fill: "#5C6770" }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="QoQ growth"
                  unit="%"
                  domain={[-15, 25]}
                  tick={{ fontSize: 11 }}
                  label={{ value: "QoQ growth →", angle: -90, position: "left", fontSize: 11, fill: "#5C6770" }}
                />
                <ZAxis type="number" dataKey="z" range={[40, 320]} />
                <ReferenceLine x={100} stroke="#5C6770" strokeDasharray="3 3" />
                <ReferenceLine y={0} stroke="#5C6770" strokeDasharray="3 3" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const a = payload[0].payload as AccountPerf;
                    return (
                      <div className="bg-surface border border-border rounded p-2 text-xs">
                        <div className="font-semibold">{a.name}</div>
                        <div className="text-muted">{a.region}</div>
                        <div className="font-mono">QTD {a.qtdPctOfTarget.toFixed(1)}% · QoQ {a.qoqGrowthPct >= 0 ? "+" : ""}{a.qoqGrowthPct.toFixed(1)}%</div>
                        <div className="font-mono">Revenue {formatUsdShort(a.revenueUsd)}</div>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={data}
                  onClick={(e: { id?: string }) => e?.id && setSelectedId(e.id)}
                >
                  {data.map((d) => (
                    <Cell
                      key={d.id}
                      fill={getRegionColor(d.region)}
                      fillOpacity={d.qtdPctOfTarget < 90 ? 1 : 0.7}
                      stroke={d.qtdPctOfTarget < 90 ? "#C1423B" : getRegionColor(d.region)}
                      strokeWidth={d.qtdPctOfTarget < 90 ? 2 : 1}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-[11px]">
            {(["Northeast", "Southeast", "Midwest", "West", "South-Central"] as const).map((r) => (
              <span key={r} className="flex items-center gap-1 text-muted">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: getRegionColor(r) }} />
                {r}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {selected ? (
            <div className="card">
              <div className="flex items-baseline justify-between">
                <h4 className="font-heading text-h4 text-secondary">{selected.name}</h4>
                <button onClick={() => setSelectedId(null)} className="text-xs text-muted hover:text-foreground">close</button>
              </div>
              <div className="caption text-muted">{selected.region}</div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                <Metric label="QTD vs target" value={`${selected.qtdPctOfTarget.toFixed(1)}%`} />
                <Metric label="QoQ growth" value={`${selected.qoqGrowthPct >= 0 ? "+" : ""}${selected.qoqGrowthPct.toFixed(1)}%`} positive={selected.qoqGrowthPct >= 0} />
                <Metric label="Revenue" value={formatUsdShort(selected.revenueUsd)} />
              </div>
              <div className="caption text-muted mt-3">Top prescribers</div>
              <ul className="text-xs">
                {selected.topPrescribers.map((p) => <li key={p}>• {p}</li>)}
              </ul>
              <div className="caption text-muted mt-3">Pattern</div>
              <p className="text-xs">{selected.variancePattern}</p>
              <div className="caption text-muted mt-3">Recommended action</div>
              <p className="text-xs text-secondary font-semibold">{selected.recommendedAction}</p>
            </div>
          ) : (
            <div className="card text-xs text-muted text-center py-6">
              Click a bubble in the chart to drill into account details.
            </div>
          )}

          <div className="card">
            <h4 className="font-heading text-h4 text-secondary mb-2">Top performers</h4>
            <ul className="text-xs space-y-1">
              {topPerformers.map((a) => (
                <li key={a.id} onClick={() => setSelectedId(a.id)} className="cursor-pointer hover:bg-background rounded px-2 py-1 flex justify-between">
                  <span>{a.name}</span>
                  <span className="font-mono text-success">{a.qtdPctOfTarget.toFixed(0)}% / +{a.qoqGrowthPct.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h4 className="font-heading text-h4 text-secondary mb-2">At risk</h4>
            <ul className="text-xs space-y-1">
              {atRisk.map((a) => (
                <li key={a.id} onClick={() => setSelectedId(a.id)} className="cursor-pointer hover:bg-background rounded px-2 py-1 flex justify-between">
                  <span>{a.name}</span>
                  <span className="font-mono text-danger">{a.qtdPctOfTarget.toFixed(0)}% / {a.qoqGrowthPct >= 0 ? "+" : ""}{a.qoqGrowthPct.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <div className="caption text-muted">{label}</div>
      <div className={"font-mono font-semibold " + (positive === true ? "text-success" : positive === false ? "text-danger" : "")}>{value}</div>
    </div>
  );
}
