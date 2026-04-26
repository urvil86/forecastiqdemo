import type { DailyProfile, PhasingProfile } from "./types";

const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type DayKey = (typeof DAY_KEYS)[number];

export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDay(); // 0 (Sun) - 6 (Sat)
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map((x) => parseInt(x));
  return new Date(Date.UTC(y, m - 1, d));
}

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function dayOfWeekKey(d: Date): DayKey {
  const idx = d.getUTCDay();
  // JS: 0=Sun..6=Sat. Convert to Mon..Sun ordering.
  const mapping: DayKey[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const key = mapping[idx];
  return key === "Sun" ? "Sun" : key;
}

export function generateWeekStarts(start: string, end: string): string[] {
  const startDate = getMondayOfWeek(parseIsoDate(start));
  const endDate = parseIsoDate(end);
  const out: string[] = [];
  const cur = new Date(startDate.getTime());
  while (cur.getTime() <= endDate.getTime()) {
    out.push(isoDate(cur));
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return out;
}

export function isoWeekNumber(d: Date): number {
  // Per ISO 8601
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  return Math.round(1 + (target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export function annualToMonthly(
  annualValue: number,
  year: number,
  erdByMonth: PhasingProfile["erdByMonth"]
): { month: string; value: number }[] {
  const months: { month: string; erds: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    const found = erdByMonth.find((e) => e.month === key);
    months.push({ month: key, erds: found ? found.erds : 21 });
  }
  const totalErds = months.reduce((s, x) => s + x.erds, 0);
  return months.map((m) => ({
    month: m.month,
    value: totalErds === 0 ? annualValue / 12 : (annualValue * m.erds) / totalErds,
  }));
}

// Determine which calendar week of month this Monday-week-start falls into.
// "Week 1" = the first Monday on/after the 1st of the month.
export function weekOfMonth(weekStart: Date): number {
  const dom = weekStart.getUTCDate();
  return Math.min(4, Math.max(1, Math.ceil(dom / 7)));
}

export function monthlyToWeekly(
  monthlyValue: number,
  monthKey: string,
  weekStarts: string[],
  weeklyOfMonth: PhasingProfile["weeklyOfMonth"]
): { weekStart: string; value: number }[] {
  // Filter weeks that fall in this month (by week-start month), plus boundary weeks via days-in-month split.
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month - 1, lastDay));

  // Find weeks that overlap with this month
  const weeks: { weekStart: string; daysInMonth: number; weekStartDate: Date }[] = [];
  for (const ws of weekStarts) {
    const wd = parseIsoDate(ws);
    const we = new Date(wd.getTime());
    we.setUTCDate(we.getUTCDate() + 6);
    if (we.getTime() < monthStart.getTime() || wd.getTime() > monthEnd.getTime()) continue;
    let days = 0;
    for (let i = 0; i < 7; i++) {
      const day = new Date(wd.getTime());
      day.setUTCDate(day.getUTCDate() + i);
      if (day.getTime() >= monthStart.getTime() && day.getTime() <= monthEnd.getTime()) days++;
    }
    weeks.push({ weekStart: ws, daysInMonth: days, weekStartDate: wd });
  }

  // Compute raw weights using weeklyOfMonth keyed by week-of-month, prorated by daysInMonth/7
  const wRaw = weeks.map((w) => {
    const wom = weekOfMonth(w.weekStartDate);
    const womWeight = weeklyOfMonth.find((x) => x.weekOfMonth === wom)?.weight ?? 0.25;
    return { weekStart: w.weekStart, weight: womWeight * (w.daysInMonth / 7) };
  });
  const totalW = wRaw.reduce((s, x) => s + x.weight, 0);
  if (totalW === 0) {
    return weeks.map((w) => ({ weekStart: w.weekStart, value: monthlyValue / Math.max(1, weeks.length) }));
  }
  return wRaw.map((w) => ({
    weekStart: w.weekStart,
    value: (monthlyValue * w.weight) / totalW,
  }));
}

export function weeklyToDaily(
  weeklyValue: number,
  weekStart: string,
  profile: DailyProfile
): { date: string; value: number; dayOfWeek: DayKey }[] {
  const start = parseIsoDate(weekStart);
  const total =
    profile.dayWeights.Mon +
    profile.dayWeights.Tue +
    profile.dayWeights.Wed +
    profile.dayWeights.Thu +
    profile.dayWeights.Fri +
    profile.dayWeights.Sat +
    profile.dayWeights.Sun;
  const out: { date: string; value: number; dayOfWeek: DayKey }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime());
    d.setUTCDate(d.getUTCDate() + i);
    const key = (DAY_KEYS as readonly DayKey[])[i];
    const w = profile.dayWeights[key];
    out.push({
      date: isoDate(d),
      dayOfWeek: key,
      value: total === 0 ? 0 : (weeklyValue * w) / total,
    });
  }
  return out;
}

export function quarterOfMonth(monthKey: string): number {
  const m = parseInt(monthKey.split("-")[1]);
  return Math.floor((m - 1) / 3) + 1;
}
