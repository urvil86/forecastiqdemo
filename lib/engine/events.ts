import type { Event } from "./types";

export function sigmoidImpact(
  yearStart: number,
  monthOfYear: number,
  event: Event
): number {
  // launchDate may be 'YYYY-MM' or 'YYYY-MM-DD'
  const parts = event.launchDate.split("-");
  const launchYear = parseInt(parts[0]);
  const launchMonth = parseInt(parts[1] ?? "1");
  const monthsSince = (yearStart - launchYear) * 12 + (monthOfYear - launchMonth);
  if (monthsSince <= 0) return 0;
  if (event.timeToPeakMonths <= 0) return 1;
  const tau = monthsSince / event.timeToPeakMonths;
  if (tau >= 1) return 1;
  const k = event.curveShape === "slow" ? 3 : event.curveShape === "moderate" ? 6 : 12;
  return 1 / (1 + Math.exp(-k * (tau - 0.5)));
}

export function applyEventsAnnual(
  baseline: { year: number; value: number }[],
  events: Event[]
): { year: number; value: number }[] {
  const enabled = events.filter((e) => e.enabled);
  return baseline.map(({ year, value }) => {
    let factor = 1;
    for (const e of enabled) {
      // Use mid-year (month=6) as representative for the year
      const f = sigmoidImpact(year, 6, e);
      const direction = e.type === "positive" ? 1 : -1;
      factor *= 1 + direction * e.peakImpact * f;
    }
    return { year, value: Math.max(0, value * factor) };
  });
}

export function eventImpactSeries(
  startYear: number,
  endYear: number,
  event: Event
): { year: number; impact: number }[] {
  const out: { year: number; impact: number }[] = [];
  const direction = event.type === "positive" ? 1 : -1;
  for (let y = startYear; y <= endYear; y++) {
    const f = sigmoidImpact(y, 6, event);
    out.push({ year: y, impact: direction * event.peakImpact * f });
  }
  return out;
}

// Date-aware sigmoid (continuous; for weekly grain).
export function sigmoidImpactForDate(date: Date, event: Event): number {
  const parts = event.launchDate.split("-");
  const ly = parseInt(parts[0]);
  const lm = parseInt(parts[1] ?? "1");
  const ld = parseInt(parts[2] ?? "1");
  const launchMs = Date.UTC(ly, lm - 1, ld);
  const monthsSince = (date.getTime() - launchMs) / (30.4375 * 86_400_000);
  if (monthsSince <= 0) return 0;
  if (event.timeToPeakMonths <= 0) return 1;
  const tau = monthsSince / event.timeToPeakMonths;
  if (tau >= 1) return 1;
  const k = event.curveShape === "slow" ? 3 : event.curveShape === "moderate" ? 6 : 12;
  return 1 / (1 + Math.exp(-k * (tau - 0.5)));
}

export function applyStfEventsFactor(date: Date, events: Event[]): number {
  let factor = 1;
  for (const e of events) {
    if (!e.enabled) continue;
    const f = sigmoidImpactForDate(date, e);
    const dir = e.type === "positive" ? 1 : -1;
    factor *= 1 + dir * e.peakImpact * f;
  }
  return factor;
}
