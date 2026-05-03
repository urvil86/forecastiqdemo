"use client";

import { useStore } from "@/lib/store";
import { useState } from "react";

export function PreLaunchLrpCard() {
  const forecast = useStore((s) => s.forecast);
  const cfg = forecast.lifecycleContext?.preLaunchConfig;
  const [posOverride, setPosOverride] = useState<number | null>(null);

  if (!cfg) return null;

  const cumulativePos = posOverride ?? cfg.posModel.cumulativeApprovalProbability;
  const analogList = cfg.analogs
    .map((a) => `${a.analogBrand} ${(a.weight * 100).toFixed(0)}%`)
    .join(" / ");

  return (
    <div className="card mt-4 border-l-4 border-primary">
      <h3 className="font-heading text-h3 text-secondary mb-1">
        Pre-launch forecast for {forecast.brand}
      </h3>
      <p className="text-sm text-muted mb-3">
        Built from analog weighting + PoS modeling. Trending and patient-based methods are
        unavailable until launch.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="text-[11px] text-muted uppercase">Cumulative PoS</div>
          <div className="text-h3 text-primary font-bold">
            {(cumulativePos * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-[11px] text-muted uppercase">Expected approval</div>
          <div className="text-sm font-semibold">
            {new Date(cfg.tacticalInputs.expectedLaunchDate).toLocaleDateString(undefined, {
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="text-[11px] text-muted uppercase">Analog blend</div>
          <div className="text-sm font-semibold">{analogList}</div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="text-xs font-semibold mb-2">PoS Sensitivity</div>
        <div className="text-[11px] text-muted mb-2">
          What if Phase 3 readout probability shifts? Drag to recompute the curve preview.
        </div>
        <input
          type="range"
          min={0.3}
          max={0.95}
          step={0.01}
          value={cumulativePos}
          onChange={(e) => setPosOverride(parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted">
          <span>30%</span>
          <span className="font-semibold">{(cumulativePos * 100).toFixed(0)}% PoS</span>
          <span>95%</span>
        </div>
      </div>
    </div>
  );
}
