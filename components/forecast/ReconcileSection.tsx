"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { ForecastStackView } from "@/components/connect/ForecastStackView";
import { VarianceMonitor } from "@/components/connect/VarianceMonitor";
import { SeekToForecast } from "@/components/connect/SeekToForecast";
import { SourceOfTruthMap } from "@/components/connect/SourceOfTruthMap";
import { SaveSnapshotModal } from "./SaveSnapshotModal";
import { ThresholdSettingsModal } from "./ThresholdSettingsModal";
import { VersionLog } from "./VersionLog";
import { getBrandConfig } from "@/lib/engine";
import type { BrandKey, ReconciliationAction } from "@/lib/engine";

export function ReconcileSection() {
  const forecast = useStore((s) => s.forecast);
  const computed = useStore((s) => s.computed);
  const threshold = useStore((s) => s.threshold);
  const varianceStatus = useStore((s) => s.varianceStatus);
  const variance = useMemo(() => varianceStatus(), [
    varianceStatus,
    computed,
    threshold,
  ]);
  const brandConfig = getBrandConfig(forecast.brand as BrandKey);
  const [modalAction, setModalAction] = useState<ReconciliationAction | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [thresholdOpen, setThresholdOpen] = useState(false);

  const status = variance.status;
  const isAligned = status === "aligned";

  function openModal(action: ReconciliationAction | null) {
    setModalAction(action);
    setModalOpen(true);
  }

  // Compute basic preview deltas for the action cards
  const previewDelta = useMemo(() => {
    if (!computed) return { lrpAnnualUsd: 0, lrpAnnualPct: 0, weeksToAdjust: 13, weeklyAdj: 0 };
    const currentYear = new Date().getFullYear();
    const yrAnnual = computed.annual.find((a) => a.year === currentYear);
    const baseAnnual = yrAnnual?.netSales ?? 0;
    // Approximate implied annual delta from current rolling variance, projected
    const lrpAnnualUsd = baseAnnual * variance.rolling13Week;
    const lrpAnnualPct = variance.rolling13Week;
    const weeklyAdj = baseAnnual !== 0 ? Math.abs(lrpAnnualUsd) / 13 : 0;
    return {
      lrpAnnualUsd,
      lrpAnnualPct,
      weeksToAdjust: 13,
      weeklyAdj,
    };
  }, [computed, variance.rolling13Week]);

  return (
    <div className="space-y-10">
      {/* Section header */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-heading text-h2 text-secondary">Reconcile &amp; Save</h2>
          <p className="text-xs text-muted mt-1">
            Variance status:{" "}
            <span
              className={
                "font-semibold " +
                (status === "aligned"
                  ? "text-emerald-700"
                  : status === "watching"
                  ? "text-amber-700"
                  : "text-red-700")
              }
            >
              {status === "aligned" ? "Aligned" : status === "watching" ? "Watching" : "Drift"}
            </span>{" "}
            · Threshold: ±{threshold.thresholdPct}% rolling {threshold.rollingWindow}
          </p>
        </div>
        <button
          className="btn-ghost text-xs"
          onClick={() => setThresholdOpen(true)}
        >
          Configure threshold
        </button>
      </div>

      {/* 3.1 — Forecast Stack View */}
      <section>
        <ForecastStackView />
        {!brandConfig.stfActive && (
          <p className="text-[11px] text-muted mt-2 italic">
            Weekly grain activates at launch. Showing annual + monthly only.
          </p>
        )}
      </section>

      {/* 3.2 — Variance Monitor */}
      {brandConfig.stfActive && (
        <section>
          <VarianceMonitor />
        </section>
      )}

      {/* 3.3 — Seek-to-Forecast */}
      <section>
        <SeekToForecast />
        {!brandConfig.stfActive && (
          <p className="text-[11px] text-muted mt-2 italic">
            Pre-launch: Seek-to-Forecast operates in LT-only mode (no weekly intervention map).
          </p>
        )}
      </section>

      {/* 3.4 — Reconciliation Actions */}
      <section>
        <h3 className="font-heading text-h3 text-secondary mb-2">Reconciliation Actions</h3>
        {isAligned ? (
          <div className="card border-emerald-500/40 bg-emerald-50">
            <div className="text-sm">
              <span className="font-semibold text-emerald-800">Variance within threshold.</span>{" "}
              <span className="text-secondary">
                No reconciliation needed at this time. You can still save a planned checkpoint
                snapshot below.
              </span>
            </div>
            <div className="mt-3">
              <button
                className="btn-ghost text-xs"
                onClick={() => openModal(null)}
              >
                Save manual checkpoint
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ActionCard
              icon="↑"
              title="Refresh LRP from STF"
              body="STF actuals show sustained drift. Pull the implied annual delta into the LRP and recompute."
              previews={[
                {
                  label: "Implied annual change",
                  value: `${previewDelta.lrpAnnualUsd >= 0 ? "+" : ""}$${(
                    Math.abs(previewDelta.lrpAnnualUsd) / 1e6
                  ).toFixed(1)}M (${(previewDelta.lrpAnnualPct * 100).toFixed(1)}%)`,
                },
                { label: "Affected years", value: "Current + next" },
              ]}
              cta="Refresh LRP"
              onClick={() => openModal("refresh-lrp")}
            />
            <ActionCard
              icon="↓"
              title="Adjust STF to LRP target"
              body="Hold the LRP target steady and generate weekly STF overrides to close the gap."
              previews={[
                {
                  label: "Required weekly adjustment",
                  value: `${previewDelta.weeklyAdj >= 0 ? "+" : ""}$${(
                    Math.abs(previewDelta.weeklyAdj) / 1e6
                  ).toFixed(2)}M / wk over ${previewDelta.weeksToAdjust}w`,
                },
                {
                  label: "Weeks requiring intervention",
                  value: `${previewDelta.weeksToAdjust}`,
                },
              ]}
              cta="Adjust STF"
              onClick={() => openModal("adjust-stf")}
              disabled={!brandConfig.stfActive}
            />
            <ActionCard
              icon="📝"
              title="Document & Accept"
              body="Acknowledge the variance without changing either forecast. Capture the reason for audit."
              previews={[]}
              cta="Document"
              onClick={() => openModal("document-accept")}
            />
          </div>
        )}
      </section>

      {/* 3.6 — Version Log */}
      <section>
        <VersionLog />
      </section>

      {/* 3.7 — Source-of-Truth Map */}
      <section>
        <SourceOfTruthMap />
      </section>

      <SaveSnapshotModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        action={modalAction}
      />
      <ThresholdSettingsModal
        open={thresholdOpen}
        onClose={() => setThresholdOpen(false)}
      />
    </div>
  );
}

function ActionCard({
  icon,
  title,
  body,
  previews,
  cta,
  onClick,
  disabled,
}: {
  icon: string;
  title: string;
  body: string;
  previews: { label: string; value: string }[];
  cta: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="card flex flex-col">
      <div className="flex items-baseline gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-primary-light/40 text-primary flex items-center justify-center font-bold">
          {icon}
        </div>
        <div className="font-heading text-h4 text-secondary">{title}</div>
      </div>
      <p className="text-xs text-muted mb-3">{body}</p>
      {previews.length > 0 && (
        <div className="space-y-1 mb-3 text-xs">
          {previews.map((p) => (
            <div key={p.label} className="flex justify-between">
              <span className="text-muted">{p.label}</span>
              <span className="font-mono">{p.value}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-auto">
        <button
          className="btn-secondary w-full text-xs"
          onClick={onClick}
          disabled={disabled}
        >
          {cta}
        </button>
      </div>
    </div>
  );
}
