"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import type { AllocationResult, LeverAllocation } from "@/lib/growth-intel";
import { LEVERS, getLever, elasticityCurve } from "@/lib/growth-intel";
import { formatUsdShort, formatPct, classNames } from "@/lib/format";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  LineChart,
  Line,
} from "recharts";
import { AlertTriangle, Sparkles, Save, RotateCcw, Bookmark, Calculator } from "lucide-react";
import { CalculationBreakdownPanel } from "./CalculationBreakdownPanel";
import type { CalculationBreakdown, LeverId } from "@/lib/growth-intel";

const CATEGORY_COLOR: Record<string, string> = {
  "commercial-investment": "#004466",
  "commercial-optimization": "#C98B27",
  "operations-investment": "#1F8A5C",
};

export function GrowthResults({
  result,
  stale,
  onRerun,
  onReset,
}: {
  result: AllocationResult;
  stale: boolean;
  onRerun: () => void;
  onReset: () => void;
}) {
  const [openBreakdown, setOpenBreakdown] = useState<LeverId | null>(null);
  const pushAllocationToScenario = useStore((s) => s.pushAllocationToScenario);
  const router = useRouter();

  const breakdownByLever = new Map<LeverId, CalculationBreakdown>();
  for (const bd of result.breakdowns ?? []) breakdownByLever.set(bd.leverId, bd);
  const activeBreakdown = openBreakdown ? breakdownByLever.get(openBreakdown) ?? null : null;

  const display: AllocationResult = result;

  function saveAsScenario() {
    const id = pushAllocationToScenario();
    if (id) router.push("/forecast/lrp/");
  }

  return (
    <div className="space-y-6">
      {stale && (
        <div className="card bg-warning/10 border-warning text-warning text-sm flex items-center justify-between">
          <span>
            <AlertTriangle className="inline align-middle mr-2" size={16} />
            Inputs changed. Click <strong>Optimize</strong> to refresh.
          </span>
          <button onClick={onRerun} className="btn-secondary !py-1 !px-3 text-xs">
            Re-run
          </button>
        </div>
      )}

      <PortfolioHeadline result={display} />
      <AllocationBreakdown result={display} onOpenBreakdown={setOpenBreakdown} hasBreakdowns={breakdownByLever.size > 0} />
      <RationaleSection result={display} />
      <ElasticityVisualizations result={display} onOpenBreakdown={setOpenBreakdown} hasBreakdowns={breakdownByLever.size > 0} />
      <BudgetSensitivity result={result} />

      {activeBreakdown && (
        <CalculationBreakdownPanel breakdown={activeBreakdown} onClose={() => setOpenBreakdown(null)} />
      )}

      <div className="card flex flex-wrap gap-2 items-center">
        <button onClick={saveAsScenario} className="btn-secondary flex items-center gap-1">
          <Bookmark size={14} /> Save as Scenario in LRP
        </button>
        <button onClick={() => alert("Export Plan would generate an exec-ready brief in production. Not wired in demo.")} className="btn-ghost flex items-center gap-1">
          <Save size={14} /> Export Plan (PPT)
        </button>
        <button onClick={onReset} className="btn-ghost flex items-center gap-1 ml-auto">
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </div>
  );
}

function PortfolioHeadline({ result }: { result: AllocationResult }) {
  const s = result.summary;
  const annual = result.request.computed.annual.find((a) => a.year === result.request.forecastYear);
  const baseline = annual?.netSales ?? 0;
  const adjusted = baseline + s.totalExpectedImpactUsdMid;
  return (
    <div className="card">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
        <div>
          <div className="caption text-muted">Total Investment</div>
          <div className="font-heading text-h2 text-secondary">{formatUsdShort(s.totalAllocatedUsd)}</div>
        </div>
        <div>
          <div className="caption text-muted">Expected Lift</div>
          <div className="font-heading text-h2 text-primary">{formatUsdShort(s.totalExpectedImpactUsdMid)}</div>
          <div className="text-xs text-muted">
            range {formatUsdShort(s.totalExpectedImpactUsdLow)} – {formatUsdShort(s.totalExpectedImpactUsdHigh)}
          </div>
        </div>
        <div>
          <div className="caption text-muted">Confidence</div>
          <div className="font-heading text-h2 text-secondary">{formatPct(s.portfolioConfidence, 0)}</div>
        </div>
      </div>

      {/* Baseline → Adjusted forecast comparison: concrete proof the engine moved the forecast */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-5 text-center bg-background rounded-md p-3">
        <div>
          <div className="caption text-muted">{result.request.forecastYear} forecast — baseline</div>
          <div className="font-mono text-h4 text-secondary">{formatUsdShort(baseline)}</div>
        </div>
        <div className="self-center text-muted text-h4">→</div>
        <div>
          <div className="caption text-muted">After this allocation</div>
          <div className="font-mono text-h4 text-success">{formatUsdShort(adjusted)}</div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <span className="inline-block px-4 py-2 rounded-full font-semibold bg-primary text-white">
          {s.portfolioROI.toFixed(1)}× ROI · Payback in {s.paybackWeeks} weeks
        </span>
      </div>
      <p className="font-heading text-h4 text-foreground text-center mt-4 leading-snug max-w-4xl mx-auto">
        {result.rationale.headline}
      </p>
    </div>
  );
}

function AllocationBreakdown({
  result,
  onOpenBreakdown,
  hasBreakdowns,
}: {
  result: AllocationResult;
  onOpenBreakdown: (id: LeverId) => void;
  hasBreakdowns: boolean;
}) {
  const total = result.summary.totalAllocatedUsd || 1;
  return (
    <div className="card">
      <h3 className="font-heading text-h3 text-secondary mb-2">Allocation Breakdown</h3>
      <div className="flex w-full h-10 rounded overflow-hidden border border-border mb-3">
        {result.allocations.map((a) => {
          const lever = getLever(a.leverId);
          if (!lever) return null;
          const widthPct = (a.investmentUsd / total) * 100;
          const color = CATEGORY_COLOR[lever.category];
          return (
            <div
              key={a.leverId}
              className="flex items-center justify-center text-white text-[11px] font-semibold whitespace-nowrap overflow-hidden"
              style={{ width: `${widthPct}%`, background: color }}
              title={`${lever.displayName}: ${formatUsdShort(a.investmentUsd)}`}
            >
              {widthPct >= 8 ? `${lever.displayName.split(" ")[0]} ${formatUsdShort(a.investmentUsd)}` : ""}
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[860px]">
          <thead>
            <tr>
              <th>Lever</th>
              <th>Investment</th>
              <th>Intensity</th>
              <th>Expected Impact</th>
              <th>Range</th>
              <th>Confidence</th>
              <th>Ramp</th>
              {hasBreakdowns && <th></th>}
            </tr>
          </thead>
          <tbody>
            {result.allocations.map((a) => (
              <AllocationRow
                key={a.leverId}
                alloc={a}
                hasBreakdowns={hasBreakdowns}
                onOpenBreakdown={() => onOpenBreakdown(a.leverId as LeverId)}
              />
            ))}
            {result.excluded.map((a) => (
              <ExcludedRow key={a.leverId} alloc={a} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AllocationRow({
  alloc,
  hasBreakdowns,
  onOpenBreakdown,
}: {
  alloc: LeverAllocation;
  hasBreakdowns: boolean;
  onOpenBreakdown: () => void;
}) {
  const lever = getLever(alloc.leverId);
  if (!lever) return null;
  return (
    <tr>
      <td className="flex items-center gap-2">
        <span
          className="inline-block w-2 h-6 rounded-sm"
          style={{ background: CATEGORY_COLOR[lever.category] }}
        />
        <div>
          <div className="font-medium">{lever.displayName}</div>
          <div className="text-[10px] text-muted">{lever.category.replace(/-/g, " ")}</div>
        </div>
      </td>
      <td className="font-mono">{formatUsdShort(alloc.investmentUsd)}</td>
      <td className="font-mono text-xs">
        {alloc.intensity.toFixed(1)} {lever.unitOfInvestment}
      </td>
      <td className="font-mono text-success">+{formatUsdShort(alloc.expectedImpactUsd)}</td>
      <td className="font-mono text-xs text-muted">
        {formatUsdShort(alloc.expectedImpactUsdLow)} – {formatUsdShort(alloc.expectedImpactUsdHigh)}
      </td>
      <td className="font-mono">{formatPct(alloc.confidenceInterval, 0)}</td>
      <td className="font-mono text-xs">{alloc.rampWeeks}w</td>
      {hasBreakdowns && (
        <td>
          <button
            onClick={onOpenBreakdown}
            className="text-primary hover:text-primary-dark text-xs flex items-center gap-1"
            title="Show how this number is calculated, end-to-end"
          >
            <Calculator size={12} /> Show calc
          </button>
        </td>
      )}
    </tr>
  );
}

function ExcludedRow({ alloc }: { alloc: LeverAllocation }) {
  const lever = getLever(alloc.leverId);
  if (!lever) return null;
  return (
    <tr className="opacity-50">
      <td>
        <div className="font-medium">{lever.displayName}</div>
        <div className="text-[10px] text-muted">{lever.category.replace(/-/g, " ")}</div>
      </td>
      <td colSpan={6} className="text-xs italic text-muted">
        {alloc.reasonExcluded}
      </td>
    </tr>
  );
}

function RationaleSection({ result }: { result: AllocationResult }) {
  const r = result.rationale;
  return (
    <div className="card">
      <h3 className="font-heading text-h3 text-secondary mb-3">Why this allocation</h3>
      <p className="text-sm leading-relaxed bg-background p-4 rounded-md mb-2">{r.reasoning}</p>
      <p className="text-[11px] text-muted mb-6">
        Generated by {r.generatedBy === "llm" ? "LLM (Anthropic Claude)" : "deterministic fallback"}
      </p>

      <h4 className="font-heading text-h4 text-secondary mb-2">Lever rationale</h4>
      <div className="space-y-2 mb-6">
        {r.leverJustifications.map((j) => {
          const lever = getLever(j.leverId);
          const alloc = result.allocations.find((a) => a.leverId === j.leverId);
          return (
            <div key={j.leverId} className="border border-border rounded-md p-3 flex items-start gap-3">
              <span
                className="inline-block w-1 h-12 rounded"
                style={{ background: lever ? CATEGORY_COLOR[lever.category] : "#999" }}
              />
              <div className="flex-1">
                <div className="font-semibold text-sm">{lever?.displayName ?? j.leverId}</div>
                <div className="text-xs text-muted mt-1">{j.justification}</div>
              </div>
              {alloc && <span className="pill bg-primary/15 text-primary self-start">{formatUsdShort(alloc.investmentUsd)}</span>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-danger/30 rounded-md p-4 bg-danger/5">
          <h4 className="font-heading text-h4 text-danger mb-2">Risks to monitor</h4>
          <ul className="space-y-1 text-sm">
            {r.risks.map((risk, i) => (
              <li key={i} className="flex gap-2">
                <AlertTriangle className="text-danger flex-shrink-0 mt-0.5" size={14} />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-info/30 rounded-md p-4 bg-info/5">
          <h4 className="font-heading text-h4 text-info mb-2">Track during execution</h4>
          <ul className="space-y-1 text-sm">
            {r.watchList.map((w, i) => (
              <li key={i} className="flex gap-2">
                <Sparkles className="text-info flex-shrink-0 mt-0.5" size={14} />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ElasticityVisualizations({
  result,
  onOpenBreakdown,
  hasBreakdowns,
}: {
  result: AllocationResult;
  onOpenBreakdown: (id: LeverId) => void;
  hasBreakdowns: boolean;
}) {
  return (
    <div className="card">
      <h3 className="font-heading text-h3 text-secondary mb-3">Elasticity Curves — what each lever looks like</h3>
      <p className="text-xs text-muted mb-4">
        Each curve is the elasticity model the optimizer is using. The vertical line shows where on the curve your allocation sits
        — close to the steep part means high marginal return; close to flat means diminishing returns.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {LEVERS.map((lever) => {
          const alloc = result.allocations.find((a) => a.leverId === lever.id);
          const intensity = alloc?.intensity ?? 0;
          const curve = elasticityCurve(lever, 32).map((p) => ({
            intensity: p.intensity,
            impactPct: p.impactPct * 100,
          }));
          return (
            <div key={lever.id} className="border border-border rounded-md p-3">
              <div className="flex items-baseline justify-between mb-1">
                <div className="text-sm font-semibold">{lever.displayName}</div>
                <span
                  className="pill text-[10px]"
                  style={{ background: `${CATEGORY_COLOR[lever.category]}20`, color: CATEGORY_COLOR[lever.category] }}
                >
                  {lever.elasticityShape}
                </span>
              </div>
              <div className="h-32">
                <ResponsiveContainer>
                  <LineChart data={curve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
                    <XAxis dataKey="intensity" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} unit="%" />
                    <Tooltip formatter={(v: number | string) => (typeof v === "number" ? `${v.toFixed(2)}%` : "—")} />
                    {alloc && intensity > 0 && (
                      <ReferenceLine x={intensity} stroke="#C98B27" strokeWidth={2} strokeDasharray="3 3" />
                    )}
                    <Line dataKey="impactPct" stroke={CATEGORY_COLOR[lever.category]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-2 text-[10px]">
                <div>
                  <div className="text-muted">Allocated</div>
                  <div className="font-mono">{alloc ? formatUsdShort(alloc.investmentUsd) : "—"}</div>
                </div>
                <div>
                  <div className="text-muted">Lift</div>
                  <div className="font-mono text-success">{alloc ? `+${formatPct(alloc.expectedImpactPct)}` : "—"}</div>
                </div>
                <div>
                  <div className="text-muted">Saturation</div>
                  <div className="font-mono">{lever.maxIntensity} {lever.unitOfInvestment.split(" ")[0]}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="text-[10px] text-muted italic">{lever.benchmarkSource.split(",")[0]}</div>
                {hasBreakdowns && alloc && (
                  <button
                    onClick={() => onOpenBreakdown(lever.id as LeverId)}
                    className="text-[10px] text-primary hover:text-primary-dark flex items-center gap-1"
                  >
                    <Calculator size={11} /> View calculation
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BudgetSensitivity({ result }: { result: AllocationResult }) {
  const data = [
    { label: "½ budget", investment: result.budgetSensitivity.halfBudget.totalInvestmentUsd, impact: result.budgetSensitivity.halfBudget.expectedImpact, current: false },
    { label: "current", investment: result.budgetSensitivity.fullBudget.totalInvestmentUsd, impact: result.budgetSensitivity.fullBudget.expectedImpact, current: true },
    { label: "2× budget", investment: result.budgetSensitivity.doubleBudget.totalInvestmentUsd, impact: result.budgetSensitivity.doubleBudget.expectedImpact, current: false },
    { label: "4× budget", investment: result.budgetSensitivity.quadrupleBudget.totalInvestmentUsd, impact: result.budgetSensitivity.quadrupleBudget.expectedImpact, current: false },
  ].map((d) => ({
    label: `${d.label}\n$${(d.investment / 1e6).toFixed(0)}M`,
    impactM: d.impact / 1e6,
    color: d.current ? "#A26F1C" : "#C98B27",
    marginal: d.investment > 0 ? d.impact / d.investment : 0,
  }));

  return (
    <div className="card">
      <h3 className="font-heading text-h3 text-secondary mb-2">Budget Sensitivity — what if you spent more or less?</h3>
      <p className="text-xs text-muted mb-3">
        Doubling the budget does not double the impact. The shape of the curve below shows how much each additional dollar buys.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(0)}M`} />
              <Tooltip formatter={(v: number | string) => (typeof v === "number" ? `$${v.toFixed(1)}M` : "—")} />
              <Bar dataKey="impactM" fill="#C98B27" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-sm space-y-2">
          {data.map((d) => (
            <div key={d.label} className={classNames("p-2 rounded border", d.color === "#A26F1C" ? "border-primary bg-primary-light/30" : "border-border")}>
              <div className="font-mono text-xs">{d.label.replace("\n", " · ")}</div>
              <div className="text-xs text-muted">
                Impact: <span className="text-success font-mono">${d.impactM.toFixed(1)}M</span>
              </div>
              <div className="text-xs text-muted">
                $/$ : <span className="font-mono">{d.marginal.toFixed(1)}×</span>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted leading-relaxed mt-2">
            Going from current → 2× budget yields a smaller marginal $/$ than the first dollar; that's the elasticity diminishing
            returns property. The 4× column shows where the portfolio approaches saturation across most levers.
          </p>
        </div>
      </div>
    </div>
  );
}

