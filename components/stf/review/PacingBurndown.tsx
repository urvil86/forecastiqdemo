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

function buildMonthBurndown(computed: ComputedSlim | null, cutoff: string) {
  // Apr 2026: 22 ERDs assumed; today = Apr 22 (14 day elapsed of 30)
  const apr = computed?.monthly.find((m) => m.month === "2026-04")?.netSales ?? 356_000_000;
  const dailyTarget = apr / 22;
  const todayDay = 14;
  const data: Record<string, number | string | null>[] = [];
  // Build daily target / actual / projected
  let actualCum = 0;
  let actualDailyAccel = 1.06; // running ahead initially
  for (let d = 1; d <= 30; d++) {
    const target = (Math.min(d, 22) / 22) * apr;
    let actual: number | null = null;
    let projected: number | null = null;
    if (d <= todayDay) {
      // Build actual run rate roughly hitting $342M MTD by day 14
      const mtdTarget = (todayDay / 22) * apr;
      const ratio = 342e6 / mtdTarget; // ratio of actual to target so MTD = $342M
      const targetThisDay = (1 / 22) * apr;
      actualCum += targetThisDay * ratio * (0.9 + (d % 3) * 0.06);
      actual = actualCum / 1e6;
    }
    if (d >= todayDay) {
      const runRate = actualCum / todayDay;
      projected = (actualCum + runRate * (d - todayDay)) / 1e6;
    }
    data.push({ day: d, target: target / 1e6, actual, projected });
  }

  const mtdActual = 342;
  const mtdTarget = (todayDay / 22) * apr / 1e6;
  const gap = mtdActual - mtdTarget;
  const projectedEom = (actualCum / todayDay) * 22 / 1e6;
  return {
    data,
    todayDay,
    summary: [
      { label: "MTD Actual", value: `$${mtdActual.toFixed(0)}M` },
      { label: "MTD Target", value: `$${mtdTarget.toFixed(0)}M` },
      { label: "Gap", value: `${gap >= 0 ? "+" : ""}$${gap.toFixed(0)}M (${gap >= 0 ? "+" : ""}${((gap / mtdTarget) * 100).toFixed(1)}%)` },
      { label: "Days remaining", value: `${22 - todayDay}` },
      { label: "Required daily run-rate", value: `$${((apr / 1e6 - mtdActual) / (22 - todayDay)).toFixed(2)}M/day` },
      { label: "Projected EOM", value: `$${projectedEom.toFixed(0)}M (${((projectedEom / (apr / 1e6)) * 100).toFixed(0)}% of plan)` },
    ],
    statusBanner:
      gap < -10
        ? `April month at risk: gap of $${Math.abs(gap).toFixed(0)}M to target. Recovery requires $${((apr / 1e6 - mtdActual) / (22 - todayDay)).toFixed(2)}M/day for remaining ${22 - todayDay} days.`
        : gap >= 0
        ? "On track to meet April plan."
        : `Minor gap to April plan ($${Math.abs(gap).toFixed(0)}M). Modest acceleration required.`,
  };
}

function buildQuarterBurndown(computed: ComputedSlim | null, cutoff: string) {
  // Q2 2026: weeks 14-26 of year, ~13 weeks. Today in week 16 (~3 weeks elapsed).
  const q2Total =
    (computed?.monthly.find((m) => m.month === "2026-04")?.netSales ?? 0) +
    (computed?.monthly.find((m) => m.month === "2026-05")?.netSales ?? 0) +
    (computed?.monthly.find((m) => m.month === "2026-06")?.netSales ?? 0) ||
    1_072_000_000;
  const todayWeek = 3;
  const totalWeeks = 13;
  const data: Record<string, number | string | null>[] = [];
  let actualCum = 0;
  for (let w = 1; w <= totalWeeks; w++) {
    const target = (w / totalWeeks) * q2Total;
    let actual: number | null = null;
    let projected: number | null = null;
    if (w <= todayWeek) {
      const ratio = 1058e6 / ((todayWeek / totalWeeks) * q2Total); // run-rate ratio
      actualCum += (q2Total / totalWeeks) * ratio * (0.96 + w * 0.02);
      actual = actualCum / 1e6;
    }
    if (w >= todayWeek) {
      const runRate = actualCum / todayWeek;
      projected = (actualCum + runRate * (w - todayWeek)) / 1e6;
    }
    data.push({ week: `W${w}`, target: target / 1e6, actual, projected });
  }
  const qtdActual = 1058;
  const qtdTarget = (todayWeek / totalWeeks) * q2Total / 1e6;
  const gap = qtdActual - qtdTarget;
  const projectedEoq = (actualCum / todayWeek) * totalWeeks / 1e6;
  return {
    data,
    todayWeek: `W${todayWeek}`,
    summary: [
      { label: "QTD Actual", value: `$${qtdActual.toFixed(0)}M` },
      { label: "QTD Target", value: `$${qtdTarget.toFixed(0)}M` },
      { label: "Gap", value: `${gap >= 0 ? "+" : ""}$${gap.toFixed(0)}M (${gap >= 0 ? "+" : ""}${((gap / qtdTarget) * 100).toFixed(1)}%)` },
      { label: "Weeks remaining", value: `${totalWeeks - todayWeek}` },
      { label: "Required weekly run-rate", value: `$${((q2Total / 1e6 - qtdActual) / (totalWeeks - todayWeek)).toFixed(0)}M/week` },
      { label: "Projected EOQ", value: `$${projectedEoq.toFixed(0)}M (${((projectedEoq / (q2Total / 1e6)) * 100).toFixed(1)}% of plan)` },
    ],
  };
}
