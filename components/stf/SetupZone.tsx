"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { SectionHeader } from "@/components/SectionHeader";
import { EditableNumber } from "@/components/EditableNumber";
import { formatPct, formatNumber } from "@/lib/format";
import { interpolateAnchors } from "@/lib/engine";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Save, Check, Plus, Trash2 } from "lucide-react";

export function SetupZone() {
  return (
    <div className="space-y-8">
      <SaveBar />
      <ConfigCard />
      <PricingGtnCard />
      <SkuCard />
      <PhasingCards />
    </div>
  );
}

function SaveBar() {
  const saveVersion = useStore((s) => s.saveVersion);
  const versionHistory = useStore((s) => s.versionHistory);
  const versionLabel = useStore((s) => s.forecast.versionLabel);
  const version = useStore((s) => s.forecast.version);
  const [showDialog, setShowDialog] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [recentlySaved, setRecentlySaved] = useState<string | null>(null);

  const lastSavedAt = versionHistory[0]?.timestamp ?? null;

  function commit(label: string) {
    saveVersion(label);
    const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setRecentlySaved(stamp);
    setShowDialog(false);
    setDraftLabel("");
    setTimeout(() => setRecentlySaved(null), 4000);
  }

  return (
    <div className="card flex items-center justify-between flex-wrap gap-3 bg-bound-cell-bg/40 border-secondary/20">
      <div>
        <div className="caption text-muted">Setup snapshot</div>
        <div className="font-heading text-h4 text-secondary">
          v{version} · {versionLabel}
        </div>
        <div className="text-xs text-muted">
          {lastSavedAt
            ? `Last saved ${new Date(lastSavedAt).toLocaleString()}`
            : "Edits auto-persist locally. Click Save to create a named snapshot you can roll back to."}
        </div>
      </div>
      <div className="flex gap-2 items-center">
        {recentlySaved && (
          <span className="pill-success flex items-center gap-1">
            <Check size={12} /> Saved at {recentlySaved}
          </span>
        )}
        <button
          onClick={() => commit(`Setup auto-save · ${new Date().toLocaleString()}`)}
          className="btn-ghost flex items-center gap-1"
          title="Quick-save with timestamp label"
        >
          <Save size={14} /> Quick Save
        </button>
        <button onClick={() => setShowDialog(true)} className="btn-secondary flex items-center gap-1">
          <Save size={14} /> Save Setup…
        </button>
      </div>

      {showDialog && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center"
          onClick={() => setShowDialog(false)}
        >
          <div className="card max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-h3 mb-2">Save Setup as Version</h3>
            <p className="text-sm text-muted mb-4">
              Captures every Setup field, SKU config, and phasing factor. Restore later from Version History on /lrp.
            </p>
            <input
              type="text"
              value={draftLabel}
              placeholder="e.g. Q2 setup — 13w horizon, weekly grain"
              onChange={(e) => setDraftLabel(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setShowDialog(false)}>
                Cancel
              </button>
              <button
                className="btn-secondary"
                onClick={() => commit(draftLabel || `Setup saved ${new Date().toLocaleString()}`)}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigCard() {
  const forecast = useStore((s) => s.forecast);
  const updateLRPInput = useStore((s) => s.updateLRPInput);
  return (
    <section>
      <SectionHeader title="Forecast Configuration" subtitle="Settings here drive the Build zone — horizon, grain, cutoff, history window, and trend method." />
      <div className="card grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Field label="Forecast Horizon">
          <select
            className="input-cell !font-sans w-full"
            value={forecast.stf.horizonWeeks}
            onChange={(e) => updateLRPInput("stf.horizonWeeks", parseInt(e.target.value))}
          >
            {[4, 8, 13, 26].map((w) => (
              <option key={w} value={w}>
                {w} weeks
              </option>
            ))}
          </select>
        </Field>
        <Field label="Granularity">
          <select
            className="input-cell !font-sans w-full"
            value={forecast.stf.granularity}
            onChange={(e) => updateLRPInput("stf.granularity", e.target.value)}
          >
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
          </select>
        </Field>
        <Field label="History Window">
          <select
            className="input-cell !font-sans w-full"
            value={forecast.stf.historyWeeksShown}
            onChange={(e) => updateLRPInput("stf.historyWeeksShown", parseInt(e.target.value))}
          >
            {[13, 26, 52, 104, 156].map((w) => (
              <option key={w} value={w}>
                {w} weeks back
              </option>
            ))}
          </select>
        </Field>
        <Field label="Actuals Cutoff">
          <input
            type="date"
            className="input-cell !font-sans w-full"
            value={forecast.stf.actualsCutoffDate}
            onChange={(e) => updateLRPInput("stf.actualsCutoffDate", e.target.value)}
          />
        </Field>
        <Field label="Auto-trend mode">
          <select
            className="input-cell !font-sans w-full"
            value={forecast.stf.trending.method}
            onChange={(e) => updateLRPInput("stf.trending.method", e.target.value)}
          >
            <option value="quick-expert">Quick Expert</option>
            <option value="linear">Linear (User Selected)</option>
            <option value="holt-winter-add">Holt-Winter (User Selected)</option>
          </select>
        </Field>
      </div>
      <p className="text-xs text-muted mt-2">
        Changes here propagate to every Build sub-view. The dot next to a Build sub-view in the side nav indicates engine-driven content; non-dotted views are configuration helpers.
      </p>
    </section>
  );
}

function PricingGtnCard() {
  const grossPrice = useStore((s) => s.forecast.lrp.grossPrice);
  const gtnRate = useStore((s) => s.forecast.lrp.gtnRate);
  const cutoffDate = useStore((s) => s.forecast.stf.actualsCutoffDate);
  const setLrpAnchor = useStore((s) => s.setLrpAnchor);

  const cycleYear = parseInt(cutoffDate.split("-")[0]);
  const grossInterp = interpolateAnchors(grossPrice, cycleYear, cycleYear)[0]?.value ?? 0;
  const gtnInterp = interpolateAnchors(gtnRate, cycleYear, cycleYear)[0]?.value ?? 0;
  const netPrice = grossInterp * (1 - gtnInterp);

  return (
    <section>
      <SectionHeader
        title="Pricing & GTN — STF Cycle"
        subtitle={`Gross price and gross-to-net for the ${cycleYear} short-term cycle. Updates the ${cycleYear} pricing anchor and propagates to net-revenue build-up.`}
      />
      <div className="card grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={`Gross Price (${cycleYear})`}>
          <EditableNumber
            value={grossInterp}
            onChange={(v) => setLrpAnchor("grossPrice", cycleYear, v)}
            format={(v) => `$${formatNumber(v)}`}
            parse={(s) => parseFloat(s.replace(/[$,]/g, ""))}
            className="input-cell w-full text-right"
          />
        </Field>
        <Field label={`GTN Rate (${cycleYear})`}>
          <EditableNumber
            value={gtnInterp}
            onChange={(v) => setLrpAnchor("gtnRate", cycleYear, v)}
            format={(v) => formatPct(v, 1)}
            parse={(s) => parseFloat(s.replace("%", "")) / 100}
            className="input-cell w-full text-right"
          />
        </Field>
        <Field label={`Net Price (computed)`}>
          <div className="input-cell w-full text-right bg-background text-muted">${formatNumber(netPrice)}</div>
        </Field>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="caption text-muted mb-1">{label}</div>
      {children}
    </div>
  );
}

function SkuCard() {
  const skus = useStore((s) => s.forecast.stf.skus);
  const horizonWeeks = useStore((s) => s.forecast.stf.horizonWeeks);
  const weeklyInputs = useStore((s) => s.forecast.stf.weeklyInputs);
  const updateLRPInput = useStore((s) => s.updateLRPInput);
  const applySkuMixForWeeks = useStore((s) => s.applySkuMixForWeeks);
  const clearSkuMixOverrides = useStore((s) => s.clearSkuMixOverrides);

  const [applyWeeks, setApplyWeeks] = useState<number>(8);

  // Count distinct future weeks that currently have any SKU mix override
  const lockedWeeks = useMemo(() => {
    const set = new Set<string>();
    for (const wi of weeklyInputs) if (wi.skuMixOverride !== undefined) set.add(wi.weekStart);
    return set.size;
  }, [weeklyInputs]);

  const horizonOptions = [4, 8, 13, 26].filter((w) => w <= horizonWeeks);
  if (!horizonOptions.includes(horizonWeeks)) horizonOptions.push(horizonWeeks);

  return (
    <section>
      <SectionHeader title="SKU Configuration" subtitle="Active SKUs and default mix percentages. Lock the current mix for a forward window so it stays fixed even if the defaults change later." />
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="caption text-muted">Apply current mix for next:</span>
            <select
              value={applyWeeks}
              onChange={(e) => setApplyWeeks(parseInt(e.target.value))}
              className="input-cell !font-sans text-sm"
            >
              {horizonOptions.map((w) => (
                <option key={w} value={w}>{w === horizonWeeks ? `${w} weeks (full horizon)` : `${w} weeks`}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => applySkuMixForWeeks(applyWeeks)}
              className="btn-secondary !py-1 !px-3 text-xs"
            >
              Apply
            </button>
            {lockedWeeks > 0 && (
              <button
                type="button"
                onClick={clearSkuMixOverrides}
                className="btn-ghost !py-1 !px-3 text-xs"
              >
                Clear ({lockedWeeks} {lockedWeeks === 1 ? "week" : "weeks"})
              </button>
            )}
          </div>
          <span className="text-xs text-muted">
            {lockedWeeks > 0
              ? `Mix locked for ${lockedWeeks} forward ${lockedWeeks === 1 ? "week" : "weeks"}`
              : "No mix lock applied — engine uses defaults for the full horizon"}
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Display Name</th>
              <th>Category</th>
              <th>Active</th>
              <th>Default Mix %</th>
            </tr>
          </thead>
          <tbody>
            {skus.map((sku, i) => (
              <tr key={sku.id}>
                <td>{sku.displayName}</td>
                <td className="capitalize">{sku.category}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={sku.active}
                    onChange={(e) => updateLRPInput(`stf.skus.${i}.active`, e.target.checked)}
                    className="accent-primary"
                  />
                </td>
                <td>
                  <EditableNumber
                    value={sku.defaultMixPct}
                    onChange={(v) => updateLRPInput(`stf.skus.${i}.defaultMixPct`, v)}
                    format={(v) => formatPct(v, 1)}
                    parse={(s) => parseFloat(s.replace("%", "")) / 100}
                    className="input-cell w-20 text-right"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted mt-3">
          Active SKU mixes are normalized to 100% by the engine. Inactive SKUs are excluded from forecast totals.
          Apply locks the current Default Mix % values as per-week overrides for the chosen window — useful when you
          expect a launch or competitor event to shift the mix later in the horizon.
        </p>
      </div>
    </section>
  );
}

function PhasingCards() {
  const phasing = useStore((s) => s.forecast.phasing);
  const updateLRPInput = useStore((s) => s.updateLRPInput);
  const womData = phasing.weeklyOfMonth.map((w) => ({ name: `W${w.weekOfMonth}`, weight: w.weight * 100 }));

  return (
    <section>
      <SectionHeader title="Phasing Profiles" subtitle="Daily, weekly, and monthly phasing factors that bridge grains." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DailySalesPatternCard />

        <div className="card">
          <h4 className="font-heading text-h4 text-secondary mb-2">Weekly-of-Month Pattern</h4>
          <div className="h-40">
            <ResponsiveContainer>
              <BarChart data={womData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Bar dataKey="weight" fill="#0A5C82" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="data-table mt-2">
            <tbody>
              {phasing.weeklyOfMonth.map((w, i) => (
                <tr key={w.weekOfMonth}>
                  <td>W{w.weekOfMonth}</td>
                  <td>
                    <EditableNumber
                      value={w.weight}
                      onChange={(v) => updateLRPInput(`phasing.weeklyOfMonth.${i}.weight`, v)}
                      format={(v) => formatPct(v, 1)}
                      parse={(s) => parseFloat(s.replace("%", "")) / 100}
                      className="input-cell w-20 text-right"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h4 className="font-heading text-h4 text-secondary mb-2">Effective Revenue Days</h4>
          <div className="max-h-72 overflow-y-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>ERDs</th>
                  <th>Baseline</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {phasing.erdByMonth
                  .filter((m) => m.month.startsWith("2026") || m.month.startsWith("2027"))
                  .map((m, i) => {
                    const idx = phasing.erdByMonth.findIndex((x) => x.month === m.month);
                    return (
                      <tr key={m.month}>
                        <td className="font-mono text-xs">{m.month}</td>
                        <td>
                          <EditableNumber
                            value={m.erds}
                            onChange={(v) => updateLRPInput(`phasing.erdByMonth.${idx}.erds`, v)}
                            format={(v) => String(v)}
                            className="input-cell w-14 text-right"
                          />
                        </td>
                        <td className="font-mono text-xs">{m.baseline}</td>
                        <td className={"font-mono text-xs " + (m.erds < m.baseline ? "text-danger" : m.erds > m.baseline ? "text-success" : "text-muted")}>
                          {m.erds - m.baseline}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted mt-2">Auto-counts business days minus federal holidays. Override for plant shutdowns.</p>
        </div>
      </div>
    </section>
  );
}

const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type DayKey = (typeof DAY_KEYS)[number];

function DailySalesPatternCard() {
  const profiles = useStore((s) => s.forecast.phasing.dailyProfiles);
  const weeklyProfileMap = useStore((s) => s.forecast.phasing.weeklyProfileMap);
  const setDailyProfileWeight = useStore((s) => s.setDailyProfileWeight);
  const normalizeDailyProfile = useStore((s) => s.normalizeDailyProfile);
  const renameDailyProfile = useStore((s) => s.renameDailyProfile);
  const addDailyProfile = useStore((s) => s.addDailyProfile);
  const removeDailyProfile = useStore((s) => s.removeDailyProfile);
  const assignProfileToWeek = useStore((s) => s.assignProfileToWeek);

  const [selectedId, setSelectedId] = useState<string>(profiles[0]?.id ?? "standard");
  const profile = profiles.find((p) => p.id === selectedId) ?? profiles[0];

  if (!profile) return null;

  const data = DAY_KEYS.map((d) => ({ day: d, weight: profile.dayWeights[d] * 100 }));
  const total = DAY_KEYS.reduce((s, d) => s + profile.dayWeights[d], 0);
  const normalized = Math.abs(total - 1) < 0.005;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h4 className="font-heading text-h4 text-secondary">Daily Sales Pattern</h4>
        <div className="flex gap-1">
          <button onClick={() => addDailyProfile(profile.id)} title="Duplicate as new profile" className="p-1 text-muted hover:text-foreground">
            <Plus size={14} />
          </button>
          {profiles.length > 1 && (
            <button onClick={() => { removeDailyProfile(profile.id); setSelectedId(profiles[0]?.id ?? "standard"); }} title="Delete this profile" className="p-1 text-muted hover:text-danger">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <select
          className="input-cell !font-sans flex-1"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <input
        type="text"
        value={profile.name}
        onChange={(e) => renameDailyProfile(profile.id, e.target.value)}
        className="input-cell !font-sans w-full text-sm mb-2"
        placeholder="Profile name"
      />

      <div className="h-32">
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
            <Bar dataKey="weight" fill="#C98B27" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-7 gap-1 mt-2">
        {DAY_KEYS.map((d) => (
          <div key={d} className="text-center">
            <div className="text-[10px] text-muted">{d}</div>
            <EditableNumber
              value={profile.dayWeights[d]}
              onChange={(v) => setDailyProfileWeight(profile.id, d, v)}
              format={(v) => formatPct(v, 1)}
              parse={(s) => parseFloat(s.replace("%", "")) / 100}
              className="input-cell w-full text-center text-xs px-1"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-2 text-xs">
        <span className={normalized ? "text-success" : "text-warning"}>
          Sum: <span className="font-mono">{(total * 100).toFixed(1)}%</span> {normalized ? "✓" : "(should be 100%)"}
        </span>
        {!normalized && (
          <button onClick={() => normalizeDailyProfile(profile.id)} className="btn-ghost !py-0.5 !px-2 text-xs">
            Normalize to 100%
          </button>
        )}
      </div>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted hover:text-foreground">
          Apply to weeks ({weeklyProfileMap.filter((m) => m.profileId === profile.id).length} assigned)
        </summary>
        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
          {weeklyProfileMap
            .filter((m) => m.profileId === profile.id)
            .map((m) => (
              <div key={m.weekStart} className="flex justify-between items-center bg-background rounded px-2 py-1">
                <span className="font-mono">{m.weekStart}</span>
                <button onClick={() => assignProfileToWeek(m.weekStart, null)} className="text-muted hover:text-danger">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          <AddWeekAssignment profileId={profile.id} onAssign={(ws) => assignProfileToWeek(ws, profile.id)} />
        </div>
      </details>

      <p className="text-xs text-muted mt-3">
        <strong>Where these come from:</strong> profiles are user-supplied, not detected from history (the engine only ingests
        annual actuals). Default seed reflects a Wednesday-heavy infusion pattern. Edit any cell above and the daily distribution
        in <em>Build → Baseline OUTs (granularity = Daily)</em> recomputes within 100ms.
      </p>
    </div>
  );
}

function AddWeekAssignment({ onAssign }: { profileId: string; onAssign: (weekStart: string) => void }) {
  const [date, setDate] = useState("");
  function commit() {
    if (!date) return;
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    onAssign(d.toISOString().slice(0, 10));
    setDate("");
  }
  return (
    <div className="flex gap-1 mt-1">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-cell !font-sans flex-1 text-xs" />
      <button onClick={commit} disabled={!date} className="btn-ghost !py-0.5 !px-2 text-xs disabled:opacity-50">
        + Assign
      </button>
    </div>
  );
}
