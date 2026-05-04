import type { ConnectedForecast } from "@/lib/engine";

export type Severity = "error" | "warning" | "info";

export interface InputIssue {
  id: string;
  section: string;
  severity: Severity;
  message: string;
  /** Anchor id to scroll to */
  anchor: string;
}

export function validateInput(forecast: ConnectedForecast): InputIssue[] {
  const issues: InputIssue[] = [];
  const stage = forecast.lifecycleStage ?? "growth";
  const methodology = forecast.lrpMethodology ?? "epidemiology";

  // ─── LRP Epidemiology ─────────────────────────────────────────
  if (methodology === "epidemiology") {
    const inputs = forecast.epidemiologyInputs;
    if (!inputs || inputs.yearly.length === 0) {
      issues.push({
        id: "epi-missing",
        section: "LRP Epidemiology",
        severity: "error",
        message: "No epidemiology inputs populated.",
        anchor: "lrp",
      });
    } else {
      for (const y of inputs.yearly) {
        const checks: { field: string; value: number; min: number; max: number }[] = [
          { field: "diagnosisRatePct", value: y.diagnosisRatePct, min: 0, max: 100 },
          { field: "treatedRatePct", value: y.treatedRatePct, min: 0, max: 100 },
          { field: "classSharePct", value: y.classSharePct, min: 0, max: 100 },
          { field: "brandSharePct", value: y.brandSharePct, min: 0, max: 100 },
          { field: "persistenceY1Pct", value: y.persistenceY1Pct, min: 0, max: 100 },
          { field: "persistenceY2Pct", value: y.persistenceY2Pct, min: 0, max: 100 },
        ];
        for (const c of checks) {
          if (c.value < c.min || c.value > c.max) {
            issues.push({
              id: `epi-${c.field}-${y.year}`,
              section: "LRP Epidemiology",
              severity: "error",
              message: `${c.field} for ${y.year} out of range (${c.value})`,
              anchor: "lrp",
            });
          }
        }
        if (y.dosesPerPatientYear <= 0) {
          issues.push({
            id: `epi-doses-${y.year}`,
            section: "LRP Epidemiology",
            severity: "warning",
            message: `Doses per patient per year for ${y.year} is zero.`,
            anchor: "lrp",
          });
        }
      }
    }
  }

  // ─── LRP Market Share ─────────────────────────────────────────
  if (methodology === "market-share") {
    const inputs = forecast.marketShareInputs;
    if (!inputs || inputs.yearly.length === 0) {
      issues.push({
        id: "ms-missing",
        section: "LRP Market Share",
        severity: "error",
        message: "No market share inputs populated.",
        anchor: "lrp",
      });
    } else {
      for (const y of inputs.yearly) {
        if (y.brandSharePct < 0 || y.brandSharePct > 100) {
          issues.push({
            id: `ms-share-${y.year}`,
            section: "LRP Market Share",
            severity: "error",
            message: `Brand share for ${y.year} out of range (${y.brandSharePct}%)`,
            anchor: "lrp",
          });
        }
        if (y.totalMarketUsdM <= 0 && (y.totalMarketUnitsK ?? 0) <= 0) {
          issues.push({
            id: `ms-mkt-${y.year}`,
            section: "LRP Market Share",
            severity: "error",
            message: `Total market for ${y.year} is zero.`,
            anchor: "lrp",
          });
        }
      }
    }
  }

  // ─── Pre-launch overlay ───────────────────────────────────────
  if (stage === "pre-launch") {
    const ov = forecast.preLaunchOverlay;
    if (!ov) {
      issues.push({
        id: "pre-missing",
        section: "Pre-launch overlay",
        severity: "error",
        message: "Pre-launch overlay not populated.",
        anchor: "lrp",
      });
    } else {
      const totalWeight = ov.analogs.reduce((a, x) => a + x.weightPct, 0);
      if (Math.abs(totalWeight - 100) > 0.5) {
        issues.push({
          id: "pre-weights",
          section: "Pre-launch · Analogs",
          severity: "error",
          message: `Analog weights sum to ${totalWeight.toFixed(1)}% (must equal 100).`,
          anchor: "lrp",
        });
      }
      const probs = [
        ov.posModel.phase3ReadoutProb,
        ov.posModel.fdaFilingProb,
        ov.posModel.fdaApprovalProb,
      ];
      for (const p of probs) {
        if (p < 0 || p > 1) {
          issues.push({
            id: "pre-pos",
            section: "Pre-launch · PoS",
            severity: "error",
            message: "Milestone probability must be between 0 and 1.",
            anchor: "lrp",
          });
          break;
        }
      }
    }
  }

  // ─── LoE overlay ──────────────────────────────────────────────
  if (stage === "loe") {
    const ov = forecast.loeOverlay;
    if (!ov) {
      issues.push({
        id: "loe-missing",
        section: "LoE overlay",
        severity: "error",
        message: "LoE overlay not populated.",
        anchor: "lrp",
      });
    } else {
      function isMonotonicDecreasing(arr: { yearsAfterEntry: number; remainingClassPricePct?: number; remainingOriginatorSharePct?: number }[], field: "remainingClassPricePct" | "remainingOriginatorSharePct") {
        const sorted = arr.slice().sort((a, b) => a.yearsAfterEntry - b.yearsAfterEntry);
        for (let i = 1; i < sorted.length; i++) {
          const prev = (sorted[i - 1] as Record<string, number>)[field] ?? 100;
          const cur = (sorted[i] as Record<string, number>)[field] ?? 100;
          if (cur > prev + 0.01) return false;
        }
        return true;
      }
      if (!isMonotonicDecreasing(ov.biosimilarEntry.classPriceErosionByYear, "remainingClassPricePct")) {
        issues.push({
          id: "loe-price",
          section: "LoE · Class price erosion",
          severity: "warning",
          message: "Class price erosion curve is not monotonically decreasing.",
          anchor: "lrp",
        });
      }
      if (
        !isMonotonicDecreasing(
          ov.biosimilarEntry.originatorShareRetentionByYear,
          "remainingOriginatorSharePct",
        )
      ) {
        issues.push({
          id: "loe-share",
          section: "LoE · Share retention",
          severity: "warning",
          message: "Originator share retention curve is not monotonically decreasing.",
          anchor: "lrp",
        });
      }
    }
  }

  // ─── STF (when applicable) ────────────────────────────────────
  if (stage !== "pre-launch") {
    const stf = forecast.stf;
    if (!stf || !stf.weeklyInputs) {
      issues.push({
        id: "stf-missing",
        section: "STF",
        severity: "warning",
        message: "STF inputs not populated.",
        anchor: "stf",
      });
    } else if (stf.weeklyInputs.length === 0) {
      issues.push({
        id: "stf-weeks",
        section: "STF · Weekly inputs",
        severity: "info",
        message: "No weekly inputs yet — engine will use trend defaults.",
        anchor: "stf",
      });
    }
  }

  return issues;
}

export function summary(issues: InputIssue[]): {
  status: "ok" | "warnings" | "errors";
  errors: number;
  warnings: number;
  info: number;
} {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const info = issues.filter((i) => i.severity === "info").length;
  const status = errors > 0 ? "errors" : warnings > 0 ? "warnings" : "ok";
  return { status, errors, warnings, info };
}
