"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useStore } from "@/lib/store";
import { getBrandConfig } from "@/lib/engine";
import type { BrandKey } from "@/lib/engine";
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

  // Compare-to version: defaults to the latest snapshot (prior submission).
  const [compareToVersionId, setCompareToVersionId] = useState<string | null>(
    null,
  );
  useEffect(() => {
    if (compareToVersionId === null && versions.length > 0) {
      setCompareToVersionId(versions[0].id);
    }
  }, [versions, compareToVersionId]);

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

  function fmtVersion(): string {
    if (!forecast.lastSubmittedAt) return `v${forecast.version}`;
    try {
      const d = new Date(forecast.lastSubmittedAt);
      return `v${forecast.version} · submitted ${d.toLocaleString()}`;
    } catch {
      return `v${forecast.version}`;
    }
  }

  function reEdit() {
    setDraftStatus("draft");
    router.push("/forecast/");
  }

  return (
    <>
      {/* Action strip */}
      <div className="border-b border-border px-8 py-3 flex items-center justify-between flex-wrap gap-2 bg-surface">
        <div className="flex items-baseline gap-3 flex-wrap">
          {leftPanelHidden && (
            <button
              onClick={() => setLeftPanelHidden(false)}
              className="text-muted hover:text-secondary self-center"
              title="Show left panel"
            >
              <PanelLeftOpen size={16} />
            </button>
          )}
          <span className="text-xs text-muted">Forecast version:</span>
          <span className="pill text-[10px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
            {fmtVersion()}
          </span>
          {forecast.lastSubmittedBy && (
            <span className="text-[11px] text-muted">
              by {forecast.lastSubmittedBy.name}
            </span>
          )}
          <span className="text-xs text-muted ml-2">Compare to:</span>
          <select
            value={compareToVersionId ?? ""}
            onChange={(e) => setCompareToVersionId(e.target.value || null)}
            className="input-cell !font-sans !text-xs"
          >
            <option value="">— none —</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version} · {v.label}
              </option>
            ))}
          </select>
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
            <ChangeSummaryCard compareToVersionId={compareToVersionId} />

            <NetSalesTrajectory
              viewThroughYear={parseInt(forecast.timeframe.forecastEnd.slice(0, 4))}
              versions={[]}
              compareToVersionId={compareToVersionId}
            />
            <VarianceWaterfall
              year={2027}
              onYearChange={() => {}}
              compareToVersionId={compareToVersionId}
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
                <StfCycleCompareChart compareToVersionId={compareToVersionId} />

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
