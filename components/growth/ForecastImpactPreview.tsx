"use client";

import { useStore } from "@/lib/store";
import type { AllocationResult } from "@/lib/growth-intel";
import { formatUsdShort } from "@/lib/format";
import { useState } from "react";

export function ForecastImpactPreview({
  result,
  forecastYear,
  timelineWeeks,
}: {
  result: AllocationResult | null;
  forecastYear: number;
  timelineWeeks: number;
}) {
  const computed = useStore((s) => s.computed);
  const [tab, setTab] = useState<"forecast" | "pl" | "lrp">("forecast");

  const baseline = computed?.annual.find((a) => a.year === forecastYear)?.netSales ?? 0;
  const lift = result?.summary.totalExpectedImpactUsdMid ?? 0;
  const investment = result?.summary.totalAllocatedUsd ?? 0;

  // Approximate scaled to timeline window
  const baselineWindow = baseline * (timelineWeeks / 52);
  const withPlanWindow = baselineWindow + lift;

  return (
    <div className="card sticky top-44">
      <h3 className="font-heading text-h3 text-secondary mb-2">Forecast Impact Preview</h3>
      <p className="text-xs text-muted mb-3">
        Live comparison of baseline vs. with-plan over the next {timelineWeeks} weeks.
      </p>

      {/* Mini chart */}
      <div className="space-y-2 mb-4">
        <Bar label="Baseline" value={baselineWindow} max={Math.max(baselineWindow, withPlanWindow)} color="bg-secondary/40" />
        <Bar label="With Plan" value={withPlanWindow} max={Math.max(baselineWindow, withPlanWindow)} color="bg-primary" />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs mb-4">
        <Stat label="Baseline" value={formatUsdShort(baselineWindow)} />
        <Stat label="With Plan" value={formatUsdShort(withPlanWindow)} accent />
        <Stat
          label="Lift"
          value={`+${formatUsdShort(lift)}`}
          accent
        />
      </div>

      <div className="flex border-b border-border text-xs">
        <TabBtn active={tab === "forecast"} onClick={() => setTab("forecast")}>Forecast Impact</TabBtn>
        <TabBtn active={tab === "pl"} onClick={() => setTab("pl")}>P&L Impact</TabBtn>
        <TabBtn active={tab === "lrp"} onClick={() => setTab("lrp")}>LRP Rollup</TabBtn>
      </div>

      <div className="text-xs mt-3">
        {tab === "forecast" && (
          <div className="space-y-1.5">
            {(result?.allocations ?? [])
              .filter((a) => a.investmentUsd > 0)
              .slice(0, 6)
              .map((a) => (
                <div key={a.leverId} className="flex items-center justify-between">
                  <span className="text-muted truncate pr-2">{a.leverId}</span>
                  <span className="font-mono">+{formatUsdShort(a.expectedImpactUsd ?? 0)}</span>
                </div>
              ))}
            {!result && <div className="text-muted">Run optimizer to see per-lever waterfall.</div>}
          </div>
        )}
        {tab === "pl" && (
          <table className="w-full">
            <tbody>
              <PRow label="Gross Revenue" baseline={baselineWindow / 0.6} delta={lift / 0.6} />
              <PRow label="Trade Discount" baseline={-(baselineWindow / 0.6) * 0.4} delta={-(lift / 0.6) * 0.4} negative />
              <PRow label="Net Revenue" baseline={baselineWindow} delta={lift} />
              <PRow label="COGS" baseline={-baselineWindow * 0.15} delta={-lift * 0.15} negative />
              <PRow label="Gross Profit" baseline={baselineWindow * 0.85} delta={lift * 0.85} />
              <PRow label="Investment Cost" baseline={0} delta={-investment} negative />
              <PRow
                label="Operating Profit"
                baseline={baselineWindow * 0.85}
                delta={lift * 0.85 - investment}
                bold
              />
            </tbody>
          </table>
        )}
        {tab === "lrp" && (
          <table className="w-full">
            <thead className="text-[10px] uppercase text-muted">
              <tr>
                <th className="text-left py-1">Year</th>
                <th className="text-right py-1">Baseline</th>
                <th className="text-right py-1">With Plan</th>
                <th className="text-right py-1">Δ</th>
              </tr>
            </thead>
            <tbody>
              {(computed?.annual ?? [])
                .filter((a) => a.year >= forecastYear && a.year <= forecastYear + 2)
                .map((a) => {
                  const decay = Math.max(0.2, 1 - (a.year - forecastYear) * 0.4);
                  const yearLift = lift * decay;
                  return (
                    <tr key={a.year} className="border-t border-border">
                      <td className="py-1 font-mono">{a.year}</td>
                      <td className="py-1 text-right">{formatUsdShort(a.netSales)}</td>
                      <td className="py-1 text-right">{formatUsdShort(a.netSales + yearLift)}</td>
                      <td className="py-1 text-right text-success font-mono">
                        +{formatUsdShort(yearLift)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = (value / Math.max(max, 1)) * 100;
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-20 text-muted">{label}</div>
      <div className="flex-1 h-5 bg-background rounded relative">
        <div className={`h-full rounded ${color}`} style={{ width: `${pct}%` }} />
        <span className="absolute inset-0 flex items-center px-2 font-semibold">
          {formatUsdShort(value)}
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={"p-2 rounded border " + (accent ? "border-primary/40 bg-primary/5" : "border-border bg-background")}>
      <div className="text-[10px] text-muted">{label}</div>
      <div className={"font-bold " + (accent ? "text-primary" : "")}>{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "px-3 py-1.5 -mb-px border-b-2 " +
        (active ? "border-primary text-secondary font-semibold" : "border-transparent text-muted hover:text-secondary")
      }
    >
      {children}
    </button>
  );
}

function PRow({
  label,
  baseline,
  delta,
  negative,
  bold,
}: {
  label: string;
  baseline: number;
  delta: number;
  negative?: boolean;
  bold?: boolean;
}) {
  return (
    <tr className={"border-t border-border " + (bold ? "font-semibold" : "")}>
      <td className="py-1">{label}</td>
      <td className="py-1 text-right text-muted">{formatUsdShort(baseline)}</td>
      <td className="py-1 text-right">{formatUsdShort(baseline + delta)}</td>
      <td className={"py-1 text-right font-mono " + (delta < 0 ? "text-danger" : "text-success")}>
        {delta >= 0 ? "+" : ""}
        {formatUsdShort(delta)}
      </td>
    </tr>
  );
}
