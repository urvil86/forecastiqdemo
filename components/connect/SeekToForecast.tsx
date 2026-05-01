"use client";

import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { seekToForecast } from "@/lib/engine";
import type { SeekOptions, SeekResult } from "@/lib/engine";
import { SectionHeader } from "@/components/SectionHeader";
import { formatUsdShort, formatPct, formatNumber } from "@/lib/format";

const DEFAULT_THRESHOLDS = { achievable: 1.05, stretch: 1.15 };
const PROGRESS_STEPS = [
  "Decomposing annual lift across 52 weeks…",
  "Identifying intervention weeks…",
  "Generating recommendations…",
  "Done.",
];

export function SeekToForecast() {
  const forecast = useStore((s) => s.forecast);
  const computed = useStore((s) => s.computed);

  const baselineByYear = useMemo(() => {
    const m = new Map<number, number>();
    if (computed) for (const a of computed.annual) m.set(a.year, a.netSales);
    return m;
  }, [computed]);

  const [year, setYear] = useState(2027);
  const baseline = baselineByYear.get(year) ?? 0;
  const [target, setTarget] = useState<number>(0);
  const [distMethod, setDistMethod] = useState<SeekOptions["distributionMethod"]>("flat");
  const [intervMode, setIntervMode] = useState<SeekOptions["interventionMode"]>("allow-stf-overrides");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SeekResult | null>(null);
  const [filterMonth, setFilterMonth] = useState<string | null>(null);
  const interventionRef = useRef<HTMLDivElement | null>(null);

  function handleRunSeek() {
    if (!computed) return;
    setRunning(true);
    setProgress(0);
    setResult(null);
    let step = 0;
    const tick = () => {
      step++;
      setProgress(step);
      if (step < PROGRESS_STEPS.length - 1) {
        setTimeout(tick, 700);
      } else {
        const r = seekToForecast(
          forecast,
          { year, targetNetSales: target > 0 ? target : baseline + 250e6 },
          {
            distributionMethod: distMethod,
            interventionMode: intervMode,
            achievabilityThresholds: DEFAULT_THRESHOLDS,
          },
          computed
        );
        setResult(r);
        setRunning(false);
      }
    };
    setTimeout(tick, 600);
  }

  const effectiveTarget = target > 0 ? target : baseline + 250e6;

  return (
    <div>
      <SectionHeader title="Seek to Forecast" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <h4 className="font-heading text-h4 text-secondary mb-3">Target</h4>
          <div className="caption text-muted">Year</div>
          <select
            value={year}
            onChange={(e) => {
              const newY = parseInt(e.target.value);
              setYear(newY);
              setTarget(0);
            }}
            className="input-cell !font-sans w-full mb-2"
          >
            {[2026, 2027, 2028, 2029, 2030].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <div className="caption text-muted mt-2">Current LRP forecast</div>
          <div className="font-mono text-secondary">{formatUsdShort(baseline)}</div>
          <div className="caption text-muted mt-2">Target ($)</div>
          <input
            type="text"
            placeholder={formatUsdShort(baseline + 250e6)}
            onBlur={(e) => {
              const v = parseTarget(e.target.value);
              if (Number.isFinite(v)) setTarget(v);
            }}
            className="input-cell w-full"
          />
          <button onClick={handleRunSeek} disabled={running} className="btn-secondary mt-3 w-full">
            {running ? "Running…" : "Run Seek"}
          </button>
        </div>

        <div className="card">
          <h4 className="font-heading text-h4 text-secondary mb-1">Distribution Method</h4>
          <p className="text-xs text-muted mb-3">
            <strong>How should the gap be spread across the year?</strong> The lift you need to hit your target has to be allocated
            to specific weeks. This setting decides which weeks get more of the burden.
          </p>
          <Radio name="dist" value="flat" current={distMethod} onChange={setDistMethod}>
            <strong>Flat (even)</strong>
            <div className="text-xs text-muted">
              Spread the lift evenly across every remaining week. Use when you have no reason to think one period is easier than
              another.
            </div>
          </Radio>
          <Radio name="dist" value="historical-pattern" current={distMethod} onChange={setDistMethod}>
            <strong>Match the year's existing shape</strong>
            <div className="text-xs text-muted">
              Big months stay big, small months stay small. Adds proportionally more to your already strong weeks.
            </div>
          </Radio>
          <Radio name="dist" value="event-weighted" current={distMethod} onChange={setDistMethod}>
            <strong>Front-load (event-weighted)</strong>
            <div className="text-xs text-muted">
              Tilt the lift earlier in the year, into months not blocked by known negative events. Buys time before headwinds bite.
            </div>
          </Radio>
        </div>

        <div className="card">
          <h4 className="font-heading text-h4 text-secondary mb-1">Intervention Mode</h4>
          <p className="text-xs text-muted mb-3">
            <strong>Where should the change actually be made?</strong> The system can hit your target in different ways — change the
            operational forecast week-by-week, or just raise the LRP assumption.
          </p>
          <Radio name="mode" value="allow-stf-overrides" current={intervMode} onChange={setIntervMode}>
            <strong>Adjust weekly STF (operational)</strong>
            <div className="text-xs text-muted">
              Push individual weeks above their current forecast — for example, "we need W34 to deliver +$8M more than baseline."
              Changes are concrete and assignable to teams.
            </div>
          </Radio>
          <Radio name="mode" value="lrp-only" current={intervMode} onChange={setIntervMode}>
            <strong>Raise the LRP assumption</strong>
            <div className="text-xs text-muted">
              Change the annual number and let phasing push the lift down to weeks automatically. Use when the upside is structural
              (e.g. price increase), not week-specific.
            </div>
          </Radio>
          <Radio name="mode" value="optimize" current={intervMode} onChange={setIntervMode}>
            <strong>Optimize (least disruption)</strong>
            <div className="text-xs text-muted">
              Solve for the smoothest weekly path that still hits the target. Minimizes spike weeks; spreads small lifts widely.
            </div>
          </Radio>
        </div>
      </div>

      {running && (
        <div className="card text-center py-10">
          <div className="font-heading text-h4 text-secondary mb-2">{PROGRESS_STEPS[progress]}</div>
          <div className="w-3/4 mx-auto bg-background rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full transition-all"
              style={{ width: `${((progress + 1) / PROGRESS_STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {result && !running && (
        <div className="space-y-6">
          <ResultStrip1 result={result} />
          <ResultStrip2 result={result} thresholds={DEFAULT_THRESHOLDS} onMonthClick={(m) => {
            setFilterMonth(m);
            setTimeout(() => interventionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
          }} />
          <div ref={interventionRef}>
            <ResultStrip3 result={result} thresholds={DEFAULT_THRESHOLDS} filterMonth={filterMonth} onClear={() => setFilterMonth(null)} />
          </div>
          <ResultStrip4 result={result} />
          <ResultStrip5 />
        </div>
      )}
    </div>
  );
}

function Radio<T extends string>({
  name,
  value,
  current,
  onChange,
  children,
}: {
  name: string;
  value: T;
  current: T;
  onChange: (v: T) => void;
  children: React.ReactNode;
}) {
  const checked = current === value;
  return (
    <label className={"block px-3 py-2 rounded mb-1 cursor-pointer border " + (checked ? "border-primary bg-primary-light/40" : "border-transparent hover:bg-background")}>
      <input type="radio" name={name} className="mr-2 accent-primary" checked={checked} onChange={() => onChange(value)} />
      {children}
    </label>
  );
}

function parseTarget(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return NaN;
  if (s.toLowerCase().includes("b")) return n * 1e9;
  if (s.toLowerCase().includes("m")) return n * 1e6;
  return n;
}

function ResultStrip1({ result }: { result: SeekResult }) {
  const interventions = result.summary.weeksRequireIntervention;
  const totalWeeks = result.summary.weeksAchievable + result.summary.weeksStretch + result.summary.weeksRequireIntervention;
  const badgeColor =
    interventions === 0 ? "bg-success/20 text-success" : interventions <= 5 ? "bg-warning/20 text-warning" : "bg-danger/20 text-danger";
  const label =
    interventions === 0
      ? `Achievable — fully within run-rate`
      : interventions <= 12
      ? `Stretch — requires intervention in ${interventions} of ${totalWeeks} weeks`
      : `High lift — intervention required in ${interventions} of ${totalWeeks} weeks`;

  return (
    <div className="card">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div>
          <div className="caption text-muted">Target</div>
          <div className="font-heading text-h2 text-secondary">{formatUsdShort(result.target.targetNetSales)}</div>
        </div>
        <div>
          <div className="caption text-muted">Baseline</div>
          <div className="font-heading text-h2 text-secondary">{formatUsdShort(result.baseline.baselineNetSales)}</div>
        </div>
        <div>
          <div className="caption text-muted">Required Lift</div>
          <div className="font-heading text-h2 text-primary">
            {result.requiredLift.absoluteUsd > 0 ? "+" : ""}
            {formatUsdShort(result.requiredLift.absoluteUsd)}
          </div>
          <div className="text-xs text-muted">{formatPct(result.requiredLift.pct)}</div>
        </div>
      </div>
      <div className="mt-4 text-center">
        <span className={"inline-block px-4 py-2 rounded-full font-semibold " + badgeColor}>{label}</span>
      </div>
    </div>
  );
}

function ResultStrip2({
  result,
  thresholds,
  onMonthClick,
}: {
  result: SeekResult;
  thresholds: { achievable: number; stretch: number };
  onMonthClick: (m: string) => void;
}) {
  return (
    <div className="card">
      <h4 className="font-heading text-h4 text-secondary mb-2">Monthly Decomposition</h4>
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {result.monthlyDecomposition.map((m) => {
          const color =
            m.achievabilityFlag === "achievable"
              ? "bg-success/15 border-success/40"
              : m.achievabilityFlag === "stretch"
              ? "bg-warning/15 border-warning/40"
              : "bg-danger/15 border-danger/40";
          const date = new Date(m.month + "-01");
          const label = date.toLocaleDateString("en-US", { month: "short" });
          return (
            <button
              key={m.month}
              onClick={() => onMonthClick(m.month)}
              className={"text-left p-3 rounded-md border " + color}
            >
              <div className="text-xs font-semibold">{label}</div>
              <div className="text-[10px] text-muted">Baseline: {formatUsdShort(m.baseline)}</div>
              <div className="text-[10px] text-muted">Required: {formatUsdShort(m.required)}</div>
              <div className="text-[11px] mt-1">
                Δ <span className="font-mono">{formatUsdShort(m.additional)}</span>
              </div>
              <div className="text-[10px] text-muted">×{m.runRateMultiplier.toFixed(2)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultStrip3({
  result,
  thresholds,
  filterMonth,
  onClear,
}: {
  result: SeekResult;
  thresholds: { achievable: number; stretch: number };
  filterMonth: string | null;
  onClear: () => void;
}) {
  const skus = Array.from(new Set(result.weeklyDecomposition.map((w) => w.sku)));
  const weeks = Array.from(new Set(result.weeklyDecomposition.map((w) => w.weekStart))).sort();
  const filteredWeeks = filterMonth ? weeks.filter((w) => w.startsWith(filterMonth)) : weeks;

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-heading text-h4 text-secondary">Weekly Intervention Map</h4>
        {filterMonth && (
          <button onClick={onClear} className="text-xs text-primary hover:underline">
            Clear filter ({filterMonth})
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="text-[10px] border-collapse">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-muted">SKU</th>
              {filteredWeeks.map((w) => (
                <th key={w} className="px-1 py-1 text-muted font-mono">{w.slice(5)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {skus.map((sku) => (
              <tr key={sku}>
                <td className="px-2 py-1 font-medium">{sku.replace("ocrevus-", "")}</td>
                {filteredWeeks.map((w) => {
                  const entry = result.weeklyDecomposition.find((wd) => wd.sku === sku && wd.weekStart === w);
                  const color =
                    !entry || entry.achievabilityFlag === "achievable"
                      ? "bg-success"
                      : entry.achievabilityFlag === "stretch"
                      ? "bg-warning"
                      : "bg-danger";
                  return (
                    <td
                      key={w}
                      className={"w-3 h-6 border border-white " + color}
                      title={
                        entry
                          ? `${w} (${sku}) · Baseline ${formatUsdShort(entry.baseline)} · Required ${formatUsdShort(entry.required)} · Δ ${formatUsdShort(entry.additional)} · ×${entry.runRateMultiplier.toFixed(2)}`
                          : ""
                      }
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 mt-3 text-xs text-muted">
        <span>
          <span className="inline-block w-3 h-3 align-middle bg-success mr-1" />
          Achievable: {result.summary.weeksAchievable}
        </span>
        <span>
          <span className="inline-block w-3 h-3 align-middle bg-warning mr-1" />
          Stretch: {result.summary.weeksStretch}
        </span>
        <span>
          <span className="inline-block w-3 h-3 align-middle bg-danger mr-1" />
          Requires intervention: {result.summary.weeksRequireIntervention}
        </span>
      </div>
    </div>
  );
}

function ResultStrip4({ result }: { result: SeekResult }) {
  const top = result.interventionWeeks.slice(0, 5);
  if (top.length === 0) {
    return (
      <div className="card">
        <h4 className="font-heading text-h4 text-secondary mb-2">Intervention Recommendations</h4>
        <p className="text-sm text-muted">No intervention weeks. Target is fully achievable within run-rate.</p>
      </div>
    );
  }
  return (
    <div className="card">
      <h4 className="font-heading text-h4 text-secondary mb-3">Intervention Recommendations</h4>
      <div className="space-y-3">
        {top.map((iw, i) => (
          <div key={`${iw.weekStart}-${iw.sku}-${i}`} className="border border-border rounded-md p-3">
            <div className="flex justify-between items-start">
              <div className="font-semibold">
                Week {iw.weekStart} — Gap +{formatUsdShort(iw.gapUsd)}
                <span className="text-xs text-muted ml-2">SKU: {iw.sku}</span>
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost !py-1 !px-3 text-xs">Generate plan</button>
                <button className="btn-ghost !py-1 !px-3 text-xs">Mark for review</button>
              </div>
            </div>
            <ul className="text-sm text-muted mt-2 space-y-1">
              {iw.suggestedActions.map((a, j) => (
                <li key={j}>▸ {a}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {result.interventionWeeks.length > 5 && (
        <div className="text-sm text-muted mt-2">
          + {result.interventionWeeks.length - 5} more intervention weeks
        </div>
      )}
    </div>
  );
}

function ResultStrip5() {
  return (
    <div className="card flex flex-wrap gap-2">
      <button className="btn-secondary">Save as Scenario</button>
      <button className="btn-secondary">Push to LRP</button>
      <button className="btn-secondary">Push to STF</button>
      <button className="btn-ghost">Reset</button>
    </div>
  );
}
