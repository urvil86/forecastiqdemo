"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { formatUsdShort } from "@/lib/format";

export function LaunchReadinessTab() {
  const forecast = useStore((s) => s.forecast);
  const cfg = forecast.lifecycleContext?.preLaunchConfig;
  const computed = useStore((s) => s.computed);

  const [msl, setMsl] = useState(cfg?.tacticalInputs.msldDeploymentMonths ?? 9);
  const [dtc, setDtc] = useState(cfg?.tacticalInputs.dtcBuildSpend ?? 0);
  const [tier, setTier] = useState(cfg?.tacticalInputs.formularyTier ?? "unknown");
  const [slope, setSlope] = useState(1.0);
  const [peakShare, setPeakShare] = useState(0.16);

  if (!cfg) {
    return (
      <div className="p-8 text-sm text-muted">
        Launch Readiness is only available in Pre-launch mode.
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="font-heading text-h2 text-secondary">Launch Readiness</h1>
        <p className="text-sm text-muted mt-1">
          Pre-launch tactical inputs and competitive launch comparison · {forecast.brand}
        </p>
      </div>

      <section>
        <h3 className="font-heading text-h3 text-secondary mb-2">1. Pre-launch Tactical Inputs</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="MSL deployment (months pre-launch)">
            <input
              type="number"
              value={msl}
              onChange={(e) => setMsl(parseInt(e.target.value, 10) || 0)}
              className="input-cell w-full"
            />
          </Field>
          <Field label="DTC build spend ($)">
            <input
              type="number"
              value={dtc}
              onChange={(e) => setDtc(parseInt(e.target.value, 10) || 0)}
              className="input-cell w-full"
            />
          </Field>
          <Field label="Formulary tier">
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as typeof tier)}
              className="input-cell w-full"
            >
              <option value="preferred">Preferred</option>
              <option value="covered">Covered</option>
              <option value="pa-required">PA required</option>
              <option value="unknown">Unknown</option>
            </select>
          </Field>
        </div>
      </section>

      <section>
        <h3 className="font-heading text-h3 text-secondary mb-2">2. Launch Curve Sensitivity</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={`Slope of ramp (${slope.toFixed(2)}×)`}>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={slope}
              onChange={(e) => setSlope(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>
          <Field label={`Peak share (${(peakShare * 100).toFixed(0)}%)`}>
            <input
              type="range"
              min={0.05}
              max={0.3}
              step={0.01}
              value={peakShare}
              onChange={(e) => setPeakShare(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>
          <Field label="Time to peak (years)">
            <input type="number" defaultValue={5} className="input-cell w-full" />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="font-heading text-h3 text-secondary mb-2">3. Competitor Launch Comparison</h3>
        <p className="text-xs text-muted mb-3">
          Projected {forecast.brand} curve overlaid against weighted analog launches.
        </p>
        <div className="card">
          <AnalogOverlay analogs={cfg.analogs.map((a) => a.analogBrand)} computed={computed} />
        </div>
      </section>

      <section>
        <h3 className="font-heading text-h3 text-secondary mb-2">4. Pre-launch Milestone Tracker</h3>
        <ol className="space-y-2 text-sm">
          {cfg.posModel.milestoneProbabilities.map((m, idx) => (
            <li key={m.milestone} className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                {idx + 1}
              </span>
              <div className="flex-1">
                <div className="font-semibold">{m.milestone}</div>
                <div className="text-xs text-muted">
                  {new Date(m.expectedDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                </div>
              </div>
              <div className="text-sm font-mono">{(m.probability * 100).toFixed(0)}%</div>
            </li>
          ))}
        </ol>
        <div className="mt-3 text-xs">
          Cumulative approval probability:{" "}
          <span className="text-primary font-bold">
            {(cfg.posModel.cumulativeApprovalProbability * 100).toFixed(0)}%
          </span>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-muted mb-1">{label}</div>
      {children}
    </div>
  );
}

function AnalogOverlay({
  analogs,
  computed,
}: {
  analogs: string[];
  computed: ReturnType<typeof useStore.getState>["computed"];
}) {
  if (!computed) return null;
  const series = computed.annual.slice(0, 10);
  const max = Math.max(...series.map((a) => a.netSales), 1);

  return (
    <div className="space-y-1.5 text-xs">
      {series.map((a) => (
        <div key={a.year} className="flex items-center gap-2">
          <div className="w-12 font-mono">{a.year}</div>
          <div className="flex-1 h-4 bg-background rounded relative">
            <div
              className="h-full bg-primary/40 rounded"
              style={{ width: `${(a.netSales / max) * 100}%` }}
            />
            <span className="absolute inset-0 flex items-center px-2 font-semibold">
              {formatUsdShort(a.netSales)}
            </span>
          </div>
        </div>
      ))}
      <div className="text-[10px] text-muted pt-2 border-t border-border">
        Analog blend: {analogs.join(" / ")}
      </div>
    </div>
  );
}
