"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import { useStore } from "@/lib/store";
import type { TrendAlgorithm } from "@/lib/engine";
import { EditableNumber } from "@/components/EditableNumber";
import { formatPct, formatNumber } from "@/lib/format";
import { Sparkles, Wand2 } from "lucide-react";

const ALGOS: { id: TrendAlgorithm; label: string }[] = [
  { id: "linear", label: "Linear" },
  { id: "exp-smoothing", label: "Exp Smoothing" },
  { id: "holt-winter-add", label: "Holt-Winter Additive" },
  { id: "holt-winter-mul", label: "Holt-Winter Multiplicative" },
  { id: "sma-auto", label: "SMA-Auto" },
  { id: "quick-expert", label: "Quick Expert" },
  { id: "customization", label: "Customization" },
];

export function TrendSelectionCard({ chartGrain = "annual" }: { chartGrain?: "annual" | "stf" } = {}) {
  const forecast = useStore((s) => s.forecast);
  const computed = useStore((s) => s.computed);
  const setSelectedAlgorithm = useStore((s) => s.setSelectedAlgorithm);
  const selected = forecast.lrp.selectedAlgorithm;
  const comparisons = computed?.trendDiagnostics.algorithmsCompared ?? [];
  const stfGranularity = forecast.stf.granularity;
  const stfCutoff = forecast.stf.actualsCutoffDate;

  const annualChartData = useMemo(() => {
    if (!computed) return [];
    const lastActualYear = forecast.lrp.annualActuals.reduce(
      (m, aa) => (aa.year > m ? aa.year : m),
      Number.NEGATIVE_INFINITY
    );
    const firstForecastYear = lastActualYear + 1;
    return computed.annual.map((a) => {
      const isHistorical = forecast.lrp.annualActuals.some((aa) => aa.year === a.year);
      // The actuals (blue) line extends one year into the forecast so the historical
      // segment visually closes at the first forecast year (2025 → 2026 stays blue).
      const includeInActuals = isHistorical || a.year === firstForecastYear;
      return {
        year: a.year,
        actuals: includeInActuals ? a.volume / 1000 : null,
        forecast: !isHistorical ? a.volume / 1000 : null,
      };
    });
  }, [computed, forecast.lrp.annualActuals]);

  const stfChartData = useMemo(() => {
    if (!computed) return [];
    if (stfGranularity === "daily") {
      const daily = computed.daily;
      let firstForecastIdx = -1;
      for (let i = 0; i < daily.length; i++) {
        if (daily[i].date > stfCutoff) {
          firstForecastIdx = i;
          break;
        }
      }
      return daily.map((d, i) => {
        const isActual = d.date <= stfCutoff;
        // Extend actuals one point into the forecast so the historical line closes
        // at the cutoff boundary (no visual gap between actuals and forecast).
        const includeInActuals = isActual || i === firstForecastIdx;
        return {
          period: d.date,
          actuals: includeInActuals ? d.totalVolume : null,
          forecast: !isActual ? d.totalVolume : null,
        };
      });
    }
    const weekly = computed.weekly;
    let firstForecastIdx = -1;
    for (let i = 0; i < weekly.length; i++) {
      if (!weekly[i].isActual) {
        firstForecastIdx = i;
        break;
      }
    }
    return weekly.map((w, i) => {
      const includeInActuals = w.isActual || i === firstForecastIdx;
      return {
        period: w.weekStart,
        actuals: includeInActuals ? w.totalVolume : null,
        forecast: !w.isActual ? w.totalVolume : null,
      };
    });
  }, [computed, stfGranularity, stfCutoff]);

  const showStf = chartGrain === "stf";
  const stfTickInterval = stfGranularity === "daily" ? Math.max(1, Math.floor(stfChartData.length / 12)) : 26;
  const captionText = showStf
    ? stfGranularity === "daily"
      ? "Volume (doses, daily)"
      : "Volume (doses, weekly)"
    : "Volume (thousand doses, annual)";

  return (
    <>
      <div className="card">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <div className="caption text-muted mb-2">{captionText}</div>
            <div className="h-72">
              <ResponsiveContainer>
                {showStf ? (
                  <LineChart data={stfChartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} interval={stfTickInterval} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} />
                    <Tooltip formatter={(v: number | string) => (typeof v === "number" ? formatNumber(v) : "—")} />
                    <ReferenceLine x={stfCutoff} stroke="#C98B27" strokeDasharray="4 4" label={{ value: "Cutoff", fontSize: 10, fill: "#C98B27" }} />
                    <Line type="monotone" dataKey="actuals" stroke="#004466" strokeWidth={2} dot={false} name="Actuals" />
                    <Line type="monotone" dataKey="forecast" stroke="#C98B27" strokeWidth={2} dot={false} name="Forecast" />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </LineChart>
                ) : (
                  <LineChart data={annualChartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number | string) => (typeof v === "number" ? formatNumber(v) + "K" : "—")} />
                    <ReferenceLine x={2026} stroke="#C98B27" strokeDasharray="4 4" label={{ value: "Today", fontSize: 11, fill: "#C98B27" }} />
                    <Line type="monotone" dataKey="actuals" stroke="#004466" strokeWidth={2.5} dot={{ r: 3 }} name="Actuals" />
                    <Line type="monotone" dataKey="forecast" stroke="#C98B27" strokeWidth={2.5} dot={{ r: 3 }} name="Forecast" />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
          <div className="lg:col-span-2">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>RSq</th>
                  <th>MAPE</th>
                  <th>RMSE</th>
                  <th>Sel</th>
                </tr>
              </thead>
              <tbody>
                {ALGOS.map((alg) => {
                  const cmp = comparisons.find((c) => c.algorithm === alg.id);
                  const isSelected = selected === alg.id;
                  return (
                    <tr
                      key={alg.id}
                      onClick={() => setSelectedAlgorithm(alg.id)}
                      className="cursor-pointer hover:bg-primary-light/40"
                    >
                      <td className="font-medium">{alg.label}</td>
                      <td className="font-mono text-xs">{cmp ? cmp.rsq.toFixed(2) : "—"}</td>
                      <td className="font-mono text-xs">{cmp ? formatPct(cmp.mape) : "—"}</td>
                      <td className="font-mono text-xs">{cmp ? formatNumber(cmp.rmse) : "—"}</td>
                      <td>
                        <span
                          className={
                            "inline-block w-3 h-3 rounded-full border-2 " +
                            (isSelected ? "bg-primary border-primary" : "border-muted")
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="text-xs text-muted mt-3">
              Quick Expert picks the lowest-RMSE method automatically. Currently:{" "}
              <span className="font-semibold">{computed?.trendDiagnostics.selectedAlgorithm.replace(/-/g, " ")}</span>.
            </div>
          </div>
        </div>
      </div>

      {selected === "quick-expert" && <QuickExpertPanel />}
      {selected === "customization" && <CustomizationEditor />}
    </>
  );
}

function QuickExpertPanel() {
  const computed = useStore((s) => s.computed);
  const params = useStore((s) => s.forecast.lrp.algorithmParams);
  const updateLRPInput = useStore((s) => s.updateLRPInput);
  if (!computed) return null;
  const cmps = computed.trendDiagnostics.algorithmsCompared.slice().sort((a, b) => a.rmse - b.rmse);
  const winner = cmps[0];

  return (
    <div className="card mt-4 border-primary/40 bg-primary-light/30">
      <div className="flex items-start gap-3">
        <Sparkles className="text-primary mt-1 flex-shrink-0" size={22} />
        <div className="flex-1">
          <h4 className="font-heading text-h4 text-secondary">Quick Expert is on</h4>
          <p className="text-sm text-muted mt-1">
            Quick Expert runs all five algorithms (Linear, Exp Smoothing, Holt-Winter additive & multiplicative, SMA-Auto) on your
            historical actuals and picks the one with the lowest in-sample RMSE. <strong>You don&apos;t edit Quick Expert directly</strong> —
            you tune the smoothing parameters below, and Quick Expert re-evaluates which method wins.
          </p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border border-border rounded-md p-3 bg-surface">
              <div className="caption text-muted">Currently winning</div>
              <div className="font-heading text-h4 text-primary">{winner.algorithm.replace(/-/g, " ")}</div>
              <div className="text-xs text-muted">RMSE {formatNumber(winner.rmse)}</div>
            </div>
            <div className="border border-border rounded-md p-3 bg-surface">
              <div className="caption text-muted mb-1">α (level smoothing)</div>
              <EditableNumber
                value={params.alpha ?? 0.4}
                onChange={(v) => updateLRPInput("lrp.algorithmParams.alpha", Math.max(0, Math.min(1, v)))}
                format={(v) => v.toFixed(2)}
                className="input-cell w-20 text-right"
              />
              <div className="text-[10px] text-muted mt-1">Higher = react faster to recent data (0–1)</div>
            </div>
            <div className="border border-border rounded-md p-3 bg-surface">
              <div className="caption text-muted mb-1">β (trend smoothing)</div>
              <EditableNumber
                value={params.beta ?? 0.2}
                onChange={(v) => updateLRPInput("lrp.algorithmParams.beta", Math.max(0, Math.min(1, v)))}
                format={(v) => v.toFixed(2)}
                className="input-cell w-20 text-right"
              />
              <div className="text-[10px] text-muted mt-1">Higher = trend follows level changes faster (0–1)</div>
            </div>
          </div>
          <details className="mt-3 text-xs text-muted">
            <summary className="cursor-pointer hover:text-foreground">Why this method won</summary>
            <ul className="mt-2 space-y-1 font-mono">
              {cmps.map((c) => (
                <li key={c.algorithm} className="flex justify-between">
                  <span>{c.algorithm}</span>
                  <span>RMSE {formatNumber(c.rmse)} · MAPE {formatPct(c.mape)}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}

function CustomizationEditor() {
  const annualActuals = useStore((s) => s.forecast.lrp.annualActuals);
  const customizationCurve = useStore((s) => s.forecast.lrp.customizationCurve ?? []);
  const setCustomizationPoint = useStore((s) => s.setCustomizationPoint);
  const resetCustomizationToTrend = useStore((s) => s.resetCustomizationToTrend);
  const endYear = parseInt(useStore((s) => s.forecast.timeframe.forecastEnd).split("-")[0]);
  const lastActualYear = annualActuals[annualActuals.length - 1]?.year ?? 2025;

  const years: number[] = [];
  for (let y = lastActualYear + 1; y <= endYear; y++) years.push(y);

  const valueByYear = new Map(customizationCurve.map((p) => [p.year, p.value]));

  return (
    <div className="card mt-4 border-primary/40">
      <div className="flex items-start gap-3 mb-3">
        <Wand2 className="text-primary mt-1 flex-shrink-0" size={22} />
        <div className="flex-1">
          <h4 className="font-heading text-h4 text-secondary">Customization curve</h4>
          <p className="text-sm text-muted mt-1">
            You enter a volume number for each future year directly. The engine bypasses statistical fitting and uses your numbers
            as the annual baseline (events, share, and pricing still apply on top). Empty cells fall back to the closest filled
            year.
          </p>
        </div>
        <button onClick={resetCustomizationToTrend} className="btn-ghost flex items-center gap-1 self-start">
          <Sparkles size={14} /> Pre-fill from Quick Expert
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[600px]">
          <thead>
            <tr>
              <th>Year</th>
              <th>Volume (doses)</th>
              <th>vs prior year</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y, i) => {
              const v = valueByYear.get(y);
              const prev = i === 0 ? annualActuals[annualActuals.length - 1]?.value : valueByYear.get(years[i - 1]);
              const yoy = v !== undefined && prev !== undefined && prev > 0 ? (v - prev) / prev : null;
              return (
                <tr key={y}>
                  <td className="font-mono">{y}</td>
                  <td>
                    <EditableNumber
                      value={v}
                      onChange={(val) => setCustomizationPoint(y, val)}
                      format={(val) => formatNumber(val)}
                      parse={(s) => parseFloat(s.replace(/,/g, ""))}
                      className="input-cell w-32 text-right"
                    />
                  </td>
                  <td
                    className={
                      "font-mono text-xs " +
                      (yoy === null ? "text-muted" : yoy >= 0 ? "text-success" : "text-danger")
                    }
                  >
                    {yoy === null ? "—" : `${yoy >= 0 ? "+" : ""}${(yoy * 100).toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
