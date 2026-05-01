"use client";

import { useMemo } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { getDailyVariance } from "@/lib/stfReviewSeed";
import { formatNumber } from "@/lib/format";

function colorForVariance(v: number): { bg: string; fg: string } {
  if (v >= 0.05) return { bg: "#1F8A5C", fg: "white" };
  if (v >= 0.02) return { bg: "rgba(31,138,92,0.45)", fg: "white" };
  if (v >= -0.02) return { bg: "#E6E1D6", fg: "#5C6770" };
  if (v >= -0.05) return { bg: "rgba(193,66,59,0.45)", fg: "white" };
  return { bg: "#C1423B", fg: "white" };
}

export function DailyVarianceHeatmap() {
  const data = useMemo(() => getDailyVariance(26), []);

  // Pattern analysis: Wednesday share + Friday softness
  const analysis = useMemo(() => {
    let wedSum = 0, totalSum = 0;
    for (const w of data) {
      for (const d of w.days) {
        totalSum += d.actual;
        if (d.day === "Wed") wedSum += d.actual;
      }
    }
    const wedShare = totalSum > 0 ? wedSum / totalSum : 0;

    let friBelowCount = 0;
    const last8 = data.slice(-8);
    for (const w of last8) {
      const fri = w.days.find((d) => d.day === "Fri");
      if (fri && fri.variancePct < -0.03) friBelowCount++;
    }

    return { wedShare, friBelowCount };
  }, [data]);

  return (
    <div>
      <SectionHeader
        title="Daily Variance · Last 26 Weeks"
        subtitle="Each cell is a day. Color encodes variance vs forecast: green = above, red = below."
      />
      <div className="card overflow-x-auto">
        <table className="text-[10px] border-collapse">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-muted">Week starting</th>
              {(["Mon", "Tue", "Wed", "Thu", "Fri"] as const).map((d) => (
                <th key={d} className="px-2 py-1 font-mono text-muted text-center">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((week) => (
              <tr key={week.weekStart}>
                <td className="px-2 py-1 font-mono text-muted whitespace-nowrap">{week.weekStart}</td>
                {week.days.map((d) => {
                  const c = colorForVariance(d.variancePct);
                  return (
                    <td
                      key={d.date}
                      className="px-2 py-1 text-center font-mono cursor-help border border-white"
                      style={{ background: c.bg, color: c.fg, minWidth: 64 }}
                      title={`${d.day} ${d.date}: Forecast ${formatNumber(d.forecast)} OUTs, Actual ${formatNumber(Math.round(d.actual))} OUTs, Variance ${(d.variancePct * 100).toFixed(1)}%`}
                    >
                      {`${d.variancePct >= 0 ? "+" : ""}${(d.variancePct * 100).toFixed(1)}%`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card mt-3 text-sm space-y-1">
        <p>
          <strong>Wednesday Pattern:</strong> {(analysis.wedShare * 100).toFixed(0)}% of weekly volume falls on Wednesday (consistent
          across 26 weeks).
        </p>
        <p>
          <strong>Recent variance trend:</strong> {analysis.friBelowCount} of last 8 weeks showed Friday softness ({"<-3%"} below
          forecast). Likely driver: infusion suite scheduling pressure in 2 underperforming territories.
        </p>
        <p className="text-xs text-muted">Click any cell to drill into that day's detail (wired in production).</p>
      </div>
    </div>
  );
}
