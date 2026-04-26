"use client";

import { useStore } from "@/lib/store";
import { useForecastWindow } from "@/lib/useForecastWindow";
import { useMemo } from "react";
import { interpolateAnchors } from "@/lib/engine";
import { formatNumber, formatPct } from "@/lib/format";

export function PricingGtnView() {
  const computed = useStore((s) => s.computed);
  const grossPrice = useStore((s) => s.forecast.lrp.grossPrice);
  const gtnRate = useStore((s) => s.forecast.lrp.gtnRate);
  const win = useForecastWindow();

  const rows = useMemo(() => {
    if (!computed) return [];
    const gpInterp = interpolateAnchors(grossPrice, 2026, 2026);
    const gtnInterp = interpolateAnchors(gtnRate, 2026, 2026);
    const gp2026 = gpInterp[0]?.value ?? 0;
    const gtn2026 = gtnInterp[0]?.value ?? 0;
    return computed.weekly
      .filter((w) => w.weekStart >= win.windowStart && w.weekStart <= win.windowEnd)
      .flatMap((w) =>
        w.skuValues.map((sv) => ({
          week: w.weekStart,
          sku: sv.sku,
          isActual: w.isActual,
          grossPrice: gp2026,
          tradeDiscount: 0.04,
          reserveRate: gtn2026 - 0.04,
          netPrice: sv.netPrice,
        }))
      );
  }, [computed, grossPrice, gtnRate, win]);

  return (
    <div className="card overflow-x-auto">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-heading text-h3 text-secondary">Pricing & GTN per SKU per Week</h3>
        <span className="text-xs text-muted">
          {win.historyWeeks}w history + {win.horizonWeeks}w horizon
        </span>
      </div>
      <table className="data-table min-w-[760px]">
        <thead>
          <tr>
            <th>Week</th>
            <th>SKU</th>
            <th>Type</th>
            <th>Gross Price</th>
            <th>Trade Discount</th>
            <th>Reserve Rate</th>
            <th>Net Price</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((r, i) => (
            <tr key={`${r.week}-${r.sku}-${i}`}>
              <td className="font-mono text-xs">{r.week}</td>
              <td className="text-xs">{r.sku.replace("ocrevus-", "")}</td>
              <td className="text-xs">{r.isActual ? "Actual" : "Forecast"}</td>
              <td className="font-mono">${formatNumber(r.grossPrice)}</td>
              <td className="font-mono">{formatPct(r.tradeDiscount)}</td>
              <td className="font-mono">{formatPct(r.reserveRate)}</td>
              <td className="font-mono">${formatNumber(r.netPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
