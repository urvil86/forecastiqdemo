"use client";

import { SectionHeader } from "@/components/SectionHeader";
import { useStore } from "@/lib/store";
import type { LifecycleMode } from "@/lib/engine";

interface Row {
  assumption: string;
  source: string;
  lrp: boolean | string;
  stf: boolean | string;
  updated: string;
  owner: string;
}

const PRE_LAUNCH_ROWS: Row[] = [
  { assumption: "Analog selections (Kesimpta / Briumvi / Tysabri)", source: "LRP — manual", lrp: true, stf: "n/a", updated: "2026-04-15", owner: "Forecasting" },
  { assumption: "Analog weights & adjustments", source: "LRP — manual", lrp: true, stf: "n/a", updated: "2026-04-15", owner: "Forecasting" },
  { assumption: "PoS milestone probabilities", source: "LRP — manual (R&D estimate)", lrp: true, stf: "n/a", updated: "2026-04-10", owner: "R&D / Forecasting" },
  { assumption: "Cumulative approval probability", source: "LRP — derived", lrp: "auto from milestones", stf: "n/a", updated: "auto", owner: "Engine" },
  { assumption: "Gross Price (post-launch assumed)", source: "LRP — manual", lrp: true, stf: "n/a", updated: "2026-04-01", owner: "Pricing" },
  { assumption: "GTN Rate (post-launch assumed)", source: "LRP — manual", lrp: true, stf: "n/a", updated: "2026-04-01", owner: "Finance" },
  { assumption: "Class share trajectory", source: "LRP — manual", lrp: true, stf: "n/a", updated: "2026-03-20", owner: "Forecasting" },
  { assumption: "Product share trajectory", source: "LRP — manual", lrp: true, stf: "n/a", updated: "2026-03-20", owner: "Forecasting" },
  { assumption: "MSL deployment / DTC build / formulary", source: "LRP — Launch Readiness inputs", lrp: true, stf: "n/a", updated: "2026-04-12", owner: "Brand" },
  { assumption: "Resulting LRP curve", source: "Derived", lrp: "auto", stf: "n/a", updated: "auto", owner: "Engine" },
];

const EXCLUSIVITY_ROWS: Row[] = [
  { assumption: "Gross Price", source: "LRP", lrp: true, stf: "override-able weekly", updated: "2026-04-01", owner: "A. Patel" },
  { assumption: "GTN Rate", source: "LRP (with weekly overrides)", lrp: true, stf: "override-able", updated: "2026-04-15", owner: "Finance partner" },
  { assumption: "Class Share", source: "LRP", lrp: true, stf: "derived for rollup only", updated: "2026-03-20", owner: "J. Chen" },
  { assumption: "Product Share", source: "LRP", lrp: true, stf: "derived for rollup only", updated: "2026-03-20", owner: "J. Chen" },
  { assumption: "Holiday Adjustments", source: "STF", lrp: "rollup only", stf: true, updated: "2026-04-08", owner: "Brand Ops" },
  { assumption: "DOH Targets", source: "STF", lrp: false, stf: true, updated: "2026-02-15", owner: "Supply" },
  { assumption: "Daily Sales Pattern", source: "STF", lrp: false, stf: true, updated: "2026-04-01", owner: "Brand Ops" },
  { assumption: "Trend Method", source: "Per-view", lrp: "annual fit", stf: "weekly fit", updated: "2026-04-12", owner: "Brand Ops" },
  { assumption: "Biosimilar Entry Date", source: "LRP", lrp: true, stf: "informational only", updated: "2026-04-21", owner: "J. Chen" },
  { assumption: "Events", source: "Per-view", lrp: "long-horizon", stf: "short-horizon", updated: "varies", owner: "Mixed" },
];

const POST_LOE_ROWS: Row[] = [
  { assumption: "Account current monthly demand", source: "STF (canonical)", lrp: "rollup only", stf: true, updated: "2028-03-30", owner: "Account Ops" },
  { assumption: "Account projected demand (36-mo)", source: "STF (canonical)", lrp: "rollup only", stf: true, updated: "2028-03-30", owner: "Account Ops" },
  { assumption: "Fair share methodology", source: "STF — strategy", lrp: false, stf: true, updated: "2028-02-15", owner: "Strategy" },
  { assumption: "Allocation ratios per tier", source: "STF — manual", lrp: false, stf: true, updated: "2028-02-15", owner: "Strategy" },
  { assumption: "Caps / floors per account", source: "STF — manual", lrp: false, stf: true, updated: "2028-03-01", owner: "Strategy" },
  { assumption: "Baseline carve-outs", source: "STF — manual", lrp: false, stf: true, updated: "2028-03-01", owner: "Strategy" },
  { assumption: "Biosimilar entry date", source: "LRP — governance", lrp: true, stf: "informational", updated: "2028-04-01", owner: "J. Chen" },
  { assumption: "Class price erosion curve", source: "LRP — governance", lrp: true, stf: "applied to net price", updated: "2028-04-01", owner: "Finance" },
  { assumption: "Originator share loss curve", source: "LRP — governance", lrp: true, stf: "applied to volume", updated: "2028-04-01", owner: "Forecasting" },
  { assumption: "Site-of-care erosion rates", source: "LRP — governance", lrp: true, stf: "informational", updated: "2028-03-15", owner: "Market Access" },
  { assumption: "Annual rollup → LRP", source: "Derived from STF", lrp: "read-only", stf: "auto", updated: "auto", owner: "Engine" },
];

function rowsForMode(mode: LifecycleMode): Row[] {
  if (mode === "pre-launch") return PRE_LAUNCH_ROWS;
  if (mode === "post-loe") return POST_LOE_ROWS;
  return EXCLUSIVITY_ROWS;
}

function subtitleFor(mode: LifecycleMode): string {
  if (mode === "pre-launch")
    return "Pre-launch — every assumption is authored in the LRP. STF doesn't exist yet.";
  if (mode === "post-loe")
    return "Post-LoE — STF is canonical. The LRP rolls up from accounts; only biosimilar and site-of-care assumptions remain LRP-governed.";
  return "Where each assumption lives, who can edit it, and which view consumes it.";
}

export function SourceOfTruthMap() {
  const forecast = useStore((s) => s.forecast);
  const mode: LifecycleMode = forecast.lifecycleContext?.mode ?? "exclusivity";
  const rows = rowsForMode(mode);
  const showStfColumn = mode !== "pre-launch";

  return (
    <div>
      <SectionHeader title="Source-of-Truth Map" subtitle={subtitleFor(mode)} />
      <div className="card overflow-x-auto">
        <table className="data-table min-w-[760px]">
          <thead>
            <tr>
              <th>Assumption</th>
              <th>Source of Truth</th>
              <th>Used by LRP</th>
              {showStfColumn && <th>Used by STF</th>}
              <th>Last Updated</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.assumption}>
                <td className="font-medium">{r.assumption}</td>
                <td>{r.source}</td>
                <td className="text-xs">{renderCell(r.lrp)}</td>
                {showStfColumn && <td className="text-xs">{renderCell(r.stf)}</td>}
                <td className="font-mono text-xs">{r.updated}</td>
                <td>{r.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderCell(v: boolean | string) {
  if (v === true) return <span className="pill-success">✓</span>;
  if (v === false) return <span className="pill-muted">—</span>;
  return <span className="text-muted">{v}</span>;
}
