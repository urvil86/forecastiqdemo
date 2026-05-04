"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { ThresholdConfig } from "@/lib/engine";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ThresholdSettingsModal({ open, onClose }: Props) {
  const threshold = useStore((s) => s.threshold);
  const setThreshold = useStore((s) => s.setThreshold);
  const [draft, setDraft] = useState<ThresholdConfig>(threshold);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="card max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading text-h3 mb-3">Threshold settings</h3>

        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Rolling window
          </div>
          <div className="flex gap-2">
            {(["4-week", "8-week", "13-week"] as const).map((w) => (
              <label
                key={w}
                className={
                  "flex items-center gap-2 px-3 py-2 border rounded cursor-pointer text-sm " +
                  (draft.rollingWindow === w
                    ? "border-primary bg-primary-light/40"
                    : "border-border")
                }
              >
                <input
                  type="radio"
                  name="window"
                  checked={draft.rollingWindow === w}
                  onChange={() => setDraft((d) => ({ ...d, rollingWindow: w }))}
                  className="accent-primary"
                />
                {w}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Threshold percentage (±)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  thresholdPct: Math.max(0.5, d.thresholdPct - 0.5),
                }))
              }
              className="btn-ghost px-2"
            >
              −
            </button>
            <input
              type="number"
              step={0.5}
              min={0.5}
              max={20}
              value={draft.thresholdPct}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  thresholdPct: Math.max(0.5, parseFloat(e.target.value || "5")),
                }))
              }
              className="px-2 py-1 border border-border rounded text-sm w-24 text-center"
            />
            <span className="text-sm text-muted">%</span>
            <button
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  thresholdPct: Math.min(20, d.thresholdPct + 0.5),
                }))
              }
              className="btn-ghost px-2"
            >
              +
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Applies to
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { v: "rolling-variance", l: "Rolling variance" },
                { v: "period-variance", l: "Period variance" },
                { v: "both", l: "Both" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.v}
                className={
                  "flex items-center gap-2 px-3 py-2 border rounded cursor-pointer text-sm " +
                  (draft.appliesTo === opt.v
                    ? "border-primary bg-primary-light/40"
                    : "border-border")
                }
              >
                <input
                  type="radio"
                  name="applies"
                  checked={draft.appliesTo === opt.v}
                  onChange={() => setDraft((d) => ({ ...d, appliesTo: opt.v }))}
                  className="accent-primary"
                />
                {opt.l}
              </label>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-muted mb-4">
          Default for the demo: 4-week rolling window, ±5%. The threshold determines when a
          reconciliation event is raised. Lower thresholds catch drift earlier; higher thresholds
          reduce false alarms.
        </p>

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              setThreshold(draft);
              onClose();
            }}
          >
            Save threshold
          </button>
        </div>
      </div>
    </div>
  );
}
