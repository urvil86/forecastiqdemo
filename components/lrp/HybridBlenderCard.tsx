"use client";

import { useStore } from "@/lib/store";

export function HybridBlenderCard() {
  const forecast = useStore((s) => s.forecast);
  const updateLRPInput = useStore((s) => s.updateLRPInput);
  const cfg = forecast.lifecycleContext?.exclusivityConfig;
  const sc = cfg?.scReformulationConfig;

  if (!cfg || !sc) return null;

  const analog = cfg.blenderWeights.analogWeight;
  const trend = cfg.blenderWeights.trendWeight;

  function setAnalog(value: number) {
    const clamped = Math.max(0, Math.min(1, value));
    // Update lifecycleContext.exclusivityConfig.blenderWeights via store path
    useStore.setState((s) => ({
      forecast: {
        ...s.forecast,
        lifecycleContext: {
          ...s.forecast.lifecycleContext,
          exclusivityConfig: {
            ...s.forecast.lifecycleContext.exclusivityConfig!,
            blenderWeights: { analogWeight: clamped, trendWeight: 1 - clamped },
          },
        },
      },
    }));
    // recompute is not auto-triggered here; nudge via a noop updateLRPInput
    updateLRPInput("__blendNudge", Date.now());
  }

  return (
    <div className="card mt-4 border-l-4 border-primary">
      <h3 className="font-heading text-h3 text-secondary mb-1">
        Hybrid Forecast — Trend ({(trend * 100).toFixed(0)}%) + IV-to-SC Conversion Analogs ({(analog * 100).toFixed(0)}%)
      </h3>
      <p className="text-sm text-muted mb-3">
        {cfg.monthsOfHistory} months of post-launch history · Target conversion {(sc.targetConversionRate * 100).toFixed(0)}% in {sc.conversionCurveYears}y
      </p>

      <div className="mb-3">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={analog}
          onChange={(e) => setAnalog(parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted">
          <span>100% Trend</span>
          <span>50/50</span>
          <span>100% Analog</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        {sc.conversionAnalogs.map((a) => (
          <div key={a} className="p-2 rounded bg-background border border-border">
            <div className="font-semibold">{a}</div>
            <div className="text-muted text-[11px]">SC reformulation analog</div>
          </div>
        ))}
      </div>
    </div>
  );
}
