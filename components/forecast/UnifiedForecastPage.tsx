"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { LrpAuthoringTab } from "@/components/lrp/LrpAuthoringTab";
import { StfAuthoringTab } from "@/components/stf/StfAuthoringTab";
import { NetSalesTrajectory } from "@/components/lrp/review/NetSalesTrajectory";
import { VarianceWaterfall } from "@/components/lrp/review/VarianceWaterfall";
import { ForecastEvolution } from "@/components/lrp/review/ForecastEvolution";
import { DriverSensitivity } from "@/components/lrp/review/DriverSensitivity";
import { PeakYearAnalysis } from "@/components/lrp/review/PeakYearAnalysis";
import { ConfidenceCone } from "@/components/lrp/review/ConfidenceCone";
import { ReviewZone } from "@/components/stf/ReviewZone";
import { ReconcileSection } from "./ReconcileSection";
import { getBrandConfig } from "@/lib/engine";
import type { BrandKey } from "@/lib/engine";

type AnchorId = "lrp" | "stf" | "reconcile";

const ANCHORS: { id: AnchorId; label: string }[] = [
  { id: "lrp", label: "Long Range Plan" },
  { id: "stf", label: "Short Term Forecast" },
  { id: "reconcile", label: "Reconcile & Save" },
];

export function UnifiedForecastPage() {
  const forecast = useStore((s) => s.forecast);
  const varianceStatus = useStore((s) => s.varianceStatus);
  const computed = useStore((s) => s.computed);
  const threshold = useStore((s) => s.threshold);
  const [active, setActive] = useState<AnchorId>("lrp");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const brandConfig = useMemo(
    () => getBrandConfig(forecast.brand as BrandKey),
    [forecast.brand],
  );

  const variance = useMemo(() => varianceStatus(), [
    varianceStatus,
    computed,
    threshold,
  ]);

  // Honor URL hash on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "") as AnchorId;
    if (hash === "lrp" || hash === "stf" || hash === "reconcile") {
      setActive(hash);
      // Defer scroll until after layout
      setTimeout(() => {
        const el = document.getElementById(hash);
        el?.scrollIntoView({ behavior: "auto", block: "start" });
      }, 50);
    }
  }, []);

  // Track which anchor is in view
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
    for (const a of ANCHORS) {
      const el = document.getElementById(a.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

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

  const lrpAnchorRight = brandConfig.defaultMethodology;
  const stfAnchorRight = brandConfig.stfActive
    ? `Last actuals ${forecast.stf.actualsCutoffDate}`
    : "Activates at launch";
  const reconcileAnchorRight =
    variance.status === "aligned"
      ? "Aligned"
      : variance.status === "watching"
      ? "Watching"
      : "Drift";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr]">
      {/* Anchor nav */}
      <aside className="hidden lg:block sticky top-44 self-start h-[calc(100vh-12rem)] p-4 border-r border-border bg-surface">
        <div className="caption text-muted mb-3 uppercase tracking-wider text-[10px]">
          Workflow
        </div>
        <ul className="space-y-1 text-sm">
          {ANCHORS.map((a, i) => {
            const isActive = a.id === active;
            const right =
              a.id === "lrp"
                ? lrpAnchorRight
                : a.id === "stf"
                ? stfAnchorRight
                : reconcileAnchorRight;
            const rightClass =
              a.id === "reconcile"
                ? variance.status === "aligned"
                  ? "text-emerald-700"
                  : variance.status === "watching"
                  ? "text-amber-700"
                  : "text-red-700"
                : "text-muted";
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
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-sm">
                      {i + 1}. {a.label}
                    </span>
                  </div>
                  <div
                    className={"text-[10px] mt-0.5 truncate " + rightClass}
                  >
                    {right}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Main scrollable content */}
      <div ref={containerRef} className="min-w-0">
        {/* Section 1 — Long Range Plan */}
        <section
          id="lrp"
          className="scroll-mt-32 border-b border-border pb-12"
        >
          <LrpAuthoringTab embeddedInWorkspace />
          <div className="px-8 pt-8 space-y-12">
            <NetSalesTrajectory
              viewThroughYear={parseInt(forecast.timeframe.forecastEnd.slice(0, 4))}
              versions={[]}
              compareToVersionId={null}
            />
            <VarianceWaterfall year={2027} onYearChange={() => {}} compareToVersionId={null} />
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
          </div>
        </section>

        {/* Section 2 — Short Term Forecast */}
        <section
          id="stf"
          className="scroll-mt-32 border-b border-border pb-12"
        >
          {brandConfig.stfActive ? (
            <>
              <StfAuthoringTab embeddedInWorkspace />
              <div className="px-8 pt-8">
                <ReviewZone />
              </div>
            </>
          ) : (
            <div className="p-8">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <h2 className="font-heading text-h2 text-secondary">Short Term Forecast</h2>
                <span className="text-xs text-muted">Pre-launch · No actuals available</span>
              </div>
              <div className="card border-l-4 border-primary">
                <h3 className="font-heading text-h3 text-secondary mb-2">
                  Short Term Forecast activates after launch
                </h3>
                <p className="text-sm text-muted">
                  Currently no commercial actuals are available for {forecast.brand}. Pre-launch
                  tactical inputs (MSL deployment, DTC build, formulary tier, expected launch
                  date) are captured in the Long Range Plan section above.
                </p>
                <p className="text-xs text-muted mt-2">
                  When the brand launches, this section will activate with weekly authoring,
                  trend selection, holiday adjustments, events, SKU mix, NFS, inventory & DOH,
                  pricing & GTN, and net revenue build-up.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Section 3 — Reconcile & Save */}
        <section id="reconcile" className="scroll-mt-32 p-8">
          <ReconcileSection />
        </section>
      </div>
    </div>
  );
}
