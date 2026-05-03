"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { KpiCard } from "@/components/KpiCard";
import { SectionHeader } from "@/components/SectionHeader";
import { TrendSelectionCard } from "@/components/lrp/TrendSelectionCard";
import { EventsCard } from "@/components/lrp/EventsCard";
import { ShareAndPricingCard } from "@/components/lrp/ShareAndPricingCard";
import { VersionDrawer } from "@/components/lrp/VersionDrawer";
import { PreLaunchLrpCard } from "@/components/lrp/PreLaunchLrpCard";
import { HybridBlenderCard } from "@/components/lrp/HybridBlenderCard";
import { PostLoeDerivativeBanner } from "@/components/lrp/PostLoeDerivativeBanner";
import { formatUsdShort, formatPct } from "@/lib/format";

export function LrpAuthoringTab({ embeddedInWorkspace = false }: { embeddedInWorkspace?: boolean } = {}) {
  const computed = useStore((s) => s.computed);
  const forecast = useStore((s) => s.forecast);
  const saveVersion = useStore((s) => s.saveVersion);
  const [showSave, setShowSave] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [showVersionDrawer, setShowVersionDrawer] = useState(false);

  const mode = forecast.lifecycleContext?.mode ?? "exclusivity";

  const kpis = useMemo(() => {
    if (!computed) return null;
    const a = (y: number) => computed.annual.find((x) => x.year === y)?.netSales ?? 0;
    let peakYear = 2026;
    let peak = 0;
    for (const yr of computed.annual) {
      if (yr.netSales > peak) {
        peak = yr.netSales;
        peakYear = yr.year;
      }
    }
    const startYear = parseInt(forecast.timeframe.forecastStart.split("-")[0]);
    const endYear = parseInt(forecast.timeframe.forecastEnd.split("-")[0]);
    const aStart = a(startYear);
    const aEnd = a(endYear);
    const span = Math.max(1, endYear - startYear);
    const cagr = aStart > 0 ? Math.pow(aEnd / aStart, 1 / span) - 1 : 0;
    return {
      a26: aStart,
      a27: a(startYear + 1),
      a30: a(startYear + 4),
      a35: aEnd,
      labelStart: String(startYear),
      labelStartPlus1: String(startYear + 1),
      labelStartPlus4: String(startYear + 4),
      labelEnd: String(endYear),
      peakYear,
      peakValue: peak,
      cagr,
    };
  }, [computed, forecast]);

  if (!computed || !kpis) {
    return (
      <div className="p-8">
        <div className="shimmer h-32 rounded-xl" />
      </div>
    );
  }

  const isPostLoe = mode === "post-loe";
  const isPreLaunch = mode === "pre-launch";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="font-heading text-h2 text-secondary">
            {isPostLoe ? "LRP (Derivative)" : "Long Range Plan"}
          </h1>
        </div>
        {!embeddedInWorkspace && (
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={() => setShowSave(true)}>Save Version</button>
            <Link href={embeddedInWorkspace ? "/forecast/review/lrp" : "/lrp/review"} className="btn-secondary">
              Review Forecast
            </Link>
            <button className="btn-ghost" onClick={() => setShowVersionDrawer(true)}>Version History</button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted">
        {forecast.brand} {forecast.geography} · {forecast.timeframe.historicalStart.slice(0, 4)} – {forecast.timeframe.forecastEnd.slice(0, 4)} · v{forecast.version} · {forecast.versionLabel}
      </p>

      {isPostLoe && <PostLoeDerivativeBanner />}
      {isPreLaunch && <PreLaunchLrpCard />}
      {!isPreLaunch && !isPostLoe && forecast.lifecycleContext?.exclusivityConfig?.scReformulationConfig && (
        <HybridBlenderCard />
      )}

      <div className="flex flex-wrap gap-3 mb-8 mt-4">
        <KpiCard label={`${kpis.labelStart} Net Sales`} value={formatUsdShort(kpis.a26)} sub="Current year" accent="secondary" />
        <KpiCard label={`${kpis.labelStartPlus1} Net Sales`} value={formatUsdShort(kpis.a27)} sub="Next year" accent="primary" />
        <KpiCard label={`${kpis.labelStartPlus4} Net Sales`} value={formatUsdShort(kpis.a30)} sub="Mid-horizon" />
        <KpiCard label={`${kpis.labelEnd} Net Sales`} value={formatUsdShort(kpis.a35)} sub="Long-tail" />
        <KpiCard label="Peak Year" value={String(kpis.peakYear)} sub={formatUsdShort(kpis.peakValue)} accent="primary" />
        <KpiCard label="CAGR" value={formatPct(kpis.cagr)} sub={`${kpis.labelStart}–${kpis.labelEnd}`} />
      </div>

      <fieldset disabled={isPostLoe} className={isPostLoe ? "opacity-60 pointer-events-none" : undefined}>
        <SectionHeader
          title="Trend Selection"
          subtitle={
            isPreLaunch
              ? "Methodology locked to Analog-Weighted in Pre-launch mode."
              : "Choose the methodology for projecting historical actuals into the forecast horizon."
          }
        />
        <TrendSelectionCard />

        <div className="mt-8" />
        <SectionHeader title="Events" subtitle="Discrete events shape the curve via sigmoid impact models." />
        <EventsCard />

        <div className="mt-8" />
        <SectionHeader title="Share & Pricing" subtitle="Anchor years interpolate linearly. Net price = gross × (1 − GTN)." />
        <ShareAndPricingCard />
      </fieldset>

      {showSave && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onClick={() => setShowSave(false)}>
          <div className="card max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-h3 mb-4">Save Version</h3>
            <input
              type="text"
              value={versionLabel}
              placeholder="e.g. Bear case — biosimilar earlier"
              onChange={(e) => setVersionLabel(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setShowSave(false)}>Cancel</button>
              <button
                className="btn-secondary"
                onClick={() => {
                  saveVersion(versionLabel || `Version saved ${new Date().toLocaleString()}`);
                  setShowSave(false);
                  setVersionLabel("");
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showVersionDrawer && <VersionDrawer onClose={() => setShowVersionDrawer(false)} />}
    </div>
  );
}
