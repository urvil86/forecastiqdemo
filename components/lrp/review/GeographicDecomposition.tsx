"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { SectionHeader } from "@/components/SectionHeader";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend, PieChart, Pie, Cell, Legend as PieLegend } from "recharts";
import { formatUsdShort, formatPct } from "@/lib/format";

// US-only forecast → subnational regional decomposition.
// Industry-typical specialty MS biologic shares with modest secular drift:
// Northeast leads (academic prescribing density + commercial insurance), Southeast and West grow,
// Midwest holds, South-Central gradual gain. Synthesized but plausible for demo.
function regionSharesForYear(year: number): Record<UsRegion, number> {
  const t = Math.max(0, Math.min(1, (year - 2025) / 10));
  return {
    Northeast: 0.28 - 0.01 * t,
    Southeast: 0.22 + 0.025 * t,
    Midwest: 0.18 - 0.005 * t,
    West: 0.20 - 0.005 * t,
    "South-Central": 0.12 - 0.005 * t,
  };
}

type UsRegion = "Northeast" | "Southeast" | "Midwest" | "West" | "South-Central";

const REGION_COLOR: Record<UsRegion, string> = {
  Northeast: "#004466",
  Southeast: "#C98B27",
  Midwest: "#0A5C82",
  West: "#1F8A5C",
  "South-Central": "#3B82C4",
};

const REGION_KEY_STATES: Record<UsRegion, string> = {
  Northeast: "NY, MA, PA, NJ, CT, MD",
  Southeast: "FL, GA, NC, SC, VA, TN",
  Midwest: "IL, OH, MI, MN, IN, WI",
  West: "CA, WA, OR, AZ, NV, CO",
  "South-Central": "TX, OK, LA, AR, MS",
};

const REGION_ANCHORS: Record<UsRegion, string> = {
  Northeast: "Mass General · NYU Langone · Penn Medicine · Mt Sinai",
  Southeast: "Duke · Emory · Vanderbilt · Mayo Jacksonville",
  Midwest: "Cleveland Clinic · Mayo Rochester · Northwestern · Henry Ford",
  West: "Stanford · UCSF · UCLA · Kaiser Permanente · Cedars-Sinai",
  "South-Central": "Houston Methodist · Baylor Scott & White · Memorial Hermann",
};

const REGIONS: UsRegion[] = ["Northeast", "Southeast", "Midwest", "West", "South-Central"];

export function GeographicDecomposition({ viewThroughYear }: { viewThroughYear: number }) {
  const computed = useStore((s) => s.computed);
  const forecast = useStore((s) => s.forecast);
  const cutoffYear = parseInt(forecast.timeframe.forecastStart.slice(0, 4));

  const data = useMemo(() => {
    if (!computed) return [];
    return computed.annual
      .filter((a) => a.year <= viewThroughYear)
      .map((a) => {
        const shares = regionSharesForYear(a.year);
        const row: Record<string, number> = { year: a.year };
        for (const r of REGIONS) row[r] = (a.netSales * shares[r]) / 1e6;
        return row;
      });
  }, [computed, viewThroughYear]);

  const yearsToShow = [2025, 2030, Math.min(2035, viewThroughYear)].filter(
    (y, i, arr) => arr.indexOf(y) === i
  );

  const pies = yearsToShow.map((y) => {
    const row = data.find((d) => d.year === y);
    if (!row) return { year: y, slices: [], total: 0 };
    const slices = REGIONS.map((r) => ({ name: r, value: row[r] as number }));
    const total = slices.reduce((s, x) => s + x.value, 0);
    return { year: y, slices, total };
  });

  const cagrTable = REGIONS.map((r) => {
    const start2025 = (data.find((d) => d.year === 2025)?.[r] as number) ?? 0;
    const end = (data.find((d) => d.year === Math.min(2035, viewThroughYear))?.[r] as number) ?? 0;
    const span = Math.min(2035, viewThroughYear) - 2025;
    const cagr = start2025 > 0 && span > 0 ? Math.pow(end / start2025, 1 / span) - 1 : 0;
    return { region: r, start2025: start2025 * 1e6, end: end * 1e6, cagr };
  });

  return (
    <div>
      <SectionHeader
        title="Net Sales by US Region · 2022–2035"
        subtitle="Subnational decomposition of the US forecast across five regions. Synthetic regional shares reflect industry-typical specialty MS biologic distribution; replaceable with internal account-level data on day-one of production."
      />
      <div className="card">
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(0)}M`} />
              <Tooltip
                formatter={(v: number | string) => (typeof v === "number" ? formatUsdShort(v * 1e6) : "—")}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine
                x={cutoffYear}
                stroke="#C98B27"
                strokeDasharray="4 4"
                label={{ value: "Today", fontSize: 11, fill: "#C98B27" }}
              />
              {REGIONS.map((r) => (
                <Area
                  key={r}
                  dataKey={r}
                  stackId="region"
                  stroke={REGION_COLOR[r]}
                  fill={REGION_COLOR[r]}
                  fillOpacity={0.7}
                  name={r}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        {pies.map((p) => (
          <div key={p.year} className="card">
            <div className="caption text-muted text-center">Mix · {p.year}</div>
            <div className="h-44">
              <ResponsiveContainer>
                <PieChart>
                  <Tooltip formatter={(v: number | string) => (typeof v === "number" ? formatUsdShort(v * 1e6) : "—")} />
                  <Pie data={p.slices} dataKey="value" nameKey="name" innerRadius={36} outerRadius={66} paddingAngle={1}>
                    {p.slices.map((s) => (
                      <Cell key={s.name} fill={REGION_COLOR[s.name as UsRegion]} />
                    ))}
                  </Pie>
                  <PieLegend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[11px] text-muted text-center font-mono">Total {formatUsdShort(p.total * 1e6)}</div>
          </div>
        ))}
      </div>

      <div className="card mt-4 overflow-x-auto">
        <h4 className="font-heading text-h4 text-secondary mb-2">
          Regional CAGR · 2025–{Math.min(2035, viewThroughYear)}
        </h4>
        <table className="data-table min-w-[760px]">
          <thead>
            <tr>
              <th>Region</th>
              <th>Key states</th>
              <th>Anchor accounts</th>
              <th>2025 Net Sales</th>
              <th>{Math.min(2035, viewThroughYear)} Net Sales</th>
              <th>CAGR</th>
            </tr>
          </thead>
          <tbody>
            {cagrTable.map((r) => (
              <tr key={r.region}>
                <td className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: REGION_COLOR[r.region] }} />
                  {r.region}
                </td>
                <td className="text-xs text-muted">{REGION_KEY_STATES[r.region]}</td>
                <td className="text-xs text-muted">{REGION_ANCHORS[r.region]}</td>
                <td className="font-mono">{formatUsdShort(r.start2025)}</td>
                <td className="font-mono">{formatUsdShort(r.end)}</td>
                <td className={"font-mono " + (r.cagr >= 0 ? "text-success" : "text-danger")}>{formatPct(r.cagr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted mt-2">
          Northeast leads with ~{(regionSharesForYear(2025).Northeast * 100).toFixed(0)}% share in 2025 (academic-center prescribing
          density + commercial insurance penetration). Southeast share grows from {(regionSharesForYear(2025).Southeast * 100).toFixed(0)}% to{" "}
          {(regionSharesForYear(Math.min(2035, viewThroughYear)).Southeast * 100).toFixed(0)}% by{" "}
          {Math.min(2035, viewThroughYear)} as MS prevalence and treatment density rise. All regions share the same biosimilar
          headwind starting 2027 — regional differences are scale, not direction.
        </p>
      </div>
    </div>
  );
}
