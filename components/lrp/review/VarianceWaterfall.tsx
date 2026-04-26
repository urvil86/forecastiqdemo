"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { compute, type ConnectedForecast } from "@/lib/engine";
import { SectionHeader } from "@/components/SectionHeader";
import { formatUsdShort, formatPct } from "@/lib/format";

interface DriverDelta {
  label: string;
  delta: number;
  positive: boolean;
  reasoning: string;
}

export function VarianceWaterfall({
  year,
  onYearChange,
  compareToVersionId,
}: {
  year: number;
  onYearChange: (y: number) => void;
  compareToVersionId: string | null;
}) {
  const forecast = useStore((s) => s.forecast);
  const versionHistory = useStore((s) => s.versionHistory);

  const priorVersion = compareToVersionId
    ? versionHistory.find((v) => v.id === compareToVersionId)
    : versionHistory[0];

  const result = useMemo(() => {
    if (!priorVersion) return null;
    const baselineNet = compute(priorVersion.forecast).annual.find((a) => a.year === year)?.netSales ?? 0;
    const currentNet = compute(forecast).annual.find((a) => a.year === year)?.netSales ?? 0;

    // Decompose into driver-by-driver deltas: swap one piece at a time and measure
    const deltas: DriverDelta[] = [];

    // Class share
    let cur: ConnectedForecast = { ...priorVersion.forecast };
    cur = { ...cur, lrp: { ...cur.lrp, classShare: forecast.lrp.classShare } };
    let v = compute(cur).annual.find((a) => a.year === year)?.netSales ?? baselineNet;
    deltas.push({ label: "Class share revision", delta: v - baselineNet, positive: v >= baselineNet, reasoning: "Class-share trajectory anchors changed between versions." });
    let running = v;

    // Product share
    cur = { ...cur, lrp: { ...cur.lrp, productShare: forecast.lrp.productShare } };
    v = compute(cur).annual.find((a) => a.year === year)?.netSales ?? running;
    deltas.push({ label: "Product share revision", delta: v - running, positive: v >= running, reasoning: "Product-share anchors revised — competitive switching, label change, or strategy shift." });
    running = v;

    // Gross price + GTN
    cur = { ...cur, lrp: { ...cur.lrp, grossPrice: forecast.lrp.grossPrice, gtnRate: forecast.lrp.gtnRate } };
    v = compute(cur).annual.find((a) => a.year === year)?.netSales ?? running;
    deltas.push({ label: "Pricing & GTN revision", delta: v - running, positive: v >= running, reasoning: "Gross price or gross-to-net rate anchors changed — channel mix, market access, or list-price adjustment." });
    running = v;

    // Events
    cur = { ...cur, lrp: { ...cur.lrp, events: forecast.lrp.events } };
    v = compute(cur).annual.find((a) => a.year === year)?.netSales ?? running;
    deltas.push({ label: "Event impact change", delta: v - running, positive: v >= running, reasoning: "Events (biosimilar timing, competitor moves, market access wins) re-calibrated." });
    running = v;

    // Trend / actuals
    cur = { ...cur, lrp: { ...cur.lrp, annualActuals: forecast.lrp.annualActuals, selectedAlgorithm: forecast.lrp.selectedAlgorithm, algorithmParams: forecast.lrp.algorithmParams, customizationCurve: forecast.lrp.customizationCurve } };
    v = compute(cur).annual.find((a) => a.year === year)?.netSales ?? running;
    deltas.push({ label: "Trend / actuals revision", delta: v - running, positive: v >= running, reasoning: "Updated historical actuals or trending-method change shifted the baseline projection." });

    return { baselineNet, currentNet, deltas, priorVersion };
  }, [forecast, priorVersion, year]);

  if (!result) {
    return (
      <div>
        <SectionHeader title={`What Changed · v${forecast.version} vs prior`} subtitle="Variance waterfall — only available with a prior saved version." />
        <div className="card text-sm text-muted text-center py-8">
          No prior versions saved yet. Click <strong>Save Version</strong> on the LRP authoring page, make some changes, and the
          variance waterfall will appear here.
        </div>
      </div>
    );
  }

  const { baselineNet, currentNet, deltas, priorVersion: prior } = result;
  const netDelta = currentNet - baselineNet;
  const netDeltaPct = baselineNet === 0 ? 0 : netDelta / baselineNet;

  // Build waterfall visualization using horizontal bars sized to magnitudes
  const totalRange = Math.max(baselineNet, currentNet);
  const allValues = [baselineNet, currentNet, ...deltas.map((d) => d.delta).flatMap((d) => [d, -d])];
  const max = Math.max(...allValues.map(Math.abs), 1);
  const widthFor = (v: number) => `${Math.min(80, (Math.abs(v) / totalRange) * 100)}%`;

  let runningTotal = baselineNet;

  return (
    <div>
      <SectionHeader
        title={`What Changed · v${forecast.version} vs v${prior!.version}`}
        subtitle={`Driver-by-driver decomposition for ${year}. Each step shows the marginal $ impact when that piece is swapped from the prior version into the current.`}
        right={
          <div className="flex items-center gap-2">
            <span className="caption text-muted">Year:</span>
            <select className="input-cell !font-sans" value={year} onChange={(e) => onYearChange(parseInt(e.target.value))}>
              {[2026, 2027, 2028, 2029, 2030, 2032, 2035].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        }
      />
      <div className="card">
        {/* Waterfall */}
        <div className="space-y-3">
          <WaterfallRow label={`Prior (v${prior!.version}) ${year}`} value={baselineNet} type="anchor-prior" widthPct={(baselineNet / totalRange) * 100} />
          {deltas.map((d, i) => {
            runningTotal += d.delta;
            return (
              <WaterfallRow
                key={i}
                label={d.label}
                value={d.delta}
                type={d.positive ? "positive" : "negative"}
                widthPct={(Math.abs(d.delta) / totalRange) * 100}
                offsetPct={(((runningTotal - d.delta - (d.positive ? 0 : Math.abs(d.delta))) / totalRange) * 100)}
                runningTotal={runningTotal}
              />
            );
          })}
          <WaterfallRow label={`Current (v${forecast.version}) ${year}`} value={currentNet} type="anchor-current" widthPct={(currentNet / totalRange) * 100} />
        </div>

        <div className="mt-4 pt-3 border-t border-border text-center">
          <div className="caption text-muted">Net change</div>
          <div className={"font-heading text-h2 " + (netDelta >= 0 ? "text-success" : "text-danger")}>
            {netDelta >= 0 ? "+" : ""}{formatUsdShort(netDelta)} ({formatPct(netDeltaPct)})
          </div>
        </div>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <h4 className="font-heading text-h4 text-secondary mb-2">Driver detail</h4>
        <table className="data-table min-w-[760px]">
          <thead>
            <tr>
              <th>Driver</th>
              <th>Direction</th>
              <th>Magnitude ($M)</th>
              <th>Magnitude (%)</th>
              <th>Reasoning</th>
            </tr>
          </thead>
          <tbody>
            {deltas.map((d, i) => (
              <tr key={i}>
                <td className="font-medium">{d.label}</td>
                <td>
                  <span className={d.positive ? "pill-success" : "pill-danger"}>
                    {d.positive ? "+" : "−"}
                  </span>
                </td>
                <td className={"font-mono " + (d.positive ? "text-success" : "text-danger")}>
                  {d.positive ? "+" : ""}{formatUsdShort(d.delta)}
                </td>
                <td className={"font-mono text-xs " + (d.positive ? "text-success" : "text-danger")}>
                  {baselineNet === 0 ? "—" : formatPct(d.delta / baselineNet)}
                </td>
                <td className="text-xs text-muted">{d.reasoning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WaterfallRow({
  label,
  value,
  type,
  widthPct,
  offsetPct,
  runningTotal,
}: {
  label: string;
  value: number;
  type: "anchor-prior" | "anchor-current" | "positive" | "negative";
  widthPct: number;
  offsetPct?: number;
  runningTotal?: number;
}) {
  const color =
    type === "anchor-prior" ? "#004466"
    : type === "anchor-current" ? "#C98B27"
    : type === "positive" ? "#1F8A5C"
    : "#C1423B";
  const isAnchor = type === "anchor-prior" || type === "anchor-current";
  return (
    <div className="grid grid-cols-[260px_1fr_140px] gap-3 items-center">
      <div className="text-sm">{label}</div>
      <div className="relative h-7 bg-background rounded">
        <div
          className="absolute top-0 bottom-0 rounded transition-all"
          style={{
            left: `${offsetPct ?? 0}%`,
            width: `${widthPct}%`,
            background: color,
            opacity: isAnchor ? 1 : 0.85,
          }}
        />
      </div>
      <div className={"font-mono text-sm text-right " + (type === "negative" ? "text-danger" : type === "positive" ? "text-success" : "text-secondary")}>
        {isAnchor ? formatUsdShort(value) : `${value >= 0 ? "+" : ""}${formatUsdShort(value)}`}
        {!isAnchor && runningTotal !== undefined && (
          <div className="text-[10px] text-muted">→ {formatUsdShort(runningTotal)}</div>
        )}
      </div>
    </div>
  );
}
