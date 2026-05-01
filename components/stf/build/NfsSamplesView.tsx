"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useForecastWindow } from "@/lib/useForecastWindow";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from "recharts";
import { EditableNumber } from "@/components/EditableNumber";
import { formatPct, formatNumber } from "@/lib/format";

export function NfsSamplesView() {
  const computed = useStore((s) => s.computed);
  const nfs = useStore((s) => s.forecast.stf.nfs);
  const updateNfs = useStore((s) => s.updateNfs);
  const skus = useStore((s) => s.forecast.stf.skus);
  const horizonWeeks = useStore((s) => s.forecast.stf.horizonWeeks);
  const weeklyInputs = useStore((s) => s.forecast.stf.weeklyInputs);
  const applySkuMixCustomForWeeks = useStore((s) => s.applySkuMixCustomForWeeks);
  const clearSkuMixOverrides = useStore((s) => s.clearSkuMixOverrides);
  const win = useForecastWindow();

  const sampleSku = skus.find((s) => s.category === "sample" && s.active);

  const data = useMemo(() => {
    if (!computed) return [];
    return computed.weekly
      .filter((w) => w.weekStart >= win.windowStart && w.weekStart <= win.windowEnd)
      .map((w) => {
        // Engine-driven sample units = active sample SKU's weekly volume from compute()
        const engineSamples = sampleSku
          ? w.skuValues.find((sv) => sv.sku === sampleSku.id)?.volume ?? 0
          : 0;
        // Use the sample SKU output as the seed; PAP and Bridge scale relative to sample baseline
        const samples = engineSamples > 0 ? engineSamples : nfs.samplesPerWeek;
        const ratio = nfs.samplesPerWeek > 0 ? samples / nfs.samplesPerWeek : 1;
        return {
          week: w.weekStart,
          samples,
          pap: nfs.papPerWeek * ratio,
          bridge: nfs.bridgePerWeek * ratio,
          isActual: w.isActual,
        };
      });
  }, [computed, win, nfs, sampleSku]);

  // Convert engine units to expected NBRx contribution
  const nbrxThisHorizon = useMemo(() => {
    return data
      .filter((d) => !d.isActual)
      .slice(0, win.horizonWeeks)
      .reduce(
        (s, d) => s + d.samples * nfs.samplesConversionRate + d.pap * nfs.papConversionRate + d.bridge * nfs.bridgeConversionRate,
        0
      );
  }, [data, nfs, win]);

  if (!computed) return <div className="shimmer h-72 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <h3 className="font-heading text-h3 text-secondary">Not-for-Sale Units</h3>
            <p className="text-sm text-muted">
              Sample units come from the engine&apos;s active sample-SKU output; PAP and Bridge scale alongside.
              Forward NBRx contribution uses the seed conversion rates.
            </p>
          </div>
          <div className="text-right">
            <div className="caption text-muted">Forward NBRx contribution</div>
            <div className="font-heading text-h3 text-primary">{formatNumber(nbrxThisHorizon)}</div>
            <div className="text-xs text-muted">over {win.horizonWeeks} weeks</div>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(data.length / 13))} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number | string) => (typeof v === "number" ? formatNumber(v) : "—")} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine x={win.cutoff} stroke="#C1423B" strokeDasharray="3 3" label={{ value: "Cutoff", fontSize: 10, fill: "#C1423B" }} />
              <Bar dataKey="samples" stackId="nfs" fill="#0A5C82" name="Samples" />
              <Bar dataKey="pap" stackId="nfs" fill="#C98B27" name="PAP" />
              <Bar dataKey="bridge" stackId="nfs" fill="#1F8A5C" name="Bridge" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card">
        <h4 className="font-heading text-h4 text-secondary mb-2">Calibration · NFS Baselines</h4>
        <p className="text-xs text-muted mb-3">Average weekly NFS units. Sample units come from the engine&apos;s active sample SKU; PAP and Bridge scale alongside.</p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Avg Weekly Units</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Physician Samples</td>
              <td>
                <EditableNumber
                  value={nfs.samplesPerWeek}
                  onChange={(v) => updateNfs("samplesPerWeek", v)}
                  format={formatNumber}
                  className="input-cell w-20 text-right"
                />
              </td>
              <td className="text-xs text-muted">Engine-linked (active sample SKU)</td>
            </tr>
            <tr>
              <td>PAP</td>
              <td>
                <EditableNumber
                  value={nfs.papPerWeek}
                  onChange={(v) => updateNfs("papPerWeek", v)}
                  format={formatNumber}
                  className="input-cell w-20 text-right"
                />
              </td>
              <td className="text-xs text-muted">Scales w/ samples</td>
            </tr>
            <tr>
              <td>Bridge Units</td>
              <td>
                <EditableNumber
                  value={nfs.bridgePerWeek}
                  onChange={(v) => updateNfs("bridgePerWeek", v)}
                  format={formatNumber}
                  className="input-cell w-20 text-right"
                />
              </td>
              <td className="text-xs text-muted">Scales w/ samples</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SkuMixCalibrationCard
        skus={skus}
        horizonWeeks={horizonWeeks}
        weeklyInputs={weeklyInputs}
        onApply={applySkuMixCustomForWeeks}
        onClear={clearSkuMixOverrides}
      />
    </div>
  );
}

function SkuMixCalibrationCard({
  skus,
  horizonWeeks,
  weeklyInputs,
  onApply,
  onClear,
}: {
  skus: { id: string; displayName: string; category: string; active: boolean; defaultMixPct: number }[];
  horizonWeeks: number;
  weeklyInputs: { weekStart: string; sku: string; skuMixOverride?: number }[];
  onApply: (weeks: number, mixBySkuId: Record<string, number>) => void;
  onClear: () => void;
}) {
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
    <div className="card">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h4 className="font-heading text-h4 text-secondary">SKU Mix · Apply a New Mix Forward</h4>
        <span className="text-xs text-muted">
          {lockedWeeks > 0 ? `Locked for ${lockedWeeks} forward ${lockedWeeks === 1 ? "week" : "weeks"}` : "No mix lock applied"}
        </span>
      </div>
      <p className="text-xs text-muted mb-3">
        Edit the mix per active SKU below, choose how many forward weeks the new mix should apply, and click Apply. The
        engine will use these values for the chosen window only — weeks outside the window keep using the default mix from
        Setup. Useful for modeling a mid-horizon launch or competitive shift.
      </p>
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
                <td className={"font-mono text-xs " + (Math.abs(delta) < 0.0005 ? "text-muted" : delta > 0 ? "text-success" : "text-danger")}>
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
              <option key={w} value={w}>{w === horizonWeeks ? `${w} weeks (full horizon)` : `${w} weeks`}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onApply(applyWeeks, draftMix)}
            className="btn-secondary !py-1 !px-3 text-xs"
          >
            Apply New Mix
          </button>
          <button
            type="button"
            onClick={resetToDefault}
            className="btn-ghost !py-1 !px-3 text-xs"
          >
            Reset draft
          </button>
          {lockedWeeks > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="btn-ghost !py-1 !px-3 text-xs"
            >
              Clear locked weeks
            </button>
          )}
        </div>
        <span className={"text-xs font-mono " + (Math.abs(draftSum - 1) < 0.005 ? "text-success" : "text-warning")}>
          Draft sums to {(draftSum * 100).toFixed(1)}%{Math.abs(draftSum - 1) < 0.005 ? " ✓" : " (engine renormalizes to 100%)"}
        </span>
      </div>
    </div>
  );
}
