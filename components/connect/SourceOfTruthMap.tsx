"use client";

import { SectionHeader } from "@/components/SectionHeader";

const ROWS = [
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

export function SourceOfTruthMap() {
  return (
    <div>
      <SectionHeader
        title="Source-of-Truth Map"
        subtitle="Where each assumption lives, who can edit it, and which view consumes it."
      />
      <div className="card overflow-x-auto">
        <table className="data-table min-w-[760px]">
          <thead>
            <tr>
              <th>Assumption</th>
              <th>Source of Truth</th>
              <th>Used by LRP</th>
              <th>Used by STF</th>
              <th>Last Updated</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.assumption}>
                <td className="font-medium">{r.assumption}</td>
                <td>{r.source}</td>
                <td className="text-xs">{renderCell(r.lrp)}</td>
                <td className="text-xs">{renderCell(r.stf)}</td>
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
