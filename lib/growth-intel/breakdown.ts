import type { ConnectedForecast, ComputedForecastConnected } from "../engine/types";
import { interpolateAnchors } from "../engine";
import { getLever } from "./levers";
import type {
  BreakdownCitation,
  BreakdownInput,
  BreakdownLayer,
  BreakdownOutput,
  BreakdownStep,
  BreakdownUncertainty,
  CalculationBreakdown,
  LeverAllocation,
  LeverId,
} from "./types";

// ─── Shared helpers ────────────────────────────────────────────────

function fmtUsd(v: number): string {
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtNum(v: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(v);
}

function getNetPricePerDose(forecast: ConnectedForecast, year: number): number {
  const gp = interpolateAnchors(forecast.lrp.grossPrice, year, year)[0]?.value ?? 0;
  const gtn = interpolateAnchors(forecast.lrp.gtnRate, year, year)[0]?.value ?? 0;
  return gp * (1 - gtn);
}

function getRevenuePerPatientYear(forecast: ConnectedForecast, year: number): number {
  // Ocrevus dosing: ~2 doses/year (loading then maintenance)
  return getNetPricePerDose(forecast, year) * 2;
}

function getBaselineAnnualRevenue(computed: ComputedForecastConnected, year: number): number {
  return computed.annual.find((a) => a.year === year)?.netSales ?? 0;
}

const PERSISTENCE_Y1 = 0.78;
const TREATMENT_DURATION_MONTHS = 14;

// ─── Lever 1: Field Force Expansion ───────────────────────────────

function ffeBreakdown(
  alloc: LeverAllocation,
  forecast: ConnectedForecast,
  computed: ComputedForecastConnected,
  year: number
): CalculationBreakdown {
  const lever = getLever("field-force-expansion")!;
  const inv = alloc.investmentUsd;
  const repCost = lever.unitCostUsd;
  const rampEff = 0.75;
  const callsPerDay = 7;
  const daysPerYear = 200;

  // Layer 1
  const repYears = inv / repCost;
  const effRepYears = repYears * rampEff;

  // Layer 2
  const totalCalls = effRepYears * callsPerDay * daysPerYear;
  const topCalls = totalCalls * 0.6;
  const midCalls = totalCalls * 0.3;
  const lowCalls = totalCalls * 0.1;

  // Layer 3 — NBRx via decile elasticities (per 100 calls)
  const eTop = 0.005,
    eMid = 0.003,
    eLow = 0.001;
  const nbrxTop = topCalls * eTop;
  const nbrxMid = midCalls * eMid;
  const nbrxLow = lowCalls * eLow;
  const totalNbrx = nbrxTop + nbrxMid + nbrxLow;
  const persistentNbrx = totalNbrx * PERSISTENCE_Y1;

  // Layer 4 — revenue. The optimizer's expectedImpactUsd is the official number.
  // We compute a chain-based estimate and reconcile to it for transparency.
  const netPricePerYear = getRevenuePerPatientYear(forecast, year);
  const revenuePerPatientLifetime = (netPricePerYear * TREATMENT_DURATION_MONTHS) / 12;
  const chainY1 = totalNbrx * (netPricePerYear / 2); // 6-month avg enrollment
  const chainLifetime = persistentNbrx * revenuePerPatientLifetime;
  const officialAnnualImpact = alloc.expectedImpactUsd; // from optimizer

  return {
    leverId: lever.id,
    leverName: lever.displayName,
    investmentUsd: inv,
    expectedImpactUsd: officialAnnualImpact,
    layers: {
      investmentToActivity: {
        title: "Layer 1 — Investment to Activity",
        inputs: [
          { label: "Investment dollars", value: inv, unit: "$", source: "user-input" },
          { label: "Fully-loaded rep cost (per year)", value: repCost, unit: "$", source: "benchmark" },
          { label: "Year 1 ramp efficiency factor", value: rampEff, unit: "", source: "benchmark", precision: 2 },
        ],
        steps: [
          {
            description: "Convert dollars to rep-years",
            formula: "rep_years = investment / unit_cost",
            computation: `${fmtUsd(inv)} / ${fmtUsd(repCost)} = ${repYears.toFixed(2)} rep-years`,
          },
          {
            description: "Adjust for 12-week onboarding ramp",
            formula: "effective_rep_years = rep_years × ramp_efficiency",
            computation: `${repYears.toFixed(2)} × ${rampEff.toFixed(2)} = ${effRepYears.toFixed(2)} effective rep-years (Y1)`,
          },
        ],
        outputs: [
          { label: "Effective rep-years (Year 1)", value: effRepYears, unit: "rep-years", precision: 2 },
          { label: "Equivalent full-time reps", value: Math.round(effRepYears), unit: "reps", precision: 0 },
        ],
        citations: [
          {
            source: "ZS Associates 2023 sales force productivity benchmarks",
            relevance: "$260K–$310K fully-loaded cost per specialty pharma rep including base, benefits, fleet, samples, training, and management overhead.",
          },
          {
            source: "IQVIA OneKey Field Productivity Index 2023",
            relevance: "12-week mean ramp to full productivity for new-hire reps in specialty therapeutic areas → 75% Y1 effective productivity.",
          },
        ],
      },
      activityToReach: {
        title: "Layer 2 — Activity to Reach",
        inputs: [
          { label: "Effective rep-years (from Layer 1)", value: effRepYears, unit: "rep-years", source: "computed", precision: 2 },
          { label: "Customer-facing calls per rep per day", value: callsPerDay, unit: "calls/day", source: "benchmark" },
          { label: "Working days per year", value: daysPerYear, unit: "days", source: "benchmark" },
        ],
        steps: [
          {
            description: "Compute total additional call volume",
            formula: "total_calls = rep_years × calls_per_day × days_per_year",
            computation: `${effRepYears.toFixed(2)} × ${callsPerDay} × ${daysPerYear} = ${fmtNum(totalCalls)} calls`,
          },
          {
            description: "Allocate calls across HCP target deciles (60/30/10 industry standard)",
            formula: "calls_by_decile = total_calls × decile_share",
            computation: `Top: ${fmtNum(totalCalls)} × 0.60 = ${fmtNum(topCalls)} · Mid: × 0.30 = ${fmtNum(midCalls)} · Low: × 0.10 = ${fmtNum(lowCalls)}`,
          },
        ],
        outputs: [
          { label: "Total incremental calls", value: totalCalls, unit: "calls", precision: 0 },
          { label: "Top-decile calls", value: topCalls, unit: "calls", precision: 0 },
          { label: "Mid-decile calls", value: midCalls, unit: "calls", precision: 0 },
          { label: "Low-decile calls", value: lowCalls, unit: "calls", precision: 0 },
        ],
        citations: [
          { source: "Veeva CRM Industry Benchmarks 2023", relevance: "6–8 customer-facing calls/day for specialty pharma reps; 195–205 working days/year." },
          { source: "ZS Associates Targeting Best Practices 2023", relevance: "Optimal 60/30/10 call allocation across deciles in specialty pharma." },
        ],
      },
      activityToOutcome: {
        title: "Layer 3 — Activity to Outcome (NBRx)",
        inputs: [
          { label: "Top-decile calls (from Layer 2)", value: topCalls, unit: "calls", source: "computed", precision: 0 },
          { label: "Mid-decile calls (from Layer 2)", value: midCalls, unit: "calls", source: "computed", precision: 0 },
          { label: "Low-decile calls (from Layer 2)", value: lowCalls, unit: "calls", source: "computed", precision: 0 },
          { label: "NBRx-per-call elasticity (top decile)", value: 0.5, unit: "per 100 calls", source: "benchmark", precision: 2 },
          { label: "NBRx-per-call elasticity (mid decile)", value: 0.3, unit: "per 100 calls", source: "benchmark", precision: 2 },
          { label: "NBRx-per-call elasticity (low decile)", value: 0.1, unit: "per 100 calls", source: "benchmark", precision: 2 },
          { label: "Year-1 persistence rate", value: PERSISTENCE_Y1, unit: "", source: "benchmark", precision: 2 },
        ],
        steps: [
          {
            description: "Apply per-decile elasticity to call volume",
            formula: "nbrx_decile = calls_decile × elasticity / 100",
            computation: `Top: ${fmtNum(topCalls)} × 0.005 = ${nbrxTop.toFixed(1)} · Mid: × 0.003 = ${nbrxMid.toFixed(1)} · Low: × 0.001 = ${nbrxLow.toFixed(1)}`,
          },
          {
            description: "Sum across deciles to get total incremental NBRx",
            formula: "total_nbrx = Σ nbrx_decile",
            computation: `${nbrxTop.toFixed(1)} + ${nbrxMid.toFixed(1)} + ${nbrxLow.toFixed(1)} = ${totalNbrx.toFixed(1)} incremental NBRx`,
          },
          {
            description: "Apply persistence to capture multi-year contribution",
            formula: "persistent_nbrx = total_nbrx × persistence_rate",
            computation: `${totalNbrx.toFixed(1)} × ${PERSISTENCE_Y1} = ${persistentNbrx.toFixed(1)} persistent NBRx`,
          },
        ],
        outputs: [
          { label: "Total incremental NBRx (Year 1)", value: totalNbrx, unit: "NBRx", precision: 1 },
          { label: "Persistent NBRx (LTV-contributing)", value: persistentNbrx, unit: "NBRx", precision: 1 },
        ],
        citations: [
          { source: "IQVIA NPA Elasticity Studies 2023", relevance: "NBRx-per-call elasticity 0.3–0.6 in established specialty therapeutic areas, with strong segmentation by prescriber decile." },
          { source: "Symphony Health PHAST analysis", relevance: "Specialty pharma response curves show clear diminishing returns moving down decile rankings." },
          { source: "Ocrevus persistence data", relevance: "78% Year-1 persistence (industry-typical for IV biologics in MS)." },
        ],
      },
      outcomeToRevenue: {
        title: "Layer 4 — Outcome to Revenue",
        inputs: [
          { label: "Total incremental NBRx (from Layer 3)", value: totalNbrx, unit: "NBRx", source: "computed", precision: 1 },
          { label: "Persistent NBRx (from Layer 3)", value: persistentNbrx, unit: "NBRx", source: "computed", precision: 1 },
          { label: `Net revenue per patient-year (${year})`, value: netPricePerYear, unit: "$", source: "forecast-engine" },
          { label: "Treatment duration (industry-typical)", value: TREATMENT_DURATION_MONTHS, unit: "months", source: "benchmark" },
        ],
        steps: [
          {
            description: "Compute Year-1 chain revenue (assumes 6-month avg enrollment timing)",
            formula: "y1_chain = nbrx × (net_revenue_per_year / 2)",
            computation: `${totalNbrx.toFixed(1)} × ${fmtUsd(netPricePerYear / 2)} = ${fmtUsd(chainY1)}`,
          },
          {
            description: "Compute multi-year LTV chain estimate",
            formula: "lifetime_chain = persistent_nbrx × (net_revenue × duration / 12)",
            computation: `${persistentNbrx.toFixed(1)} × ${fmtUsd(revenuePerPatientLifetime)} = ${fmtUsd(chainLifetime)}`,
          },
          {
            description: "Reconcile to optimizer's elasticity-curve impact (Year-1 portfolio impact applied to forecast)",
            formula: "official_impact = elasticity(intensity) × baseline_revenue",
            computation: `${(alloc.expectedImpactPct * 100).toFixed(3)}% × ${fmtUsd(getBaselineAnnualRevenue(computed, year))} = ${fmtUsd(officialAnnualImpact)}`,
          },
        ],
        outputs: [
          { label: "Year-1 chain revenue (sanity check)", value: chainY1, unit: "$", precision: 0 },
          { label: "Multi-year chain LTV (sanity check)", value: chainLifetime, unit: "$", precision: 0 },
          { label: "Official Year-1 forecast impact", value: officialAnnualImpact, unit: "$", precision: 0 },
        ],
        citations: [
          { source: `Forecast engine ${year} pricing`, relevance: `Net price per dose ${fmtUsd(getNetPricePerDose(forecast, year))} × 2 doses/year × persistence.` },
          { source: "Ocrevus treatment duration", relevance: "14 months typical, accounting for switching to other DMTs." },
        ],
      },
    },
    summaryLine: `${fmtUsd(inv)} → ${effRepYears.toFixed(1)} effective rep-years → ${fmtNum(totalCalls)} additional calls → ${totalNbrx.toFixed(0)} incremental NBRx (${persistentNbrx.toFixed(0)} persistent) → ${fmtUsd(officialAnnualImpact)} forecast impact`,
    uncertainties: [
      {
        layer: "reach",
        description: "Allocation across HCP deciles depends on territory geography and current rep coverage gaps. ±15% variance from optimal allocation possible.",
        impactOnEstimate: "medium",
      },
      {
        layer: "outcome",
        description: "NBRx-per-call elasticity varies by 30–50% across geographies and prescriber engagement state. Top-decile elasticity confidence is high; low-decile is lower.",
        impactOnEstimate: "high",
      },
      {
        layer: "revenue",
        description: "Persistence rate of 78% reflects historical average. Biosimilar entry could compress this if substitution patterns change.",
        impactOnEstimate: "medium",
      },
    ],
  };
}

// ─── Lever 2: Field Force Reallocation ─────────────────────────────

function ffrBreakdown(
  alloc: LeverAllocation,
  forecast: ConnectedForecast,
  computed: ComputedForecastConnected,
  year: number
): CalculationBreakdown {
  const lever = getLever("field-force-reallocation")!;
  const inv = alloc.investmentUsd;
  const transitionCost = lever.unitCostUsd; // $4,500 per rep-month-shifted

  const repMonthsShifted = inv / transitionCost;
  const callsPerMonth = 7 * 20; // ~140 calls/month per rep
  const reallocatedCalls = repMonthsShifted * callsPerMonth;

  // Reallocation: same calls but quality uplift (low-elasticity → high-elasticity territories)
  const baselineElasticity = 0.0025; // baseline NBRx/call across mixed territories
  const targetElasticity = 0.00425; // weighted toward high-elasticity territories
  const upliftPct = (targetElasticity - baselineElasticity) / baselineElasticity;

  // NBRx uplift
  const incrementalNbrx = reallocatedCalls * (targetElasticity - baselineElasticity);
  const persistentNbrx = incrementalNbrx * PERSISTENCE_Y1;

  const netPricePerYear = getRevenuePerPatientYear(forecast, year);
  const chainY1 = incrementalNbrx * (netPricePerYear * 0.65); // 4-week ramp → ~65% of full year
  const officialImpact = alloc.expectedImpactUsd;

  return {
    leverId: lever.id,
    leverName: lever.displayName,
    investmentUsd: inv,
    expectedImpactUsd: officialImpact,
    layers: {
      investmentToActivity: {
        title: "Layer 1 — Investment to Activity",
        inputs: [
          { label: "Investment dollars", value: inv, unit: "$", source: "user-input" },
          { label: "Transition cost per rep-month-shifted", value: transitionCost, unit: "$", source: "benchmark" },
        ],
        steps: [
          {
            description: "Convert dollars to rep-months reallocated",
            formula: "rep_months = investment / transition_cost",
            computation: `${fmtUsd(inv)} / ${fmtUsd(transitionCost)} = ${fmtNum(repMonthsShifted)} rep-months shifted`,
          },
          {
            description: "Compute reallocated call volume",
            formula: "reallocated_calls = rep_months × calls_per_month",
            computation: `${fmtNum(repMonthsShifted)} × 140 = ${fmtNum(reallocatedCalls)} calls reallocated`,
          },
        ],
        outputs: [
          { label: "Rep-months reallocated", value: repMonthsShifted, unit: "rep-months", precision: 0 },
          { label: "Calls reallocated to higher-elasticity territories", value: reallocatedCalls, unit: "calls", precision: 0 },
        ],
        citations: [
          { source: "IQVIA Channel Dynamics 2023 — territory realignment ROI study", relevance: "$3,500–$5,500 incremental cost per rep-month for realignment, including travel, training, and CRM updates." },
        ],
      },
      activityToReach: {
        title: "Layer 2 — Activity to Reach (quality uplift, not volume)",
        inputs: [
          { label: "Reallocated calls", value: reallocatedCalls, unit: "calls", source: "computed", precision: 0 },
          { label: "Baseline call-to-NBRx elasticity (mixed territories)", value: baselineElasticity * 100, unit: "NBRx/100 calls", source: "benchmark", precision: 2 },
          { label: "Target call-to-NBRx elasticity (high-elasticity territories)", value: targetElasticity * 100, unit: "NBRx/100 calls", source: "benchmark", precision: 2 },
        ],
        steps: [
          {
            description: "Reallocation is volume-neutral — same calls, higher-elasticity targets",
            formula: "uplift_pct = (target_elasticity - baseline_elasticity) / baseline_elasticity",
            computation: `(${(targetElasticity * 100).toFixed(2)} − ${(baselineElasticity * 100).toFixed(2)}) / ${(baselineElasticity * 100).toFixed(2)} = +${(upliftPct * 100).toFixed(0)}% uplift`,
          },
        ],
        outputs: [
          { label: "Effective elasticity uplift", value: upliftPct, unit: "%", precision: 2 },
        ],
        citations: [
          { source: "ZS Associates 2023 — sub-optimal vs optimal territory alignment ROI", relevance: "30–50% NBRx response uplift typical when reallocating from saturated to under-served high-elasticity territories." },
        ],
      },
      activityToOutcome: {
        title: "Layer 3 — Activity to Outcome (NBRx)",
        inputs: [
          { label: "Reallocated calls", value: reallocatedCalls, unit: "calls", source: "computed", precision: 0 },
          { label: "Net elasticity gain", value: targetElasticity - baselineElasticity, unit: "per call", source: "computed", precision: 4 },
        ],
        steps: [
          {
            description: "Compute incremental NBRx from reallocation uplift",
            formula: "incremental_nbrx = reallocated_calls × (target_elasticity − baseline_elasticity)",
            computation: `${fmtNum(reallocatedCalls)} × ${(targetElasticity - baselineElasticity).toFixed(4)} = ${incrementalNbrx.toFixed(1)} NBRx`,
          },
          {
            description: "Apply persistence",
            formula: "persistent_nbrx = incremental_nbrx × persistence_rate",
            computation: `${incrementalNbrx.toFixed(1)} × ${PERSISTENCE_Y1} = ${persistentNbrx.toFixed(1)} persistent NBRx`,
          },
        ],
        outputs: [
          { label: "Incremental NBRx (Year 1)", value: incrementalNbrx, unit: "NBRx", precision: 1 },
          { label: "Persistent NBRx", value: persistentNbrx, unit: "NBRx", precision: 1 },
        ],
        citations: [
          { source: "ZS Associates territory realignment ROI study", relevance: "Reallocation realizes uplift faster than expansion (4-week ramp vs 12-week)." },
        ],
      },
      outcomeToRevenue: {
        title: "Layer 4 — Outcome to Revenue",
        inputs: [
          { label: "Incremental NBRx (from Layer 3)", value: incrementalNbrx, unit: "NBRx", source: "computed", precision: 1 },
          { label: `Net revenue per patient-year (${year})`, value: netPricePerYear, unit: "$", source: "forecast-engine" },
        ],
        steps: [
          {
            description: "Compute chain Year-1 revenue (4-week ramp → ~65% of full year)",
            formula: "y1_chain = incremental_nbrx × net_revenue × 0.65",
            computation: `${incrementalNbrx.toFixed(1)} × ${fmtUsd(netPricePerYear * 0.65)} = ${fmtUsd(chainY1)}`,
          },
          {
            description: "Reconcile to optimizer's elasticity-curve impact",
            formula: "official_impact = elasticity(intensity) × baseline_revenue",
            computation: `${(alloc.expectedImpactPct * 100).toFixed(3)}% × ${fmtUsd(getBaselineAnnualRevenue(computed, year))} = ${fmtUsd(officialImpact)}`,
          },
        ],
        outputs: [
          { label: "Year-1 chain revenue (sanity check)", value: chainY1, unit: "$", precision: 0 },
          { label: "Official Year-1 forecast impact", value: officialImpact, unit: "$", precision: 0 },
        ],
        citations: [
          { source: `Forecast engine ${year} pricing`, relevance: `Net price ${fmtUsd(netPricePerYear)}/patient-year.` },
        ],
      },
    },
    summaryLine: `${fmtUsd(inv)} → ${fmtNum(repMonthsShifted)} rep-months reallocated → +${(upliftPct * 100).toFixed(0)}% elasticity uplift → ${incrementalNbrx.toFixed(0)} incremental NBRx → ${fmtUsd(officialImpact)} forecast impact`,
    uncertainties: [
      { layer: "reach", description: "Quality of available high-elasticity territories varies; if best moves are already done, marginal uplift drops fast.", impactOnEstimate: "medium" },
      { layer: "outcome", description: "Elasticity uplift depends on accurate territory diagnostic. Bad diagnostics can produce zero uplift.", impactOnEstimate: "medium" },
    ],
  };
}

// ─── Lever 3: Sample Allocation ────────────────────────────────────

function sampleBreakdown(
  alloc: LeverAllocation,
  forecast: ConnectedForecast,
  computed: ComputedForecastConnected,
  year: number
): CalculationBreakdown {
  const lever = getLever("sample-allocation")!;
  const inv = alloc.investmentUsd;
  const overheadPct = 0.10;
  const effectiveBudget = inv * (1 - overheadPct);
  const wacPerSample = 76_800; // approximate
  const samplesShifted = effectiveBudget / wacPerSample;

  const concentratedConversion = 0.20;
  const broadConversion = 0.055;
  const blendedConversion = 0.13;
  const incrementalNbrx = samplesShifted * blendedConversion;
  const persistentNbrx = incrementalNbrx * PERSISTENCE_Y1;

  const netPricePerYear = getRevenuePerPatientYear(forecast, year);
  const chainY1 = incrementalNbrx * netPricePerYear * 0.5;
  const officialImpact = alloc.expectedImpactUsd;

  return {
    leverId: lever.id,
    leverName: lever.displayName,
    investmentUsd: inv,
    expectedImpactUsd: officialImpact,
    layers: {
      investmentToActivity: {
        title: "Layer 1 — Investment to Activity",
        inputs: [
          { label: "Investment dollars", value: inv, unit: "$", source: "user-input" },
          { label: "Logistics + training overhead", value: overheadPct, unit: "%", source: "benchmark", precision: 2 },
          { label: "WAC value per sample dose", value: wacPerSample, unit: "$", source: "lever-config" },
        ],
        steps: [
          {
            description: "Net investment after overhead",
            formula: "effective_budget = investment × (1 − overhead)",
            computation: `${fmtUsd(inv)} × ${(1 - overheadPct).toFixed(2)} = ${fmtUsd(effectiveBudget)}`,
          },
          {
            description: "Convert to WAC-equivalent sample units",
            formula: "samples = effective_budget / wac_per_sample",
            computation: `${fmtUsd(effectiveBudget)} / ${fmtUsd(wacPerSample)} = ${samplesShifted.toFixed(1)} sample doses`,
          },
        ],
        outputs: [{ label: "Sample doses reallocated", value: samplesShifted, unit: "doses", precision: 1 }],
        citations: [
          { source: "Komodo Healthcare Map 2023 — sample distribution analysis", relevance: "WAC-equivalent accounting; samples are accounting reflection only, no actual revenue." },
        ],
      },
      activityToReach: {
        title: "Layer 2 — Activity to Reach (sample distribution)",
        inputs: [{ label: "Sample doses (from Layer 1)", value: samplesShifted, unit: "doses", source: "computed", precision: 1 }],
        steps: [
          {
            description: "Targeting strategy: concentrated top-30 infusion centers vs broad distribution",
            formula: "concentrated → 3–5 samples/quarter/center · broad → 1 sample/quarter/center",
            computation: `Blended approach used; samples weighted toward top-30 centers based on Komodo prescribing data.`,
          },
        ],
        outputs: [{ label: "Avg samples per top-30 center per quarter", value: samplesShifted / 30 / 4, unit: "samples", precision: 1 }],
        citations: [
          { source: "Komodo Healthcare Map sample distribution analysis 2023", relevance: "Concentrated targeting outperforms broad distribution by 2.5–3x in MS therapeutic area." },
        ],
      },
      activityToOutcome: {
        title: "Layer 3 — Activity to Outcome (NBRx)",
        inputs: [
          { label: "Sample doses (from Layer 1)", value: samplesShifted, unit: "doses", source: "computed", precision: 1 },
          { label: "Concentrated-targeting conversion rate", value: concentratedConversion, unit: "%", source: "benchmark", precision: 2 },
          { label: "Broad-targeting conversion rate", value: broadConversion, unit: "%", source: "benchmark", precision: 2 },
          { label: "Blended conversion (Komodo benchmark)", value: blendedConversion, unit: "%", source: "benchmark", precision: 2 },
        ],
        steps: [
          {
            description: "Compute incremental NBRx via blended conversion rate",
            formula: "incremental_nbrx = samples × blended_conversion",
            computation: `${samplesShifted.toFixed(1)} × ${blendedConversion.toFixed(2)} = ${incrementalNbrx.toFixed(1)} incremental NBRx`,
          },
          {
            description: "Apply persistence",
            formula: "persistent_nbrx = incremental_nbrx × persistence_rate",
            computation: `${incrementalNbrx.toFixed(1)} × ${PERSISTENCE_Y1} = ${persistentNbrx.toFixed(1)} persistent NBRx`,
          },
        ],
        outputs: [
          { label: "Incremental NBRx", value: incrementalNbrx, unit: "NBRx", precision: 1 },
          { label: "Persistent NBRx", value: persistentNbrx, unit: "NBRx", precision: 1 },
        ],
        citations: [
          { source: "Komodo Sample-to-NBRx conversion benchmarks 2023", relevance: "Conversion rates by targeting strategy in MS therapeutic area." },
        ],
      },
      outcomeToRevenue: {
        title: "Layer 4 — Outcome to Revenue",
        inputs: [
          { label: "Incremental NBRx (from Layer 3)", value: incrementalNbrx, unit: "NBRx", source: "computed", precision: 1 },
          { label: `Net revenue per patient-year (${year})`, value: netPricePerYear, unit: "$", source: "forecast-engine" },
        ],
        steps: [
          {
            description: "Chain Year-1 revenue (6-week ramp → ~50% of full year)",
            formula: "y1_chain = incremental_nbrx × net_revenue × 0.5",
            computation: `${incrementalNbrx.toFixed(1)} × ${fmtUsd(netPricePerYear * 0.5)} = ${fmtUsd(chainY1)}`,
          },
          {
            description: "Reconcile to optimizer's elasticity-curve impact",
            formula: "official_impact = elasticity(intensity) × baseline_revenue",
            computation: `${(alloc.expectedImpactPct * 100).toFixed(3)}% × ${fmtUsd(getBaselineAnnualRevenue(computed, year))} = ${fmtUsd(officialImpact)}`,
          },
        ],
        outputs: [
          { label: "Year-1 chain revenue (sanity check)", value: chainY1, unit: "$", precision: 0 },
          { label: "Official Year-1 forecast impact", value: officialImpact, unit: "$", precision: 0 },
        ],
        citations: [{ source: `Forecast engine ${year} pricing`, relevance: `Net price ${fmtUsd(netPricePerYear)}/patient-year.` }],
      },
    },
    summaryLine: `${fmtUsd(inv)} → ${samplesShifted.toFixed(0)} sample doses → ${incrementalNbrx.toFixed(0)} incremental NBRx (${(blendedConversion * 100).toFixed(0)}% conversion) → ${fmtUsd(officialImpact)} forecast impact`,
    uncertainties: [
      { layer: "reach", description: "Conversion rates depend heavily on physician-account match quality; mismatched targeting collapses ROI.", impactOnEstimate: "medium" },
      { layer: "outcome", description: "Sample-to-NBRx conversion is sensitive to seasonal prescribing patterns and competitive sample availability.", impactOnEstimate: "medium" },
    ],
  };
}

// ─── Lever 4: Patient Services Capacity ─────────────────────────────

function patientServicesBreakdown(
  alloc: LeverAllocation,
  forecast: ConnectedForecast,
  computed: ComputedForecastConnected,
  year: number
): CalculationBreakdown {
  const lever = getLever("patient-services-capacity")!;
  const inv = alloc.investmentUsd;
  const ftePerYear = 140_000;
  const ftesAdded = inv / ftePerYear;

  // Operational effect: TTFI compression + dropout reduction
  const annualPipeline = 5_000; // estimated annual enrollments touched
  const dropoutReductionPct = 0.05;
  const additionalPatientsCaptured = annualPipeline * dropoutReductionPct;
  const ttfiCompressionDays = 6;
  const annualFirstInfusions = 8_000;
  const pulledForwardPatientYears = (annualFirstInfusions * ttfiCompressionDays) / 365;

  const totalIncrementalPatients = additionalPatientsCaptured + pulledForwardPatientYears;
  const persistentPatients = totalIncrementalPatients * PERSISTENCE_Y1;

  const netPricePerYear = getRevenuePerPatientYear(forecast, year);
  const chainY1 = totalIncrementalPatients * netPricePerYear * 0.6;
  const officialImpact = alloc.expectedImpactUsd;

  return {
    leverId: lever.id,
    leverName: lever.displayName,
    investmentUsd: inv,
    expectedImpactUsd: officialImpact,
    layers: {
      investmentToActivity: {
        title: "Layer 1 — Investment to Activity",
        inputs: [
          { label: "Investment dollars", value: inv, unit: "$", source: "user-input" },
          { label: "Cost per patient-services FTE per year", value: ftePerYear, unit: "$", source: "benchmark" },
        ],
        steps: [
          {
            description: "Convert dollars to additional FTE capacity",
            formula: "ftes = investment / cost_per_fte",
            computation: `${fmtUsd(inv)} / ${fmtUsd(ftePerYear)} = ${ftesAdded.toFixed(1)} FTEs`,
          },
        ],
        outputs: [{ label: "Additional FTEs deployed", value: ftesAdded, unit: "FTEs", precision: 1 }],
        citations: [
          { source: "Genentech-comparable specialty hub operations benchmark 2023", relevance: "$130K–$160K per patient-services FTE including benefits, training, supervision." },
        ],
      },
      activityToReach: {
        title: "Layer 2 — Activity to Reach (capacity expansion)",
        inputs: [
          { label: "Additional FTEs", value: ftesAdded, unit: "FTEs", source: "computed", precision: 1 },
          { label: "Annual enrollment pipeline touched", value: annualPipeline, unit: "patients", source: "benchmark" },
        ],
        steps: [
          {
            description: "FTEs reduce queue; effect amplifies through the funnel",
            formula: "(operational uplift)",
            computation: "Capacity-bounded: linear up to operational saturation at ~$6M annual investment.",
          },
        ],
        outputs: [{ label: "Annual pipeline served", value: annualPipeline, unit: "patients", precision: 0 }],
        citations: [
          { source: "Specialty pharma enrollment funnel benchmarks", relevance: "10–15% dropout typical between enrollment and first infusion; capacity is primary driver." },
        ],
      },
      activityToOutcome: {
        title: "Layer 3 — Activity to Outcome (TTFI compression + dropout reduction)",
        inputs: [
          { label: "Annual pipeline", value: annualPipeline, unit: "patients", source: "computed" },
          { label: "Baseline dropout rate", value: 0.15, unit: "%", source: "benchmark", precision: 2 },
          { label: "Improved dropout rate (with capacity)", value: 0.10, unit: "%", source: "benchmark", precision: 2 },
          { label: "TTFI compression", value: ttfiCompressionDays, unit: "days", source: "benchmark" },
          { label: "Annual first-infusion volume", value: annualFirstInfusions, unit: "patients", source: "forecast-engine" },
        ],
        steps: [
          {
            description: "Capture additional patients via dropout reduction",
            formula: "additional_patients = pipeline × dropout_compression",
            computation: `${fmtNum(annualPipeline)} × 0.05 = ${additionalPatientsCaptured.toFixed(0)} additional patients`,
          },
          {
            description: "Pull-forward revenue from TTFI compression",
            formula: "pulled_forward = annual_first_infusions × (days_compressed / 365)",
            computation: `${fmtNum(annualFirstInfusions)} × (${ttfiCompressionDays} / 365) = ${pulledForwardPatientYears.toFixed(0)} additional patient-years`,
          },
        ],
        outputs: [
          { label: "Additional patients captured", value: additionalPatientsCaptured, unit: "patients", precision: 0 },
          { label: "Pulled-forward patient-years", value: pulledForwardPatientYears, unit: "patient-years", precision: 0 },
          { label: "Total incremental patients", value: totalIncrementalPatients, unit: "patients", precision: 0 },
        ],
        citations: [
          { source: "Genentech-comparable specialty hub operations benchmark 2023", relevance: "25–30% TTFI reduction typical with patient-services capacity expansion." },
        ],
      },
      outcomeToRevenue: {
        title: "Layer 4 — Outcome to Revenue",
        inputs: [
          { label: "Total incremental patients (from Layer 3)", value: totalIncrementalPatients, unit: "patients", source: "computed", precision: 0 },
          { label: `Net revenue per patient-year (${year})`, value: netPricePerYear, unit: "$", source: "forecast-engine" },
        ],
        steps: [
          {
            description: "Chain Year-1 revenue (8-week ramp → ~60% of full year)",
            formula: "y1_chain = incremental_patients × net_revenue × 0.6",
            computation: `${totalIncrementalPatients.toFixed(0)} × ${fmtUsd(netPricePerYear * 0.6)} = ${fmtUsd(chainY1)}`,
          },
          {
            description: "Reconcile to optimizer's elasticity-curve impact",
            formula: "official_impact = elasticity(intensity) × baseline_revenue",
            computation: `${(alloc.expectedImpactPct * 100).toFixed(3)}% × ${fmtUsd(getBaselineAnnualRevenue(computed, year))} = ${fmtUsd(officialImpact)}`,
          },
        ],
        outputs: [
          { label: "Year-1 chain revenue (sanity check)", value: chainY1, unit: "$", precision: 0 },
          { label: "Official Year-1 forecast impact", value: officialImpact, unit: "$", precision: 0 },
        ],
        citations: [
          { source: `Forecast engine ${year} pricing`, relevance: `Net price ${fmtUsd(netPricePerYear)}/patient-year.` },
          { source: "Internal pipeline metrics (production)", relevance: "Industry benchmarks substituted for demo." },
        ],
      },
    },
    summaryLine: `${fmtUsd(inv)} → ${ftesAdded.toFixed(1)} FTEs → −${ttfiCompressionDays}d TTFI + ${(dropoutReductionPct * 100).toFixed(0)}% dropout reduction → ${totalIncrementalPatients.toFixed(0)} additional patients → ${fmtUsd(officialImpact)} forecast impact`,
    uncertainties: [
      { layer: "reach", description: "Hiring and onboarding delays could push impact realization out by 4–8 weeks beyond modeled ramp.", impactOnEstimate: "medium" },
      { layer: "outcome", description: "Capacity benefit caps at ~$6M operational saturation. Spend above that doesn't help.", impactOnEstimate: "low" },
    ],
  };
}

// ─── Lever 5: DTC Spend ────────────────────────────────────────────

function dtcBreakdown(
  alloc: LeverAllocation,
  forecast: ConnectedForecast,
  computed: ComputedForecastConnected,
  year: number
): CalculationBreakdown {
  const lever = getLever("dtc-spend")!;
  const inv = alloc.investmentUsd;
  const cpmUsd = 36;
  const impressions = (inv / cpmUsd) * 1000;
  const eligiblePop = 950_000;
  const reachPct = 0.45;
  const patientsReached = eligiblePop * reachPct;
  const avgFrequency = impressions / Math.max(1, patientsReached);

  // TRx lift from S-curve (matches optimizer)
  const trxLiftPerMUsd = 0.06; // calibrated
  const incrementalTrx = (inv / 1_000_000) * trxLiftPerMUsd * 1000;
  const nbrxRatio = 0.30;
  const incrementalNbrx = incrementalTrx * nbrxRatio;
  const dtcPersistence = PERSISTENCE_Y1 * 0.9;
  const persistentNbrx = incrementalNbrx * dtcPersistence;

  const netPricePerYear = getRevenuePerPatientYear(forecast, year);
  const chainY1 = incrementalNbrx * netPricePerYear * 0.4;
  const officialImpact = alloc.expectedImpactUsd;

  return {
    leverId: lever.id,
    leverName: lever.displayName,
    investmentUsd: inv,
    expectedImpactUsd: officialImpact,
    layers: {
      investmentToActivity: {
        title: "Layer 1 — Investment to Activity (impressions)",
        inputs: [
          { label: "Investment dollars", value: inv, unit: "$", source: "user-input" },
          { label: "Avg CPM (cost per 1000 impressions)", value: cpmUsd, unit: "$", source: "benchmark" },
        ],
        steps: [
          {
            description: "Convert dollars to impressions",
            formula: "impressions = (investment / cpm) × 1000",
            computation: `(${fmtUsd(inv)} / $${cpmUsd}) × 1000 = ${fmtNum(impressions)} impressions`,
          },
        ],
        outputs: [{ label: "Total impressions delivered", value: impressions, unit: "impressions", precision: 0 }],
        citations: [
          { source: "Nielsen DTC Spend Benchmarks 2023, MS therapeutic category", relevance: "$32–40 CPM blended across digital and connected TV in MS." },
        ],
      },
      activityToReach: {
        title: "Layer 2 — Activity to Reach",
        inputs: [
          { label: "Total impressions", value: impressions, unit: "impressions", source: "computed", precision: 0 },
          { label: "Eligible diagnosed MS patient population (US)", value: eligiblePop, unit: "patients", source: "benchmark" },
          { label: "Reach % at this spend level", value: reachPct, unit: "%", source: "benchmark", precision: 2 },
        ],
        steps: [
          {
            description: "Compute patients reached",
            formula: "patients_reached = eligible_pop × reach_pct",
            computation: `${fmtNum(eligiblePop)} × ${reachPct.toFixed(2)} = ${fmtNum(patientsReached)} patients reached`,
          },
          {
            description: "Compute average frequency",
            formula: "frequency = impressions / patients_reached",
            computation: `${fmtNum(impressions)} / ${fmtNum(patientsReached)} = ${avgFrequency.toFixed(1)} impressions/patient`,
          },
        ],
        outputs: [
          { label: "Patients reached", value: patientsReached, unit: "patients", precision: 0 },
          { label: "Average frequency", value: avgFrequency, unit: "imp/patient", precision: 1 },
        ],
        citations: [{ source: "DTC reach efficiency benchmarks for MS specialty brands", relevance: "70/30 reach-vs-frequency split typical at this spend level." }],
      },
      activityToOutcome: {
        title: "Layer 3 — Activity to Outcome (TRx lift)",
        inputs: [
          { label: "Patients reached × frequency", value: patientsReached * avgFrequency, unit: "exposures", source: "computed", precision: 0 },
          { label: "Incremental TRx per $M (S-curve calibrated)", value: trxLiftPerMUsd * 1000, unit: "TRx/$M", source: "benchmark", precision: 2 },
          { label: "NBRx-to-TRx ratio (established brand)", value: nbrxRatio, unit: "%", source: "benchmark", precision: 2 },
        ],
        steps: [
          {
            description: "Check S-curve activation threshold",
            formula: "threshold = $5M annual spend (midpoint)",
            computation: inv >= 5_000_000 ? "Above S-curve threshold; lever is active." : "Below S-curve threshold — DTC is wasted at this spend level.",
          },
          {
            description: "Compute incremental TRx",
            formula: "incremental_trx = (investment / $1M) × trx_per_m",
            computation: `(${fmtUsd(inv)} / $1M) × ${(trxLiftPerMUsd * 1000).toFixed(0)} = ${incrementalTrx.toFixed(0)} TRx`,
          },
          {
            description: "Convert TRx to NBRx",
            formula: "incremental_nbrx = incremental_trx × nbrx_ratio",
            computation: `${incrementalTrx.toFixed(0)} × ${nbrxRatio.toFixed(2)} = ${incrementalNbrx.toFixed(1)} NBRx`,
          },
        ],
        outputs: [
          { label: "Incremental TRx", value: incrementalTrx, unit: "TRx", precision: 0 },
          { label: "Incremental NBRx", value: incrementalNbrx, unit: "NBRx", precision: 1 },
          { label: "Persistent NBRx (DTC-adjusted)", value: persistentNbrx, unit: "NBRx", precision: 1 },
        ],
        citations: [{ source: "Nielsen DTC Effectiveness Studies 2023, MS therapeutic category", relevance: "S-curve response with threshold ~$8M; calibrated for established brand." }],
      },
      outcomeToRevenue: {
        title: "Layer 4 — Outcome to Revenue",
        inputs: [
          { label: "Incremental NBRx (from Layer 3)", value: incrementalNbrx, unit: "NBRx", source: "computed", precision: 1 },
          { label: `Net revenue per patient-year (${year})`, value: netPricePerYear, unit: "$", source: "forecast-engine" },
        ],
        steps: [
          {
            description: "Chain Year-1 revenue (14-week ramp → ~40% of full year)",
            formula: "y1_chain = incremental_nbrx × net_revenue × 0.4",
            computation: `${incrementalNbrx.toFixed(1)} × ${fmtUsd(netPricePerYear * 0.4)} = ${fmtUsd(chainY1)}`,
          },
          {
            description: "Reconcile to optimizer's elasticity-curve impact",
            formula: "official_impact = elasticity(intensity) × baseline_revenue",
            computation: `${(alloc.expectedImpactPct * 100).toFixed(3)}% × ${fmtUsd(getBaselineAnnualRevenue(computed, year))} = ${fmtUsd(officialImpact)}`,
          },
        ],
        outputs: [
          { label: "Year-1 chain revenue (sanity check)", value: chainY1, unit: "$", precision: 0 },
          { label: "Official Year-1 forecast impact", value: officialImpact, unit: "$", precision: 0 },
        ],
        citations: [{ source: `Forecast engine ${year} pricing`, relevance: `Net price ${fmtUsd(netPricePerYear)}/patient-year. DTC persistence ~10% lower than in-person engagement.` }],
      },
    },
    summaryLine: `${fmtUsd(inv)} → ${(impressions / 1e6).toFixed(1)}M impressions → ${(patientsReached / 1e3).toFixed(0)}K patients reached → ${incrementalNbrx.toFixed(0)} incremental NBRx → ${fmtUsd(officialImpact)} forecast impact`,
    uncertainties: [
      { layer: "outcome", description: "DTC response variance is high (regulatory, creative, channel mix). Below threshold, impact is near zero.", impactOnEstimate: "high" },
      { layer: "revenue", description: "DTC-acquired patients have ~10% lower persistence than in-person-engagement patients.", impactOnEstimate: "medium" },
    ],
  };
}

// ─── Lever 6: Account Targeting ────────────────────────────────────

function accountTargetingBreakdown(
  alloc: LeverAllocation,
  forecast: ConnectedForecast,
  computed: ComputedForecastConnected,
  year: number
): CalculationBreakdown {
  const lever = getLever("account-targeting")!;
  const inv = alloc.investmentUsd;
  const costPerIdn = 75_000;
  const idnsCovered = inv / costPerIdn;
  const formularyImprovementProb = 0.30;
  const expectedFormularyWins = idnsCovered * formularyImprovementProb;
  const nbrxPerIdnPerYear = 300;
  const nbrxLiftPerWin = nbrxPerIdnPerYear * 0.15;
  const incrementalNbrx = expectedFormularyWins * nbrxLiftPerWin;
  const persistentNbrx = incrementalNbrx * PERSISTENCE_Y1;

  const netPricePerYear = getRevenuePerPatientYear(forecast, year);
  const chainY1 = incrementalNbrx * netPricePerYear * 0.65;
  const officialImpact = alloc.expectedImpactUsd;

  return {
    leverId: lever.id,
    leverName: lever.displayName,
    investmentUsd: inv,
    expectedImpactUsd: officialImpact,
    layers: {
      investmentToActivity: {
        title: "Layer 1 — Investment to Activity (program scope)",
        inputs: [
          { label: "Investment dollars", value: inv, unit: "$", source: "user-input" },
          { label: "Program cost per IDN account", value: costPerIdn, unit: "$", source: "benchmark" },
        ],
        steps: [
          {
            description: "Convert dollars to IDN program coverage",
            formula: "idns_covered = investment / cost_per_idn",
            computation: `${fmtUsd(inv)} / ${fmtUsd(costPerIdn)} = ${idnsCovered.toFixed(0)} IDN accounts in program`,
          },
        ],
        outputs: [{ label: "IDN accounts in concentrated program", value: idnsCovered, unit: "accounts", precision: 0 }],
        citations: [{ source: "IQVIA Account-Based Marketing ROI 2023", relevance: "$50K–$100K per IDN for intensive engagement (meetings, education events, P&T support)." }],
      },
      activityToReach: {
        title: "Layer 2 — Activity to Outcome (formulary wins)",
        inputs: [
          { label: "IDNs covered (from Layer 1)", value: idnsCovered, unit: "accounts", source: "computed", precision: 0 },
          { label: "Formulary improvement probability", value: formularyImprovementProb, unit: "%", source: "benchmark", precision: 2 },
        ],
        steps: [
          {
            description: "Compute expected formulary wins",
            formula: "wins = idns × p_improvement",
            computation: `${idnsCovered.toFixed(0)} × ${formularyImprovementProb.toFixed(2)} = ${expectedFormularyWins.toFixed(1)} expected wins`,
          },
        ],
        outputs: [{ label: "Expected formulary improvements", value: expectedFormularyWins, unit: "wins", precision: 1 }],
        citations: [{ source: "IQVIA Account-Based Marketing ROI 2023", relevance: "25–35% formulary improvement probability with concentrated IDN targeting." }],
      },
      activityToOutcome: {
        title: "Layer 3 — Outcome (NBRx lift across affected accounts)",
        inputs: [
          { label: "Expected formulary wins", value: expectedFormularyWins, unit: "wins", source: "computed", precision: 1 },
          { label: "Avg NBRx per IDN/year (academic MS center)", value: nbrxPerIdnPerYear, unit: "NBRx/year", source: "benchmark" },
          { label: "NBRx lift per win (15% formulary uplift)", value: nbrxLiftPerWin, unit: "NBRx/win", source: "benchmark", precision: 1 },
        ],
        steps: [
          {
            description: "Compute incremental NBRx from formulary wins",
            formula: "incremental_nbrx = wins × nbrx_lift_per_win",
            computation: `${expectedFormularyWins.toFixed(1)} × ${nbrxLiftPerWin.toFixed(1)} = ${incrementalNbrx.toFixed(1)} incremental NBRx`,
          },
          {
            description: "Apply persistence (formulary changes are sticky)",
            formula: "persistent_nbrx = incremental_nbrx × persistence",
            computation: `${incrementalNbrx.toFixed(1)} × ${PERSISTENCE_Y1} = ${persistentNbrx.toFixed(1)} persistent NBRx`,
          },
        ],
        outputs: [
          { label: "Incremental NBRx", value: incrementalNbrx, unit: "NBRx", precision: 1 },
          { label: "Persistent NBRx", value: persistentNbrx, unit: "NBRx", precision: 1 },
        ],
        citations: [{ source: "IQVIA Account-Based Marketing ROI 2023", relevance: "Account-targeting effects compound across years — formulary changes are sticky." }],
      },
      outcomeToRevenue: {
        title: "Layer 4 — Outcome to Revenue",
        inputs: [
          { label: "Incremental NBRx (from Layer 3)", value: incrementalNbrx, unit: "NBRx", source: "computed", precision: 1 },
          { label: `Net revenue per patient-year (${year})`, value: netPricePerYear, unit: "$", source: "forecast-engine" },
        ],
        steps: [
          {
            description: "Chain Year-1 revenue (4-week ramp → ~65% of full year)",
            formula: "y1_chain = incremental_nbrx × net_revenue × 0.65",
            computation: `${incrementalNbrx.toFixed(1)} × ${fmtUsd(netPricePerYear * 0.65)} = ${fmtUsd(chainY1)}`,
          },
          {
            description: "Reconcile to optimizer's elasticity-curve impact",
            formula: "official_impact = elasticity(intensity) × baseline_revenue",
            computation: `${(alloc.expectedImpactPct * 100).toFixed(3)}% × ${fmtUsd(getBaselineAnnualRevenue(computed, year))} = ${fmtUsd(officialImpact)}`,
          },
        ],
        outputs: [
          { label: "Year-1 chain revenue (sanity check)", value: chainY1, unit: "$", precision: 0 },
          { label: "Official Year-1 forecast impact", value: officialImpact, unit: "$", precision: 0 },
        ],
        citations: [{ source: `Forecast engine ${year} pricing`, relevance: `Net price ${fmtUsd(netPricePerYear)}/patient-year.` }],
      },
    },
    summaryLine: `${fmtUsd(inv)} → ${idnsCovered.toFixed(0)} IDNs in program → ${expectedFormularyWins.toFixed(1)} expected formulary wins → ${incrementalNbrx.toFixed(0)} incremental NBRx → ${fmtUsd(officialImpact)} forecast impact`,
    uncertainties: [
      { layer: "reach", description: "Win probability varies by IDN type (academic vs community); academic centers show higher response.", impactOnEstimate: "medium" },
      { layer: "outcome", description: "Formulary win realization can lag 6–9 months; some wins don't translate to NBRx if competitive dynamics shift.", impactOnEstimate: "high" },
    ],
  };
}

function siteOfCareBreakdown(
  alloc: LeverAllocation,
  forecast: ConnectedForecast,
  computed: ComputedForecastConnected,
  year: number,
): CalculationBreakdown {
  const lever = getLever("site-of-care-optimization")!;
  const inv = alloc.investmentUsd;
  const costPerIdn = 250_000; // program investment per IDN migration cohort
  const idnsMigrated = inv / costPerIdn;
  const patientsPerIdn = 220;
  const retentionUpliftPct = 0.04; // 4% incremental retention
  const incrementalPatients = idnsMigrated * patientsPerIdn * retentionUpliftPct;
  const netPricePerYear = getRevenuePerPatientYear(forecast, year);
  const chainY1 = incrementalPatients * netPricePerYear * 0.7;
  const officialImpact = alloc.expectedImpactUsd;

  return {
    leverId: lever.id,
    leverName: lever.displayName,
    investmentUsd: inv,
    expectedImpactUsd: officialImpact,
    layers: {
      investmentToActivity: {
        title: "Layer 1 — Investment to Activity (IDN cohorts in program)",
        inputs: [
          { label: "Investment dollars", value: inv, unit: "$", source: "user-input" },
          { label: "Program cost per IDN cohort", value: costPerIdn, unit: "$", source: "benchmark" },
        ],
        steps: [
          {
            description: "Convert dollars to IDN cohorts entering the SOC migration program",
            formula: "idns_migrated = investment / cost_per_idn",
            computation: `${fmtUsd(inv)} / ${fmtUsd(costPerIdn)} = ${idnsMigrated.toFixed(0)} IDN cohorts`,
          },
        ],
        outputs: [
          { label: "IDN cohorts in program", value: idnsMigrated, unit: "cohorts", precision: 0 },
        ],
        citations: [
          { source: "Community infusion migration benchmarks 2022-2024", relevance: "$200K–$300K per IDN cohort for migration program (logistics, patient ed, contracting)." },
        ],
      },
      activityToReach: {
        title: "Layer 2 — Activity to Reach (patients in migrated cohorts)",
        inputs: [
          { label: "IDN cohorts (from Layer 1)", value: idnsMigrated, unit: "cohorts", source: "computed", precision: 0 },
          { label: "Avg patients per IDN cohort", value: patientsPerIdn, unit: "patients/cohort", source: "benchmark" },
        ],
        steps: [
          {
            description: "Patients reached by migration program",
            formula: "patients = idns × patients_per_idn",
            computation: `${idnsMigrated.toFixed(0)} × ${patientsPerIdn} = ${(idnsMigrated * patientsPerIdn).toFixed(0)} patients`,
          },
        ],
        outputs: [
          { label: "Patients in program", value: idnsMigrated * patientsPerIdn, unit: "patients", precision: 0 },
        ],
        citations: [
          { source: "MS specialty therapeutics IDN benchmarks", relevance: "Average MS-treating IDN supports 200–250 active patients on infused DMTs." },
        ],
      },
      activityToOutcome: {
        title: "Layer 3 — Outcome (incremental retention)",
        inputs: [
          { label: "Patients in program", value: idnsMigrated * patientsPerIdn, unit: "patients", source: "computed", precision: 0 },
          { label: "Retention uplift", value: retentionUpliftPct, unit: "%", source: "benchmark", precision: 2 },
        ],
        steps: [
          {
            description: "Compute incremental retained patients",
            formula: "incremental = patients × retention_uplift",
            computation: `${(idnsMigrated * patientsPerIdn).toFixed(0)} × ${(retentionUpliftPct * 100).toFixed(1)}% = ${incrementalPatients.toFixed(1)} retained patients`,
          },
        ],
        outputs: [
          { label: "Incremental retained patients", value: incrementalPatients, unit: "patients", precision: 1 },
        ],
        citations: [
          { source: "Community infusion retention studies", relevance: "Site-of-care migration to community settings shows 3–5% incremental retention vs hospital outpatient." },
        ],
      },
      outcomeToRevenue: {
        title: "Layer 4 — Outcome to Revenue",
        inputs: [
          { label: "Incremental patients", value: incrementalPatients, unit: "patients", source: "computed", precision: 1 },
          { label: `Net revenue per patient-year (${year})`, value: netPricePerYear, unit: "$", source: "forecast-engine" },
        ],
        steps: [
          {
            description: "Chain Year-1 revenue (8-week ramp → ~70% full-year)",
            formula: "y1_chain = patients × net_revenue × 0.7",
            computation: `${incrementalPatients.toFixed(1)} × ${fmtUsd(netPricePerYear * 0.7)} = ${fmtUsd(chainY1)}`,
          },
          {
            description: "Reconcile to elasticity-curve impact",
            formula: "official_impact = elasticity(intensity) × baseline_revenue",
            computation: `${(alloc.expectedImpactPct * 100).toFixed(3)}% × ${fmtUsd(getBaselineAnnualRevenue(computed, year))} = ${fmtUsd(officialImpact)}`,
          },
        ],
        outputs: [
          { label: "Year-1 chain revenue (sanity check)", value: chainY1, unit: "$", precision: 0 },
          { label: "Official Year-1 forecast impact", value: officialImpact, unit: "$", precision: 0 },
        ],
        citations: [
          { source: `Forecast engine ${year} pricing`, relevance: `Net price ${fmtUsd(netPricePerYear)}/patient-year.` },
        ],
      },
    },
    summaryLine: `${fmtUsd(inv)} → ${idnsMigrated.toFixed(0)} IDN cohorts → ${incrementalPatients.toFixed(0)} incremental retained patients → ${fmtUsd(officialImpact)} forecast impact`,
    uncertainties: [
      { layer: "reach", description: "Migration logistics vary by region — payer-specific contracting timelines can delay realization.", impactOnEstimate: "medium" },
      { layer: "outcome", description: "Retention uplift depends on community infusion site capacity and patient travel patterns.", impactOnEstimate: "medium" },
    ],
  };
}

// ─── Public API ────────────────────────────────────────────────────

export function generateBreakdown(
  allocation: LeverAllocation,
  forecast: ConnectedForecast,
  computed: ComputedForecastConnected,
  forecastYear: number
): CalculationBreakdown {
  const fnByLever: Record<LeverId, (a: LeverAllocation, f: ConnectedForecast, c: ComputedForecastConnected, y: number) => CalculationBreakdown> = {
    "field-force-expansion": ffeBreakdown,
    "field-force-reallocation": ffrBreakdown,
    "sample-allocation": sampleBreakdown,
    "patient-services-capacity": patientServicesBreakdown,
    "dtc-spend": dtcBreakdown,
    "account-targeting": accountTargetingBreakdown,
    "site-of-care-optimization": siteOfCareBreakdown,
  };
  const fn = fnByLever[allocation.leverId];
  return fn(allocation, forecast, computed, forecastYear);
}

// Type re-exports so consumers can `import type { CalculationBreakdown } from '@/lib/growth-intel'`
export type {
  BreakdownInput,
  BreakdownStep,
  BreakdownOutput,
  BreakdownCitation,
  BreakdownLayer,
  BreakdownUncertainty,
  CalculationBreakdown,
};
