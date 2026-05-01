"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useForecastWindow } from "@/lib/useForecastWindow";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from "recharts";
import { EditableNumber } from "@/components/EditableNumber";
import { formatNumber } from "@/lib/format";

export function NfsSamplesView() {
  const computed = useStore((s) => s.computed);
  const nfs = useStore((s) => s.forecast.stf.nfs);
  const updateNfs = useStore((s) => s.updateNfs);
  const skus = useStore((s) => s.forecast.stf.skus);
  const horizonWeeks = useStore((s) => s.forecast.stf.horizonWeeks);
  const applyNfsPlanForWeeks = useStore((s) => s.applyNfsPlanForWeeks);
  const clearNfsPlan = useStore((s) => s.clearNfsPlan);
  const win = useForecastWindow();

  const sampleSku = skus.find((s) => s.category === "sample" && s.active);

  // Helper: is this week within the active NFS plan window?
  function isInPlanWindow(weekStart: string): boolean {
    if (!nfs.plan) return false;
    const start = new Date(nfs.plan.fromWeek).getTime();
    const end = start + nfs.plan.weeks * 7 * 86_400_000;
    const w = new Date(weekStart).getTime();
    return w >= start && w < end;
  }

  const data = useMemo(() => {
    if (!computed) return [];
    return computed.weekly
      .filter((w) => w.weekStart >= win.windowStart && w.weekStart <= win.windowEnd)
      .map((w) => {
        const inPlan = !w.isActual && isInPlanWindow(w.weekStart);
        const samplesBaseline = inPlan ? nfs.plan!.samplesPerWeek : nfs.samplesPerWeek;
        const papBaseline = inPlan ? nfs.plan!.papPerWeek : nfs.papPerWeek;
        const bridgeBaseline = inPlan ? nfs.plan!.bridgePerWeek : nfs.bridgePerWeek;

        // Engine-driven sample units = active sample SKU's weekly volume from compute()
        const engineSamples = sampleSku
          ? w.skuValues.find((sv) => sv.sku === sampleSku.id)?.volume ?? 0
          : 0;
        // For actual / non-plan weeks: keep the engine-linked behavior. For plan weeks: use the planned values directly.
        const samples = inPlan ? samplesBaseline : engineSamples > 0 ? engineSamples : samplesBaseline;
        const ratio = !inPlan && nfs.samplesPerWeek > 0 ? samples / nfs.samplesPerWeek : 1;
        return {
          week: w.weekStart,
          samples,
          pap: inPlan ? papBaseline : papBaseline * ratio,
          bridge: inPlan ? bridgeBaseline : bridgeBaseline * ratio,
          isActual: w.isActual,
          inPlan,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              Forward NBRx contribution uses the seed conversion rates. Weeks inside an active NFS plan window use the
              planned values.
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

      <NfsPlanCard
        nfs={nfs}
        horizonWeeks={horizonWeeks}
        onApply={applyNfsPlanForWeeks}
        onClear={clearNfsPlan}
      />
    </div>
  );
}

function NfsPlanCard({
  nfs,
  horizonWeeks,
  onApply,
  onClear,
}: {
  nfs: {
    samplesPerWeek: number;
    papPerWeek: number;
    bridgePerWeek: number;
    plan?: { samplesPerWeek: number; papPerWeek: number; bridgePerWeek: number; weeks: number; fromWeek: string };
  };
  horizonWeeks: number;
  onApply: (weeks: number, samplesPerWeek: number, papPerWeek: number, bridgePerWeek: number) => void;
  onClear: () => void;
}) {
  const [draftSamples, setDraftSamples] = useState<number>(nfs.plan?.samplesPerWeek ?? nfs.samplesPerWeek);
  const [draftPap, setDraftPap] = useState<number>(nfs.plan?.papPerWeek ?? nfs.papPerWeek);
  const [draftBridge, setDraftBridge] = useState<number>(nfs.plan?.bridgePerWeek ?? nfs.bridgePerWeek);
  const [applyWeeks, setApplyWeeks] = useState<number>(nfs.plan?.weeks ?? 8);

  const horizonOptions = [4, 8, 13, 26].filter((w) => w <= horizonWeeks);
  if (!horizonOptions.includes(horizonWeeks)) horizonOptions.push(horizonWeeks);

  const planActive = !!nfs.plan;

  function resetToBaseline() {
    setDraftSamples(nfs.samplesPerWeek);
    setDraftPap(nfs.papPerWeek);
    setDraftBridge(nfs.bridgePerWeek);
  }

  const deltaSamples = draftSamples - nfs.samplesPerWeek;
  const deltaPap = draftPap - nfs.papPerWeek;
  const deltaBridge = draftBridge - nfs.bridgePerWeek;

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <div>
          <h4 className="font-heading text-h4 text-secondary">NFS Plan · Apply Future Sample / PAP / Bridge Units</h4>
          <p className="text-xs text-muted mt-1 max-w-3xl">
            Plan future weekly NFS units for a forward window. Set new per-week values for Samples, PAP, and Bridge,
            choose how many weeks the plan should run for, and click <strong>Apply Plan</strong>. The chart and the
            forward NBRx contribution above use these planned values for the chosen window; weeks outside revert to the
            calibration baselines.
          </p>
        </div>
        <span className="text-xs text-muted whitespace-nowrap">
          {planActive
            ? `Plan active for ${nfs.plan!.weeks} ${nfs.plan!.weeks === 1 ? "week" : "weeks"} from ${nfs.plan!.fromWeek}`
            : "No plan applied"}
        </span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Baseline / Week</th>
            <th>Planned / Week</th>
            <th>Δ vs baseline</th>
          </tr>
        </thead>
        <tbody>
          <NfsPlanRow
            label="Physician Samples"
            baseline={nfs.samplesPerWeek}
            draft={draftSamples}
            setDraft={setDraftSamples}
            delta={deltaSamples}
          />
          <NfsPlanRow
            label="PAP"
            baseline={nfs.papPerWeek}
            draft={draftPap}
            setDraft={setDraftPap}
            delta={deltaPap}
          />
          <NfsPlanRow
            label="Bridge Units"
            baseline={nfs.bridgePerWeek}
            draft={draftBridge}
            setDraft={setDraftBridge}
            delta={deltaBridge}
          />
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
            onClick={() => onApply(applyWeeks, draftSamples, draftPap, draftBridge)}
            className="btn-secondary !py-1 !px-3 text-xs"
          >
            Apply Plan
          </button>
          <button type="button" onClick={resetToBaseline} className="btn-ghost !py-1 !px-3 text-xs">
            Reset draft
          </button>
          {planActive && (
            <button type="button" onClick={onClear} className="btn-ghost !py-1 !px-3 text-xs">
              Clear plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NfsPlanRow({
  label,
  baseline,
  draft,
  setDraft,
  delta,
}: {
  label: string;
  baseline: number;
  draft: number;
  setDraft: (v: number) => void;
  delta: number;
}) {
  return (
    <tr>
      <td>{label}</td>
      <td className="font-mono text-xs text-muted">{formatNumber(baseline)}</td>
      <td>
        <EditableNumber
          value={draft}
          onChange={setDraft}
          format={formatNumber}
          className="input-cell w-24 text-right"
        />
      </td>
      <td
        className={
          "font-mono text-xs " +
          (Math.abs(delta) < 1 ? "text-muted" : delta > 0 ? "text-success" : "text-danger")
        }
      >
        {Math.abs(delta) < 1 ? "—" : `${delta > 0 ? "+" : ""}${formatNumber(Math.round(delta))}`}
      </td>
    </tr>
  );
}
