"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { reverseCascade } from "@/lib/engine";
import { formatUsdShort } from "@/lib/format";

export function ReverseCascadeCard() {
  const forecast = useStore((s) => s.forecast);
  const computed = useStore((s) => s.computed);
  const [drift, setDrift] = useState(-0.06);
  const [committed, setCommitted] = useState(false);

  if (!computed) return null;

  const result = reverseCascade(forecast, computed.annual, 13, drift);

  return (
    <div className="card border-l-4 border-primary">
      <h3 className="font-heading text-h3 text-secondary mb-1">Reverse Cascade · ST → LT</h3>
      <p className="text-sm text-muted mb-4">
        When sustained STF drift exceeds threshold over a 13-week window, the system proposes an LRP
        refresh with the implied annual delta pre-computed. Drag the simulation slider to test.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-xs font-semibold mb-1">Simulated 13-week drift</div>
          <input
            type="range"
            min={-0.2}
            max={0.2}
            step={0.005}
            value={drift}
            onChange={(e) => {
              setDrift(parseFloat(e.target.value));
              setCommitted(false);
            }}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted">
            <span>-20%</span>
            <span className={drift < 0 ? "text-danger font-semibold" : "text-success font-semibold"}>
              {(drift * 100).toFixed(1)}%
            </span>
            <span>+20%</span>
          </div>
        </div>

        <div className="text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Detected drift</span>
            <span className="font-mono">{(result.detectedDriftPct * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Implied annual delta</span>
            <span className="font-mono">{formatUsdShort(result.impliedAnnualDelta)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Confidence</span>
            <span className="font-mono">{(result.proposedRefresh.confidenceScore * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <h4 className="text-sm font-semibold mt-5 mb-2">Proposed LRP refresh</h4>
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase text-muted">
          <tr>
            <th className="text-left py-1">Year</th>
            <th className="text-right py-1">Current annual</th>
            <th className="text-right py-1">Suggested</th>
            <th className="text-right py-1">Delta</th>
          </tr>
        </thead>
        <tbody>
          {result.proposedRefresh.suggestedAnnualValues.map((row) => {
            const cur = computed.annual.find((a) => a.year === row.year)?.netSales ?? 0;
            const delta = row.newValue - cur;
            return (
              <tr key={row.year} className="border-t border-border">
                <td className="py-1.5 font-mono">{row.year}</td>
                <td className="py-1.5 text-right">{formatUsdShort(cur)}</td>
                <td className="py-1.5 text-right">{formatUsdShort(row.newValue)}</td>
                <td className={"py-1.5 text-right font-mono " + (delta < 0 ? "text-danger" : "text-success")}>
                  {delta >= 0 ? "+" : ""}
                  {formatUsdShort(delta)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 flex items-center gap-2">
        <button className="btn-secondary text-xs" onClick={() => setCommitted(true)}>
          Accept proposed refresh
        </button>
        <button className="btn-ghost text-xs" onClick={() => setCommitted(false)}>
          Defer
        </button>
        {committed && (
          <span className="text-xs text-success">Logged · LRP refresh queued for review</span>
        )}
      </div>
    </div>
  );
}
