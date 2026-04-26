import { LEVERS, getLever } from "./levers";
import type {
  AllocationRationale,
  AllocationRequest,
  AllocationResult,
  LeverAllocation,
} from "./types";

function fmtUsdM(v: number): string {
  return `$${(v / 1e6).toFixed(1)}M`;
}
function fmtUsdB(v: number): string {
  return `$${(v / 1e9).toFixed(2)}B`;
}
function fmtPct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

function leverJustification(alloc: LeverAllocation): string {
  const lever = getLever(alloc.leverId);
  if (!lever) return "Allocated based on portfolio optimization.";
  const inv = fmtUsdM(alloc.investmentUsd);
  const impact = fmtUsdM(alloc.expectedImpactUsd);
  const cap = lever.elasticityParams.capacityThreshold;
  switch (lever.elasticityShape) {
    case "logarithmic":
      return `${inv} into ${lever.displayName} captures the high-marginal-return early portion of its logarithmic curve before strong diminishing returns set in (≈ ${impact} expected impact).`;
    case "s-curve":
      return `${inv} into ${lever.displayName} clears the S-curve threshold so this investment registers material impact (≈ ${impact}); below threshold the spend would underperform.`;
    case "capacity-bounded":
      return `${inv} into ${lever.displayName} sits ${
        cap !== undefined && alloc.investmentUsd >= cap * lever.unitCostUsd - 1
          ? "at the operational capacity cap of $" + cap + "M"
          : "below the $" + cap + "M operational cap"
      }, where each dollar still produces linear impact (≈ ${impact}).`;
    case "linear-bounded":
      return `${inv} into ${lever.displayName} contributes proportionally up to its bounded ceiling (≈ ${impact}).`;
  }
}

function leverExclusionReason(alloc: LeverAllocation): string {
  const lever = getLever(alloc.leverId);
  if (!lever) return alloc.reasonExcluded ?? "Not selected by optimizer.";
  if (alloc.reasonExcluded) return `${lever.displayName}: ${alloc.reasonExcluded}.`;
  return `${lever.displayName}: not selected (lower marginal $/$ than alternatives).`;
}

export function explainAllocation(
  request: AllocationRequest,
  result: Omit<AllocationResult, "rationale">,
  options: { useFallback?: boolean } = {}
): AllocationRationale {
  // For the demo, deterministic fallback only. (LLM hook can be added later
  // by detecting an env var and POSTing to /v1/messages — left intentionally
  // out so the demo never depends on a network call.)
  void options;

  const allocations = result.allocations;
  const top = allocations[0];
  const second = allocations[1];
  const summary = result.summary;
  const budget = request.budgetUsd;
  const targetYear = request.forecastYear;
  const annual = request.computed.annual.find((a) => a.year === targetYear);
  const baselineRev = annual?.netSales ?? 0;

  const headline = top
    ? `Recommended allocation of ${fmtUsdM(budget)}: weight ${getLever(top.leverId)?.displayName ?? top.leverId} (${fmtUsdM(top.investmentUsd)}, ${fmtPct(
        top.investmentUsd / budget
      )} of budget) for highest marginal ROI, paired with ${
        second ? getLever(second.leverId)?.displayName ?? second.leverId : "diversification levers"
      } for resilience. Expected lift on the ${targetYear} forecast (${fmtUsdB(baselineRev)} baseline): ${fmtUsdM(
        summary.totalExpectedImpactUsdMid
      )} (range ${fmtUsdM(summary.totalExpectedImpactUsdLow)}–${fmtUsdM(summary.totalExpectedImpactUsdHigh)}), ${fmtPct(
        summary.portfolioConfidence
      )} confidence.`
    : `No allocation produced for ${fmtUsdM(budget)} — every lever was excluded by constraints. Loosen constraints to receive a portfolio.`;

  // Reasoning: 4 sentences
  const reasoningParts: string[] = [];
  if (top) {
    const lever = getLever(top.leverId)!;
    reasoningParts.push(
      `The optimizer favors ${lever.displayName} because at the current operating point its marginal impact per dollar exceeds alternatives — calibrated against ${lever.benchmarkSource}.`
    );
  }
  const dimReturnsLever = allocations.find((a) => {
    const l = getLever(a.leverId);
    if (!l) return false;
    if (l.elasticityShape === "logarithmic") {
      const cap = l.maxIntensity;
      return a.intensity > 0.5 * cap;
    }
    return false;
  });
  if (dimReturnsLever) {
    const l = getLever(dimReturnsLever.leverId)!;
    reasoningParts.push(
      `Diminishing returns on ${l.displayName} push the optimizer to diversify into the next lever rather than over-concentrate.`
    );
  } else {
    reasoningParts.push(
      `No single lever absorbs the full budget — diminishing returns trigger reallocation across multiple levers.`
    );
  }

  const bindingDtc = result.excluded.find((e) => e.leverId === "dtc-spend");
  if (bindingDtc) {
    reasoningParts.push(
      `DTC is held back at this budget level because spend below the S-curve threshold (~$8M) yields near-zero impact — investing there would waste budget that has higher-return uses elsewhere.`
    );
  }
  reasoningParts.push(
    `Portfolio confidence of ${fmtPct(summary.portfolioConfidence)} reflects ${
      allocations.filter((a) => {
        const l = getLever(a.leverId);
        return l?.riskScore === "low";
      }).length
    } of ${allocations.length} allocations sitting on low-risk levers with proven elasticity, with payback expected by week ${summary.paybackWeeks}.`
  );

  const reasoning = reasoningParts.join(" ");

  const leverJustifications = allocations.map((a) => ({ leverId: a.leverId, justification: leverJustification(a) }));

  // Risks
  const risks: string[] = [];
  const hasDtc = allocations.find((a) => a.leverId === "dtc-spend");
  if (hasDtc) {
    risks.push(
      "DTC investment carries higher response variance — actual lift may fall outside the P10–P90 range given regulatory and creative-execution uncertainty."
    );
  }
  const hasExpansion = allocations.find((a) => a.leverId === "field-force-expansion");
  if (hasExpansion) {
    risks.push(
      `Field Force Expansion has a 12-week ramp — full impact is not realized for ${hasExpansion.rampWeeks} weeks, and hiring delays can stretch that further.`
    );
  }
  const hasPS = allocations.find((a) => a.leverId === "patient-services-capacity");
  if (hasPS) {
    risks.push(
      "Patient Services Capacity is operations-dependent — hiring and onboarding delays could push impact realization out by 4–8 weeks beyond the modeled ramp."
    );
  }
  if (risks.length === 0) {
    risks.push(
      "All allocated levers are low-risk, but the portfolio is correlated with overall market response — a broad-market downturn would erode several allocations simultaneously."
    );
  }
  risks.push(
    "Elasticity calibrations come from industry benchmarks, not Genentech's internal historical activity-to-outcome data — replace with your own data on day-one of production for tighter confidence intervals."
  );

  // Watch list
  const watchList: string[] = [
    "Track NBRx variance in target territories weekly during the first 4 weeks of execution to confirm the response thesis.",
    "Monitor sample-to-NBRx conversion rate against benchmark to validate Sample Reallocation's elasticity assumption.",
    "Compare actual incremental revenue versus expected impact monthly; recalibrate elasticity if variance > 25% sustained.",
  ];

  return {
    headline,
    reasoning,
    leverJustifications,
    risks,
    watchList,
    generatedBy: "deterministic-fallback",
  };
}
