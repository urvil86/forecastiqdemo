"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { SectionHeader } from "@/components/SectionHeader";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend } from "recharts";
import { formatUsdShort, formatNumber } from "@/lib/format";

type Metric = "revenue" | "units";

export function PacingBurndown() {
  const computed = useStore((s) => s.computed);
  const cutoff = useStore((s) => s.forecast.stf.actualsCutoffDate);
  const [metric, setMetric] = useState<Metric>("revenue");

  // Demo period: May 2026, 20 ERDs, today = day 14 of May. Q2 2026, today = end of week 6.
  const month = useMemo(() => buildMonthBurndown(computed, cutoff, metric), [computed, cutoff, metric]);
  const quarter = useMemo(() => buildQuarterBurndown(computed, cutoff, metric), [computed, cutoff, metric]);

  return (
    <div>
      <SectionHeader
        title="Plan Pacing · MTD and QTD"
        subtitle="Burndown vs target, with run-rate projection through end of period."
        right={
          <label className="caption text-muted flex items-center gap-2">
            Metric
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
              className="input-cell !font-sans text-sm"
            >
              <option value="revenue">Revenue ($)</option>
              <option value="units">Units (doses)</option>
            </select>
          </label>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BurndownCard
          title={`Month-to-date · ${month.periodLabel}`}
          data={month.data}
          xKey="day"
          xLabel="Day"
          summary={month.summary}
          todayMarker={month.todayDay}
          metric={metric}
        />
        <BurndownCard
          title={`Quarter-to-date · ${quarter.periodLabel}`}
          data={quarter.data}
          xKey="week"
          xLabel="Week"
          summary={quarter.summary}
          todayMarker={quarter.todayWeek}
          metric={metric}
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
  metric,
}: {
  title: string;
  data: Record<string, number | string | null>[];
  xKey: string;
  xLabel: string;
  summary: { label: string; value: string }[];
  todayMarker: number | string;
  metric: Metric;
}) {
  const yTickFmt = metric === "revenue" ? (v: number) => `$${v.toFixed(0)}M` : (v: number) => `${formatNumber(v)}`;
  const tipFmt = (v: number | string) => {
    if (typeof v !== "number") return "—";
    return metric === "revenue" ? formatUsdShort(v * 1e6) : `${formatNumber(Math.round(v))} doses`;
  };
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
            <YAxis tick={{ fontSize: 10 }} tickFormatter={yTickFmt} />
            <Tooltip formatter={tipFmt} />
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

interface ComputedSlim {
  monthly: { month: string; netSales: number; volume: number }[];
}

// Demo behavior: assume the current period is running ~6% behind plan, so MTD/QTD
// actuals trend below the linear cumulative target. Numbers are deterministic so the
// MTD and QTD cards stay internally consistent (gap = actual − target_through_today).
const RUN_RATE_VS_TARGET = 0.94;

function fmtAmount(v: number, metric: Metric): string {
  return metric === "revenue" ? `$${v.toFixed(0)}M` : `${formatNumber(Math.round(v))} doses`;
}
function fmtAmount1(v: number, metric: Metric): string {
  return metric === "revenue" ? `$${v.toFixed(1)}M` : `${formatNumber(Math.round(v))} doses`;
}
function fmtRate(v: number, metric: Metric, per: "day" | "week"): string {
  if (metric === "revenue") {
    return `$${v.toFixed(2)}M/${per}`;
  }
  return `${formatNumber(Math.round(v))} doses/${per}`;
}

function buildMonthBurndown(computed: ComputedSlim | null, _cutoff: string, metric: Metric) {
  // May 2026: 20 ERDs (31 days minus weekends and Memorial Day); today = day 14.
  const monthly = computed?.monthly.find((m) => m.month === "2026-05");
  const totalUsd = monthly?.netSales ?? 372_000_000;
  const totalUnits = monthly?.volume ?? 12_400;
  const totalRevM = totalUsd / 1e6;
  // For revenue, we work in $M; for units, in raw doses. monthTotal is the working scale.
  const monthTotal = metric === "revenue" ? totalRevM : totalUnits;
  const totalErds = 20;
  const totalDays = 31;
  const todayDay = 14;

  const mtdTarget = (todayDay / totalErds) * monthTotal;
  const mtdActual = mtdTarget * RUN_RATE_VS_TARGET;
  const gap = mtdActual - mtdTarget;

  const data: Record<string, number | string | null>[] = [];
  let actualCum = 0;
  for (let d = 1; d <= totalDays; d++) {
    const targetCum = (Math.min(d, totalErds) / totalErds) * monthTotal;
    let actual: number | null = null;
    let projected: number | null = null;
    if (d <= todayDay) {
      const noise = 0.92 + ((d * 7) % 5) * 0.04;
      const dailyShare = (1 / todayDay) * mtdActual * noise;
      actualCum += dailyShare;
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
  const requiredDaily = (monthTotal - mtdActual) / Math.max(1, daysRemaining);
  const projectedEom = (mtdActual / todayDay) * totalErds;
  const gapPct = (gap / mtdTarget) * 100;
  const atRiskThreshold = metric === "revenue" ? 10 : 350; // $10M or 350 doses

  return {
    data,
    todayDay,
    periodLabel: "May 2026",
    summary: [
      { label: "MTD Actual", value: fmtAmount(mtdActual, metric) },
      { label: "MTD Target", value: fmtAmount(mtdTarget, metric) },
      {
        label: "Gap",
        value: `${gap >= 0 ? "+" : ""}${fmtAmount1(gap, metric)} (${gap >= 0 ? "+" : ""}${gapPct.toFixed(1)}%)`,
      },
      { label: "Days remaining", value: `${daysRemaining}` },
      { label: "Required daily run-rate", value: fmtRate(requiredDaily, metric, "day") },
      {
        label: "Projected EOM",
        value: `${fmtAmount(projectedEom, metric)} (${((projectedEom / monthTotal) * 100).toFixed(0)}% of plan)`,
      },
    ],
    statusBanner:
      Math.abs(gap) >= atRiskThreshold && gap < 0
        ? `May month at risk: gap of ${fmtAmount1(Math.abs(gap), metric)} to target. Recovery requires ${fmtRate(requiredDaily, metric, "day")} for remaining ${daysRemaining} days.`
        : gap >= 0
        ? "On track to meet May plan."
        : `Minor gap to May plan (${fmtAmount1(Math.abs(gap), metric)}). Modest acceleration required.`,
  };
}

function buildQuarterBurndown(computed: ComputedSlim | null, _cutoff: string, metric: Metric) {
  // Q2 2026 (Apr + May + Jun): 13 weeks total, today = end of week 6 (mid-quarter).
  const aprMonthly = computed?.monthly.find((m) => m.month === "2026-04");
  const mayMonthly = computed?.monthly.find((m) => m.month === "2026-05");
  const junMonthly = computed?.monthly.find((m) => m.month === "2026-06");
  const q2TotalUsd =
    (aprMonthly?.netSales ?? 0) + (mayMonthly?.netSales ?? 0) + (junMonthly?.netSales ?? 0) ||
    1_072_000_000;
  const q2TotalUnits =
    (aprMonthly?.volume ?? 0) + (mayMonthly?.volume ?? 0) + (junMonthly?.volume ?? 0) ||
    37_500;
  const q2TotalRevM = q2TotalUsd / 1e6;
  const quarterTotal = metric === "revenue" ? q2TotalRevM : q2TotalUnits;
  const totalWeeks = 13;
  const todayWeek = 6;

  const qtdTarget = (todayWeek / totalWeeks) * quarterTotal;
  const qtdActual = qtdTarget * RUN_RATE_VS_TARGET;
  const gap = qtdActual - qtdTarget;

  const data: Record<string, number | string | null>[] = [];
  let actualCum = 0;
  for (let w = 1; w <= totalWeeks; w++) {
    const targetCum = (w / totalWeeks) * quarterTotal;
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
  const requiredWeekly = (quarterTotal - qtdActual) / Math.max(1, weeksRemaining);
  const projectedEoq = (qtdActual / todayWeek) * totalWeeks;
  const gapPct = (gap / qtdTarget) * 100;
  return {
    data,
    todayWeek: `W${todayWeek}`,
    periodLabel: "Q2 2026",
    summary: [
      { label: "QTD Actual", value: fmtAmount(qtdActual, metric) },
      { label: "QTD Target", value: fmtAmount(qtdTarget, metric) },
      {
        label: "Gap",
        value: `${gap >= 0 ? "+" : ""}${fmtAmount1(gap, metric)} (${gap >= 0 ? "+" : ""}${gapPct.toFixed(1)}%)`,
      },
      { label: "Weeks remaining", value: `${weeksRemaining}` },
      { label: "Required weekly run-rate", value: fmtRate(requiredWeekly, metric, "week") },
      {
        label: "Projected EOQ",
        value: `${fmtAmount(projectedEoq, metric)} (${((projectedEoq / quarterTotal) * 100).toFixed(1)}% of plan)`,
      },
    ],
  };
}
