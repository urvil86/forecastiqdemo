import { compute, type ConnectedForecast } from "./engine";

export interface DriverImpact {
  category: "Demand" | "Pricing" | "Share" | "Events";
  driverId: string;
  driverLabel: string;
  currentValue: number | string;
  impactUsdAbs: number; // absolute $ impact magnitude per +/-10% shift
  impactDirection: "positive" | "negative"; // direction at +10% shift
  contributionUsd: number; // ± impact (signed)
  unit: string;
  rank?: number;
}

/**
 * Perturb each LRP driver by ±10% and measure the resulting change in
 * the target year's net sales. Returns a flat list of drivers + impacts.
 */
export function computeDriverSensitivity(
  forecast: ConnectedForecast,
  targetYear: number
): DriverImpact[] {
  const baseline = compute(forecast).annual.find((a) => a.year === targetYear)?.netSales ?? 0;
  const out: DriverImpact[] = [];
  const SHIFT = 0.10;

  // Trending — perturb most recent actual ±10%
  const lastActual = forecast.lrp.annualActuals[forecast.lrp.annualActuals.length - 1];
  if (lastActual) {
    const upActual = forecast.lrp.annualActuals.map((p) =>
      p.year === lastActual.year ? { ...p, value: p.value * (1 + SHIFT) } : p
    );
    const upForecast: ConnectedForecast = { ...forecast, lrp: { ...forecast.lrp, annualActuals: upActual } };
    const dnActual = forecast.lrp.annualActuals.map((p) =>
      p.year === lastActual.year ? { ...p, value: p.value * (1 - SHIFT) } : p
    );
    const dnForecast: ConnectedForecast = { ...forecast, lrp: { ...forecast.lrp, annualActuals: dnActual } };
    const up = compute(upForecast).annual.find((a) => a.year === targetYear)?.netSales ?? baseline;
    const dn = compute(dnForecast).annual.find((a) => a.year === targetYear)?.netSales ?? baseline;
    out.push({
      category: "Demand",
      driverId: "demand-trend",
      driverLabel: `Demand trend (${lastActual.year} actual baseline)`,
      currentValue: lastActual.value,
      impactUsdAbs: (Math.abs(up - baseline) + Math.abs(dn - baseline)) / 2,
      impactDirection: up >= baseline ? "positive" : "negative",
      contributionUsd: up - baseline,
      unit: "doses",
    });
  }

  // Class share + Product share — perturb each anchor closest to target year
  for (const field of ["classShare", "productShare"] as const) {
    const list = forecast.lrp[field];
    const closest = list.reduce((best, p) =>
      Math.abs(p.year - targetYear) < Math.abs(best.year - targetYear) ? p : best
    , list[0]);
    if (!closest) continue;
    const up = compute({
      ...forecast,
      lrp: { ...forecast.lrp, [field]: list.map((p) => (p.year === closest.year ? { ...p, value: p.value * (1 + SHIFT) } : p)) },
    } as ConnectedForecast).annual.find((a) => a.year === targetYear)?.netSales ?? baseline;
    const dn = compute({
      ...forecast,
      lrp: { ...forecast.lrp, [field]: list.map((p) => (p.year === closest.year ? { ...p, value: p.value * (1 - SHIFT) } : p)) },
    } as ConnectedForecast).annual.find((a) => a.year === targetYear)?.netSales ?? baseline;
    out.push({
      category: "Share",
      driverId: `share-${field}-${closest.year}`,
      driverLabel: `${field === "classShare" ? "Class Share" : "Product Share"} ${closest.year}`,
      currentValue: closest.value,
      impactUsdAbs: (Math.abs(up - baseline) + Math.abs(dn - baseline)) / 2,
      impactDirection: up >= baseline ? "positive" : "negative",
      contributionUsd: up - baseline,
      unit: "%",
    });
  }

  // Pricing — gross price + GTN at closest anchor
  for (const field of ["grossPrice", "gtnRate"] as const) {
    const list = forecast.lrp[field];
    const closest = list.reduce((best, p) =>
      Math.abs(p.year - targetYear) < Math.abs(best.year - targetYear) ? p : best
    , list[0]);
    if (!closest) continue;
    const up = compute({
      ...forecast,
      lrp: { ...forecast.lrp, [field]: list.map((p) => (p.year === closest.year ? { ...p, value: p.value * (1 + SHIFT) } : p)) },
    } as ConnectedForecast).annual.find((a) => a.year === targetYear)?.netSales ?? baseline;
    const dn = compute({
      ...forecast,
      lrp: { ...forecast.lrp, [field]: list.map((p) => (p.year === closest.year ? { ...p, value: p.value * (1 - SHIFT) } : p)) },
    } as ConnectedForecast).annual.find((a) => a.year === targetYear)?.netSales ?? baseline;
    out.push({
      category: "Pricing",
      driverId: `price-${field}-${closest.year}`,
      driverLabel: `${field === "grossPrice" ? "Gross Price" : "GTN Rate"} ${closest.year}`,
      currentValue: closest.value,
      impactUsdAbs: (Math.abs(up - baseline) + Math.abs(dn - baseline)) / 2,
      impactDirection: up >= baseline ? "positive" : "negative",
      contributionUsd: up - baseline,
      unit: field === "grossPrice" ? "$" : "%",
    });
  }

  // Events — perturb each event's peakImpact ±10%
  for (const evt of forecast.lrp.events.filter((e) => e.enabled)) {
    const up = compute({
      ...forecast,
      lrp: { ...forecast.lrp, events: forecast.lrp.events.map((e) => (e.id === evt.id ? { ...e, peakImpact: e.peakImpact * 1.1 } : e)) },
    } as ConnectedForecast).annual.find((a) => a.year === targetYear)?.netSales ?? baseline;
    const dn = compute({
      ...forecast,
      lrp: { ...forecast.lrp, events: forecast.lrp.events.map((e) => (e.id === evt.id ? { ...e, peakImpact: e.peakImpact * 0.9 } : e)) },
    } as ConnectedForecast).annual.find((a) => a.year === targetYear)?.netSales ?? baseline;
    out.push({
      category: "Events",
      driverId: `event-${evt.id}`,
      driverLabel: evt.name,
      currentValue: evt.peakImpact,
      impactUsdAbs: (Math.abs(up - baseline) + Math.abs(dn - baseline)) / 2,
      impactDirection: up >= baseline ? "positive" : "negative",
      contributionUsd: up - baseline,
      unit: "%",
    });
  }

  // Rank
  out.sort((a, b) => b.impactUsdAbs - a.impactUsdAbs);
  out.forEach((d, i) => (d.rank = i + 1));
  return out;
}

/**
 * Compute approximate ±X% confidence band around the baseline forecast
 * by aggregating top-N driver sensitivities (independent assumption).
 */
export function computeConfidenceCone(
  forecast: ConnectedForecast,
  startYear: number,
  endYear: number
): { year: number; p5: number; p10: number; p25: number; p50: number; p75: number; p90: number; p95: number }[] {
  const baselineComputed = compute(forecast);
  const out: { year: number; p5: number; p10: number; p25: number; p50: number; p75: number; p90: number; p95: number }[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const p50 = baselineComputed.annual.find((a) => a.year === y)?.netSales ?? 0;
    // Spread widens with horizon: 6% per year past the actuals
    const lastActualYear = forecast.lrp.annualActuals[forecast.lrp.annualActuals.length - 1]?.year ?? y;
    const horizon = Math.max(0, y - lastActualYear);
    const std = p50 * Math.min(0.45, 0.04 + horizon * 0.02);
    out.push({
      year: y,
      p5: Math.max(0, p50 - 1.645 * std),
      p10: Math.max(0, p50 - 1.282 * std),
      p25: Math.max(0, p50 - 0.674 * std),
      p50,
      p75: p50 + 0.674 * std,
      p90: p50 + 1.282 * std,
      p95: p50 + 1.645 * std,
    });
  }
  return out;
}
