import { describe, it, expect } from "vitest";
import { compute, seekToForecast, reconcile, getSeedForecast } from "..";
import type { ConnectedForecast } from "../types";

function stripComputedAt(o: unknown): unknown {
  return JSON.parse(JSON.stringify(o, (k, v) => (k === "computedAt" ? undefined : v)));
}

describe("Engine validation suite", () => {
  it("Test 1 — Determinism", () => {
    const f = getSeedForecast();
    const a = stripComputedAt(compute(f));
    const b = stripComputedAt(compute(f));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("Test 2 — Output magnitude sanity", () => {
    const c = compute(getSeedForecast());
    const a26 = c.annual.find((a) => a.year === 2026)!.netSales;
    const a27 = c.annual.find((a) => a.year === 2027)!.netSales;
    const a30 = c.annual.find((a) => a.year === 2030)!.netSales;
    const a35 = c.annual.find((a) => a.year === 2035)!.netSales;
    // 2026 in target range
    expect(a26).toBeGreaterThan(4.0e9);
    expect(a26).toBeLessThan(4.6e9);
    // 2027 should be in a reasonable range and grow over 2026 (pre-biosimilar peak)
    expect(a27).toBeGreaterThan(4.0e9);
    expect(a27).toBeLessThan(6.5e9);
    expect(a27).toBeGreaterThan(a26);
    // Biosimilar effect kicks in by 2030
    expect(a30).toBeGreaterThan(2.0e9);
    expect(a30).toBeLessThan(a27);
    // Continued decline through 2035
    expect(a35).toBeLessThan(a30);
  });

  it("Test 3 — Multi-grain consistency", () => {
    const c = compute(getSeedForecast());
    expect(c.grainConsistency.monthlyToAnnualMaxDriftPct).toBeLessThan(0.005);
    expect(c.grainConsistency.weeklyToMonthlyMaxDriftPct).toBeLessThan(0.005);
    expect(c.grainConsistency.dailyToWeeklyMaxDriftPct).toBeLessThan(0.001);
  });

  it("Test 4 — Edit cascade (LRP → STF)", () => {
    const f = getSeedForecast();
    const cBase = compute(f);
    const baseQ3 = cBase.monthly
      .filter((m) => m.year === 2026 && m.quarter === 3)
      .reduce((s, m) => s + m.netSales, 0);
    // Reduce both surrounding anchors so 2026 interpolated drops ~19%
    const f2: ConnectedForecast = {
      ...f,
      lrp: {
        ...f.lrp,
        productShare: f.lrp.productShare.map((p) => {
          if (p.year === 2025) return { ...p, value: 0.2 };
          if (p.year === 2027) return { ...p, value: 0.19 };
          return p;
        }),
      },
    };
    const c2 = compute(f2);
    const newQ3 = c2.monthly
      .filter((m) => m.year === 2026 && m.quarter === 3)
      .reduce((s, m) => s + m.netSales, 0);
    expect(newQ3).toBeLessThan(baseQ3 * 0.85);
    const a27Base = cBase.annual.find((a) => a.year === 2027)!.netSales;
    const a27New = c2.annual.find((a) => a.year === 2027)!.netSales;
    expect(a27New).toBeLessThan(a27Base);
  });

  it("Test 5 — Edit cascade (STF → LRP rollup)", () => {
    const f = getSeedForecast();
    const cBase = compute(f);
    const baselineApr = cBase.monthly.find((m) => m.month === "2026-04")!.netSales;
    const aprWeek = cBase.weekly.find((w) => w.weekStart === "2026-04-20" && !w.isActual);
    expect(aprWeek).toBeTruthy();
    const trendVol = aprWeek!.skuValues[0].volume;
    const f2: ConnectedForecast = {
      ...f,
      stf: {
        ...f.stf,
        weeklyInputs: [
          ...f.stf.weeklyInputs,
          { weekStart: "2026-04-20", sku: "ocrevus-300mg", trendValue: trendVol, override: trendVol * 0.5 },
        ],
      },
    };
    const c2 = compute(f2);
    const newApr = c2.monthly.find((m) => m.month === "2026-04")!.netSales;
    expect(newApr).toBeLessThan(baselineApr);
  });

  it("Test 6 — Trending algorithms", () => {
    const f = getSeedForecast();
    const algos = [
      "linear",
      "exp-smoothing",
      "holt-winter-add",
      "holt-winter-mul",
      "sma-auto",
      "quick-expert",
    ] as const;
    for (const a of algos) {
      const c = compute({ ...f, lrp: { ...f.lrp, selectedAlgorithm: a } });
      const a27 = c.annual.find((aa) => aa.year === 2027)!.netSales;
      expect(a27).toBeGreaterThan(3.5e9);
      expect(a27).toBeLessThan(8e9);
      const cmpMatch = c.trendDiagnostics.algorithmsCompared.length > 0;
      expect(cmpMatch).toBe(true);
    }
  });

  it("Test 7 — Phasing arithmetic", () => {
    const f = getSeedForecast();
    const c = compute(f);
    const may = c.monthly.find((m) => m.month === "2026-05")!.netSales;
    const mayWeeks = c.weekly.filter((w) => w.month === "2026-05");
    const sumWeeks = mayWeeks.reduce((s, w) => s + w.totalNetSales, 0);
    expect(Math.abs(sumWeeks - may) / may).toBeLessThan(0.01);
    // Daily check (any non-holiday week in May): pick a standard-profile week
    const stdWeek = mayWeeks.find((w) => w.weekStart !== "2026-05-25");
    const days = c.daily.filter((d) => d.weekStart === stdWeek!.weekStart);
    const wedVol = days.find((d) => d.dayOfWeek === "Wed")!.totalVolume;
    const monVol = days.find((d) => d.dayOfWeek === "Mon")!.totalVolume;
    expect(wedVol).toBeGreaterThan(monVol);
    const sumDays = days.reduce((s, d) => s + d.totalNetSales, 0);
    expect(Math.abs(sumDays - stdWeek!.totalNetSales) / stdWeek!.totalNetSales).toBeLessThan(0.001);
  });

  it("Test 8 — Seek-to-Forecast", () => {
    const f = getSeedForecast();
    const c = compute(f);
    const baseline27 = c.annual.find((a) => a.year === 2027)!.netSales;
    const r1 = seekToForecast(
      f,
      { year: 2027, targetNetSales: baseline27 + 250e6 },
      {
        distributionMethod: "flat",
        interventionMode: "allow-stf-overrides",
        achievabilityThresholds: { achievable: 1.05, stretch: 1.15 },
      },
      c
    );
    expect(r1.monthlyDecomposition.length).toBe(12);
    const monthlyAddSum = r1.monthlyDecomposition.reduce((s, m) => s + m.additional, 0);
    expect(Math.abs(monthlyAddSum - 250e6) / 250e6).toBeLessThan(0.01);
    const weeksTotal = r1.summary.weeksAchievable + r1.summary.weeksStretch + r1.summary.weeksRequireIntervention;
    expect(weeksTotal).toBe(r1.weeklyDecomposition.length);

    const r2 = seekToForecast(
      f,
      { year: 2027, targetNetSales: baseline27 + 650e6 },
      {
        distributionMethod: "flat",
        interventionMode: "allow-stf-overrides",
        achievabilityThresholds: { achievable: 1.05, stretch: 1.15 },
      },
      c
    );
    expect(r2.summary.totalAdditionalRevenue).toBeGreaterThan(r1.summary.totalAdditionalRevenue);
    expect(r2.summary.weeksRequireIntervention).toBeGreaterThanOrEqual(r1.summary.weeksRequireIntervention);
  });

  it("Test 9 — Reconciliation detection", () => {
    const f = getSeedForecast();
    const c = compute(f);
    const lastActuals = c.weekly.filter((w) => w.isActual).slice(-4);
    const overrides = lastActuals.map((w) => ({
      weekStart: w.weekStart,
      sku: "ocrevus-300mg",
      trendValue: w.skuValues[0]?.volume ?? 0,
      override: (w.skuValues[0]?.volume ?? 0) * 1.06,
    }));
    const f2: ConnectedForecast = {
      ...f,
      stf: { ...f.stf, weeklyInputs: [...f.stf.weeklyInputs, ...overrides] },
    };
    const events = reconcile(f2);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const drift = events[0];
    expect(["sustained-positive-variance", "warning", "critical-drift"]).toContain(drift.type === "warning" ? "warning" : drift.type);
    expect(drift.rolling4WeekVariancePct).toBeGreaterThan(0.04);

    const cleanEvents = reconcile(f);
    expect(cleanEvents[0].type).toBe("aligned");
  });

  it("Test 10 — Performance budget", () => {
    const f = getSeedForecast();
    const t0 = Date.now();
    const c = compute(f);
    const dt1 = Date.now() - t0;
    expect(dt1).toBeLessThan(1500);

    const t1 = Date.now();
    seekToForecast(
      f,
      { year: 2027, targetNetSales: c.annual.find((a) => a.year === 2027)!.netSales + 250e6 },
      {
        distributionMethod: "flat",
        interventionMode: "allow-stf-overrides",
        achievabilityThresholds: { achievable: 1.05, stretch: 1.15 },
      },
      c
    );
    expect(Date.now() - t1).toBeLessThan(3000);

    const t2 = Date.now();
    reconcile(f, c);
    expect(Date.now() - t2).toBeLessThan(2000);
  });
});
