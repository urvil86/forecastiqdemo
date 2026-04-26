"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { GrowthHeader } from "@/components/growth/GrowthHeader";
import { SetupCard } from "@/components/growth/GrowthInputCards";
import { GrowthResults } from "@/components/growth/GrowthResults";
import { GrowthLoading } from "@/components/growth/GrowthLoading";
import { ManualAllocationCard, DEFAULT_MANUAL_FORM, type ManualFormState } from "@/components/growth/ManualAllocationCard";
import type { OptimizationConstraint, AllocationRequest, LeverId } from "@/lib/growth-intel";

export interface GrowthFormState {
  budgetUsd: number;
  forecastYear: number;
  timelineWeeks: number;
  objective: AllocationRequest["objective"];
  excludedLevers: string[];
  categoryCaps: { commercial: number; optimization: number; operations: number };
  riskTolerance: "balanced" | "conservative" | "aggressive";
}

const DEFAULT_FORM: GrowthFormState = {
  budgetUsd: 10_000_000,
  forecastYear: 2027,
  timelineWeeks: 52,
  objective: "max-revenue",
  excludedLevers: [],
  categoryCaps: { commercial: 20_000_000, optimization: 20_000_000, operations: 20_000_000 },
  riskTolerance: "balanced",
};

function buildConstraints(form: GrowthFormState): OptimizationConstraint[] {
  const out: OptimizationConstraint[] = [];
  for (const id of form.excludedLevers) {
    out.push({ type: "lever-exclude", value: id, description: `Exclude ${id}` });
  }
  if (form.categoryCaps.commercial < 20_000_000) {
    out.push({
      type: "category-cap",
      value: { category: "commercial-investment", capUsd: form.categoryCaps.commercial },
      description: `Commercial Investment cap $${(form.categoryCaps.commercial / 1e6).toFixed(0)}M`,
    });
  }
  if (form.categoryCaps.optimization < 20_000_000) {
    out.push({
      type: "category-cap",
      value: { category: "commercial-optimization", capUsd: form.categoryCaps.optimization },
      description: `Commercial Optimization cap $${(form.categoryCaps.optimization / 1e6).toFixed(0)}M`,
    });
  }
  if (form.categoryCaps.operations < 20_000_000) {
    out.push({
      type: "category-cap",
      value: { category: "operations-investment", capUsd: form.categoryCaps.operations },
      description: `Operations Investment cap $${(form.categoryCaps.operations / 1e6).toFixed(0)}M`,
    });
  }
  if (form.riskTolerance === "conservative") {
    out.push({ type: "lever-exclude", value: "dtc-spend", description: "Conservative risk: exclude DTC" });
    out.push({ type: "lever-exclude", value: "field-force-expansion", description: "Conservative risk: exclude FFE" });
  }
  return out;
}

export default function GrowthPage() {
  const [form, setForm] = useState<GrowthFormState>(DEFAULT_FORM);
  const [manualForm, setManualForm] = useState<ManualFormState>(DEFAULT_MANUAL_FORM);
  const computed = useStore((s) => s.computed);
  const recompute = useStore((s) => s.recompute);
  const growthIntel = useStore((s) => s.growthIntel);
  const runGrowthIntel = useStore((s) => s.runGrowthIntel);
  const runManualEvaluation = useStore((s) => s.runManualEvaluation);
  const clearGrowthIntel = useStore((s) => s.clearGrowthIntel);

  const [resultsStale, setResultsStale] = useState(false);

  useEffect(() => {
    if (!computed) recompute();
  }, [computed, recompute]);

  const baselineRevenue = computed?.annual.find((a) => a.year === form.forecastYear)?.netSales ?? 0;

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
      form.riskTolerance === "conservative" ? "max-confidence" : form.riskTolerance === "aggressive" ? "max-roi" : form.objective;
    await runGrowthIntel({
      budgetUsd: form.budgetUsd,
      forecastYear: form.forecastYear,
      timelineWeeks: form.timelineWeeks,
      constraints: buildConstraints(form),
      objective,
    });
    // After optimize completes, sync sliders so the user can tweak from the recommendation
    const result = useStore.getState().growthIntel.lastResult;
    if (result) {
      const sliders = { ...DEFAULT_MANUAL_FORM.perLeverInvestmentUsd };
      for (const a of result.allocations) sliders[a.leverId as LeverId] = a.investmentUsd;
      setManualForm((f) => ({ ...f, perLeverInvestmentUsd: sliders, forecastYear: form.forecastYear, timelineWeeks: form.timelineWeeks }));
    }
    scrollToResults();
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
    scrollToResults();
  }

  function scrollToResults() {
    setTimeout(() => {
      const el = document.getElementById("growth-results");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function loadDemoScenario() {
    setForm(DEFAULT_FORM);
    setManualForm(DEFAULT_MANUAL_FORM);
    setResultsStale(false);
    setTimeout(() => runOptimize(), 500);
  }

  function reset() {
    clearGrowthIntel();
    setForm(DEFAULT_FORM);
    setManualForm(DEFAULT_MANUAL_FORM);
    setResultsStale(false);
  }

  // Sync year + timeline across optimize and manual forms
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
      <GrowthHeader
        forecastYear={form.forecastYear}
        baselineRevenue={baselineRevenue}
        onLoadDemo={loadDemoScenario}
        onYearChange={setYear}
        timelineWeeks={form.timelineWeeks}
        onTimelineChange={setTimeline}
      />

      <SetupCard form={form} update={update} onOptimize={runOptimize} isComputing={growthIntel.isComputing} />

      <ManualAllocationCard form={manualForm} setForm={updateManual} onRun={runCompute} isComputing={growthIntel.isComputing} />

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
              Set a budget above and click <strong>Optimize</strong> to get a recommendation, or drag the sliders directly and click{" "}
              <strong>Compute Impact</strong>. Or hit <strong>Load Demo Scenario</strong> in the header.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
