"use client";

import { useState } from "react";
import type { AllocationResult } from "@/lib/growth-intel";
import { formatUsdShort } from "@/lib/format";

export function TradeoffAnalysisSection({
  form,
  result,
  onSimulate,
}: {
  form: { budgetUsd: number; forecastYear: number; timelineWeeks: number };
  result: AllocationResult | null;
  onSimulate: (budget: number) => Promise<void>;
}) {
  const [altBudget, setAltBudget] = useState(form.budgetUsd / 2);
  const recLift = result?.summary.totalExpectedImpactUsdMid ?? 0;
  // Approx: alternative gets ~60% of lift at 50% of cost (diminishing returns)
  const altLift = recLift * 0.6 * (altBudget / Math.max(1, form.budgetUsd));
  const altRoi = altBudget > 0 ? altLift / altBudget : 0;
  const recRoi = form.budgetUsd > 0 ? recLift / form.budgetUsd : 0;

  return (
    <section>
      <h3 className="font-heading text-h3 text-secondary mb-1">Trade-off Analysis for Finance Conversation</h3>
      <p className="text-xs text-muted mb-4">
        Compare the recommended plan against a smaller-budget alternative. Drag the slider to explore
        diminishing-returns trade-offs.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Baseline (no investment)" investment={0} lift={0} payback="—" roi={0} risk="Low" levers={[]} />
        <Card
          title="Recommended Plan"
          investment={form.budgetUsd}
          lift={recLift}
          payback={result ? "8–12 wks" : "—"}
          roi={recRoi}
          risk="Medium"
          levers={(result?.allocations ?? [])
            .filter((a) => a.investmentUsd > 0)
            .slice(0, 3)
            .map((a) => a.leverId)}
          accent
        />
        <Card
          title="Alternative Plan"
          investment={altBudget}
          lift={altLift}
          payback={altLift > 0 ? "10–14 wks" : "—"}
          roi={altRoi}
          risk="Lower"
          levers={(result?.allocations ?? [])
            .filter((a) => a.investmentUsd > 0)
            .slice(0, 2)
            .map((a) => a.leverId)}
          slider={
            <div className="mt-2">
              <input
                type="range"
                min={1_000_000}
                max={form.budgetUsd}
                step={500_000}
                value={altBudget}
                onChange={(e) => setAltBudget(parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
              <div className="text-[10px] text-muted text-right">
                ${(altBudget / 1e6).toFixed(1)}M
              </div>
              <button
                className="btn-ghost text-[11px] mt-1"
                onClick={() => onSimulate(altBudget)}
              >
                Re-run optimizer at {formatUsdShort(altBudget)}
              </button>
            </div>
          }
        />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button className="btn-secondary text-xs">Send to Finance</button>
        <button className="btn-ghost text-xs">Save as Scenario</button>
        <button className="btn-ghost text-xs">Push to STF</button>
      </div>
    </section>
  );
}

function Card({
  title,
  investment,
  lift,
  payback,
  roi,
  risk,
  levers,
  slider,
  accent,
}: {
  title: string;
  investment: number;
  lift: number;
  payback: string;
  roi: number;
  risk: string;
  levers: string[];
  slider?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={"card " + (accent ? "border-l-4 border-primary" : "")}>
      <h4 className="font-heading text-h4 text-secondary mb-2">{title}</h4>
      <div className="space-y-1 text-xs">
        <Row label="Total investment" value={investment === 0 ? "—" : formatUsdShort(investment)} />
        <Row label="Projected lift" value={lift === 0 ? "—" : `+${formatUsdShort(lift)}`} accent={accent} />
        <Row label="Payback" value={payback} />
        <Row label="ROI" value={roi === 0 ? "—" : `${(roi * 100).toFixed(0)}%`} />
        <Row label="Risk" value={risk} />
      </div>
      {levers.length > 0 && (
        <div className="mt-3 text-[10px] text-muted">
          Top levers: <span className="font-mono">{levers.join(", ")}</span>
        </div>
      )}
      {slider}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className={"font-semibold " + (accent ? "text-primary" : "")}>{value}</span>
    </div>
  );
}
