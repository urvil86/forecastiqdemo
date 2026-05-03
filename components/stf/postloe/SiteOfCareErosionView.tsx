"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

const HORIZON_YEARS = 7;

export function SiteOfCareErosionView() {
  const forecast = useStore((s) => s.forecast);
  const cfg = forecast.lifecycleContext?.postLoeConfig?.siteOfCareErosion;
  const [yearOffset, setYearOffset] = useState(0);

  if (!cfg) return null;

  const segments = cfg.sourceOfCareSegments;
  // Project segment shares by year (clamped at 0)
  const projection = Array.from({ length: HORIZON_YEARS + 1 }, (_, y) => {
    const shares = segments.map((s) => Math.max(0, s.currentSharePct + s.erosionRatePerYear * y));
    const total = shares.reduce((a, b) => a + b, 0) || 1;
    return shares.map((s) => s / total);
  });

  const colors = ["#C98B27", "#004466", "#3B82C4", "#1F8A5C", "#E5A04B"];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-heading text-h3 text-secondary">Site-of-Care Erosion</h3>
          <p className="text-xs text-muted">
            Year T+{yearOffset} projection. Drag the slider to fast-forward.
          </p>
        </div>
        <input
          type="range"
          min={0}
          max={HORIZON_YEARS}
          step={1}
          value={yearOffset}
          onChange={(e) => setYearOffset(parseInt(e.target.value, 10))}
          className="w-64 accent-primary"
        />
      </div>

      {/* Stacked horizontal bar by year */}
      <div className="space-y-2 mb-6">
        {projection.map((shares, y) => (
          <div key={y} className="flex items-center gap-2">
            <div className="w-12 text-xs text-muted text-right">T+{y}</div>
            <div className="flex-1 h-6 flex bg-background rounded overflow-hidden border border-border">
              {shares.map((s, i) => (
                <div
                  key={i}
                  className="h-full"
                  style={{ width: `${s * 100}%`, backgroundColor: colors[i % colors.length] }}
                  title={`${segments[i].segmentName} ${(s * 100).toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="w-12 text-[10px] text-muted">
              {(shares.reduce((a, b) => a + b, 0) * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>

      {/* Legend + editable rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {segments.map((s, i) => (
          <div key={s.segmentName} className="card p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span
                className="inline-block w-3 h-3 rounded"
                style={{ backgroundColor: colors[i % colors.length] }}
              />
              {s.segmentName}
            </div>
            <div className="text-xs text-muted mt-1">
              Current share: {(s.currentSharePct * 100).toFixed(1)}% · erosion {(s.erosionRatePerYear * 100).toFixed(1)}%/yr
              {s.destinationSegment ? ` → ${s.destinationSegment}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
