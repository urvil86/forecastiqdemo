import { LEVERS } from "./levers";
import { elasticityImpactPct } from "./elasticity";
import type {
  AllocationRequest,
  AllocationResult,
  AllocationSummary,
  Lever,
  LeverAllocation,
  LeverId,
  OptimizationConstraint,
} from "./types";

const LOW_FACTOR = 0.65;
const HIGH_FACTOR = 1.4;

interface InternalAlloc {
  lever: Lever;
  intensity: number;
}

function intensityFor(lever: Lever, investmentUsd: number): number {
  const raw = investmentUsd / lever.unitCostUsd;
  return Math.max(0, Math.min(lever.maxIntensity, raw));
}

function investmentFor(lever: Lever, intensity: number): number {
  return Math.max(0, intensity) * lever.unitCostUsd;
}

function isLeverExcluded(constraints: OptimizationConstraint[], leverId: LeverId): boolean {
  return constraints.some((c) => c.type === "lever-exclude" && c.value === leverId);
}

function categoryCap(constraints: OptimizationConstraint[], category: Lever["category"]): number | null {
  for (const c of constraints) {
    if (c.type === "category-cap" && typeof c.value === "object" && c.value !== null) {
      const v = c.value as { category: string; capUsd: number };
      if (v.category === category) return v.capUsd;
    }
  }
  return null;
}

function maxInvestmentForLever(lever: Lever): number {
  return lever.maxIntensity * lever.unitCostUsd;
}

function effectiveMaxInvestmentForLever(lever: Lever): number {
  // For capacity-bounded levers, dollar contribution above capacityThreshold is wasted
  const cap = lever.elasticityParams.capacityThreshold;
  if (lever.elasticityShape === "capacity-bounded" && cap !== undefined) {
    return Math.min(lever.maxIntensity, cap) * lever.unitCostUsd;
  }
  return maxInvestmentForLever(lever);
}

function computeImpactUsd(lever: Lever, intensity: number, baselineRevenue: number): number {
  return elasticityImpactPct(lever, intensity) * baselineRevenue;
}

function marginalImpactPerDollar(lever: Lever, intensity: number, baselineRevenue: number): number {
  // Use a small probe step to get current marginal $/$
  const eps = 1; // 1 unit of intensity
  const dPct = elasticityImpactPct(lever, intensity + eps) - elasticityImpactPct(lever, intensity);
  const dDollar = lever.unitCostUsd * eps;
  if (dDollar === 0) return 0;
  return (dPct * baselineRevenue) / dDollar;
}

interface CoreOptimizeOptions {
  budgetUsd: number;
  baselineRevenue: number;
  constraints: OptimizationConstraint[];
  excludedLevers: LeverId[];
  objective: AllocationRequest["objective"];
}

function coreOptimize(opts: CoreOptimizeOptions): InternalAlloc[] {
  const eligible = LEVERS.filter((l) => !opts.excludedLevers.includes(l.id) && !isLeverExcluded(opts.constraints, l.id));
  if (eligible.length === 0) return [];

  // Initialize: equal allocation, capped by lever max and category caps
  let allocs: InternalAlloc[] = eligible.map((lever) => {
    const equalShare = opts.budgetUsd / eligible.length;
    const cappedByLever = Math.min(equalShare, effectiveMaxInvestmentForLever(lever));
    return { lever, intensity: intensityFor(lever, cappedByLever) };
  });

  function totalSpend(): number {
    return allocs.reduce((s, a) => s + investmentFor(a.lever, a.intensity), 0);
  }

  function categorySpend(cat: Lever["category"]): number {
    return allocs.filter((a) => a.lever.category === cat).reduce((s, a) => s + investmentFor(a.lever, a.intensity), 0);
  }

  function clampToConstraints() {
    // Cap each lever to its effective max
    for (const a of allocs) {
      const max = effectiveMaxInvestmentForLever(a.lever);
      const cur = investmentFor(a.lever, a.intensity);
      if (cur > max) a.intensity = intensityFor(a.lever, max);
    }
    // Apply category caps
    for (const cat of ["commercial-investment", "commercial-optimization", "operations-investment"] as const) {
      const cap = categoryCap(opts.constraints, cat);
      if (cap === null) continue;
      const inCat = allocs.filter((a) => a.lever.category === cat);
      let catTotal = inCat.reduce((s, a) => s + investmentFor(a.lever, a.intensity), 0);
      if (catTotal <= cap) continue;
      // Scale down proportionally
      const scale = cap / catTotal;
      for (const a of inCat) a.intensity = a.intensity * scale;
    }
    // Scale down to global budget if exceeded
    let total = totalSpend();
    if (total > opts.budgetUsd && total > 0) {
      const scale = opts.budgetUsd / total;
      for (const a of allocs) a.intensity *= scale;
    }
  }

  clampToConstraints();

  // Helper: room left for a lever respecting both its own ceiling AND any category cap
  function roomForLever(target: InternalAlloc): number {
    const cur = investmentFor(target.lever, target.intensity);
    const leverMax = effectiveMaxInvestmentForLever(target.lever);
    const leverRoom = Math.max(0, leverMax - cur);
    const cap = categoryCap(opts.constraints, target.lever.category);
    if (cap === null) return leverRoom;
    const catSpend = allocs
      .filter((a) => a.lever.category === target.lever.category)
      .reduce((s, a) => s + investmentFor(a.lever, a.intensity), 0);
    return Math.max(0, Math.min(leverRoom, cap - catSpend));
  }

  // Gradient-ascent reallocation
  const stepUsd = opts.budgetUsd * 0.05;
  const maxIters = 60;
  const tolerance = 0.0001; // % impact change threshold

  function totalImpactPct(): number {
    return allocs.reduce((s, a) => s + elasticityImpactPct(a.lever, a.intensity), 0);
  }

  let prevImpact = totalImpactPct();

  for (let iter = 0; iter < maxIters; iter++) {
    // Find highest and lowest marginal $/$
    let best: InternalAlloc | null = null;
    let worst: InternalAlloc | null = null;
    let bestMarg = -Infinity;
    let worstMarg = Infinity;
    for (const a of allocs) {
      const cur = investmentFor(a.lever, a.intensity);
      const room = roomForLever(a);
      const marg = marginalImpactPerDollar(a.lever, a.intensity, opts.baselineRevenue);
      if (room > 1 && marg > bestMarg) {
        bestMarg = marg;
        best = a;
      }
      const margWorst = marginalImpactPerDollar(a.lever, Math.max(0, a.intensity - 1), opts.baselineRevenue);
      if (cur > stepUsd / 4 && margWorst < worstMarg) {
        worstMarg = margWorst;
        worst = a;
      }
    }
    if (!best || !worst || best === worst) break;
    if (bestMarg <= worstMarg * 1.001) break; // no profitable move

    // Move stepUsd from worst → best (respecting constraints)
    const worstInv = investmentFor(worst.lever, worst.intensity);
    const bestInv = investmentFor(best.lever, best.intensity);
    const bestRoom = roomForLever(best);
    const move = Math.min(stepUsd, worstInv, bestRoom);
    if (move <= 1) break;
    worst.intensity = intensityFor(worst.lever, worstInv - move);
    best.intensity = intensityFor(best.lever, bestInv + move);

    clampToConstraints();
    const newImpact = totalImpactPct();
    if (Math.abs(newImpact - prevImpact) < tolerance) break;
    prevImpact = newImpact;
  }

  // After main loop, if budget is still under-allocated (because everything saturated),
  // fill remaining into the lever with highest current marginal $/$ that has room
  let total = totalSpend();
  if (total < opts.budgetUsd - 1) {
    let remaining = opts.budgetUsd - total;
    let safety = 30;
    while (remaining > 1 && safety-- > 0) {
      let target: InternalAlloc | null = null;
      let bestMarg = -Infinity;
      for (const a of allocs) {
        const room = roomForLever(a);
        if (room < 1) continue;
        const m = marginalImpactPerDollar(a.lever, a.intensity, opts.baselineRevenue);
        if (m > bestMarg) {
          bestMarg = m;
          target = a;
        }
      }
      if (!target) break;
      const room = roomForLever(target);
      const add = Math.min(remaining, room);
      target.intensity = intensityFor(target.lever, investmentFor(target.lever, target.intensity) + add);
      remaining -= add;
      clampToConstraints();
      total = totalSpend();
      remaining = opts.budgetUsd - total;
    }
  }

  // Drop allocations below $1 to avoid noise
  return allocs.filter((a) => investmentFor(a.lever, a.intensity) >= 1);
}

function buildAllocations(
  internalAllocs: InternalAlloc[],
  baselineRevenue: number
): LeverAllocation[] {
  return internalAllocs.map((a) => {
    const investmentUsd = investmentFor(a.lever, a.intensity);
    const impactPct = elasticityImpactPct(a.lever, a.intensity);
    const impactUsd = impactPct * baselineRevenue;
    return {
      leverId: a.lever.id,
      investmentUsd,
      intensity: a.intensity,
      expectedImpactPct: impactPct,
      expectedImpactUsd: impactUsd,
      expectedImpactUsdLow: impactUsd * LOW_FACTOR,
      expectedImpactUsdHigh: impactUsd * HIGH_FACTOR,
      confidenceInterval: a.lever.riskScore === "low" ? 0.85 : a.lever.riskScore === "medium" ? 0.7 : 0.55,
      rampWeeks: a.lever.rampWeeks,
      fullEffectWeek: a.lever.rampWeeks,
    };
  });
}

function summarize(allocations: LeverAllocation[]): AllocationSummary {
  const totalAllocatedUsd = allocations.reduce((s, a) => s + a.investmentUsd, 0);
  const mid = allocations.reduce((s, a) => s + a.expectedImpactUsd, 0);
  // Independent levers: variance approx via triangular spread
  const variance = allocations.reduce((s, a) => {
    const range = (a.expectedImpactUsdHigh - a.expectedImpactUsdLow) / 2;
    return s + (range * range) / 6;
  }, 0);
  const std = Math.sqrt(variance);
  const low = Math.max(0, mid - 1.28 * std);
  const high = mid + 1.28 * std;

  // Portfolio confidence: weighted by risk + diminishing-returns proximity
  const weightedConf =
    totalAllocatedUsd === 0
      ? 0
      : allocations.reduce((s, a) => s + a.confidenceInterval * a.investmentUsd, 0) / totalAllocatedUsd;

  const portfolioROI = totalAllocatedUsd === 0 ? 0 : mid / totalAllocatedUsd;

  // Payback: heuristic — weighted average ramp + 4 weeks of post-ramp accrual
  const weightedRamp =
    totalAllocatedUsd === 0
      ? 0
      : allocations.reduce((s, a) => s + a.rampWeeks * a.investmentUsd, 0) / totalAllocatedUsd;
  const paybackWeeks = portfolioROI > 0 ? Math.round(weightedRamp + 52 / portfolioROI) : 99;

  return {
    totalAllocatedUsd,
    totalExpectedImpactUsdLow: low,
    totalExpectedImpactUsdMid: mid,
    totalExpectedImpactUsdHigh: high,
    portfolioConfidence: Math.max(0.3, Math.min(0.95, weightedConf)),
    paybackWeeks: Math.max(2, paybackWeeks),
    portfolioROI,
  };
}

function buildBindingConstraints(
  allocations: LeverAllocation[],
  request: AllocationRequest
): AllocationResult["bindingConstraints"] {
  const out: AllocationResult["bindingConstraints"] = [];
  for (const a of allocations) {
    const lever = LEVERS.find((l) => l.id === a.leverId)!;
    const max = effectiveMaxInvestmentForLever(lever);
    if (a.investmentUsd >= max - 1) {
      const cap = lever.elasticityParams.capacityThreshold;
      if (lever.elasticityShape === "capacity-bounded" && cap !== undefined) {
        out.push({
          constraintType: "capacity",
          leverId: a.leverId,
          impact: `${lever.displayName} capped at $${cap}M (operational saturation; further investment shows zero marginal impact).`,
        });
      } else {
        out.push({
          constraintType: "max-intensity",
          leverId: a.leverId,
          impact: `${lever.displayName} hit its max-intensity ceiling.`,
        });
      }
    }
  }
  for (const c of request.constraints) {
    if (c.type === "lever-exclude") {
      const lever = LEVERS.find((l) => l.id === c.value);
      if (lever) {
        out.push({
          constraintType: "lever-exclude",
          leverId: c.value as LeverId,
          impact: `${lever.displayName} excluded by user constraint.`,
        });
      }
    }
    if (c.type === "category-cap") {
      const v = c.value as { category: string; capUsd: number };
      out.push({
        constraintType: "category-cap",
        impact: `${v.category} capped at $${(v.capUsd / 1e6).toFixed(1)}M.`,
      });
    }
  }
  return out;
}

export function optimize(request: AllocationRequest): Omit<AllocationResult, "rationale"> {
  const annual = request.computed.annual.find((a) => a.year === request.forecastYear);
  const baselineRevenue = annual?.netSales ?? 0;

  const objectiveExcluded: LeverId[] = [];
  // For "Risk-minimized" alt below we'll pass extra excluded levers
  if (request.objective === "max-confidence") {
    for (const l of LEVERS) {
      if (l.riskScore === "high") objectiveExcluded.push(l.id);
    }
  }

  const internalAllocs = coreOptimize({
    budgetUsd: request.budgetUsd,
    baselineRevenue,
    constraints: request.constraints,
    excludedLevers: objectiveExcluded,
    objective: request.objective,
  });

  const allocations = buildAllocations(internalAllocs, baselineRevenue);
  // Sort by investment dollars descending
  allocations.sort((a, b) => b.investmentUsd - a.investmentUsd);

  // Excluded list (for UI): levers not in main allocation, with reason
  const excluded: LeverAllocation[] = LEVERS.filter((l) => !allocations.find((a) => a.leverId === l.id)).map((l) => {
    const intensity = l.minIntensity;
    return {
      leverId: l.id,
      investmentUsd: 0,
      intensity: 0,
      expectedImpactPct: 0,
      expectedImpactUsd: 0,
      expectedImpactUsdLow: 0,
      expectedImpactUsdHigh: 0,
      confidenceInterval: 0,
      rampWeeks: l.rampWeeks,
      fullEffectWeek: l.rampWeeks,
      reasonExcluded: isLeverExcluded(request.constraints, l.id)
        ? "Excluded by user constraint"
        : objectiveExcluded.includes(l.id)
        ? "Excluded by risk-minimized objective"
        : l.elasticityShape === "s-curve"
        ? `Below S-curve threshold at this budget (midpoint ≈ $${l.elasticityParams.midpoint}M)`
        : "Lower marginal $/$ than alternatives at this budget",
    };
  });

  const summary = summarize(allocations);

  // Budget sensitivity: re-run at half / 2× / 4× budget (without recursion to avoid stack)
  function quickRunImpact(budget: number): { totalInvestmentUsd: number; expectedImpact: number } {
    const allocsAlt = coreOptimize({
      budgetUsd: budget,
      baselineRevenue,
      constraints: request.constraints,
      excludedLevers: objectiveExcluded,
      objective: request.objective,
    });
    const a = buildAllocations(allocsAlt, baselineRevenue);
    const s = summarize(a);
    return { totalInvestmentUsd: s.totalAllocatedUsd, expectedImpact: s.totalExpectedImpactUsdMid };
  }
  const half = quickRunImpact(request.budgetUsd / 2);
  const full = { totalInvestmentUsd: summary.totalAllocatedUsd, expectedImpact: summary.totalExpectedImpactUsdMid };
  const dbl = quickRunImpact(request.budgetUsd * 2);
  const quad = quickRunImpact(request.budgetUsd * 4);
  const marginalPerUsd = dbl.totalInvestmentUsd > full.totalInvestmentUsd
    ? (dbl.expectedImpact - full.expectedImpact) / (dbl.totalInvestmentUsd - full.totalInvestmentUsd)
    : 0;

  // Alternative allocations
  const alt1Allocs = coreOptimize({
    budgetUsd: request.budgetUsd,
    baselineRevenue,
    constraints: request.constraints,
    excludedLevers: ["dtc-spend", "field-force-expansion"],
    objective: request.objective,
  });
  const alt1 = buildAllocations(alt1Allocs, baselineRevenue);
  alt1.sort((a, b) => b.investmentUsd - a.investmentUsd);

  const alt2Allocs = coreOptimize({
    budgetUsd: request.budgetUsd,
    baselineRevenue,
    constraints: request.constraints,
    excludedLevers: objectiveExcluded,
    objective: "max-roi",
  });
  const alt2 = buildAllocations(alt2Allocs, baselineRevenue);
  alt2.sort((a, b) => b.investmentUsd - a.investmentUsd);

  const alt3Allocs = coreOptimize({
    budgetUsd: request.budgetUsd,
    baselineRevenue,
    constraints: [
      ...request.constraints,
      { type: "category-cap", value: { category: "commercial-investment", capUsd: request.budgetUsd * 0.45 }, description: "Balanced: cap commercial-investment at 45% of budget" },
    ],
    excludedLevers: objectiveExcluded,
    objective: request.objective,
  });
  const alt3 = buildAllocations(alt3Allocs, baselineRevenue);
  alt3.sort((a, b) => b.investmentUsd - a.investmentUsd);

  const alternatives: AllocationResult["alternativeAllocations"] = [
    {
      label: "Risk-Minimized",
      description: "Excludes high-risk levers (DTC, Field Force Expansion). Lower expected impact, higher confidence.",
      allocations: alt1,
      summary: summarize(alt1),
    },
    {
      label: "Maximum ROI",
      description: "Optimizes for revenue per dollar regardless of total. Favors low-cost, high-marginal-return levers.",
      allocations: alt2,
      summary: summarize(alt2),
    },
    {
      label: "Diversified",
      description: "Forces minimum spread across categories. Insurance against single-lever underperformance.",
      allocations: alt3,
      summary: summarize(alt3),
    },
  ];

  return {
    request,
    allocations,
    excluded,
    summary,
    budgetSensitivity: {
      halfBudget: half,
      fullBudget: full,
      doubleBudget: dbl,
      quadrupleBudget: quad,
      marginalImpactPerUsd: marginalPerUsd,
    },
    bindingConstraints: buildBindingConstraints(allocations, request),
    alternativeAllocations: alternatives,
  };
}
