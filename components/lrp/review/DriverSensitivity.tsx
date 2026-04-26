"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { computeDriverSensitivity } from "@/lib/lrpSensitivity";
import { SectionHeader } from "@/components/SectionHeader";
import { formatUsdShort } from "@/lib/format";

const CATEGORY_COLOR: Record<string, string> = {
  Demand: "#004466",
  Pricing: "#C98B27",
  Share: "#0A5C82",
  Events: "#1F8A5C",
};

export function DriverSensitivity({ targetYear }: { targetYear: number }) {
  const forecast = useStore((s) => s.forecast);
  const drivers = useMemo(() => computeDriverSensitivity(forecast, targetYear), [forecast, targetYear]);

  // Group by category for the treemap-style layout
  const byCategory = useMemo(() => {
    const map = new Map<string, typeof drivers>();
    for (const d of drivers) {
      const list = map.get(d.category) ?? [];
      list.push(d);
      map.set(d.category, list);
    }
    return map;
  }, [drivers]);

  const totalImpact = drivers.reduce((s, d) => s + d.impactUsdAbs, 0);
  const top10 = drivers.slice(0, 10);

  return (
    <div>
      <SectionHeader
        title={`What Moves the Forecast · Driver Sensitivity (${targetYear})`}
        subtitle={`Each tile sized to ±10% perturbation impact on ${targetYear} net sales. Color encodes contribution direction; top-10 listed below.`}
      />
      <div className="card">
        {/* Treemap-style layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 min-h-[280px]">
          {(["Demand", "Pricing", "Share", "Events"] as const).map((cat) => {
            const list = byCategory.get(cat) ?? [];
            const catTotal = list.reduce((s, d) => s + d.impactUsdAbs, 0);
            return (
              <div key={cat} className="border border-border rounded-md p-2 bg-background">
                <div className="caption text-muted flex justify-between">
                  <span>{cat}</span>
                  <span className="font-mono">±{formatUsdShort(catTotal)}</span>
                </div>
                <div className="space-y-1 mt-2">
                  {list.length === 0 && <div className="text-xs text-muted italic">No drivers in this category.</div>}
                  {list.map((d) => {
                    const pct = catTotal === 0 ? 0 : (d.impactUsdAbs / catTotal) * 100;
                    return (
                      <div
                        key={d.driverId}
                        title={`${d.driverLabel}: ±${formatUsdShort(d.impactUsdAbs)} per 10% shift; current value ${typeof d.currentValue === "number" ? d.currentValue.toFixed(3) : d.currentValue}`}
                        className="rounded p-2 hover:opacity-90 cursor-help"
                        style={{
                          background: CATEGORY_COLOR[cat],
                          opacity: 0.4 + (d.impactUsdAbs / Math.max(1, totalImpact)) * 4,
                          minHeight: Math.max(28, pct * 0.8),
                        }}
                      >
                        <div className="text-[11px] text-white font-semibold truncate">{d.driverLabel}</div>
                        <div className="text-[10px] text-white/85 font-mono">±{formatUsdShort(d.impactUsdAbs)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top-10 ranked table */}
      <div className="card mt-4 overflow-x-auto">
        <h4 className="font-heading text-h4 text-secondary mb-2">Top {Math.min(10, top10.length)} drivers (ranked by absolute impact)</h4>
        <table className="data-table min-w-[760px]">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Driver</th>
              <th>Category</th>
              <th>Current value</th>
              <th>Impact on {targetYear} (±10% shift)</th>
              <th>Direction at +10%</th>
            </tr>
          </thead>
          <tbody>
            {top10.map((d) => (
              <tr key={d.driverId}>
                <td className="font-mono">{d.rank}</td>
                <td>{d.driverLabel}</td>
                <td className="text-xs">{d.category}</td>
                <td className="font-mono text-xs">
                  {d.unit === "$" ? `$${(typeof d.currentValue === "number" ? d.currentValue : 0).toLocaleString()}` :
                   d.unit === "%" ? `${(typeof d.currentValue === "number" ? d.currentValue * 100 : 0).toFixed(1)}%` :
                   typeof d.currentValue === "number" ? d.currentValue.toLocaleString() : d.currentValue}
                </td>
                <td className="font-mono text-success">±{formatUsdShort(d.impactUsdAbs)}</td>
                <td>
                  <span className={d.impactDirection === "positive" ? "pill-success" : "pill-danger"}>
                    {d.impactDirection === "positive" ? "↑ positive" : "↓ negative"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
