"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { LifecycleStage, LrpMethodologyV26 } from "@/lib/engine";

const STAGES: { value: LifecycleStage; label: string }[] = [
  { value: "pre-launch", label: "Pre-launch" },
  { value: "growth", label: "Growth" },
  { value: "loe", label: "LoE" },
];

const METHODOLOGIES: { value: LrpMethodologyV26; label: string }[] = [
  { value: "epidemiology", label: "Epidemiology-based" },
  { value: "market-share", label: "Market share-based" },
];

const HORIZONS = [5, 7, 10, 15] as const;

export function SetupCard() {
  const forecast = useStore((s) => s.forecast);
  const setLifecycleStage = useStore((s) => s.setLifecycleStage);
  const setLrpMethodologyV26 = useStore((s) => s.setLrpMethodologyV26);
  const setCycleName = useStore((s) => s.setCycleName);
  const setCycleHorizonYears = useStore((s) => s.setCycleHorizonYears);
  const currentDemoUser = useStore((s) => s.currentDemoUser);

  const [pendingStage, setPendingStage] = useState<LifecycleStage | null>(null);
  const [pendingMethodology, setPendingMethodology] =
    useState<LrpMethodologyV26 | null>(null);

  const stage = forecast.lifecycleStage ?? "growth";
  const methodology = forecast.lrpMethodology ?? "epidemiology";

  function tryStageChange(next: LifecycleStage) {
    if (next === stage) return;
    const hasOverlay =
      (stage === "pre-launch" && forecast.preLaunchOverlay) ||
      (stage === "loe" && forecast.loeOverlay);
    if (hasOverlay) {
      setPendingStage(next);
    } else {
      setLifecycleStage(next);
    }
  }

  function tryMethodologyChange(next: LrpMethodologyV26) {
    if (next === methodology) return;
    const hasInputs = forecast.epidemiologyInputs || forecast.marketShareInputs;
    if (hasInputs) {
      setPendingMethodology(next);
    } else {
      setLrpMethodologyV26(next);
    }
  }

  return (
    <section id="setup" className="card scroll-mt-32">
      <h3 className="font-heading text-h3 text-secondary mb-1">Setup</h3>
      <p className="text-xs text-muted mb-4">
        Stage and methodology drive which assumption sections are visible below.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-3">
          <Field label="Brand">
            <div className="px-2 py-1.5 bg-background border border-border rounded text-sm font-mono">
              {forecast.brand}
            </div>
          </Field>
          <Field label="Geography">
            <select
              value={forecast.geography}
              className="input-cell !font-sans w-full"
              onChange={() => {
                /* placeholder — single geography in demo */
              }}
            >
              <option value="US">United States</option>
              <option value="EU5">EU5</option>
              <option value="Japan">Japan</option>
              <option value="RoW">RoW</option>
            </select>
          </Field>
          <Field label="Forecast cycle">
            <input
              type="text"
              value={forecast.cycleName ?? ""}
              onChange={(e) => setCycleName(e.target.value)}
              placeholder="2026 Q2 S&OP"
              className="input-cell !font-sans w-full"
            />
          </Field>
        </div>

        {/* Middle column */}
        <div className="space-y-3">
          <Field label="Lifecycle stage">
            <select
              value={stage}
              onChange={(e) => tryStageChange(e.target.value as LifecycleStage)}
              className="input-cell !font-sans w-full"
            >
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="LRP methodology">
            <select
              value={methodology}
              onChange={(e) =>
                tryMethodologyChange(e.target.value as LrpMethodologyV26)
              }
              className="input-cell !font-sans w-full"
            >
              {METHODOLOGIES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Right column */}
        <div className="space-y-3">
          <Field label="Owner">
            <div className="px-2 py-1.5 bg-background border border-border rounded text-sm">
              {currentDemoUser.name} ·{" "}
              <span className="text-muted text-xs">{currentDemoUser.role}</span>
            </div>
          </Field>
          <Field label="Cycle start date">
            <input
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="input-cell !font-sans w-full"
              onChange={() => { /* informational in demo */ }}
            />
          </Field>
          <Field label="Cycle horizon">
            <select
              value={forecast.cycleHorizonYears ?? 10}
              onChange={(e) => setCycleHorizonYears(parseInt(e.target.value))}
              className="input-cell !font-sans w-full"
            >
              {HORIZONS.map((h) => (
                <option key={h} value={h}>
                  {h} years
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {pendingStage && (
        <ConfirmDialog
          title="Change lifecycle stage?"
          body={`Changing stage clears the ${
            stage === "pre-launch" ? "Pre-launch" : "LoE"
          } overlay. Continue?`}
          onCancel={() => setPendingStage(null)}
          onConfirm={() => {
            setLifecycleStage(pendingStage);
            setPendingStage(null);
          }}
        />
      )}

      {pendingMethodology && (
        <ConfirmDialog
          title="Change methodology?"
          body="Changing methodology clears LRP assumption inputs and re-seeds defaults. Continue?"
          onCancel={() => setPendingMethodology(null)}
          onConfirm={() => {
            setLrpMethodologyV26(pendingMethodology);
            setPendingMethodology(null);
          }}
        />
      )}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}

function ConfirmDialog({
  title,
  body,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="card max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="font-heading text-h4 mb-2">{title}</h4>
        <p className="text-sm text-muted mb-4">{body}</p>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-secondary" onClick={onConfirm}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
