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
import { formatUsdShort, formatPct } from "@/lib/format";

export default function LrpPage() {
  const computed = useStore((s) => s.computed);
  const forecast = useStore((s) => s.forecast);
  const saveVersion = useStore((s) => s.saveVersion);
  const [showSave, setShowSave] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [showVersionDrawer, setShowVersionDrawer] = useState(false);

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
    const a26 = a(2026);
    const a35 = a(2035);
    const cagr = a26 > 0 ? Math.pow(a35 / a26, 1 / 9) - 1 : 0;
    return {
      a26: a(2026),
      a27: a(2027),
      a30: a(2030),
      a35: a(2035),
      peakYear,
      peakValue: peak,
      cagr,
    };
  }, [computed]);

  if (!computed || !kpis) {
    return (
      <div className="p-8">
        <div className="shimmer h-32 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-h2 text-secondary">{forecast.brand} {forecast.geography} — LRP</h1>
          <p className="text-sm text-muted mt-1">
            Long-Range Plan · {forecast.timeframe.historicalStart.slice(0, 4)} – {forecast.timeframe.forecastEnd.slice(0, 4)} · v{forecast.version} · {forecast.versionLabel}
          </p>
          <div className="text-xs text-muted mt-2">
            Connected to STF · Last STF sync: 2 minutes ago ·{" "}
            <Link href="/stf" className="text-primary hover:underline">Open STF →</Link>{" "}
            ·{" "}
            <Link href="/stf/connect" className="text-primary hover:underline">Compare LRP vs STF →</Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => setShowSave(true)}>Save Version</button>
          <Link href="/lrp/review" className="btn-secondary">Review Forecast</Link>
          <button className="btn-ghost" onClick={() => setShowVersionDrawer(true)}>Version History</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <KpiCard label="2026 Net Sales" value={formatUsdShort(kpis.a26)} sub="Current year" accent="secondary" />
        <KpiCard label="2027 Net Sales" value={formatUsdShort(kpis.a27)} sub="Pre-biosimilar peak" accent="primary" />
        <KpiCard label="2030 Net Sales" value={formatUsdShort(kpis.a30)} sub="Post-biosimilar" />
        <KpiCard label="2035 Net Sales" value={formatUsdShort(kpis.a35)} sub="Long-tail" />
        <KpiCard label="Peak Year" value={String(kpis.peakYear)} sub={formatUsdShort(kpis.peakValue)} accent="primary" />
        <KpiCard label="CAGR 2026-2035" value={formatPct(kpis.cagr)} sub="Annualized" />
      </div>

      <SectionHeader
        title="Trend Selection"
        subtitle="Choose the methodology for projecting historical actuals into the forecast horizon."
      />
      <TrendSelectionCard />

      <div className="mt-8" />
      <SectionHeader
        title="Events"
        subtitle="Discrete events shape the curve via sigmoid impact models."
      />
      <EventsCard />

      <div className="mt-8" />
      <SectionHeader
        title="Share & Pricing"
        subtitle="Anchor years interpolate linearly. Net price = gross × (1 − GTN)."
      />
      <ShareAndPricingCard />

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
