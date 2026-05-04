"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  getBrandConfig,
  detectScopeChanges,
  snapshotsInScope,
} from "@/lib/engine";
import type { BrandKey, VersionSnapshot } from "@/lib/engine";
import { NetSalesTrajectory } from "@/components/lrp/review/NetSalesTrajectory";
import { VarianceWaterfall } from "@/components/lrp/review/VarianceWaterfall";
import { ForecastEvolution } from "@/components/lrp/review/ForecastEvolution";
import { DriverSensitivity } from "@/components/lrp/review/DriverSensitivity";
import { PeakYearAnalysis } from "@/components/lrp/review/PeakYearAnalysis";
import { ConfidenceCone } from "@/components/lrp/review/ConfidenceCone";
import { ReviewZone } from "@/components/stf/ReviewZone";
import { ForecastStackView } from "@/components/connect/ForecastStackView";
import { SourceOfTruthMap } from "@/components/connect/SourceOfTruthMap";
import { ChangeSummaryCard } from "@/components/forecast/views/ChangeSummaryCard";
import { StfCycleCompareChart } from "@/components/forecast/views/StfCycleCompareChart";

type AnchorId = "lrp" | "stf" | "combined";

function scopeLabel(scope?: VersionSnapshot["scope"]): string {
  if (scope === "lrp") return "LRP";
  if (scope === "stf") return "STF";
  return "Full";
}

export default function ForecastViewsPage() {
  const forecast = useStore((s) => s.forecast);
  const setDraftStatus = useStore((s) => s.setDraftStatus);
  const versions = useStore((s) => s.versionHistory);
  const leftPanelHidden = useStore((s) => s.leftPanelHidden);
  const setLeftPanelHidden = useStore((s) => s.setLeftPanelHidden);
  const router = useRouter();
  const [active, setActive] = useState<AnchorId>("lrp");

  const brandConfig = useMemo(
    () => getBrandConfig(forecast.brand as BrandKey),
    [forecast.brand],
  );
  const stage = forecast.lifecycleStage ?? brandConfig.defaultStage;
  const draft = forecast.draftStatus ?? "draft";
  const stfVisible = stage !== "pre-launch";

  // Scope-aware version lists: LRP charts pick from lrp + full snapshots,
  // STF charts pick from stf + full snapshots.
  const lrpVersions = useMemo(
    () => snapshotsInScope(versions, "lrp"),
    [versions],
  );
  const stfVersions = useMemo(
    () => snapshotsInScope(versions, "stf"),
    [versions],
  );

  // Pick the most recent prior version that actually differs from current.
  // Falls back to the most recent snapshot in scope when nothing differs.
  function pickDefaultCompare(
    list: VersionSnapshot[],
    side: "lrp" | "stf",
  ): string | null {
    if (list.length === 0) return null;
    for (const v of list) {
      const baseline = v.forecastSnapshot ?? v.forecast;
      const change = detectScopeChanges(baseline, forecast);
      if (side === "lrp" && change.lrp) return v.id;
      if (side === "stf" && change.stf) return v.id;
    }
    return list[0].id;
  }

  const [compareLrpId, setCompareLrpId] = useState<string | null>(null);
  const [compareStfId, setCompareStfId] = useState<string | null>(null);
  useEffect(() => {
    if (compareLrpId === null && lrpVersions.length > 0) {
      setCompareLrpId(pickDefaultCompare(lrpVersions, "lrp"));
    }
    if (compareStfId === null && stfVersions.length > 0) {
      setCompareStfId(pickDefaultCompare(stfVersions, "stf"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lrpVersions, stfVersions]);

  const anchors = useMemo(() => {
    const list: { id: AnchorId; label: string }[] = [
      { id: "lrp", label: "LRP Outputs" },
    ];
    if (stfVisible) {
      list.push({ id: "stf", label: "STF Outputs" });
      list.push({ id: "combined", label: "Combined" });
    }
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
  }, [anchors, draft]);

  function scrollTo(id: AnchorId) {
    setActive(id);
    if (typeof window !== "undefined") {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", `#${id}`);
      }
    }
  }

  if (draft === "draft") {
    return (
      <div className="p-8 flex justify-center">
        <div className="card max-w-lg text-center mt-12 border-l-4 border-primary">
          <h2 className="font-heading text-h2 text-secondary mb-2">
            Submit your forecast to see views
          </h2>
          <p className="text-sm text-muted mb-4">
            Build your assumptions in the Input sub-tab. Once submitted, this
            view shows the full set of outputs across LRP and STF.
          </p>
          <Link href="/forecast/" className="btn-secondary text-xs">
            Go to Input
          </Link>
        </div>
      </div>
    );
  }

  function reEdit() {
    setDraftStatus("draft");
    router.push("/forecast/");
  }

  return (
    <>
      {/* Action strip */}
      <div className="border-b border-border px-8 py-3 flex items-center justify-between flex-wrap gap-3 bg-surface">
        <div className="flex items-center gap-4 flex-wrap">
          {leftPanelHidden && (
            <button
              onClick={() => setLeftPanelHidden(false)}
              className="text-muted hover:text-secondary self-center"
              title="Show left panel"
            >
              <PanelLeftOpen size={16} />
            </button>
          )}
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-muted">Submitted:</span>
            <span className="pill text-[10px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 font-mono">
              LRP v{forecast.lrpVersion ?? forecast.version}
            </span>
            <span className="pill text-[10px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 font-mono">
              STF v{forecast.stfVersion ?? forecast.version}
            </span>
            {forecast.lastSubmittedBy && (
              <span className="text-[11px] text-muted">
                · {forecast.lastSubmittedBy.name}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-xs text-muted">Compare LRP to:</span>
            <select
              value={compareLrpId ?? ""}
              onChange={(e) => setCompareLrpId(e.target.value || null)}
              className="input-cell !font-sans !text-xs"
              disabled={lrpVersions.length === 0}
            >
              <option value="">— none —</option>
              {lrpVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {scopeLabel(v.scope)} · {v.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-xs text-muted">Compare STF to:</span>
            <select
              value={compareStfId ?? ""}
              onChange={(e) => setCompareStfId(e.target.value || null)}
              className="input-cell !font-sans !text-xs"
              disabled={stfVersions.length === 0}
            >
              <option value="">— none —</option>
              {stfVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {scopeLabel(v.scope)} · {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost text-xs" onClick={reEdit}>
            Re-edit assumptions
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={() =>
              alert("Export PPT is wired in production (Phase 2 placeholder).")
            }
          >
            Export PPT
          </button>
        </div>
      </div>

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
                Outputs
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
              {anchors.map((a, i) => {
                const isActive = a.id === active;
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => scrollTo(a.id)}
                      className={
                        "w-full text-left px-3 py-2 rounded transition-colors " +
                        (isActive
                          ? "bg-primary-light/40 text-secondary"
                          : "hover:bg-primary-light/20 text-foreground")
                      }
                    >
                      <span className="font-semibold text-sm">
                        {i + 1}. {a.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}

        {/* Content */}
        <div className="min-w-0">
          <section
            id="lrp"
            className="p-8 space-y-12 scroll-mt-32 border-b border-border"
          >
            <div>
              <h2 className="font-heading text-h2 text-secondary">LRP Outputs</h2>
              <p className="text-xs text-muted mt-1">
                {forecast.brand} · {forecast.geography} · {stage}
              </p>
            </div>

            {/* Comparison summary lands at the top of LRP */}
            <ChangeSummaryCard
              compareToVersionId={compareLrpId}
              scope="lrp"
            />

            <NetSalesTrajectory
              viewThroughYear={parseInt(forecast.timeframe.forecastEnd.slice(0, 4))}
              versions={[]}
              compareToVersionId={compareLrpId}
            />
            <VarianceWaterfall
              year={2027}
              onYearChange={() => {}}
              compareToVersionId={compareLrpId}
            />
            <ForecastEvolution
              viewThroughYear={parseInt(forecast.timeframe.forecastEnd.slice(0, 4))}
            />
            <DriverSensitivity targetYear={2030} />
            <PeakYearAnalysis
              viewThroughYear={parseInt(forecast.timeframe.forecastEnd.slice(0, 4))}
            />
            <ConfidenceCone
              viewThroughYear={parseInt(forecast.timeframe.forecastEnd.slice(0, 4))}
            />
          </section>

          {stfVisible && (
            <>
              <section
                id="stf"
                className="p-8 space-y-12 scroll-mt-32 border-b border-border"
              >
                <div>
                  <h2 className="font-heading text-h2 text-secondary">
                    STF Outputs
                  </h2>
                  <p className="text-xs text-muted mt-1">
                    13 weeks forward · Last actuals {forecast.stf.actualsCutoffDate}
                  </p>
                </div>

                {/* STF cycle comparison: current vs prior cycle, two lines */}
                <ChangeSummaryCard
                  compareToVersionId={compareStfId}
                  scope="stf"
                />
                <StfCycleCompareChart compareToVersionId={compareStfId} />

                <ReviewZone />
              </section>

              <section
                id="combined"
                className="p-8 space-y-12 scroll-mt-32"
              >
                <div>
                  <h2 className="font-heading text-h2 text-secondary">
                    Combined View
                  </h2>
                  <p className="text-xs text-muted mt-1">
                    Annual + monthly + weekly stack and source-of-truth lineage
                  </p>
                </div>
                <ForecastStackView />
                <SourceOfTruthMap />
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
