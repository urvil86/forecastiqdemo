import { describe, it, expect } from "vitest";
import { compute, getSeedForecast } from "@/lib/engine";
import {
  generateRecommendation,
  computeSensitivity,
  optimize,
  LEVERS,
} from "@/lib/growth-intel";
import type { OptimizationConstraint } from "@/lib/growth-intel";

function setup() {
  const f = getSeedForecast();
  const c = compute(f);
  return { f, c };
}

describe("Growth Intelligence validation suite", () => {
  it("Test 1 — Determinism", () => {
    const { f, c } = setup();
    const r1 = generateRecommendation(f, c, 10e6, { forecastYear: 2027 });
    const r2 = generateRecommendation(f, c, 10e6, { forecastYear: 2027 });
    expect(r1.allocations.length).toBe(r2.allocations.length);
    for (let i = 0; i < r1.allocations.length; i++) {
      expect(Math.abs(r1.allocations[i].investmentUsd - r2.allocations[i].investmentUsd)).toBeLessThan(1);
    }
  });

  it("Test 2 — Budget conservation", () => {
    const { f, c } = setup();
    for (const budget of [10e6, 25e6]) {
      const r = generateRecommendation(f, c, budget, { forecastYear: 2027 });
      const total = r.allocations.reduce((s, a) => s + a.investmentUsd, 0);
      expect(total).toBeGreaterThanOrEqual(budget * 0.95);
      expect(total).toBeLessThanOrEqual(budget + 1);
    }
  });

  it("Test 3 — Diminishing returns visible", () => {
    const { f, c } = setup();
    const i10 = generateRecommendation(f, c, 10e6, { forecastYear: 2027 }).summary.totalExpectedImpactUsdMid;
    const i20 = generateRecommendation(f, c, 20e6, { forecastYear: 2027 }).summary.totalExpectedImpactUsdMid;
    const i40 = generateRecommendation(f, c, 40e6, { forecastYear: 2027 }).summary.totalExpectedImpactUsdMid;
    expect(i20 / i10).toBeLessThan(2.0);
    expect(i40 / i20).toBeLessThan(2.0);
    expect(i40 / i20).toBeLessThan(i20 / i10);
  });

  it("Test 4 — Constraint enforcement", () => {
    const { f, c } = setup();
    const a1 = generateRecommendation(f, c, 10e6, { forecastYear: 2027 });
    const dtcInBaseline = a1.allocations.find((a) => a.leverId === "dtc-spend");

    const exclude: OptimizationConstraint[] = [
      { type: "lever-exclude", value: "dtc-spend", description: "Exclude DTC" },
    ];
    const a2 = generateRecommendation(f, c, 10e6, { forecastYear: 2027, constraints: exclude });
    expect(a2.allocations.find((a) => a.leverId === "dtc-spend")).toBeUndefined();
    const a2Total = a2.allocations.reduce((s, a) => s + a.investmentUsd, 0);
    expect(a2Total).toBeGreaterThan(9.5e6);
    expect(a2Total).toBeLessThan(10.01e6);

    const cap: OptimizationConstraint[] = [
      {
        type: "category-cap",
        value: { category: "operations-investment", capUsd: 1e6 },
        description: "Cap operations at $1M",
      },
    ];
    const a3 = generateRecommendation(f, c, 10e6, { forecastYear: 2027, constraints: cap });
    const ps = a3.allocations.find((a) => a.leverId === "patient-services-capacity");
    if (ps) expect(ps.investmentUsd).toBeLessThanOrEqual(1e6 + 1);
    const a3Total = a3.allocations.reduce((s, a) => s + a.investmentUsd, 0);
    expect(a3Total).toBeGreaterThan(9.5e6);

    // Quick reference to first run so eslint doesn't complain about unused
    void dtcInBaseline;
  });

  it("Test 5 — Sensitivity ranking", () => {
    const { f, c } = setup();
    const s = computeSensitivity(f, c, 2027);
    expect(s.leverSensitivities.length).toBe(6);
    // field-force-reallocation is low cost ($4500/unit) and yields ~0.0015% per unit, so very high $/$ ROI
    expect(s.rankedByROI.indexOf("field-force-reallocation")).toBeLessThanOrEqual(1);
    // dtc-spend at min intensity is below midpoint, so its marginal impact is small at start
    expect(s.rankedByROI.indexOf("dtc-spend")).toBeGreaterThanOrEqual(4);
  });

  it("Test 6 — Capacity constraints respected", () => {
    const { f, c } = setup();
    const r = generateRecommendation(f, c, 50e6, { forecastYear: 2027 });
    const ps = r.allocations.find((a) => a.leverId === "patient-services-capacity");
    if (ps) expect(ps.investmentUsd).toBeLessThanOrEqual(6e6 + 1); // capacity threshold $6M
    for (const a of r.allocations) {
      const lever = LEVERS.find((l) => l.id === a.leverId)!;
      const maxInv = lever.maxIntensity * lever.unitCostUsd;
      expect(a.investmentUsd).toBeLessThanOrEqual(maxInv + 1);
    }
  });

  it("Test 7 — LLM fallback behavior", () => {
    const { f, c } = setup();
    const r1 = generateRecommendation(f, c, 10e6, { forecastYear: 2027, useLLM: true });
    expect(r1.rationale.generatedBy).toBe("deterministic-fallback");
    expect(r1.rationale.headline.length).toBeGreaterThan(20);
    expect(r1.rationale.reasoning.length).toBeGreaterThan(50);
    expect(r1.rationale.leverJustifications.length).toBe(r1.allocations.length);
    expect(r1.rationale.risks.length).toBeGreaterThan(0);
    expect(r1.rationale.watchList.length).toBeGreaterThan(0);

    const r2 = generateRecommendation(f, c, 10e6, { forecastYear: 2027, useLLM: false });
    expect(r2.rationale.generatedBy).toBe("deterministic-fallback");
  });

  it("Test 8 — Performance budget", () => {
    const { f, c } = setup();
    const t0 = Date.now();
    computeSensitivity(f, c, 2027);
    expect(Date.now() - t0).toBeLessThan(500);

    const t1 = Date.now();
    optimize({
      forecast: f,
      computed: c,
      budgetUsd: 10e6,
      timelineWeeks: 52,
      forecastYear: 2027,
      constraints: [],
      objective: "max-revenue",
    });
    expect(Date.now() - t1).toBeLessThan(2000);

    const t2 = Date.now();
    generateRecommendation(f, c, 10e6, { forecastYear: 2027 });
    expect(Date.now() - t2).toBeLessThan(3000);
  });

  it("Test 9 — Calculation breakdown integrity", () => {
    const { f, c } = setup();
    const r = generateRecommendation(f, c, 10e6, { forecastYear: 2027, includeBreakdowns: true });
    expect(r.breakdowns).toBeTruthy();
    expect(r.breakdowns!.length).toBe(r.allocations.length);
    for (const bd of r.breakdowns!) {
      // All four layers populated
      expect(bd.layers.investmentToActivity.title).toBeTruthy();
      expect(bd.layers.activityToReach.title).toBeTruthy();
      expect(bd.layers.activityToOutcome.title).toBeTruthy();
      expect(bd.layers.outcomeToRevenue.title).toBeTruthy();
      // Summary line present
      expect(bd.summaryLine.length).toBeGreaterThan(20);
      // Investment in Layer 1 inputs equals allocation.investmentUsd
      const invInput = bd.layers.investmentToActivity.inputs.find((i) => i.label === "Investment dollars");
      expect(invInput).toBeTruthy();
      expect(Math.abs((invInput!.value as number) - bd.investmentUsd)).toBeLessThan(1);
      // Each layer has at least one citation
      expect(bd.layers.investmentToActivity.citations.length).toBeGreaterThan(0);
      expect(bd.layers.outcomeToRevenue.citations.length).toBeGreaterThan(0);
      // At least one uncertainty
      expect(bd.uncertainties.length).toBeGreaterThan(0);
      // Layer 4 final official-impact output is within 5% of allocation.expectedImpactUsd
      const officialOutput = bd.layers.outcomeToRevenue.outputs.find((o) =>
        o.label.toLowerCase().includes("official")
      );
      expect(officialOutput).toBeTruthy();
      const drift = Math.abs(officialOutput!.value - bd.expectedImpactUsd) / Math.max(1, bd.expectedImpactUsd);
      expect(drift).toBeLessThan(0.05);
    }
  });

  it("Demo readiness check", () => {
    const { f, c } = setup();
    const r10 = generateRecommendation(f, c, 10e6, { forecastYear: 2027 });
    expect(r10.allocations.length).toBeGreaterThanOrEqual(3);
    expect(r10.allocations.length).toBeLessThanOrEqual(6);
    expect(r10.summary.totalExpectedImpactUsdMid).toBeGreaterThan(20e6);
    expect(r10.summary.totalExpectedImpactUsdMid).toBeLessThan(180e6);
    expect(r10.summary.portfolioConfidence).toBeGreaterThan(0.4);
    expect(r10.summary.portfolioConfidence).toBeLessThan(0.95);
    expect(r10.rationale.headline).toContain("M");

    const r25 = generateRecommendation(f, c, 25e6, { forecastYear: 2027 });
    expect(r25.summary.totalAllocatedUsd).toBeGreaterThan(r10.summary.totalAllocatedUsd);
    expect(r25.summary.totalExpectedImpactUsdMid).toBeGreaterThan(r10.summary.totalExpectedImpactUsdMid);
  });
});
