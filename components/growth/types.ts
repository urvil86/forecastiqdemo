import type { AllocationRequest } from "@/lib/growth-intel";

export interface GrowthFormState {
  budgetUsd: number;
  forecastYear: number;
  timelineWeeks: number;
  objective: AllocationRequest["objective"];
  excludedLevers: string[];
  categoryCaps: { commercial: number; optimization: number; operations: number };
  riskTolerance: "balanced" | "conservative" | "aggressive";
}

export const DEFAULT_GROWTH_FORM: GrowthFormState = {
  budgetUsd: 10_000_000,
  forecastYear: 2027,
  timelineWeeks: 52,
  objective: "max-revenue",
  excludedLevers: [],
  categoryCaps: { commercial: 20_000_000, optimization: 20_000_000, operations: 20_000_000 },
  riskTolerance: "balanced",
};
