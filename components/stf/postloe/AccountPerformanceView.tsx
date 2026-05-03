"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { formatUsdShort } from "@/lib/format";

const TIER_OPTIONS = [
  "All",
  "Top 50 IDNs",
  "Academic MS Centers",
  "Community Neuro",
  "Long-tail Accounts",
] as const;

export function AccountPerformanceView() {
  const forecast = useStore((s) => s.forecast);
  const cfg = forecast.lifecycleContext?.postLoeConfig;
  const [tierFilter, setTierFilter] = useState<(typeof TIER_OPTIONS)[number]>("All");

  const accounts = cfg?.accountBasedInputs.accountForecasts ?? [];
  const filtered = useMemo(
    () => (tierFilter === "All" ? accounts : accounts.filter((a) => a.tier === tierFilter)),
    [accounts, tierFilter]
  );
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.currentMonthlyDemand - a.currentMonthlyDemand),
    [filtered]
  );

  const monthlyTotal = sorted.reduce((s, a) => s + a.currentMonthlyDemand, 0);
  const annualTotal = monthlyTotal * 12;
  const annualNetSales = annualTotal * 33000;

  if (!cfg) {
    return <div className="text-sm text-muted">Account-based inputs not configured for this forecast.</div>;
  }

  const allocationRatios = cfg.accountBasedInputs.allocationRatios;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-h3 text-secondary">Top Accounts</h3>
          <select
            className="input-cell !font-sans text-xs"
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as (typeof TIER_OPTIONS)[number])}
          >
            {TIER_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 mb-6">
          {sorted.slice(0, 25).map((a) => {
            const max = sorted[0]?.currentMonthlyDemand ?? 1;
            const pct = (a.currentMonthlyDemand / max) * 100;
            return (
              <div key={a.accountId} className="flex items-center gap-3 text-xs">
                <div className="w-32 truncate font-mono">{a.accountName}</div>
                <div className="w-32 text-muted truncate">{a.tier}</div>
                <div className="flex-1 h-5 bg-background rounded relative">
                  <div
                    className="h-full bg-primary/40 rounded"
                    style={{ width: `${pct}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 font-semibold">
                    {a.currentMonthlyDemand.toLocaleString()} units/mo
                  </span>
                </div>
                <div className="w-32 text-muted text-[10px] truncate">{a.siteOfCareSegment}</div>
              </div>
            );
          })}
        </div>

        <div>
          <h4 className="font-heading text-h4 text-secondary mb-2">Allocation Ratios per Tier</h4>
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-muted">
              <tr>
                <th className="text-left py-1">Tier</th>
                <th className="text-left py-1">Ratio</th>
                <th className="text-right py-1">Cap</th>
                <th className="text-right py-1">Floor</th>
                <th className="text-right py-1">Carve-out?</th>
              </tr>
            </thead>
            <tbody>
              {allocationRatios.map((r) => (
                <tr key={r.tierName} className="border-t border-border">
                  <td className="py-1.5">{r.tierName}</td>
                  <td className="py-1.5 font-mono">{r.ratioName}</td>
                  <td className="py-1.5 text-right">{r.capUnits ? r.capUnits.toLocaleString() : "—"}</td>
                  <td className="py-1.5 text-right">{r.floorUnits ? r.floorUnits.toLocaleString() : "—"}</td>
                  <td className="py-1.5 text-right">{r.baselineCarveout ? "Yes" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="card h-fit sticky top-44">
        <h4 className="font-heading text-h4 text-secondary mb-3">Roll-up to LRP</h4>
        <div className="space-y-3 text-sm">
          <Row label="Accounts shown" value={sorted.length.toString()} />
          <Row label="Sum of monthly demand" value={`${monthlyTotal.toLocaleString()} units`} />
          <Row label="Annualized" value={`${annualTotal.toLocaleString()} units`} />
          <Row label="Annual net sales (≈)" value={formatUsdShort(annualNetSales)} accent />
          <div className="text-[11px] text-muted pt-2 border-t border-border">
            This is the figure that flows up to LRP in Post-LoE mode. Editing accounts updates the
            LRP automatically.
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted text-xs">{label}</span>
      <span className={"font-semibold " + (accent ? "text-primary" : "")}>{value}</span>
    </div>
  );
}
