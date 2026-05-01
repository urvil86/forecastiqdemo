"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useForecastWindow } from "@/lib/useForecastWindow";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine } from "recharts";
import { formatNumber } from "@/lib/format";

type ChannelKey = "wholesaler" | "specialty-pharmacy";

interface SubAccount {
  name: string;
  units: number;
  doh: number;
}

interface ChannelMeta {
  label: string;
  areaColor: string;
  lineColor: string;
  targetDoh: number;
  startingUnits: number;
  averageDoh: number;
  status: "HEALTHY" | "LOW" | "CRITICAL";
  statusColor: "success" | "warning" | "danger";
  alert?: string;
  subAccounts: SubAccount[];
}

const CHANNEL_META: Record<ChannelKey, ChannelMeta> = {
  "wholesaler": {
    label: "Wholesaler",
    areaColor: "#004466",
    lineColor: "#171717",
    targetDoh: 18,
    startingUnits: 148000,
    averageDoh: 20.1,
    status: "HEALTHY",
    statusColor: "success",
    subAccounts: [
      { name: "McKesson", units: 62000, doh: 22.4 },
      { name: "Cardinal", units: 48000, doh: 19.8 },
      { name: "Cencora", units: 38000, doh: 17.5 },
    ],
  },
  "specialty-pharmacy": {
    label: "Specialty Pharmacy",
    areaColor: "#0A5C82",
    lineColor: "#C1423B",
    targetDoh: 7,
    startingUnits: 48000,
    averageDoh: 6.5,
    status: "LOW",
    statusColor: "warning",
    alert: "Accredo at 4.8 days — below 7-day target. Replenishment recommended.",
    subAccounts: [
      { name: "Accredo", units: 22000, doh: 4.8 },
      { name: "CVS Specialty", units: 16000, doh: 7.2 },
      { name: "Option Care", units: 10000, doh: 8.6 },
    ],
  },
};

export function InventoryDohView() {
  const computed = useStore((s) => s.computed);
  const inventoryStart = useStore((s) => s.forecast.stf.inventoryStart);
  const win = useForecastWindow();
  const [channel, setChannel] = useState<ChannelKey>("wholesaler");

  // Starting on-hand: prefer the seed value for this channel, fall back to demo number.
  const startingUnits = useMemo(() => {
    const seedSum = inventoryStart
      .filter((t) => t.tier === channel)
      .reduce((sum, t) => sum + t.units, 0);
    return seedSum > 0 ? seedSum : CHANNEL_META[channel].startingUnits;
  }, [inventoryStart, channel]);

  const meta = CHANNEL_META[channel];

  // The chart is a demand-cover view: starting inventory ÷ implied daily outflow ≈ target DOH.
  // baselineDailyOuts is calibrated so DOH starts near the channel's average and drifts mildly.
  const baselineDailyOuts = startingUnits / meta.averageDoh;

  const projection = useMemo(() => {
    if (!computed) return [];
    let units = startingUnits;
    const driftAmplitude = startingUnits * 0.06; // ±6% noise on units
    // Slight downward bias so the line trends toward the target (replenishment story)
    const downwardBias = startingUnits * 0.005;
    return computed.weekly
      .filter((w) => w.weekStart >= win.windowStart && w.weekStart <= win.windowEnd)
      .map((w, i) => {
        units += Math.sin(i * 0.55) * driftAmplitude - downwardBias;
        const safeUnits = Math.max(0, units);
        const doh = safeUnits / baselineDailyOuts;
        return {
          week: w.weekStart,
          units: safeUnits,
          doh,
          isActual: w.isActual,
        };
      });
  }, [computed, startingUnits, baselineDailyOuts, win]);

  const maxUnits = projection.reduce((m, p) => Math.max(m, p.units), startingUnits);
  const maxDoh = projection.reduce((m, p) => Math.max(m, p.doh), meta.targetDoh);
  const dohDomainMax = Math.ceil(Math.max(meta.targetDoh * 1.6, maxDoh + 2) / 5) * 5;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-baseline justify-between mb-2 flex-wrap gap-3">
          <div>
            <h3 className="font-heading text-h3 text-secondary">Channel Inventory & Days on Hand</h3>
            <p className="text-xs text-muted mt-1 max-w-2xl">
              Filled area (left axis) is on-hand inventory units in the selected channel. The line (right axis) is
              <strong> Days on Hand</strong> — how many days of demand the on-hand cover represents at the channel&apos;s
              implied run-rate. The dashed green line marks the target DOH; the line drifting below it signals a
              replenishment risk.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="caption text-muted flex items-center gap-2">
              Channel
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as ChannelKey)}
                className="input-cell !font-sans"
              >
                <option value="wholesaler">Wholesaler</option>
                <option value="specialty-pharmacy">Specialty Pharmacy</option>
              </select>
            </label>
            <span className="text-xs text-muted">
              {win.historyWeeks}w history + {win.horizonWeeks}w horizon
            </span>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <ComposedChart data={projection} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(projection.length / 13))} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => formatNumber(v)}
                domain={[0, Math.ceil(maxUnits / 10000) * 10000]}
                label={{ value: "Inventory (units)", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#777" } }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10 }}
                domain={[0, dohDomainMax]}
                allowDataOverflow={false}
                label={{ value: "Days on Hand", angle: 90, position: "insideRight", style: { fontSize: 10, fill: "#777" } }}
              />
              <Tooltip
                formatter={(value: number | string, name: string) => {
                  if (typeof value !== "number") return ["—", name];
                  if (name === "DOH") return [`${value.toFixed(1)} days`, name];
                  return [formatNumber(Math.round(value)), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine yAxisId="left" x={win.cutoff} stroke="#C1423B" strokeDasharray="3 3" label={{ value: "Cutoff", fontSize: 10, fill: "#C1423B" }} />
              <ReferenceLine
                yAxisId="right"
                y={meta.targetDoh}
                stroke="#1F8A5C"
                strokeDasharray="4 2"
                label={{ value: `Target ${meta.targetDoh}d`, fontSize: 10, fill: "#1F8A5C", position: "right" }}
              />
              <Area yAxisId="left" type="monotone" dataKey="units" fill={meta.areaColor} stroke={meta.areaColor} fillOpacity={0.45} name="Inventory (units)" />
              <Line yAxisId="right" type="monotone" dataKey="doh" stroke={meta.lineColor} strokeWidth={2} dot={false} name="DOH" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted mt-2">
          <strong>{meta.label}</strong> — starting on-hand <span className="font-mono">{formatNumber(startingUnits)} units</span>,
          implied daily outflow <span className="font-mono">{formatNumber(Math.round(baselineDailyOuts))} units/day</span>,
          target DOH <span className="font-mono">{meta.targetDoh} days</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChannelCard meta={CHANNEL_META["wholesaler"]} />
        <ChannelCard meta={CHANNEL_META["specialty-pharmacy"]} />
      </div>
    </div>
  );
}

function ChannelCard({ meta }: { meta: ChannelMeta }) {
  const cls =
    meta.statusColor === "success" ? "pill-success" : meta.statusColor === "warning" ? "pill-warning" : "pill-danger";
  return (
    <div className="card">
      <div className="flex justify-between items-start">
        <div>
          <div className="caption text-muted">{meta.label}</div>
          <div className="font-heading text-h3 text-secondary mt-1">{formatNumber(meta.startingUnits)}</div>
          <div className="text-xs text-muted">DOH {meta.averageDoh.toFixed(1)} · target {meta.targetDoh}</div>
        </div>
        <span className={cls}>{meta.status}</span>
      </div>
      <ul className="text-xs mt-3 space-y-1">
        {meta.subAccounts.map((s) => {
          const belowTarget = s.doh < meta.targetDoh;
          return (
            <li key={s.name} className="flex justify-between">
              <span className="text-muted">{s.name}</span>
              <span className="flex items-center gap-3 font-mono">
                <span>{formatNumber(s.units)}u</span>
                <span className={belowTarget ? "text-danger font-semibold" : "text-foreground"}>
                  DOH {s.doh.toFixed(1)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {meta.alert && (
        <p
          className={
            "text-xs mt-3 p-2 rounded " +
            (meta.statusColor === "danger" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning")
          }
        >
          ⚠ {meta.alert}
        </p>
      )}
    </div>
  );
}
