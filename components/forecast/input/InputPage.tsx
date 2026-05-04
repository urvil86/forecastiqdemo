"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  AlertTriangle,
  AlertCircle,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { getBrandConfig } from "@/lib/engine";
import type { BrandKey } from "@/lib/engine";
import { SetupCard } from "./SetupCard";
import { EpidemiologyTable } from "./EpidemiologyTable";
import { MarketShareTable } from "./MarketShareTable";
import { PreLaunchOverlayCard } from "./PreLaunchOverlayCard";
import { LoeOverlayCard } from "./LoeOverlayCard";
import { LrpEventsCard } from "./LrpEventsCard";
import { StfSetupCard } from "./StfSetupCard";
import { DriftPanel } from "./DriftPanel";
import { PreLaunchStfCard } from "./PreLaunchStfCard";
import { BuildZone } from "@/components/stf/BuildZone";
import { validateInput, summary, type InputIssue } from "./validation";

type AnchorId = "setup" | "lrp" | "stf" | "submit";

export function InputPage() {
  const forecast = useStore((s) => s.forecast);
  const submitForecast = useStore((s) => s.submitForecast);
  const saveVersion = useStore((s) => s.saveVersion);
  const currentDemoUser = useStore((s) => s.currentDemoUser);
  const leftPanelHidden = useStore((s) => s.leftPanelHidden);
  const setLeftPanelHidden = useStore((s) => s.setLeftPanelHidden);
  const router = useRouter();
  const [active, setActive] = useState<AnchorId>("setup");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const brandConfig = useMemo(
    () => getBrandConfig(forecast.brand as BrandKey),
    [forecast.brand],
  );
  const stage = forecast.lifecycleStage ?? brandConfig.defaultStage;
  const methodology = forecast.lrpMethodology ?? brandConfig.defaultMethodologyV26;
  const draft = forecast.draftStatus ?? "draft";
  const stfVisible = stage !== "pre-launch";

  const issues: InputIssue[] = useMemo(() => validateInput(forecast), [forecast]);
  const sum = summary(issues);

  const anchors = useMemo(() => {
    const list: { id: AnchorId; label: string }[] = [
      { id: "setup", label: "Setup" },
      { id: "lrp", label: "LRP Assumptions" },
    ];
    if (stfVisible) list.push({ id: "stf", label: "STF Assumptions" });
    list.push({ id: "submit", label: "Submit" });
    return list;
  }, [stfVisible]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id as AnchorId);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    for (const a of anchors) {
      const el = document.getElementById(a.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [anchors, methodology, stage]);

  function scrollTo(id: string) {
    if (typeof window !== "undefined") {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  async function handleSubmit() {
    if (sum.status === "errors") return;
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 50));
      const result = submitForecast();
      if (!result.ok) {
        setToast(
          "No changes since last submit. Edit any assumption to enable Submit.",
        );
        setTimeout(() => setToast(null), 3000);
        return;
      }
      const scopeText =
        result.scope === "lrp"
          ? `LRP submitted (LRP v${result.lrpVersion}). Snapshot saved.`
          : result.scope === "stf"
          ? `STF submitted (STF v${result.stfVersion}). Snapshot saved.`
          : `Forecast submitted (LRP v${result.lrpVersion}, STF v${result.stfVersion}). Snapshot saved.`;
      setToast(scopeText);
      setTimeout(() => {
        router.push("/forecast/views/");
      }, 700);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSaveDraft() {
    saveVersion(`Draft saved ${new Date().toLocaleString()}`);
    setToast(`Draft saved at ${new Date().toLocaleTimeString()} by ${currentDemoUser.name}.`);
    setTimeout(() => setToast(null), 2200);
  }

  // Edit-after-submit detection
  const editedAfterSubmit = false; // draftStatus auto-flips to 'draft' on edits, so this banner may not fire often

  function statusPill(): React.ReactNode {
    if (draft === "draft") {
      return (
        <span className="pill text-[10px] bg-gray-500/10 text-gray-700 border border-gray-500/30">
          Draft
        </span>
      );
    }
    if (editedAfterSubmit) {
      return (
        <span className="pill text-[10px] bg-amber-500/10 text-amber-700 border border-amber-500/30">
          Submitted, edited
        </span>
      );
    }
    return (
      <span className="pill text-[10px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
        Submitted
      </span>
    );
  }

  return (
    <div
      className={
        "grid grid-cols-1 " +
        (leftPanelHidden ? "" : "lg:grid-cols-[220px_1fr]")
      }
    >
      {/* Anchor nav */}
      {!leftPanelHidden && (
        <aside className="hidden lg:block sticky top-44 self-start h-[calc(100vh-12rem)] p-4 border-r border-border bg-surface overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="caption text-muted uppercase tracking-wider text-[10px]">
              Sections
            </div>
            <button
              onClick={() => setLeftPanelHidden(true)}
              className="text-muted hover:text-secondary"
              title="Hide left panel"
            >
              <PanelLeftClose size={14} />
            </button>
          </div>
          <ul className="space-y-1 text-sm">
            {anchors.map((a, i) => (
              <li key={a.id}>
                <button
                  onClick={() => scrollTo(a.id)}
                  className={
                    "w-full text-left px-3 py-2 rounded transition-colors " +
                    (active === a.id
                      ? "bg-primary-light/40 text-secondary"
                      : "hover:bg-primary-light/20 text-foreground")
                  }
                >
                  <span className="font-semibold text-sm">
                    {i + 1}. {a.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {/* Content */}
      <div className="min-w-0">
        {/* Top strip */}
        <div className="border-b border-border px-8 py-3 flex items-center justify-between flex-wrap gap-2 bg-surface">
          <div className="flex items-center gap-3">
            {leftPanelHidden && (
              <button
                onClick={() => setLeftPanelHidden(false)}
                className="text-muted hover:text-secondary"
                title="Show left panel"
              >
                <PanelLeftOpen size={16} />
              </button>
            )}
            <div>
              <div className="font-heading text-h3 text-secondary">
                Forecast Input · {forecast.brand} ·{" "}
                {stage === "pre-launch"
                  ? "Pre-launch"
                  : stage === "loe"
                  ? "LoE"
                  : "Growth"}
              </div>
              <div className="text-xs text-muted">
                {forecast.cycleName ?? "Current cycle"} ·{" "}
                {methodology === "epidemiology"
                  ? "Epidemiology-based"
                  : "Market share-based"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {statusPill()}
            <button
              className="btn-ghost text-xs"
              onClick={handleSaveDraft}
              disabled={submitting}
            >
              Save Draft
            </button>
            <button
              className="btn-secondary text-xs flex items-center gap-1"
              onClick={handleSubmit}
              disabled={submitting || sum.status === "errors"}
              title={
                sum.status === "errors"
                  ? "Validation errors must be fixed before submitting"
                  : undefined
              }
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              {draft === "submitted" ? "Re-submit Forecast" : "Submit Forecast"}
            </button>
          </div>
        </div>

        <div className="p-8 space-y-12">
          {/* Drift panel — shows changes vs prior version */}
          <DriftPanel />

          {/* Section 1: Setup */}
          <SetupCard />

          {/* Section 2: LRP Assumptions */}
          <section id="lrp" className="scroll-mt-32">
            <div className="mb-4">
              <h3 className="font-heading text-h3 text-secondary">
                Long Range Plan Assumptions
              </h3>
              <p className="text-xs text-muted mt-0.5">
                {methodology === "epidemiology"
                  ? "Epidemiology-based"
                  : "Market share-based"}{" "}
                · {forecast.cycleHorizonYears ?? 10}-year horizon
              </p>
            </div>

            {methodology === "epidemiology" ? (
              <EpidemiologyTable />
            ) : (
              <MarketShareTable />
            )}

            <div className="mt-8">
              <LrpEventsCard />
            </div>

            {stage === "pre-launch" && (
              <div className="mt-8">
                <PreLaunchOverlayCard />
              </div>
            )}
            {stage === "loe" && (
              <div className="mt-8">
                <LoeOverlayCard />
              </div>
            )}
          </section>

          {/* Section 3: STF Assumptions */}
          <section id="stf" className="scroll-mt-32">
            <div className="mb-4">
              <h3 className="font-heading text-h3 text-secondary">
                Short Term Forecast Assumptions
              </h3>
              <p className="text-xs text-muted mt-0.5">
                {stfVisible
                  ? "13 weeks forward · Trend + Events"
                  : `Derived from LRP at launch · ${forecast.preLaunchOverlay?.launchTrajectory?.expectedLaunchDate?.slice(0, 10) ?? "set launch date"}`}
              </p>
            </div>
            {stfVisible ? (
              <div className="space-y-8">
                <StfSetupCard />
                <div>
                  <h4 className="font-heading text-h4 text-secondary mb-2">
                    3.4 Build &amp; Weekly Authoring
                  </h4>
                  <BuildZone />
                </div>
              </div>
            ) : (
              <PreLaunchStfSection />
            )}
          </section>

          {/* Section 4: Submit */}
          <section id="submit" className="scroll-mt-32">
            <div className="card">
              <h3 className="font-heading text-h3 text-secondary mb-2">
                Validation
              </h3>
              <div className="flex items-center gap-2 mb-3">
                <ValidationPill status={sum.status} count={sum.errors + sum.warnings} />
                <span className="text-[11px] text-muted">
                  {sum.errors} errors · {sum.warnings} warnings · {sum.info} info
                </span>
              </div>

              {issues.length === 0 ? (
                <div className="text-xs text-muted py-2 italic">
                  All validation checks passed.
                </div>
              ) : (
                <ul className="space-y-1 text-xs max-h-64 overflow-y-auto">
                  {issues.map((iss) => (
                    <li
                      key={iss.id}
                      className={
                        "flex items-start gap-2 p-2 rounded border " +
                        (iss.severity === "error"
                          ? "border-red-300 bg-red-50"
                          : iss.severity === "warning"
                          ? "border-amber-300 bg-amber-50"
                          : "border-border bg-background")
                      }
                    >
                      {iss.severity === "error" ? (
                        <AlertCircle size={14} className="text-red-600 mt-0.5 shrink-0" />
                      ) : iss.severity === "warning" ? (
                        <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                      ) : (
                        <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{iss.section}</div>
                        <div className="text-muted">{iss.message}</div>
                      </div>
                      <button
                        className="text-[10px] text-primary hover:underline shrink-0"
                        onClick={() => scrollTo(iss.anchor)}
                      >
                        Jump to →
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button
                  className="btn-ghost text-xs"
                  onClick={handleSaveDraft}
                  disabled={submitting}
                >
                  Save Draft
                </button>
                <button
                  className="btn-secondary text-xs flex items-center gap-1"
                  onClick={handleSubmit}
                  disabled={submitting || sum.status === "errors"}
                >
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  {draft === "submitted" ? "Re-submit Forecast" : "Submit Forecast"}
                </button>
              </div>
            </div>
          </section>
        </div>

        {toast && (
          <div className="fixed bottom-4 right-4 z-[60] card max-w-sm shadow-lg">
            <div className="flex items-center gap-2">
              <Check size={14} className="text-emerald-600" />
              <div className="text-xs">{toast}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ValidationPill({
  status,
  count,
}: {
  status: "ok" | "warnings" | "errors";
  count: number;
}) {
  if (status === "ok")
    return (
      <span className="pill text-[10px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
        All checks passed
      </span>
    );
  if (status === "warnings")
    return (
      <span className="pill text-[10px] bg-amber-500/10 text-amber-700 border border-amber-500/30">
        {count} warnings
      </span>
    );
  return (
    <span className="pill text-[10px] bg-red-500/10 text-red-700 border border-red-500/30">
      {count} errors
    </span>
  );
}

/**
 * Pre-launch STF section: PreLaunchStfCard always shows. Once the
 * forecaster clicks "Activate STF" (which sets the actuals cutoff to
 * the launch date), the regular Setup + Build Zone reveals so they can
 * layer weekly authoring on top of the LRP-derived baseline.
 */
function PreLaunchStfSection() {
  const forecast = useStore((s) => s.forecast);
  const launch =
    forecast.preLaunchOverlay?.launchTrajectory?.expectedLaunchDate;
  const isActivated = useMemo(() => {
    if (!launch) return false;
    const launchTime = new Date(launch).getTime();
    const cutoffTime = new Date(forecast.stf.actualsCutoffDate).getTime();
    return Math.abs(launchTime - cutoffTime) < 14 * 86400_000;
  }, [forecast.stf.actualsCutoffDate, launch]);

  return (
    <div className="space-y-8">
      <PreLaunchStfCard />
      {isActivated && (
        <>
          <StfSetupCard />
          <div>
            <h4 className="font-heading text-h4 text-secondary mb-2">
              3.4 Build &amp; Weekly Authoring (post-launch overrides)
            </h4>
            <p className="text-xs text-muted mb-2">
              The LRP-derived baseline is now editable week by week. Add
              launch-quarter events (DTC flights, congresses), set
              channel-specific overrides, configure NFS / pricing for the
              launch window.
            </p>
            <BuildZone />
          </div>
        </>
      )}
    </div>
  );
}
