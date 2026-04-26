"use client";

import { useMemo } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { getChannelReconciliation, getTierInventoryHistory } from "@/lib/stfReviewSeed";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatNumber, formatUsdShort } from "@/lib/format";

const TIER_COLOR = { wholesaler: "#004466", sp: "#0A5C82", hub: "#C98B27" };

export function ChannelInventoryFlow() {
  const recon = useMemo(() => getChannelReconciliation(), []);
  const history = useMemo(() => getTierInventoryHistory(13), []);

  // Flow widths roughly proportional to last week's volume
  const last = recon[recon.length - 1];
  const totalIn = last.ins852;
  const totalOut = last.outs867;

  return (
    <div>
      <SectionHeader
        title="Channel Flow · Last 4 Weeks"
        subtitle="Manufacturer → Wholesaler → Specialty Pharmacy → Patient. Width proportional to units shipped; status by tier."
      />

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-2 items-center">
          <Node title="Manufacturer" units="∞" status="—" color="#5C6770" />
          <FlowArrow units={totalIn} forecastPct={1.02} />
          <Node title="Wholesaler" units="148K" doh="20.1" status="HEALTHY" color={TIER_COLOR.wholesaler} statusClass="pill-success" />
          <FlowArrow units={Math.round(totalIn * 0.8)} forecastPct={0.97} />
          <Node title="Specialty Pharmacy" units="48K" doh="6.5" status="LOW" color={TIER_COLOR.sp} statusClass="pill-warning" />
          <FlowArrow units={Math.round(totalOut * 0.6)} forecastPct={0.94} />
          <Node title="Patient (Hub)" units="8K" doh="1.1" status="CRITICAL" color={TIER_COLOR.hub} statusClass="pill-danger" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <TierCard name="Wholesaler" units={148000} doh={20.1} status="HEALTHY" color="success" subItems={[{ name: "McKesson", units: 62000 }, { name: "Cardinal", units: 48000 }, { name: "Cencora", units: 38000 }]} history={history.map((h) => ({ x: h.weekStart, y: h.wholesaler }))} stroke={TIER_COLOR.wholesaler} />
        <TierCard name="Specialty Pharmacy" units={48000} doh={6.5} status="LOW" color="warning" alert="Accredo SP DOH at 5.1 days — below threshold of 7" subItems={[{ name: "Accredo", units: 22000 }, { name: "CVS Specialty", units: 16000 }, { name: "Option Care", units: 10000 }]} history={history.map((h) => ({ x: h.weekStart, y: h.sp }))} stroke={TIER_COLOR.sp} />
        <TierCard name="Hub" units={8000} doh={1.1} status="CRITICAL" color="danger" alert="Hub at 1.1 DOH — replenishment PO pending Apr 23" history={history.map((h) => ({ x: h.weekStart, y: h.hub }))} stroke={TIER_COLOR.hub} />
      </div>

      <div className="card mt-4 overflow-x-auto">
        <h4 className="font-heading text-h4 text-secondary mb-2">Reconciliation · Last 8 weeks</h4>
        <table className="data-table min-w-[760px] text-xs">
          <thead>
            <tr>
              <th>Week ending</th>
              <th>852 In</th>
              <th>867 Out</th>
              <th>Returns</th>
              <th>Net flow</th>
              <th>Inventory change</th>
              <th>Inventory end</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {recon.map((r) => (
              <tr key={r.weekEnding}>
                <td>{r.weekEnding}</td>
                <td>{formatNumber(r.ins852)}</td>
                <td>{formatNumber(r.outs867)}</td>
                <td>{formatNumber(r.returns)}</td>
                <td className={r.netFlow >= 0 ? "text-success" : "text-danger"}>
                  {r.netFlow >= 0 ? "+" : ""}{formatNumber(r.netFlow)}
                </td>
                <td className={r.inventoryChange >= 0 ? "text-success" : "text-danger"}>
                  {r.inventoryChange >= 0 ? "+" : ""}{formatNumber(r.inventoryChange)}
                </td>
                <td>{formatNumber(r.inventoryEnd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Node({ title, units, doh, status, color, statusClass }: { title: string; units: string; doh?: string; status: string; color: string; statusClass?: string }) {
  return (
    <div className="text-center">
      <div className="rounded-md border-2 p-3" style={{ borderColor: color }}>
        <div className="caption text-muted">{title}</div>
        <div className="font-heading font-bold text-secondary">{units}</div>
        {doh && <div className="text-[10px] text-muted">DOH {doh}</div>}
        <span className={(statusClass ?? "pill-muted") + " mt-1 inline-block"}>{status}</span>
      </div>
    </div>
  );
}

function FlowArrow({ units, forecastPct }: { units: number; forecastPct: number }) {
  const color = forecastPct >= 0.98 ? "#1F8A5C" : forecastPct >= 0.93 ? "#E5A04B" : "#C1423B";
  const width = Math.max(4, Math.min(28, units / 4000));
  return (
    <div className="flex flex-col items-center" title={`${formatNumber(units)} units · ${(forecastPct * 100).toFixed(0)}% of forecast`}>
      <div className="font-mono text-[10px] text-muted">{formatNumber(units)}</div>
      <div style={{ height: width, background: color }} className="rounded w-12" />
      <div className="text-[10px]" style={{ color }}>{(forecastPct * 100).toFixed(0)}%</div>
    </div>
  );
}

function TierCard({
  name, units, doh, status, color, alert, subItems, history, stroke,
}: {
  name: string;
  units: number;
  doh: number;
  status: string;
  color: "success" | "warning" | "danger";
  alert?: string;
  subItems?: { name: string; units: number }[];
  history: { x: string; y: number }[];
  stroke: string;
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
      <div className="h-20 mt-2">
        <ResponsiveContainer>
          <AreaChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
            <XAxis dataKey="x" hide />
            <YAxis hide />
            <Tooltip formatter={(v: number | string) => (typeof v === "number" ? formatNumber(v) : "—")} />
            <Area dataKey="y" stroke={stroke} fill={stroke} fillOpacity={0.25} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {subItems && (
        <ul className="text-xs mt-2 space-y-1 text-muted">
          {subItems.map((s) => (
            <li key={s.name} className="flex justify-between">
              <span>{s.name}</span>
              <span className="font-mono">{formatNumber(s.units)}</span>
            </li>
          ))}
        </ul>
      )}
      {alert && (
        <p className={"text-xs mt-3 p-2 rounded " + (color === "danger" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning")}>
          ⚠ {alert}
        </p>
      )}
    </div>
  );
}
