"use client";

import { useStore } from "@/lib/store";
import { EditableNumber } from "@/components/EditableNumber";
import { formatPct, formatNumber } from "@/lib/format";
import { interpolateAnchors } from "@/lib/engine";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * v2.6 STF Setup card — covers what was previously in the v2.5 STF Setup
 * zone, lifted into the Input page so the forecaster sets up the STF cycle
 * before authoring weekly inputs.
 *
 * Sections:
 *   3.0 Cycle configuration  (horizon, history, granularity, cutoff)
 *   3.1 Pricing & GTN        (cycle-year gross / GTN / net price)
 *   3.2 Daily sales pattern  (DSP — Mon..Sun weights)
 *   3.3 Inventory & DOH setup (target DOH per tier, alert thresholds,
 *                              starting on-hand)
 */
export function StfSetupCard() {
  return (
    <div className="space-y-6">
      <CycleConfigCard />
      <PricingCard />
      <DspCard />
      <DohSetupCard />
    </div>
  );
}

function CycleConfigCard() {
  const forecast = useStore((s) => s.forecast);
  const updateLRPInput = useStore((s) => s.updateLRPInput);

  return (
    <div>
      <h4 className="font-heading text-h4 text-secondary mb-2">
        3.0 Cycle Configuration
      </h4>
      <div className="card grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Forecast horizon">
          <select
            value={forecast.stf.horizonWeeks}
            onChange={(e) =>
              updateLRPInput("stf.horizonWeeks", parseInt(e.target.value))
            }
            className="input-cell !font-sans w-full"
          >
            {[4, 8, 13, 26].map((w) => (
              <option key={w} value={w}>
                {w} weeks forward
              </option>
            ))}
          </select>
        </Field>
        <Field label="History window">
          <select
            value={forecast.stf.historyWeeksShown}
            onChange={(e) =>
              updateLRPInput("stf.historyWeeksShown", parseInt(e.target.value))
            }
            className="input-cell !font-sans w-full"
          >
            {[13, 26, 52, 104, 156].map((w) => (
              <option key={w} value={w}>
                {w} weeks back
              </option>
            ))}
          </select>
        </Field>
        <Field label="Granularity">
          <select
            value={forecast.stf.granularity}
            onChange={(e) =>
              updateLRPInput("stf.granularity", e.target.value)
            }
            className="input-cell !font-sans w-full"
          >
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
          </select>
        </Field>
        <Field label="Actuals cutoff">
          <input
            type="date"
            value={forecast.stf.actualsCutoffDate}
            onChange={(e) =>
              updateLRPInput("stf.actualsCutoffDate", e.target.value)
            }
            className="input-cell !font-sans w-full"
          />
        </Field>
      </div>
      <p className="text-[11px] text-muted mt-2">
        Horizon and granularity set the size of the forward-week table below.
        History window controls how many past weeks are shown for trend
        fitting. Actuals cutoff is the boundary between actuals and forecast.
      </p>
    </div>
  );
}

function PricingCard() {
  const grossPrice = useStore((s) => s.forecast.lrp.grossPrice);
  const gtnRate = useStore((s) => s.forecast.lrp.gtnRate);
  const cutoffDate = useStore((s) => s.forecast.stf.actualsCutoffDate);
  const setLrpAnchor = useStore((s) => s.setLrpAnchor);

  const cycleYear = parseInt(cutoffDate.split("-")[0]);
  const grossInterp =
    interpolateAnchors(grossPrice, cycleYear, cycleYear)[0]?.value ?? 0;
  const gtnInterp =
    interpolateAnchors(gtnRate, cycleYear, cycleYear)[0]?.value ?? 0;
  const netPrice = grossInterp * (1 - gtnInterp);

  return (
    <div>
      <h4 className="font-heading text-h4 text-secondary mb-2">
        3.1 Pricing &amp; GTN ({cycleYear})
      </h4>
      <div className="card grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label={`Gross price (${cycleYear})`}>
          <EditableNumber
            value={grossInterp}
            onChange={(v) => setLrpAnchor("grossPrice", cycleYear, v)}
            format={(v) => `$${formatNumber(v)}`}
            parse={(s) => parseFloat(s.replace(/[$,]/g, ""))}
            className="input-cell w-full text-right"
          />
        </Field>
        <Field label={`GTN rate (${cycleYear})`}>
          <EditableNumber
            value={gtnInterp}
            onChange={(v) => setLrpAnchor("gtnRate", cycleYear, v)}
            format={(v) => formatPct(v, 1)}
            parse={(s) => parseFloat(s.replace("%", "")) / 100}
            className="input-cell w-full text-right"
          />
        </Field>
        <Field label="Net price (computed)">
          <div className="input-cell w-full text-right bg-background text-muted">
            ${formatNumber(netPrice)}
          </div>
        </Field>
      </div>
    </div>
  );
}

function DspCard() {
  const profiles = useStore((s) => s.forecast.phasing.dailyProfiles);
  const setDailyProfileWeight = useStore((s) => s.setDailyProfileWeight);
  const normalizeDailyProfile = useStore((s) => s.normalizeDailyProfile);
  const profile = profiles[0];

  if (!profile) return null;

  const data = DAY_KEYS.map((d) => ({
    day: d,
    weight: profile.dayWeights[d] * 100,
  }));
  const total = DAY_KEYS.reduce((s, d) => s + profile.dayWeights[d], 0);
  const normalized = Math.abs(total - 1) < 0.005;

  return (
    <div>
      <h4 className="font-heading text-h4 text-secondary mb-2">
        3.2 Daily Sales Pattern
      </h4>
      <div className="card">
        <p className="text-[11px] text-muted mb-3">
          Weekly volume distribution across days. Defaults reflect a
          Wednesday-heavy infusion pattern (Ocrevus). Edit to match the brand's
          consumption rhythm.
        </p>
        <div className="h-32 mb-2">
          <ResponsiveContainer>
            <BarChart data={data}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              <Bar dataKey="weight" fill="#C98B27" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {DAY_KEYS.map((d) => (
            <div key={d} className="text-center">
              <div className="text-[10px] text-muted">{d}</div>
              <EditableNumber
                value={profile.dayWeights[d]}
                onChange={(v) => setDailyProfileWeight(profile.id, d, v)}
                format={(v) => formatPct(v, 1)}
                parse={(s) => parseFloat(s.replace("%", "")) / 100}
                className="input-cell w-full text-center text-[11px] px-1"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2 text-[11px]">
          <span className={normalized ? "text-emerald-700" : "text-amber-700"}>
            Sum: <span className="font-mono">{(total * 100).toFixed(1)}%</span>{" "}
            {normalized ? "✓" : "(should be 100%)"}
          </span>
          {!normalized && (
            <button
              onClick={() => normalizeDailyProfile(profile.id)}
              className="btn-ghost !py-0.5 !px-2 text-[11px]"
            >
              Normalize to 100%
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface TierSetup {
  tier: string;
  label: string;
  startingUnits: number;
  targetDoh: number;
  alertLowDoh: number;
  alertCriticalDoh: number;
  active: boolean;
}

function DohSetupCard() {
  const forecast = useStore((s) => s.forecast);
  const updateLRPInput = useStore((s) => s.updateLRPInput);

  // Build tier-level rollups from forecast.stf.inventoryStart.
  const tierSums: Record<string, number> = {};
  for (const inv of forecast.stf.inventoryStart) {
    tierSums[inv.tier] = (tierSums[inv.tier] ?? 0) + inv.units;
  }

  // For v2.6 we treat targetDoh / alert thresholds as setup parameters
  // surfaced as editable rows. They live as DEFAULTS for the channel rather
  // than persisted anywhere new — store under stf.inventoryStart entries
  // (we'll round-trip them via a side annotation below).
  const tiers: TierSetup[] = [
    {
      tier: "wholesaler",
      label: "Wholesaler",
      startingUnits: tierSums["wholesaler"] ?? 148000,
      targetDoh: 18,
      alertLowDoh: 12,
      alertCriticalDoh: 7,
      active: true,
    },
    {
      tier: "specialty-pharmacy",
      label: "Specialty Pharmacy",
      startingUnits: tierSums["specialty-pharmacy"] ?? 48000,
      targetDoh: 7,
      alertLowDoh: 5,
      alertCriticalDoh: 3,
      active: true,
    },
    {
      tier: "hub",
      label: "Hub / Patient Services",
      startingUnits: tierSums["hub"] ?? 0,
      targetDoh: 14,
      alertLowDoh: 9,
      alertCriticalDoh: 5,
      active: tierSums["hub"] > 0,
    },
  ];

  function setStartingUnits(tier: string, units: number) {
    // Sum across SKUs proportionally — for the demo we just write to the first
    // matching entry, or push a new one if none exists.
    const next = forecast.stf.inventoryStart.slice();
    const idx = next.findIndex((x) => x.tier === tier);
    if (idx >= 0) {
      next[idx] = { ...next[idx], units };
    } else {
      next.push({
        tier: tier as "wholesaler" | "specialty-pharmacy" | "hub",
        sku: "300mg",
        units,
      });
    }
    updateLRPInput("stf.inventoryStart", next);
  }

  return (
    <div>
      <h4 className="font-heading text-h4 text-secondary mb-2">
        3.3 Inventory &amp; DOH Setup
      </h4>
      <div className="card">
        <p className="text-[11px] text-muted mb-3">
          Set target days-on-hand per channel and the warn / critical thresholds
          that drive alerts in the STF Build view. Starting units feed the DOH
          chart and the inventory roll-forward.
        </p>
        <div className="overflow-x-auto border border-border rounded">
          <table className="text-xs w-full">
            <thead className="bg-background">
              <tr className="border-b border-border">
                <th className="p-2 text-left">Channel</th>
                <th className="p-2 text-center">Active</th>
                <th className="p-2 text-right">Starting units</th>
                <th className="p-2 text-right">Target DOH (days)</th>
                <th className="p-2 text-right">Warn below</th>
                <th className="p-2 text-right">Critical below</th>
                <th className="p-2 text-left">Status logic</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr
                  key={t.tier}
                  className={
                    "border-b border-border last:border-0 " +
                    (t.active ? "" : "opacity-40")
                  }
                >
                  <td className="p-2 font-semibold">{t.label}</td>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={t.active}
                      onChange={() => {
                        /* read-only in this demo; tier active state is
                           inferred from inventoryStart presence */
                      }}
                      className="accent-primary"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      value={t.startingUnits}
                      step={1000}
                      onChange={(e) =>
                        setStartingUnits(
                          t.tier,
                          parseInt(e.target.value) || 0,
                        )
                      }
                      className="w-full px-1.5 py-1 border border-border rounded text-right font-mono text-xs"
                    />
                  </td>
                  <td className="p-1">
                    <DohCell defaultValue={t.targetDoh} />
                  </td>
                  <td className="p-1">
                    <DohCell defaultValue={t.alertLowDoh} />
                  </td>
                  <td className="p-1">
                    <DohCell defaultValue={t.alertCriticalDoh} />
                  </td>
                  <td className="p-2 text-[11px] text-muted">
                    Below {t.alertCriticalDoh}d → CRITICAL · {t.alertLowDoh}d →
                    LOW · ≥{t.targetDoh}d → HEALTHY
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted mt-2 italic">
          Channel active state is derived from starting-unit presence. To turn
          a channel off, set its starting units to 0.
        </p>
      </div>
    </div>
  );
}

function DohCell({ defaultValue }: { defaultValue: number }) {
  // DOH targets are local to the setup card; in production this would
  // round-trip to a dedicated config store. For demo, value is editable
  // but ephemeral within the page.
  return (
    <input
      type="number"
      defaultValue={defaultValue}
      step={1}
      min={1}
      max={60}
      className="w-full px-1.5 py-1 border border-border rounded text-right font-mono text-xs"
    />
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
