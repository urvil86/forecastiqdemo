"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

type SizeMode = "dollars" | "units";

export function MarketShareTable() {
  const inputs = useStore((s) => s.forecast.marketShareInputs);
  const updateMarketShareCell = useStore((s) => s.updateMarketShareCell);
  const updatePricingCell = useStore((s) => s.updatePricingCell);
  const [mode, setMode] = useState<SizeMode>("dollars");

  if (!inputs) {
    return (
      <div className="text-xs text-muted italic p-4 border border-dashed border-border rounded">
        Methodology not set to Market Share, or inputs not yet seeded.
      </div>
    );
  }

  const years = inputs.yearly.map((y) => y.year);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h4 className="font-heading text-h4 text-secondary">
            2.1 Total Market Sizing
          </h4>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-muted uppercase tracking-wider">
              Size market by:
            </span>
            <button
              className={
                "px-2 py-0.5 rounded border " +
                (mode === "dollars"
                  ? "bg-primary text-white border-primary"
                  : "border-border hover:bg-background")
              }
              onClick={() => setMode("dollars")}
            >
              Dollars
            </button>
            <button
              className={
                "px-2 py-0.5 rounded border " +
                (mode === "units"
                  ? "bg-primary text-white border-primary"
                  : "border-border hover:bg-background")
              }
              onClick={() => setMode("units")}
            >
              Units
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-border rounded">
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="text-left p-2 sticky left-0 bg-background z-10 min-w-[14rem]">
                  Driver
                </th>
                {years.map((y) => (
                  <th key={y} className="p-2 text-right font-mono font-semibold">
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mode === "dollars" ? (
                <tr className="border-b border-border">
                  <td className="p-2 sticky left-0 bg-surface z-10 font-semibold">
                    Total addressable market ($M)
                  </td>
                  {years.map((y) => {
                    const yr = inputs.yearly.find((x) => x.year === y);
                    return (
                      <td key={y} className="p-1">
                        <input
                          type="number"
                          value={yr?.totalMarketUsdM ?? 0}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (Number.isFinite(v))
                              updateMarketShareCell(y, "totalMarketUsdM", v);
                          }}
                          className="w-full px-1.5 py-1 border border-border rounded text-right font-mono text-xs"
                        />
                      </td>
                    );
                  })}
                </tr>
              ) : (
                <tr className="border-b border-border">
                  <td className="p-2 sticky left-0 bg-surface z-10 font-semibold">
                    Total addressable units (000s)
                  </td>
                  {years.map((y) => {
                    const yr = inputs.yearly.find((x) => x.year === y);
                    return (
                      <td key={y} className="p-1">
                        <input
                          type="number"
                          value={yr?.totalMarketUnitsK ?? 0}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (Number.isFinite(v))
                              updateMarketShareCell(y, "totalMarketUnitsK", v);
                          }}
                          className="w-full px-1.5 py-1 border border-border rounded text-right font-mono text-xs"
                        />
                      </td>
                    );
                  })}
                </tr>
              )}
              <tr className="border-b border-border">
                <td className="p-2 sticky left-0 bg-surface z-10 font-semibold">
                  Brand market share (%)
                </td>
                {years.map((y) => {
                  const yr = inputs.yearly.find((x) => x.year === y);
                  return (
                    <td key={y} className="p-1">
                      <input
                        type="number"
                        value={yr?.brandSharePct ?? 0}
                        min={0}
                        max={100}
                        step={0.5}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v))
                            updateMarketShareCell(y, "brandSharePct", v);
                        }}
                        className="w-full px-1.5 py-1 border border-border rounded text-right font-mono text-xs"
                      />
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing */}
      <div>
        <h4 className="font-heading text-h4 text-secondary mb-2">2.2 Pricing</h4>
        <div className="overflow-x-auto border border-border rounded">
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="text-left p-2 sticky left-0 bg-background z-10 min-w-[14rem]">
                  Driver
                </th>
                {years.map((y) => (
                  <th key={y} className="p-2 text-right font-mono font-semibold">
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  { field: "grossPriceUsd", label: "Gross price per dose ($)" },
                  { field: "tradeDiscountPct", label: "Trade discount (%)" },
                  { field: "reserveRatePct", label: "Reserve rate / GTN (%)" },
                ] as const
              ).map((r) => (
                <tr key={r.field} className="border-b border-border last:border-0">
                  <td className="p-2 sticky left-0 bg-surface z-10 font-semibold">
                    {r.label}
                  </td>
                  {years.map((y) => {
                    const yr = inputs.pricing.yearly.find((x) => x.year === y);
                    return (
                      <td key={y} className="p-1">
                        <input
                          type="number"
                          value={yr?.[r.field] ?? 0}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (Number.isFinite(v))
                              updatePricingCell(y, r.field, v);
                          }}
                          className="w-full px-1.5 py-1 border border-border rounded text-right font-mono text-xs"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
