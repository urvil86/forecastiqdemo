"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { SectionHeader } from "@/components/SectionHeader";
import { formatUsdShort } from "@/lib/format";

const START_YEAR = 2024;
const END_YEAR = 2030;
const TOTAL_YEARS = END_YEAR - START_YEAR + 1;

export function ForecastStackView() {
  const computed = useStore((s) => s.computed);

  const annual = useMemo(
    () => (computed?.annual ?? []).filter((a) => a.year >= START_YEAR && a.year <= END_YEAR),
    [computed]
  );
  const monthly = useMemo(
    () => (computed?.monthly ?? []).filter((m) => m.year >= START_YEAR && m.year <= END_YEAR),
    [computed]
  );
  const weekly = useMemo(
    () => (computed?.weekly ?? []).filter((w) => w.year >= START_YEAR && w.year <= END_YEAR),
    [computed]
  );

  if (!computed) return <div className="shimmer h-96 rounded-xl" />;

  const annualMax = Math.max(...annual.map((a) => a.netSales), 1);
  const monthlyMax = Math.max(...monthly.map((m) => m.netSales), 1);
  const weeklyMax = Math.max(...weekly.map((w) => w.totalNetSales), 1);

  function pctForYearStart(year: number) {
    return ((year - START_YEAR) / TOTAL_YEARS) * 100;
  }
  function pctForYearCenter(year: number) {
    return ((year - START_YEAR + 0.5) / TOTAL_YEARS) * 100;
  }
  function pctForMonth(monthKey: string) {
    const [y, m] = monthKey.split("-").map((s) => parseInt(s));
    return ((y - START_YEAR + (m - 1) / 12) / TOTAL_YEARS) * 100;
  }
  function pctForWeek(weekStart: string) {
    const d = new Date(weekStart);
    const dayOfYear = (d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000;
    return ((d.getUTCFullYear() - START_YEAR + dayOfYear / 365) / TOTAL_YEARS) * 100;
  }

  const yearLabels = Array.from({ length: TOTAL_YEARS }, (_, i) => START_YEAR + i);
  const tickPositions = Array.from({ length: TOTAL_YEARS + 1 }, (_, i) => (i / TOTAL_YEARS) * 100);

  const STRIP_HEIGHT = 120;
  const AXIS_HEIGHT = 24;
  const CAPTION_HEIGHT = 22;

  return (
    <div>
      <SectionHeader
        title="Forecast Stack View"
        subtitle="Annual ↔ Monthly ↔ Weekly. Same data, three lenses."
      />
      <div className="card">
        <div className="flex">
          {/* LEFT GUTTER — strip labels, vertically aligned with each strip */}
          <div className="flex flex-col flex-shrink-0 pr-3" style={{ width: 110 }}>
            <div style={{ height: AXIS_HEIGHT }} />
            <div className="caption text-muted flex items-center justify-end pr-1" style={{ height: STRIP_HEIGHT }}>
              <div className="text-right leading-tight">
                Strip A<br />
                <span className="font-normal normal-case tracking-normal">Annual LRP</span>
              </div>
            </div>
            <div style={{ height: CAPTION_HEIGHT }} />
            <div className="caption text-muted flex items-center justify-end pr-1" style={{ height: STRIP_HEIGHT }}>
              <div className="text-right leading-tight">
                Strip B<br />
                <span className="font-normal normal-case tracking-normal">Monthly LRP</span>
              </div>
            </div>
            <div style={{ height: CAPTION_HEIGHT }} />
            <div className="caption text-muted flex items-center justify-end pr-1" style={{ height: STRIP_HEIGHT }}>
              <div className="text-right leading-tight">
                Strip C<br />
                <span className="font-normal normal-case tracking-normal">Weekly STF</span>
              </div>
            </div>
            <div style={{ height: AXIS_HEIGHT }} />
          </div>

          {/* RIGHT CHART AREA */}
          <div className="flex-1 relative">
            {/* Vertical year guide lines spanning all strips */}
            {tickPositions.map((p, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-border/70 pointer-events-none"
                style={{ left: `${p}%` }}
              />
            ))}

            {/* TOP YEAR AXIS */}
            <div className="relative" style={{ height: AXIS_HEIGHT }}>
              {yearLabels.map((y) => (
                <div
                  key={y}
                  className="absolute -translate-x-1/2 text-xs font-semibold text-muted"
                  style={{ left: `${pctForYearCenter(y)}%`, top: 4 }}
                >
                  {y}
                </div>
              ))}
            </div>

            {/* STRIP A — Annual */}
            <div className="relative bg-background rounded" style={{ height: STRIP_HEIGHT }}>
              {annual.map((a) => {
                const left = pctForYearStart(a.year);
                const widthPct = (1 / TOTAL_YEARS) * 100 * 0.85;
                const heightPct = (a.netSales / annualMax) * 80; // leave headroom for label
                return (
                  <div
                    key={a.year}
                    className="absolute bottom-0"
                    style={{ left: `${left}%`, width: `${widthPct}%`, height: "100%" }}
                  >
                    <div className="text-[10px] text-center font-mono text-secondary leading-none mt-1">
                      {formatUsdShort(a.netSales)}
                    </div>
                    <div
                      className="bg-secondary rounded-t absolute bottom-0 left-1/2 -translate-x-1/2"
                      style={{ height: `${heightPct}%`, width: "92%" }}
                      title={`${a.year}: ${formatUsdShort(a.netSales)}`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-muted text-center" style={{ height: CAPTION_HEIGHT, lineHeight: `${CAPTION_HEIGHT}px` }}>
              ↓ Annual cascades to monthly via phasing
            </div>

            {/* STRIP B — Monthly */}
            <div className="relative bg-background rounded" style={{ height: STRIP_HEIGHT }}>
              {monthly.map((m) => {
                const left = pctForMonth(m.month);
                const widthPct = (1 / 12 / TOTAL_YEARS) * 100 * 0.85;
                const heightPct = (m.netSales / monthlyMax) * 95;
                return (
                  <div
                    key={m.month}
                    className="absolute bottom-0 bg-secondary-light/60 hover:bg-secondary-light"
                    style={{ left: `${left}%`, width: `${widthPct}%`, height: `${heightPct}%` }}
                    title={`${m.month}: ${formatUsdShort(m.netSales)} · source: ${m.source}`}
                  />
                );
              })}
            </div>

            <div className="text-xs text-muted text-center" style={{ height: CAPTION_HEIGHT, lineHeight: `${CAPTION_HEIGHT}px` }}>
              ↓ Monthly cascades to weekly via STF · ↑ Weekly actuals roll up; sustained variance triggers reconciliation
            </div>

            {/* STRIP C — Weekly */}
            <div className="relative bg-background rounded" style={{ height: STRIP_HEIGHT }}>
              {weekly.map((w) => {
                const left = pctForWeek(w.weekStart);
                const widthPct = (1 / 52 / TOTAL_YEARS) * 100 * 0.85;
                const heightPct = (w.totalNetSales / weeklyMax) * 95;
                const color = w.isActual ? "#1F8A5C" : w.isPartial ? "#E5A04B" : "#C98B27";
                return (
                  <div
                    key={w.weekStart}
                    className="absolute bottom-0"
                    style={{
                      left: `${left}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                      background: color,
                    }}
                    title={`${w.weekStart} (W${w.isoWeek}): ${formatUsdShort(w.totalNetSales)} · ${w.source}`}
                  />
                );
              })}
            </div>

            {/* BOTTOM YEAR AXIS */}
            <div className="relative" style={{ height: AXIS_HEIGHT }}>
              {yearLabels.map((y) => (
                <div
                  key={y}
                  className="absolute -translate-x-1/2 text-xs font-semibold text-muted"
                  style={{ left: `${pctForYearCenter(y)}%`, top: 4 }}
                >
                  {y}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-3 text-xs text-muted flex-wrap">
          <span>
            <span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: "#1F8A5C" }} />
            Actual (STF)
          </span>
          <span>
            <span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: "#E5A04B" }} />
            Partial (current week)
          </span>
          <span>
            <span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: "#C98B27" }} />
            Forecast (STF)
          </span>
          <span>
            <span className="inline-block w-3 h-3 align-middle mr-1 bg-secondary" />
            LRP-derived (annual / monthly)
          </span>
        </div>
      </div>
    </div>
  );
}
