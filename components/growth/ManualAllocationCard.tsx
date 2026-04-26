"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { LEVERS, elasticityImpactPct, type LeverId } from "@/lib/growth-intel";
import { formatUsdShort, formatPct } from "@/lib/format";

export interface ManualFormState {
  forecastYear: number;
  timelineWeeks: number;
  perLeverInvestmentUsd: Record<LeverId, number>;
}

export const DEFAULT_MANUAL_FORM: ManualFormState = {
  forecastYear: 2027,
  timelineWeeks: 52,
  perLeverInvestmentUsd: {
    "field-force-expansion": 0,
    "field-force-reallocation": 0,
    "sample-allocation": 0,
    "patient-services-capacity": 0,
    "dtc-spend": 0,
    "account-targeting": 0,
  },
};

const STEP = 100_000; // $0.1M slider granularity

export function ManualAllocationCard({
  form,
  setForm,
  onRun,
  isComputing,
}: {
  form: ManualFormState;
  setForm: (f: ManualFormState) => void;
  onRun: () => void;
  isComputing: boolean;
}) {
  const computed = useStore((s) => s.computed);
  const baseline = computed?.annual.find((a) => a.year === form.forecastYear)?.netSales ?? 0;

  const totalSpend = useMemo(
    () =>
      LEVERS.reduce((s, l) => s + (form.perLeverInvestmentUsd[l.id] ?? 0), 0),
    [form.perLeverInvestmentUsd]
  );

  const livePreview = useMemo(() => {
    if (baseline === 0) return { mid: 0, low: 0, high: 0, byLever: {} as Record<LeverId, number> };
    let mid = 0;
    const byLever: Record<string, number> = {};
    for (const lever of LEVERS) {
      const inv = form.perLeverInvestmentUsd[lever.id] ?? 0;
      if (inv <= 0) {
        byLever[lever.id] = 0;
        continue;
      }
      const intensity = Math.min(lever.maxIntensity, inv / lever.unitCostUsd);
      const impact = elasticityImpactPct(lever, intensity) * baseline;
      mid += impact;
      byLever[lever.id] = impact;
    }
    return { mid, low: mid * 0.65, high: mid * 1.4, byLever };
  }, [form.perLeverInvestmentUsd, baseline]);

  function setLever(id: LeverId, value: number) {
    setForm({
      ...form,
      perLeverInvestmentUsd: { ...form.perLeverInvestmentUsd, [id]: value },
    });
  }

  function clearAll() {
    setForm({ ...form, perLeverInvestmentUsd: { ...DEFAULT_MANUAL_FORM.perLeverInvestmentUsd } });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
          <div>
            <h3 className="font-heading text-h3 text-secondary">Step 2 — Allocate per lever</h3>
            <p className="text-xs text-muted mt-1">
              Drag any slider to set or override the per-lever investment. Live preview updates instantly. Use{" "}
              <strong>Optimize</strong> above to fill these from the engine, or set them yourself. Click <strong>Compute Impact</strong>{" "}
              to lock in this allocation as a result with full rationale and breakdowns.
            </p>
          </div>
          <div className="text-right">
            <div className="caption text-muted">Live forecast impact</div>
            <div className="font-heading text-h3 text-success">+{formatUsdShort(livePreview.mid)}</div>
            <div className="text-[11px] text-muted">
              range {formatUsdShort(livePreview.low)} – {formatUsdShort(livePreview.high)} · on{" "}
              {formatUsdShort(baseline)} {form.forecastYear} baseline
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {LEVERS.map((lever) => {
            const max = lever.maxIntensity * lever.unitCostUsd;
            const current = form.perLeverInvestmentUsd[lever.id] ?? 0;
            const intensity = Math.min(lever.maxIntensity, current / lever.unitCostUsd);
            const liftPct = elasticityImpactPct(lever, intensity);
            const liftUsd = livePreview.byLever[lever.id] ?? 0;
            return (
              <div key={lever.id} className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-3 items-center border-b border-border pb-3 last:border-0">
                <div>
                  <div className="font-semibold text-sm">{lever.displayName}</div>
                  <div className="text-[11px] text-muted">
                    {lever.elasticityShape} · {lever.riskScore} risk · max {formatUsdShort(max)}
                  </div>
                </div>
                <div>
                  <input
                    type="range"
                    min={0}
                    max={max}
                    step={STEP}
                    value={current}
                    onChange={(e) => setLever(lever.id, parseInt(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted">
                    <span>$0</span>
                    <span>{formatUsdShort(max / 2)}</span>
                    <span>{formatUsdShort(max)}</span>
                  </div>
                </div>
                <div className="text-right text-xs min-w-[110px]">
                  <div>
                    <span className="font-mono font-semibold">{formatUsdShort(current)}</span>
                  </div>
                  <div className="text-success font-mono">
                    {current > 0 ? `+${formatPct(liftPct)} = +${formatUsdShort(liftUsd)}` : "—"}
                  </div>
                  <div className="text-muted">
                    {current > 0 ? `${intensity.toFixed(1)} ${lever.unitOfInvestment.split(" ")[0]}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <div>
            <div className="caption text-muted">Total investment</div>
            <div className="font-heading text-h3 text-secondary">{formatUsdShort(totalSpend)}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={clearAll} className="btn-ghost">
              Clear all
            </button>
            <button onClick={onRun} disabled={isComputing || totalSpend <= 0} className="btn-secondary disabled:opacity-50">
              {isComputing ? "Computing…" : "Compute Impact"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
