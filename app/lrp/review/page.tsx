"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { NetSalesTrajectory } from "@/components/lrp/review/NetSalesTrajectory";
import { VarianceWaterfall } from "@/components/lrp/review/VarianceWaterfall";
import { ForecastEvolution } from "@/components/lrp/review/ForecastEvolution";
import { DriverSensitivity } from "@/components/lrp/review/DriverSensitivity";
import { PeakYearAnalysis } from "@/components/lrp/review/PeakYearAnalysis";
import { GeographicDecomposition } from "@/components/lrp/review/GeographicDecomposition";
import { ConfidenceCone } from "@/components/lrp/review/ConfidenceCone";
import { MarketEventSensitivity } from "@/components/lrp/review/MarketEventSensitivity";
import { useState } from "react";
import { Download } from "lucide-react";

const SECTIONS = [
  { id: "trajectory", label: "1. Net Sales Trajectory" },
  { id: "waterfall", label: "2. Variance Waterfall" },
  { id: "evolution", label: "3. Forecast Evolution" },
  { id: "sensitivity", label: "4. Driver Sensitivity" },
  { id: "peak", label: "5. Peak Year Analysis" },
  { id: "geo", label: "6. Subnational US Regions" },
  { id: "cone", label: "7. Confidence Cone" },
  { id: "events", label: "8. Market Event Sensitivity" },
];

const YEAR_OPTIONS = [2027, 2028, 2030, 2032, 2035];

export default function LrpReviewPage() {
  const forecast = useStore((s) => s.forecast);
  const versionHistory = useStore((s) => s.versionHistory);
  const [viewThroughYear, setViewThroughYear] = useState(2035);
  const [waterfallYear, setWaterfallYear] = useState(2027);
  const [compareToVersionId, setCompareToVersionId] = useState<string | null>(null);

  const versions = [
    { id: "current", version: forecast.version, label: forecast.versionLabel + " (current)", current: true },
    ...versionHistory.map((v) => ({ id: v.id, version: v.version, label: v.label, current: false })),
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr]">
      <aside className="hidden lg:block sticky top-16 self-start h-[calc(100vh-4rem)] p-4 border-r border-border bg-surface overflow-y-auto">
        <div className="caption text-muted mb-2">Sections</div>
        <ul className="space-y-1 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block px-3 py-2 rounded hover:bg-primary-light/40 text-foreground">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </aside>

      <div className="p-8 space-y-12">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-h2 text-secondary">LRP Review — {forecast.brand} {forecast.geography}</h1>
            <p className="text-sm text-muted mt-1">
              Decision-support visualizations for the long-range plan. Use the version selectors below to compare forecasts over
              time.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="caption text-muted">Compare to:</span>
            <select
              className="input-cell !font-sans"
              value={compareToVersionId ?? ""}
              onChange={(e) => setCompareToVersionId(e.target.value || null)}
            >
              <option value="">— auto (most recent saved, or seed) —</option>
              <option value="__seed__">v0 · Initial seed (baseline)</option>
              {versionHistory.map((v) => (
                <option key={v.id} value={v.id}>v{v.version} · {v.label}</option>
              ))}
            </select>
            <span className="caption text-muted">View through:</span>
            <select
              className="input-cell !font-sans"
              value={viewThroughYear}
              onChange={(e) => setViewThroughYear(parseInt(e.target.value))}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={() => alert("Export Review (PPT) is wired in production. The deck includes one slide per section + summary.")}
              className="btn-ghost flex items-center gap-1"
            >
              <Download size={14} /> Export Review (PPT)
            </button>
            <Link href="/lrp" className="btn-ghost">← Back to Authoring</Link>
          </div>
        </div>

        <section id="trajectory">
          <NetSalesTrajectory viewThroughYear={viewThroughYear} versions={versions} compareToVersionId={compareToVersionId} />
        </section>
        <section id="waterfall">
          <VarianceWaterfall
            year={waterfallYear}
            onYearChange={setWaterfallYear}
            compareToVersionId={compareToVersionId}
          />
        </section>
        <section id="evolution">
          <ForecastEvolution viewThroughYear={viewThroughYear} />
        </section>
        <section id="sensitivity">
          <DriverSensitivity targetYear={2030} />
        </section>
        <section id="peak">
          <PeakYearAnalysis viewThroughYear={viewThroughYear} />
        </section>
        <section id="geo">
          <GeographicDecomposition viewThroughYear={viewThroughYear} />
        </section>
        <section id="cone">
          <ConfidenceCone viewThroughYear={viewThroughYear} />
        </section>
        <section id="events">
          <MarketEventSensitivity />
        </section>
      </div>
    </div>
  );
}
