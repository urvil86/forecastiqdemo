"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { SectionHeader } from "@/components/SectionHeader";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend } from "recharts";
import { formatUsdShort } from "@/lib/format";

export function PacingBurndown() {
  const computed = useStore((s) => s.computed);
  const cutoff = useStore((s) => s.forecast.stf.actualsCutoffDate);

  // Demo-realistic data: April 2026, 22 ERDs, today is April 22 (~14 days elapsed)
  const month = useMemo(() => buildMonthBurndown(computed, cutoff), [computed, cutoff]);
  const quarter = useMemo(() => buildQuarterBurndown(computed, cutoff), [computed, cutoff]);

  return (
    <div>
      <SectionHeader
        title="Plan Pacing · MTD and QTD"
        subtitle="Burndown vs target, with run-rate projection through end of period."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BurndownCard
          title="Month-to-date"
          data={month.data}
          xKey="day"
          xLabel="Day"
          summary={month.summary}
          todayMarker={month.todayDay}
        />
        <BurndownCard
          title="Quarter-to-date"
          data={quarter.data}
          xKey="week"
          xLabel="Week"
          summary={quarter.summary}
          todayMarker={quarter.todayWeek}
        />
      </div>
      <div className="card mt-4 bg-warning/10 border-warning/40 text-sm">
        <div className="font-semibold text-warning">{month.statusBanner}</div>
      </div>
    </div>
  );
}

function BurndownCard({
  title,
  data,
  xKey,
  xLabel,
  summary,
  todayMarker,
}: {
  title: string;
  data: Record<string, number | string | null>[];
  xKey: string;
  xLabel: string;
  summary: { label: string; value: string }[];
  todayMarker: number | string;
}) {
  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="font-heading text-h4 text-secondary">{title}</h4>
        <span className="text-xs text-muted">{xLabel}-by-{xLabel}</span>
      </div>
      <div className="h-56">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(0)}M`} />
            <Tooltip formatter={(v: number | string) => (typeof v === "number" ? formatUsdShort(v * 1e6) : "—")} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine x={todayMarker} stroke="#C98B27" strokeDasharray="3 3" label={{ value: "Today", fontSize: 10, fill: "#C98B27" }} />
            <Line dataKey="target" stroke="#C98B27" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Target cumulative" />
            <Line dataKey="actual" stroke="#004466" strokeWidth={2.5} dot={false} name="Actual cumulative" />
            <Line dataKey="projected" stroke="#3B82C4" strokeWidth={2} strokeDasharray="2 2" dot={false} name="Projected" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 text-xs">
        {summary.map((s) => (
          <div key={s.label} className="flex justify-between border-b border-border pb-1">
            <span className="text-muted">{s.label}</span>
            <span className="font-mono font-semibold">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ComputedSlim { monthly: { month: string; netSales: number }[] }

// Demo behavior: assume the current period is running ~6% behind plan, so MTD/QTD
// actuals trend below the linear cumulative target. Numbers are deterministic so the
// MTD and QTD cards stay internally consistent (gap = actual − target_through_today).
const RUN_RATE_VS_TARGET = 0.94;

function buildMonthBurndown(computed: ComputedSlim | null, _cutoff: string) {
  // Apr 2026: 22 ERDs assumed; today = day 14 of the month.
  const aprTotalUsd = computed?.monthly.find((m) => m.month === "2026-04")?.netSales ?? 356_000_000;
  const aprTotalM = aprTotalUsd / 1e6;
  const totalErds = 22;
  const totalDays = 30;
  const todayDay = 14;

  // Cumulative target through today (linear ramp on ERDs)
  const mtdTarget = (todayDay / totalErds) * aprTotalM;
  // Actuals run-rate: 6% behind target on average, with mild day-to-day noise
  const mtdActual = mtdTarget * RUN_RATE_VS_TARGET;
  const gap = mtdActual - mtdTarget;

  const data: Record<string, number | string | null>[] = [];
  let actualCum = 0;
  for (let d = 1; d <= totalDays; d++) {
    const targetCum = (Math.min(d, totalErds) / totalErds) * aprTotalM;
    let actual: number | null = null;
    let projected: number | null = null;
    if (d <= todayDay) {
      // Distribute MTD actual across days with mild oscillation but a clean cumulative endpoint
      const noise = 0.92 + ((d * 7) % 5) * 0.04; // 0.92..1.08 deterministic
      const dailyShare = (1 / todayDay) * mtdActual * noise;
      actualCum += dailyShare;
      // Snap last day so cumulative lands exactly on mtdActual
      if (d === todayDay) actualCum = mtdActual;
      actual = actualCum;
    }
    if (d >= todayDay) {
      const dailyRunRate = mtdActual / todayDay;
      projected = mtdActual + dailyRunRate * (d - todayDay);
    }
    data.push({ day: d, target: targetCum, actual, projected });
  }

  const daysRemaining = totalErds - todayDay;
  const requiredDaily = (aprTotalM - mtdActual) / Math.max(1, daysRemaining);
  const projectedEom = (mtdActual / todayDay) * totalErds;
  const gapPct = (gap / mtdTarget) * 100;
  return {
    data,
    todayDay,
    summary: [
      { label: "MTD Actual", value: `$${mtdActual.toFixed(0)}M` },
      { label: "MTD Target", value: `$${mtdTarget.toFixed(0)}M` },
      { label: "Gap", value: `${gap >= 0 ? "+" : ""}$${gap.toFixed(1)}M (${gap >= 0 ? "+" : ""}${gapPct.toFixed(1)}%)` },
      { label: "Days remaining", value: `${daysRemaining}` },
      { label: "Required daily run-rate", value: `$${requiredDaily.toFixed(2)}M/day` },
      { label: "Projected EOM", value: `$${projectedEom.toFixed(0)}M (${((projectedEom / aprTotalM) * 100).toFixed(0)}% of plan)` },
    ],
    statusBanner:
      gap <= -10
        ? `April month at risk: gap of $${Math.abs(gap).toFixed(1)}M to target. Recovery requires $${requiredDaily.toFixed(2)}M/day for remaining ${daysRemaining} days.`
        : gap >= 0
        ? "On track to meet April plan."
        : `Minor gap to April plan ($${Math.abs(gap).toFixed(1)}M). Modest acceleration required.`,
  };
}

function buildQuarterBurndown(computed: ComputedSlim | null, _cutoff: string) {
  // Q2 2026 (Apr + May + Jun): 13 weeks total, today = end of week 3.
  const q2TotalUsd =
    ((computed?.monthly.find((m) => m.month === "2026-04")?.netSales ?? 0) +
      (computed?.monthly.find((m) => m.month === "2026-05")?.netSales ?? 0) +
      (computed?.monthly.find((m) => m.month === "2026-06")?.netSales ?? 0)) ||
    1_072_000_000;
  const q2TotalM = q2TotalUsd / 1e6;
  const totalWeeks = 13;
  const todayWeek = 3;

  const qtdTarget = (todayWeek / totalWeeks) * q2TotalM;
  const qtdActual = qtdTarget * RUN_RATE_VS_TARGET;
  const gap = qtdActual - qtdTarget;

  const data: Record<string, number | string | null>[] = [];
  let actualCum = 0;
  for (let w = 1; w <= totalWeeks; w++) {
    const targetCum = (w / totalWeeks) * q2TotalM;
    let actual: number | null = null;
    let projected: number | null = null;
    if (w <= todayWeek) {
      const noise = 0.94 + ((w * 11) % 4) * 0.04;
      const weeklyShare = (1 / todayWeek) * qtdActual * noise;
      actualCum += weeklyShare;
      if (w === todayWeek) actualCum = qtdActual;
      actual = actualCum;
    }
    if (w >= todayWeek) {
      const weeklyRunRate = qtdActual / todayWeek;
      projected = qtdActual + weeklyRunRate * (w - todayWeek);
    }
    data.push({ week: `W${w}`, target: targetCum, actual, projected });
  }
  const weeksRemaining = totalWeeks - todayWeek;
  const requiredWeekly = (q2TotalM - qtdActual) / Math.max(1, weeksRemaining);
  const projectedEoq = (qtdActual / todayWeek) * totalWeeks;
  const gapPct = (gap / qtdTarget) * 100;
  return {
    data,
    todayWeek: `W${todayWeek}`,
    summary: [
      { label: "QTD Actual", value: `$${qtdActual.toFixed(0)}M` },
      { label: "QTD Target", value: `$${qtdTarget.toFixed(0)}M` },
      { label: "Gap", value: `${gap >= 0 ? "+" : ""}$${gap.toFixed(1)}M (${gap >= 0 ? "+" : ""}${gapPct.toFixed(1)}%)` },
      { label: "Weeks remaining", value: `${weeksRemaining}` },
      { label: "Required weekly run-rate", value: `$${requiredWeekly.toFixed(0)}M/week` },
      { label: "Projected EOQ", value: `$${projectedEoq.toFixed(0)}M (${((projectedEoq / q2TotalM) * 100).toFixed(1)}% of plan)` },
    ],
  };
}
