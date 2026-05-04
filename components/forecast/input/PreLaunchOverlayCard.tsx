"use client";

import { useStore } from "@/lib/store";
import type { PreLaunchOverlay } from "@/lib/engine";

const ANALOG_OPTIONS = [
  "Kesimpta",
  "Briumvi",
  "Tysabri",
  "Ocrevus",
  "Lemtrada",
  "Rituxan",
  "Tecfidera",
  "Aubagio",
  "Custom...",
];

export function PreLaunchOverlayCard() {
  const overlay = useStore((s) => s.forecast.preLaunchOverlay);
  const updateOverlay = useStore((s) => s.updatePreLaunchOverlay);

  if (!overlay) return null;

  const totalWeight = overlay.analogs.reduce((a, x) => a + x.weightPct, 0);

  function setAnalog(i: number, patch: Partial<PreLaunchOverlay["analogs"][number]>) {
    if (!overlay) return;
    const analogs = overlay.analogs.map((a, idx) => (idx === i ? { ...a, ...patch } : a));
    updateOverlay({ analogs });
  }
  function removeAnalog(i: number) {
    if (!overlay) return;
    updateOverlay({ analogs: overlay.analogs.filter((_, idx) => idx !== i) });
  }
  function addAnalog() {
    if (!overlay) return;
    if (overlay.analogs.length >= 5) return;
    updateOverlay({
      analogs: [
        ...overlay.analogs,
        {
          brand: "Custom...",
          weightPct: 0,
          clinicalAdjPct: 0,
          competitiveAdjPct: 0,
          marketAccessAdjPct: 0,
        },
      ],
    });
  }

  function updatePosField(field: keyof PreLaunchOverlay["posModel"], value: number | PreLaunchOverlay["posModel"]["currentStage"]) {
    if (!overlay) return;
    const next = { ...overlay.posModel, [field]: value } as PreLaunchOverlay["posModel"];
    // Recompute cumulativePoS
    const stage = next.currentStage;
    let cum = 1;
    if (stage === "phase2") cum = next.phase3ReadoutProb * next.fdaFilingProb * next.fdaApprovalProb;
    else if (stage === "phase3") cum = next.phase3ReadoutProb * next.fdaFilingProb * next.fdaApprovalProb;
    else if (stage === "filed") cum = next.fdaApprovalProb;
    else cum = 1;
    next.cumulativePoS = cum;
    updateOverlay({ posModel: next });
  }

  function updateLaunch(patch: Partial<PreLaunchOverlay["launchTrajectory"]>) {
    if (!overlay) return;
    updateOverlay({ launchTrajectory: { ...overlay.launchTrajectory, ...patch } });
  }

  return (
    <div className="space-y-6">
      {/* 2.3 Analog Selection */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h4 className="font-heading text-h4 text-secondary">
            2.3 Analog Selection
          </h4>
          <span
            className={
              "text-xs " +
              (Math.abs(totalWeight - 100) < 0.5
                ? "text-emerald-700"
                : "text-red-600")
            }
          >
            Total weight: {totalWeight.toFixed(1)}%
            {Math.abs(totalWeight - 100) < 0.5 ? " ✓" : " (must equal 100%)"}
          </span>
        </div>
        <div className="border border-border rounded overflow-x-auto">
          <table className="text-xs w-full">
            <thead className="bg-background">
              <tr className="border-b border-border">
                <th className="p-2 text-left">Analog</th>
                <th className="p-2 text-right">Weight (%)</th>
                <th className="p-2 text-right">Clinical adj.</th>
                <th className="p-2 text-right">Competitive adj.</th>
                <th className="p-2 text-right">Market access adj.</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {overlay.analogs.map((a, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="p-1">
                    <select
                      value={a.brand}
                      onChange={(e) => setAnalog(i, { brand: e.target.value })}
                      className="input-cell !font-sans w-full !text-xs"
                    >
                      {ANALOG_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={a.weightPct}
                      onChange={(e) =>
                        setAnalog(i, {
                          weightPct: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-1.5 py-1 border border-border rounded text-right font-mono text-xs"
                    />
                  </td>
                  <td className="p-1">
                    <SliderCell
                      value={a.clinicalAdjPct}
                      min={-30}
                      max={30}
                      onChange={(v) => setAnalog(i, { clinicalAdjPct: v })}
                    />
                  </td>
                  <td className="p-1">
                    <SliderCell
                      value={a.competitiveAdjPct}
                      min={-30}
                      max={30}
                      onChange={(v) => setAnalog(i, { competitiveAdjPct: v })}
                    />
                  </td>
                  <td className="p-1">
                    <SliderCell
                      value={a.marketAccessAdjPct}
                      min={-20}
                      max={20}
                      onChange={(v) => setAnalog(i, { marketAccessAdjPct: v })}
                    />
                  </td>
                  <td className="p-1 text-right">
                    <button
                      className="text-muted hover:text-red-600 text-sm"
                      onClick={() => removeAnalog(i)}
                      title="Remove"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {overlay.analogs.length < 5 && (
          <button className="btn-ghost text-xs mt-2" onClick={addAnalog}>
            + Add analog
          </button>
        )}
      </div>

      {/* 2.4 PoS Modeling */}
      <div>
        <h4 className="font-heading text-h4 text-secondary mb-2">
          2.4 PoS Modeling
        </h4>
        <div className="card grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="block">
              <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
                Current trial stage
              </div>
              <select
                value={overlay.posModel.currentStage}
                onChange={(e) =>
                  updatePosField(
                    "currentStage",
                    e.target.value as PreLaunchOverlay["posModel"]["currentStage"],
                  )
                }
                className="input-cell !font-sans w-full"
              >
                <option value="phase2">Phase 2</option>
                <option value="phase3">Phase 3</option>
                <option value="filed">Filed</option>
                <option value="approved">Approved</option>
              </select>
            </label>

            {(overlay.posModel.currentStage === "phase2" ||
              overlay.posModel.currentStage === "phase3") && (
              <ProbField
                label="Phase 3 readout probability"
                value={overlay.posModel.phase3ReadoutProb}
                onChange={(v) => updatePosField("phase3ReadoutProb", v)}
              />
            )}
            {overlay.posModel.currentStage !== "approved" &&
              overlay.posModel.currentStage !== "filed" && (
                <ProbField
                  label="FDA filing probability"
                  value={overlay.posModel.fdaFilingProb}
                  onChange={(v) => updatePosField("fdaFilingProb", v)}
                />
              )}
            {overlay.posModel.currentStage !== "approved" && (
              <ProbField
                label="FDA approval probability"
                value={overlay.posModel.fdaApprovalProb}
                onChange={(v) => updatePosField("fdaApprovalProb", v)}
              />
            )}
          </div>
          <div className="flex flex-col items-center justify-center bg-background rounded p-4 border border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted">
              Cumulative PoS
            </div>
            <div className="font-heading text-h1 text-primary font-bold">
              {(overlay.posModel.cumulativePoS * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] text-muted mt-1">
              {overlay.posModel.currentStage === "approved"
                ? "Approved — no remaining milestones"
                : "Computed from stage probabilities"}
            </div>
          </div>
        </div>
      </div>

      {/* 2.5 Launch Trajectory */}
      <div>
        <h4 className="font-heading text-h4 text-secondary mb-2">
          2.5 Launch Trajectory
        </h4>
        <div className="card grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
              Expected launch date
            </div>
            <input
              type="date"
              value={overlay.launchTrajectory.expectedLaunchDate.slice(0, 10)}
              onChange={(e) =>
                updateLaunch({ expectedLaunchDate: e.target.value })
              }
              className="input-cell !font-sans w-full"
            />
          </label>
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
              Time to peak (years): {overlay.launchTrajectory.timeToPeakYears}
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={overlay.launchTrajectory.timeToPeakYears}
              onChange={(e) =>
                updateLaunch({ timeToPeakYears: parseInt(e.target.value) })
              }
              className="w-full accent-primary"
            />
          </label>
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
              Peak share (%)
            </div>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={overlay.launchTrajectory.peakSharePct}
              onChange={(e) =>
                updateLaunch({
                  peakSharePct: parseFloat(e.target.value) || 0,
                })
              }
              className="input-cell !font-sans w-full"
            />
          </label>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
              Ramp shape
            </div>
            <div className="flex gap-2">
              {(["slow", "moderate", "fast"] as const).map((s) => (
                <label
                  key={s}
                  className={
                    "flex items-center gap-2 px-3 py-1.5 border rounded cursor-pointer text-xs " +
                    (overlay.launchTrajectory.rampShape === s
                      ? "border-primary bg-primary-light/40"
                      : "border-border")
                  }
                >
                  <input
                    type="radio"
                    name="ramp"
                    checked={overlay.launchTrajectory.rampShape === s}
                    onChange={() => updateLaunch({ rampShape: s })}
                    className="accent-primary"
                  />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderCell({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-primary"
      />
      <span className="text-[10px] font-mono w-10 text-right">
        {value > 0 ? "+" : ""}
        {value}%
      </span>
    </div>
  );
}

function ProbField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 accent-primary"
        />
        <span className="text-xs font-mono w-12 text-right">
          {(value * 100).toFixed(0)}%
        </span>
      </div>
    </label>
  );
}
