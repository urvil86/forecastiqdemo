"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useForecastWindow } from "@/lib/useForecastWindow";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine } from "recharts";
import { formatNumber } from "@/lib/format";

type ChannelKey = "wholesaler" | "specialty-pharmacy";

const CHANNEL_META: Record<ChannelKey, { label: string; areaColor: string; lineColor: string; targetDoh: number }> = {
  "wholesaler": { label: "Wholesaler", areaColor: "#004466", lineColor: "#171717", targetDoh: 18 },
  "specialty-pharmacy": { label: "Specialty Pharmacy", areaColor: "#0A5C82", lineColor: "#C1423B", targetDoh: 7 },
};

export function InventoryDohView() {
  const computed = useStore((s) => s.computed);
  const inventoryStart = useStore((s) => s.forecast.stf.inventoryStart);
  const win = useForecastWindow();
  const [channel, setChannel] = useState<ChannelKey>("wholesaler");

  const startingUnits = useMemo(() => {
    return inventoryStart
      .filter((t) => t.tier === channel)
      .reduce((sum, t) => sum + t.units, 0);
  }, [inventoryStart, channel]);

  const projection = useMemo(() => {
    if (!computed) return [];
    let units = startingUnits;
    const driftAmplitude = channel === "wholesaler" ? 4000 : 1800;
    const driftBias = channel === "wholesaler" ? 1500 : 800;
    const channelOutShare = channel === "wholesaler" ? 0.72 : 0.28;
    return computed.weekly
      .filter((w) => w.weekStart >= win.windowStart && w.weekStart <= win.windowEnd)
      .map((w, i) => {
        units += Math.sin(i * (channel === "wholesaler" ? 0.6 : 0.5)) * driftAmplitude - driftBias;
        const safeUnits = Math.max(0, units);
        const channelDailyOuts = (w.totalVolume * channelOutShare) / 7;
        const doh = safeUnits / Math.max(1, channelDailyOuts);
        return {
          week: w.weekStart,
          units: safeUnits,
          doh,
          isActual: w.isActual,
        };
      });
  }, [computed, startingUnits, channel, win]);

  const meta = CHANNEL_META[channel];
  const maxDoh = projection.reduce((m, p) => Math.max(m, p.doh), 0);
  const maxUnits = projection.reduce((m, p) => Math.max(m, p.units), 0);
  const dohDomainMax = Math.max(meta.targetDoh * 1.5, Math.ceil(maxDoh / 5) * 5 + 5);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-baseline justify-between mb-2 flex-wrap gap-3">
          <div>
            <h3 className="font-heading text-h3 text-secondary">Channel Inventory & Days on Hand</h3>
            <p className="text-xs text-muted mt-1 max-w-2xl">
              Projected on-hand inventory units (filled area, left axis) and Days-on-Hand cover (line, right axis) for the
              selected channel. DOH = on-hand units ÷ projected daily outflow. Inventory units drift week-to-week as the
              channel ships product through to providers; the line crossing below the target band signals a replenishment
              risk.
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
          Showing <strong>{meta.label}</strong> · Starting on-hand: <span className="font-mono">{formatNumber(startingUnits)} units</span>
          {" "}· Target DOH: <span className="font-mono">{meta.targetDoh} days</span>.
          Daily outflow assumes ~{Math.round((channel === "wholesaler" ? 0.72 : 0.28) * 100)}% of total weekly OUTs flow through this channel.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
