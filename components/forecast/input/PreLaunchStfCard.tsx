"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Rocket, CheckCircle2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatUsdShort } from "@/lib/format";

const HORIZON_OPTIONS = [4, 13, 26, 52] as const;

type Grain = "weekly" | "daily";

/**
 * v2.6 Pre-launch STF derivation.
 *
 * Pre-launch products don't have commercial actuals, but the LRP curve
 * already implies a post-launch trajectory. This card lets the
 * forecaster anchor an STF at the configured launch date and derive
 * weekly or daily volumes / net sales from the LRP cascade for the
 * chosen horizon. Activation flips the actuals-cutoff to the Monday
 * before launch and writes the chosen horizon + grain into the STF
 * cycle config — no manual data needed. After activation, the regular
 * STF Setup card and Build Zone reveal so the forecaster can layer
 * weekly events / pricing / inventory / overrides on top of the
 * derived baseline.
 */
export function PreLaunchStfCard() {
  const forecast = useStore((s) => s.forecast);
  const computed = useStore((s) => s.computed);
  const activatePreLaunchStf = useStore((s) => s.activatePreLaunchStf);

  const launchDate = forecast.preLaunchOverlay?.launchTrajectory?.expectedLaunchDate;
  const ramp = forecast.preLaunchOverlay?.launchTrajectory?.rampShape;
  const peakPct = forecast.preLaunchOverlay?.launchTrajectory?.peakSharePct;
  const ttp = forecast.preLaunchOverlay?.launchTrajectory?.timeToPeakYears;

  const [horizonWeeks, setHorizonWeeks] = useState<number>(13);
  const [grain, setGrain] = useState<Grain>("weekly");

  // Activation status: actualsCutoffDate at or after launch − 1 week means
  // the STF has been anchored to launch.
  const isActivated = useMemo(() => {
    if (!launchDate) return false;
    const launchTime = new Date(launchDate).getTime();
    const cutoffTime = new Date(forecast.stf.actualsCutoffDate).getTime();
    return Math.abs(launchTime - cutoffTime) < 14 * 86400_000;
  }, [forecast.stf.actualsCutoffDate, launchDate]);

  // Derived series for the chart. We pull from computed.weekly / computed.daily
  // and clip to the post-launch window of `horizonWeeks` length.
  const series = useMemo(() => {
    if (!computed || !launchDate) return [];
    const launchTime = new Date(launchDate).getTime();
    if (grain === "weekly") {
      return computed.weekly
        .filter((w) => new Date(w.weekStart).getTime() >= launchTime)
        .slice(0, horizonWeeks)
        .map((w, i) => ({
          x: `W${i + 1}`,
          xDate: w.weekStart,
          volume: w.totalVolume,
          netSalesM: w.totalNetSales / 1e6,
        }));
    }
    // daily — show first horizonWeeks * 7 days post-launch
    return computed.daily
      .filter((d) => new Date(d.date).getTime() >= launchTime)
      .slice(0, horizonWeeks * 7)
      .map((d, i) => ({
        x: `D${i + 1}`,
        xDate: d.date,
        volume: d.totalVolume,
        netSalesM: d.totalNetSales / 1e6,
      }));
  }, [computed, launchDate, grain, horizonWeeks]);

  const totals = useMemo(() => {
    return series.reduce(
      (acc, r) => {
        acc.volume += r.volume;
        acc.netSalesM += r.netSalesM;
        return acc;
      },
      { volume: 0, netSalesM: 0 },
    );
  }, [series]);

  if (!launchDate) {
    return (
      <div className="card border-l-4 border-amber-500">
        <h4 className="font-heading text-h4 text-secondary mb-1">
          STF activates at launch
        </h4>
        <p className="text-sm text-muted">
          Set an expected launch date in the Pre-launch Trajectory section
          above to enable the STF derivation.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h4 className="font-heading text-h4 text-secondary">
          3.0 Pre-launch STF · derive from LRP
        </h4>
        {isActivated ? (
          <span className="pill text-[10px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 size={10} />
            STF activated · {forecast.stf.horizonWeeks} {forecast.stf.granularity}{" "}
            window
          </span>
        ) : (
          <span className="pill text-[10px] bg-amber-500/10 text-amber-700 border border-amber-500/30">
            Not yet activated
          </span>
        )}
      </div>
      <p className="text-xs text-muted mb-3">
        No commercial actuals yet — the engine derives a post-launch STF
        directly from the LRP curve, scaled by the launch trajectory (peak
        share, time-to-peak, ramp shape). Pick a grain and horizon, then
        Activate to unlock weekly authoring.
      </p>

      <div className="card space-y-4">
        {/* Setup row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Field label="Expected launch date">
            <div className="px-2 py-1.5 bg-background border border-border rounded text-sm font-mono flex items-center gap-2">
              <Rocket size={12} className="text-primary" />
              {launchDate.slice(0, 10)}
            </div>
          </Field>
          <Field label="Trajectory">
            <div className="px-2 py-1.5 bg-background border border-border rounded text-xs">
              {ramp ? ramp.charAt(0).toUpperCase() + ramp.slice(1) : "—"} ramp ·
              peak {peakPct ?? "—"}% in {ttp ?? "—"}y
            </div>
          </Field>
          <Field label="Output grain">
            <div className="flex gap-1">
              {(["weekly", "daily"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGrain(g)}
                  className={
                    "flex-1 px-2 py-1.5 border rounded text-xs " +
                    (grain === g
                      ? "border-primary bg-primary-light/40 text-secondary font-semibold"
                      : "border-border")
                  }
                >
                  {g === "weekly" ? "Weekly" : "Daily"}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Forecast horizon (weeks)">
            <select
              value={horizonWeeks}
              onChange={(e) => setHorizonWeeks(parseInt(e.target.value))}
              className="input-cell !font-sans w-full"
            >
              {HORIZON_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {w} weeks {grain === "daily" ? `(${w * 7} days)` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Derived chart */}
        {series.length > 0 ? (
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-[10px] uppercase tracking-wider text-muted">
                Derived {grain} forecast (post-launch)
              </div>
              <div className="text-[11px] text-muted">
                {grain === "weekly"
                  ? `${series.length} weeks`
                  : `${series.length} days`}{" "}
                · total: {formatUsdShort(totals.netSalesM * 1e6)} ·{" "}
                {totals.volume.toFixed(0)} units
              </div>
            </div>
            <div className="h-48 border border-border rounded p-2">
              <ResponsiveContainer>
                <LineChart
                  data={series}
                  margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
                  <XAxis dataKey="x" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `$${v.toFixed(2)}M`}
                  />
                  <Tooltip
                    formatter={(v: number) => [
                      `$${(v as number).toFixed(2)}M`,
                      "Net sales",
                    ]}
                    labelFormatter={(label, payload) => {
                      const xd = payload && payload[0]
                        ? (payload[0].payload as { xDate?: string }).xDate
                        : undefined;
                      return xd ? `${label} · ${xd}` : String(label);
                    }}
                  />
                  <ReferenceLine y={0} stroke="#E6E1D6" />
                  <Line
                    dataKey="netSalesM"
                    stroke="#004466"
                    strokeWidth={2.5}
                    dot={grain === "weekly" ? { r: 2.5 } : false}
                    name="Net sales"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted mt-2">
              Source: LRP cascade (epidemiology / market-share method) ×
              launch trajectory × phasing profile. Activation lets you
              override any week or day below.
            </p>
          </div>
        ) : (
          <div className="text-xs text-muted italic p-4 border border-dashed border-border rounded">
            No post-launch weeks in the computed forecast window. Verify the
            forecast end date covers at least the launch year.
          </div>
        )}

        {/* Activate button */}
        <div className="flex items-center justify-between pt-2 border-t border-border flex-wrap gap-2">
          <div className="text-[11px] text-muted">
            Activating sets the actuals cutoff to the Monday before launch and
            writes a {horizonWeeks}-week horizon at {grain} grain. You can
            re-derive any time.
          </div>
          <button
            className="btn-secondary text-xs flex items-center gap-1"
            onClick={() => activatePreLaunchStf({ horizonWeeks, grain })}
          >
            <Rocket size={12} />
            {isActivated ? "Re-derive STF" : "Activate STF"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}
