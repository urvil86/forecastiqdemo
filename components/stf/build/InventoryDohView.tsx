"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useForecastWindow } from "@/lib/useForecastWindow";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine } from "recharts";
import { formatNumber } from "@/lib/format";

export function InventoryDohView() {
  const computed = useStore((s) => s.computed);
  const inventoryStart = useStore((s) => s.forecast.stf.inventoryStart);
  const win = useForecastWindow();

  const tierTotals = inventoryStart.reduce(
    (acc, tier) => {
      acc[tier.tier] = (acc[tier.tier] ?? 0) + tier.units;
      return acc;
    },
    {} as Record<string, number>
  );

  const projection = useMemo(() => {
    if (!computed) return [];
    let wholesaler = tierTotals["wholesaler"] ?? 0;
    let sp = tierTotals["specialty-pharmacy"] ?? 0;
    let hub = tierTotals["hub"] ?? 0;
    return computed.weekly
      .filter((w) => w.weekStart >= win.windowStart && w.weekStart <= win.windowEnd)
      .map((w, i) => {
        // Inventory drift: small variations driven by week index (deterministic, not random)
        wholesaler += Math.sin(i * 0.6) * 4000 - 1500;
        sp += Math.cos(i * 0.5) * 1800 - 800;
        hub += Math.sin(i * 1.1) * 600 - 250;
        const dailyOuts = w.totalVolume / 7;
        const dohW = wholesaler / Math.max(1, dailyOuts);
        const dohS = sp / Math.max(1, dailyOuts);
        const dohH = hub / Math.max(1, dailyOuts);
        return {
          week: w.weekStart,
          wholesaler: Math.max(0, wholesaler),
          sp: Math.max(0, sp),
          hub: Math.max(0, hub),
          dohW,
          dohS,
          dohH,
          isActual: w.isActual,
        };
      });
  }, [computed, tierTotals, win]);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-heading text-h3 text-secondary">Three-Tier Inventory & DOH</h3>
          <span className="text-xs text-muted">
            {win.historyWeeks}w history + {win.horizonWeeks}w horizon
          </span>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <ComposedChart data={projection}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(projection.length / 13))} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine yAxisId="left" x={win.cutoff} stroke="#C1423B" strokeDasharray="3 3" label={{ value: "Cutoff", fontSize: 10, fill: "#C1423B" }} />
              <Area yAxisId="left" dataKey="wholesaler" stackId="inv" fill="#004466" stroke="#004466" name="Wholesaler" fillOpacity={0.6} />
              <Area yAxisId="left" dataKey="sp" stackId="inv" fill="#0A5C82" stroke="#0A5C82" name="Specialty Pharmacy" fillOpacity={0.6} />
              <Area yAxisId="left" dataKey="hub" stackId="inv" fill="#C98B27" stroke="#C98B27" name="Hub" fillOpacity={0.6} />
              <Line yAxisId="right" dataKey="dohW" stroke="#171717" name="DOH-W" dot={false} strokeWidth={1.4} />
              <Line yAxisId="right" dataKey="dohS" stroke="#C1423B" name="DOH-SP" dot={false} strokeWidth={1.4} />
              <Line yAxisId="right" dataKey="dohH" stroke="#1F8A5C" name="DOH-H" dot={false} strokeWidth={1.4} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TierCard
          name="Wholesaler"
          units={148000}
          doh={20.1}
          status="HEALTHY"
          color="success"
          subItems={[
            { name: "McKesson", units: 62000 },
            { name: "Cardinal", units: 48000 },
            { name: "Cencora", units: 38000 },
          ]}
        />
        <TierCard
          name="Specialty Pharmacy"
          units={48000}
          doh={6.5}
          status="LOW"
          color="warning"
          alert="Accredo DOH approaching critical threshold"
          subItems={[
            { name: "Accredo", units: 22000 },
            { name: "CVS Specialty", units: 16000 },
            { name: "Option Care", units: 10000 },
          ]}
        />
        <TierCard name="Hub" units={8000} doh={1.1} status="CRITICAL" color="danger" alert="Replenishment PO pending" />
      </div>
    </div>
  );
}

function TierCard({
  name,
  units,
  doh,
  status,
  color,
  subItems,
  alert,
}: {
  name: string;
  units: number;
  doh: number;
  status: string;
  color: "success" | "warning" | "danger";
  subItems?: { name: string; units: number }[];
  alert?: string;
}) {
  const cls = color === "success" ? "pill-success" : color === "warning" ? "pill-warning" : "pill-danger";
  return (
    <div className="card">
      <div className="flex justify-between items-start">
        <div>
          <div className="caption text-muted">{name}</div>
          <div className="font-heading text-h3 text-secondary mt-1">{formatNumber(units)}</div>
          <div className="text-xs text-muted">DOH {doh.toFixed(1)}</div>
        </div>
        <span className={cls}>{status}</span>
      </div>
      {subItems && (
        <ul className="text-xs mt-3 space-y-1 text-muted">
          {subItems.map((s) => (
            <li key={s.name} className="flex justify-between">
              <span>{s.name}</span>
              <span className="font-mono">{formatNumber(s.units)}</span>
            </li>
          ))}
        </ul>
      )}
      {alert && (
        <p
          className={
            "text-xs mt-3 p-2 rounded " + (color === "danger" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning")
          }
        >
          ⚠ {alert}
        </p>
      )}
    </div>
  );
}
