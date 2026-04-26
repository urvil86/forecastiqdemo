"use client";

import { useStore } from "@/lib/store";
import { formatUsdShort } from "@/lib/format";

const BRAND_OPTIONS = [
  { id: "Ocrevus", label: "Ocrevus", available: true },
  { id: "Zunovo", label: "Zunovo", available: false },
  { id: "Fenebrutinib", label: "Fenebrutinib", available: false },
];

export function GrowthHeader({
  forecastYear,
  baselineRevenue,
  onLoadDemo,
  onYearChange,
  timelineWeeks,
  onTimelineChange,
}: {
  forecastYear: number;
  baselineRevenue: number;
  onLoadDemo: () => void;
  onYearChange: (y: number) => void;
  timelineWeeks: number;
  onTimelineChange: (w: number) => void;
}) {
  const forecast = useStore((s) => s.forecast);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[280px]">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-heading text-h2 text-secondary leading-tight">Growth Intelligence</h1>
            <BrandSelect currentBrand={forecast.brand} />
          </div>
          <p className="text-sm text-muted mt-2 max-w-3xl">
            Set a budget and let the optimizer recommend the allocation, or drag the per-lever sliders yourself — the resulting
            forecast lift updates either way. Elasticity calibrations come from industry benchmarks (ZS Associates, IQVIA, Komodo,
            Nielsen). Levers: field force expansion / reallocation, sample reallocation, patient services capacity, DTC, account
            targeting.
          </p>
        </div>
        <button onClick={onLoadDemo} className="btn-ghost">
          Load Demo Scenario
        </button>
      </div>

      <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 py-3">
        <div className="flex items-center gap-2">
          <span className="caption text-muted">Forecast year</span>
          <select
            className="input-cell !font-sans"
            value={forecastYear}
            onChange={(e) => onYearChange(parseInt(e.target.value))}
          >
            {[2026, 2027, 2028, 2029, 2030].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="text-xs text-muted">
            baseline <span className="font-mono text-foreground">{formatUsdShort(baselineRevenue)}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="caption text-muted">Timeline</span>
          <input
            type="range"
            min={4}
            max={52}
            step={4}
            value={timelineWeeks}
            onChange={(e) => onTimelineChange(parseInt(e.target.value))}
            className="accent-primary w-32"
          />
          <span className="font-mono text-xs">
            {timelineWeeks}w ({(timelineWeeks / 4.345).toFixed(1)}mo)
          </span>
        </div>
      </div>
    </div>
  );
}

function BrandSelect({ currentBrand }: { currentBrand: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="caption text-muted">Brand</span>
      <select
        value={currentBrand}
        onChange={() => {
          // Placeholder — multi-brand support is built into the data model
          // (forecast.brand is a typed enum), but only Ocrevus is wired in this build.
        }}
        className="input-cell !font-sans"
        title="Multi-brand support is in the data model; production build adds the other brands here."
      >
        {BRAND_OPTIONS.map((b) => (
          <option key={b.id} value={b.id} disabled={!b.available}>
            {b.label}
            {!b.available ? " — available in production" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
