"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { GrowthHeader } from "@/components/growth/GrowthHeader";
import { SetupCard } from "@/components/growth/GrowthInputCards";
import { GrowthResults } from "@/components/growth/GrowthResults";
import { GrowthLoading } from "@/components/growth/GrowthLoading";
import {
  ManualAllocationCard,
  DEFAULT_MANUAL_FORM,
  type ManualFormState,
} from "@/components/growth/ManualAllocationCard";
import type { AllocationRequest, OptimizationConstraint, LeverId } from "@/lib/growth-intel";
import { ForecastImpactPreview } from "./ForecastImpactPreview";
import { TradeoffAnalysisSection } from "./TradeoffAnalysisSection";
import { DEFAULT_GROWTH_FORM as DEFAULT_FORM, type GrowthFormState } from "./types";

function buildConstraints(form: GrowthFormState): OptimizationConstraint[] {
  const out: OptimizationConstraint[] = [];
  for (const id of form.excludedLevers) {
    out.push({ type: "lever-exclude", value: id, description: `Exclude ${id}` });
  }
  if (form.riskTolerance === "conservative") {
    out.push({ type: "lever-exclude", value: "dtc-spend", description: "Conservative risk: exclude DTC" });
    out.push({ type: "lever-exclude", value: "field-force-expansion", description: "Conservative risk: exclude FFE" });
  }
  return out;
}

export function PlanModeTab() {
  return (
    <Suspense fallback={null}>
      <PlanModeInner />
    </Suspense>
  );
}

function PlanModeInner() {
  const params = useSearchParams();
  const [form, setForm] = useState<GrowthFormState>(DEFAULT_FORM);
  const [manualForm, setManualForm] = useState<ManualFormState>(DEFAULT_MANUAL_FORM);
  const computed = useStore((s) => s.computed);
  const recompute = useStore((s) => s.recompute);
  const growthIntel = useStore((s) => s.growthIntel);
  const runGrowthIntel = useStore((s) => s.runGrowthIntel);
  const runManualEvaluation = useStore((s) => s.runManualEvaluation);
  const clearGrowthIntel = useStore((s) => s.clearGrowthIntel);
  const [resultsStale, setResultsStale] = useState(false);
  const handoffApplied = useRef(false);

  useEffect(() => {
    if (!computed) recompute();
  }, [computed, recompute]);

  // ── Opportunity handoff (from /forecast/opportunities/) ──
  // URL params we recognize:
  //   ?budget=18500000             — pre-fill budget
  //   ?lever=site-of-care-optimization — pre-select lever in manual allocation
  //   ?action=optimize             — auto-run optimizer
  //   ?action=manual               — auto-run manual evaluation with full
  //                                  budget on the chosen lever
  //   ?label=Site-of-care          — display title (informational)
  useEffect(() => {
    if (!params || handoffApplied.current) return;
    const budgetStr = params.get("budget");
    const lever = params.get("lever") as LeverId | null;
    const action = params.get("action");
    if (!budgetStr && !lever && !action) return;
    handoffApplied.current = true;

    const budget = budgetStr ? parseInt(budgetStr) : DEFAULT_FORM.budgetUsd;
    if (Number.isFinite(budget) && budget > 0) {
      setForm((f) => ({ ...f, budgetUsd: budget }));
    }
    if (lever) {
      const sliders = { ...DEFAULT_MANUAL_FORM.perLeverInvestmentUsd } as Record<
        LeverId,
        number
      >;
      sliders[lever] = budget;
      setManualForm((f) => ({
        ...f,
        perLeverInvestmentUsd: sliders,
      }));
    }
    if (action === "optimize" || action === "manual") {
      // Defer to next tick so state setters land first
      setTimeout(() => {
        if (action === "optimize") {
          runGrowthIntel({
            budgetUsd: budget,
            forecastYear: DEFAULT_FORM.forecastYear,
            timelineWeeks: DEFAULT_FORM.timelineWeeks,
            constraints: [],
            objective: "max-revenue",
          });
        } else {
          runManualEvaluation({
            forecastYear: DEFAULT_FORM.forecastYear,
            timelineWeeks: DEFAULT_FORM.timelineWeeks,
            manualAllocations: lever
              ? [{ leverId: lever, investmentUsd: budget }]
              : [],
          });
        }
      }, 100);
    }
  }, [params, runGrowthIntel, runManualEvaluation]);

  const baselineRevenue =
    computed?.annual.find((a) => a.year === form.forecastYear)?.netSales ?? 0;

  function update<K extends keyof GrowthFormState>(key: K, value: GrowthFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (growthIntel.lastResult) setResultsStale(true);
  }

  function updateManual(next: ManualFormState) {
    setManualForm(next);
    if (growthIntel.lastResult) setResultsStale(true);
  }

  async function runOptimize() {
    setResultsStale(false);
    const objective: AllocationRequest["objective"] =
      form.riskTolerance === "conservative"
        ? "max-confidence"
        : form.riskTolerance === "aggressive"
        ? "max-roi"
        : form.objective;
    await runGrowthIntel({
      budgetUsd: form.budgetUsd,
      forecastYear: form.forecastYear,
      timelineWeeks: form.timelineWeeks,
      constraints: buildConstraints(form),
      objective,
    });
    const result = useStore.getState().growthIntel.lastResult;
    if (result) {
      const sliders = { ...DEFAULT_MANUAL_FORM.perLeverInvestmentUsd };
      for (const a of result.allocations) sliders[a.leverId as LeverId] = a.investmentUsd;
      setManualForm((f) => ({
        ...f,
        perLeverInvestmentUsd: sliders,
        forecastYear: form.forecastYear,
        timelineWeeks: form.timelineWeeks,
      }));
    }
  }

  async function runCompute() {
    setResultsStale(false);
    const allocations = (Object.entries(manualForm.perLeverInvestmentUsd) as [LeverId, number][])
      .filter(([, v]) => v > 0)
      .map(([leverId, investmentUsd]) => ({ leverId, investmentUsd }));
    await runManualEvaluation({
      forecastYear: manualForm.forecastYear,
      timelineWeeks: manualForm.timelineWeeks,
      manualAllocations: allocations,
    });
  }

  function loadDemoScenario() {
    setForm(DEFAULT_FORM);
    setManualForm(DEFAULT_MANUAL_FORM);
    setResultsStale(false);
    setTimeout(() => runOptimize(), 300);
  }

  function reset() {
    clearGrowthIntel();
    setForm(DEFAULT_FORM);
    setManualForm(DEFAULT_MANUAL_FORM);
    setResultsStale(false);
  }

  function setYear(y: number) {
    setForm((f) => ({ ...f, forecastYear: y }));
    setManualForm((f) => ({ ...f, forecastYear: y }));
    if (growthIntel.lastResult) setResultsStale(true);
  }
  function setTimeline(w: number) {
    setForm((f) => ({ ...f, timelineWeeks: w }));
    setManualForm((f) => ({ ...f, timelineWeeks: w }));
    if (growthIntel.lastResult) setResultsStale(true);
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="font-heading text-h2 text-secondary">Plan Mode</h1>
        <p className="text-sm text-muted mt-1">
          Model investments, see forecast impact. Lever allocations flow into the active forecast.
        </p>
      </div>

      <GrowthHeader
        forecastYear={form.forecastYear}
        baselineRevenue={baselineRevenue}
        onLoadDemo={loadDemoScenario}
        onYearChange={setYear}
        timelineWeeks={form.timelineWeeks}
        onTimelineChange={setTimeline}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-6">
        <div className="space-y-6">
          <SetupCard
            form={form}
            update={update}
            onOptimize={runOptimize}
            isComputing={growthIntel.isComputing}
          />
          <ManualAllocationCard
            form={manualForm}
            setForm={updateManual}
            onRun={runCompute}
            isComputing={growthIntel.isComputing}
          />
          <div id="growth-results">
            {growthIntel.isComputing ? (
              <GrowthLoading />
            ) : growthIntel.lastResult ? (
              <GrowthResults
                result={growthIntel.lastResult}
                stale={resultsStale}
                onRerun={runCompute}
                onReset={reset}
              />
            ) : (
              <div className="card text-center py-10 text-muted">
                <p className="text-sm">
                  Set a budget above and click <strong>Optimize</strong>, or drag sliders and click{" "}
                  <strong>Compute Impact</strong>.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <ForecastImpactPreview
            result={growthIntel.lastResult}
            forecastYear={form.forecastYear}
            timelineWeeks={form.timelineWeeks}
          />
        </div>
      </div>

      <TradeoffAnalysisSection
        form={form}
        result={growthIntel.lastResult}
        onSimulate={async (budget) =>
          await runGrowthIntel({
            budgetUsd: budget,
            forecastYear: form.forecastYear,
            timelineWeeks: form.timelineWeeks,
            constraints: buildConstraints(form),
            objective: form.objective,
          })
        }
      />
    </div>
  );
}
