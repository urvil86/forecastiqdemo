"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { EditableNumber } from "@/components/EditableNumber";
import { formatPct } from "@/lib/format";

export function SkuMixView() {
  const skus = useStore((s) => s.forecast.stf.skus);
  const horizonWeeks = useStore((s) => s.forecast.stf.horizonWeeks);
  const weeklyInputs = useStore((s) => s.forecast.stf.weeklyInputs);
  const applySkuMixCustomForWeeks = useStore((s) => s.applySkuMixCustomForWeeks);
  const clearSkuMixOverrides = useStore((s) => s.clearSkuMixOverrides);

  const activeSkus = skus.filter((s) => s.active);
  const [draftMix, setDraftMix] = useState<Record<string, number>>(() =>
    Object.fromEntries(activeSkus.map((s) => [s.id, s.defaultMixPct]))
  );
  const [applyWeeks, setApplyWeeks] = useState<number>(8);

  const horizonOptions = [4, 8, 13, 26].filter((w) => w <= horizonWeeks);
  if (!horizonOptions.includes(horizonWeeks)) horizonOptions.push(horizonWeeks);

  const lockedWeeks = useMemo(() => {
    const set = new Set<string>();
    for (const wi of weeklyInputs) if (wi.skuMixOverride !== undefined) set.add(wi.weekStart);
    return set.size;
  }, [weeklyInputs]);

  const draftSum = activeSkus.reduce((s, sku) => s + (draftMix[sku.id] ?? sku.defaultMixPct), 0);

  function resetToDefault() {
    setDraftMix(Object.fromEntries(activeSkus.map((s) => [s.id, s.defaultMixPct])));
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
          <div>
            <h3 className="font-heading text-h3 text-secondary">SKU Mix · Apply a New Mix Forward</h3>
            <p className="text-sm text-muted mt-1 max-w-3xl">
              Edit the mix per active SKU below, choose how many forward weeks the new mix should apply, and click
              <strong> Apply New Mix</strong>. The engine will use these values for the chosen window only — weeks outside
              the window keep using the default mix from Setup. Useful for modeling a mid-horizon launch or competitive
              shift.
            </p>
          </div>
          <span className="text-xs text-muted whitespace-nowrap">
            {lockedWeeks > 0 ? `Locked for ${lockedWeeks} forward ${lockedWeeks === 1 ? "week" : "weeks"}` : "No mix lock applied"}
          </span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Category</th>
              <th>Default Mix %</th>
              <th>New Mix %</th>
              <th>Δ vs default</th>
            </tr>
          </thead>
          <tbody>
            {activeSkus.map((sku) => {
              const draft = draftMix[sku.id] ?? sku.defaultMixPct;
              const delta = draft - sku.defaultMixPct;
              return (
                <tr key={sku.id}>
                  <td>{sku.displayName}</td>
                  <td className="capitalize">{sku.category}</td>
                  <td className="font-mono text-xs text-muted">{formatPct(sku.defaultMixPct, 1)}</td>
                  <td>
                    <EditableNumber
                      value={draft}
                      onChange={(v) => setDraftMix((m) => ({ ...m, [sku.id]: v }))}
                      format={(v) => formatPct(v, 1)}
                      parse={(s) => parseFloat(s.replace("%", "")) / 100}
                      className="input-cell w-20 text-right"
                    />
                  </td>
                  <td
                    className={
                      "font-mono text-xs " +
                      (Math.abs(delta) < 0.0005 ? "text-muted" : delta > 0 ? "text-success" : "text-danger")
                    }
                  >
                    {Math.abs(delta) < 0.0005 ? "—" : `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)}pp`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex items-center justify-between flex-wrap gap-3 mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="caption text-muted">Apply for next:</span>
            <select
              value={applyWeeks}
              onChange={(e) => setApplyWeeks(parseInt(e.target.value))}
              className="input-cell !font-sans text-sm"
            >
              {horizonOptions.map((w) => (
                <option key={w} value={w}>
                  {w === horizonWeeks ? `${w} weeks (full horizon)` : `${w} weeks`}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => applySkuMixCustomForWeeks(applyWeeks, draftMix)}
              className="btn-secondary !py-1 !px-3 text-xs"
            >
              Apply New Mix
            </button>
            <button type="button" onClick={resetToDefault} className="btn-ghost !py-1 !px-3 text-xs">
              Reset draft
            </button>
            {lockedWeeks > 0 && (
              <button type="button" onClick={clearSkuMixOverrides} className="btn-ghost !py-1 !px-3 text-xs">
                Clear locked weeks
              </button>
            )}
          </div>
          <span className={"text-xs font-mono " + (Math.abs(draftSum - 1) < 0.005 ? "text-success" : "text-warning")}>
            Draft sums to {(draftSum * 100).toFixed(1)}%
            {Math.abs(draftSum - 1) < 0.005 ? " ✓" : " (engine renormalizes to 100%)"}
          </span>
        </div>
      </div>
    </div>
  );
}
