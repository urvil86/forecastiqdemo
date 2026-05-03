"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import type { DataSourceTag } from "@/lib/engine";
import { SourceBadge } from "@/components/forecast/SourceBadge";

interface SourceRow {
  field: string;
  source: DataSourceTag;
  lastUpdated: string;
  owner: string;
  stale: boolean;
  grain: "annual" | "monthly" | "weekly" | "daily";
  detail?: string;
}

const GRAIN_TABS: SourceRow["grain"][] = ["annual", "monthly", "weekly", "daily"];

function buildRowsForForecast(brand: string): SourceRow[] {
  const baseSync = "Last sync 2026-04-22 09:30 PT, next scheduled 2026-04-29 09:00 PT";
  const rows: SourceRow[] = [
    // Annual
    {
      field: "Annual actuals (volume)",
      source: "auto-pipelined",
      lastUpdated: "2026-04-22",
      owner: "Data Eng",
      stale: false,
      grain: "annual",
      detail: `IQVIA NSP feed · ${baseSync}`,
    },
    {
      field: "Class share anchors",
      source: "manual",
      lastUpdated: "2026-04-15",
      owner: "Forecasting",
      stale: false,
      grain: "annual",
    },
    {
      field: "Product share anchors",
      source: "manual",
      lastUpdated: "2026-04-15",
      owner: "Forecasting",
      stale: false,
      grain: "annual",
    },
    {
      field: "Gross price",
      source: "auto-pipelined",
      lastUpdated: "2026-04-20",
      owner: "Pricing Ops",
      stale: false,
      grain: "annual",
      detail: `Oasis Pricing Master · ${baseSync}`,
    },
    {
      field: "GTN rate",
      source: "auto-pipelined",
      lastUpdated: "2026-04-20",
      owner: "Finance",
      stale: false,
      grain: "annual",
      detail: "Finance & Reserves system",
    },
    {
      field: "LRP curve",
      source: "derived",
      lastUpdated: "auto",
      owner: "Engine",
      stale: false,
      grain: "annual",
    },
    // Monthly
    {
      field: "Monthly cascade volume",
      source: "derived",
      lastUpdated: "auto",
      owner: "Engine",
      stale: false,
      grain: "monthly",
    },
    {
      field: "ERD by month",
      source: "auto-pipelined",
      lastUpdated: "2026-01-01",
      owner: "Calendar Service",
      stale: false,
      grain: "monthly",
      detail: "Holiday Calendar feed",
    },
    {
      field: "Plant shutdowns",
      source: "manual",
      lastUpdated: "2026-02-12",
      owner: "Operations",
      stale: false,
      grain: "monthly",
    },
    // Weekly
    {
      field: "Weekly NBRx / TRx",
      source: "auto-pipelined",
      lastUpdated: "2026-04-22",
      owner: "Data Eng",
      stale: false,
      grain: "weekly",
      detail: `Symphony PHAST · ${baseSync}`,
    },
    {
      field: "Specialty pharmacy data",
      source: "auto-pipelined",
      lastUpdated: "2026-04-22",
      owner: "Data Eng",
      stale: false,
      grain: "weekly",
      detail: "Accredo / CVS Specialty hub feeds",
    },
    {
      field: "Weekly trend value",
      source: "derived",
      lastUpdated: "auto",
      owner: "Engine",
      stale: false,
      grain: "weekly",
    },
    {
      field: "Weekly override",
      source: "manual",
      lastUpdated: "2026-04-21",
      owner: "Forecaster",
      stale: false,
      grain: "weekly",
    },
    {
      field: "SKU mix override",
      source: "override",
      lastUpdated: "2026-04-19",
      owner: "Forecaster",
      stale: false,
      grain: "weekly",
    },
    {
      field: "NFS samples / PAP / bridge",
      source: "auto-pipelined",
      lastUpdated: "2026-04-22",
      owner: "Patient Services",
      stale: false,
      grain: "weekly",
      detail: "Patient Access and Affordability system",
    },
    // Daily
    {
      field: "Daily profile (Wed-heavy)",
      source: "manual",
      lastUpdated: "2025-12-01",
      owner: "Operations",
      stale: false,
      grain: "daily",
    },
    {
      field: "Holiday adjustments",
      source: "auto-pipelined",
      lastUpdated: "2026-01-01",
      owner: "Calendar Service",
      stale: false,
      grain: "daily",
      detail: "Holiday Calendar feed",
    },
  ];

  if (brand === "Fenebrutinib") {
    return rows.map((r) => {
      if (r.grain === "annual" && r.field !== "LRP curve") {
        return { ...r, source: "manual", detail: "Pre-launch — internal R&D estimate" };
      }
      return r;
    });
  }
  return rows;
}

export default function SourceMapPage() {
  const forecast = useStore((s) => s.forecast);
  const [grain, setGrain] = useState<SourceRow["grain"]>("annual");
  const [filter, setFilter] = useState<DataSourceTag | "all">("all");
  const [showStaleOnly, setShowStaleOnly] = useState(false);

  const allRows = useMemo(() => buildRowsForForecast(forecast.brand), [forecast.brand]);

  const rows = allRows
    .filter((r) => r.grain === grain)
    .filter((r) => (filter === "all" ? true : r.source === filter))
    .filter((r) => (showStaleOnly ? r.stale : true));

  return (
    <div className="p-8">
      <h1 className="font-heading text-h2 text-secondary mb-1">Authoring Source Map</h1>
      <p className="text-sm text-muted mb-6">
        Where every input cell came from. Filter by grain, source, or staleness.
      </p>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {GRAIN_TABS.map((g) => (
          <button
            key={g}
            onClick={() => setGrain(g)}
            className={
              "px-4 py-1.5 text-xs font-semibold rounded-full border " +
              (grain === g
                ? "bg-primary text-white border-primary"
                : "bg-surface border-border text-muted hover:text-secondary")
            }
          >
            {g[0].toUpperCase() + g.slice(1)}
          </button>
        ))}
        <span className="ml-auto" />
        <select
          className="input-cell !font-sans text-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
        >
          <option value="all">All sources</option>
          <option value="auto-pipelined">Auto-Pipelined</option>
          <option value="manual">Manual</option>
          <option value="analog-derived">Analog-Derived</option>
          <option value="override">Override</option>
          <option value="derived">Derived</option>
        </select>
        <label className="flex items-center text-xs gap-1">
          <input
            type="checkbox"
            checked={showStaleOnly}
            onChange={(e) => setShowStaleOnly(e.target.checked)}
            className="accent-primary"
          />
          Stale only
        </label>
      </div>

      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase text-muted">
          <tr>
            <th className="text-left py-2">Field</th>
            <th className="text-left py-2">Source</th>
            <th className="text-left py-2">Last Updated</th>
            <th className="text-left py-2">Owner</th>
            <th className="text-left py-2">Stale?</th>
            <th className="text-left py-2">Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field} className="border-t border-border">
              <td className="py-2">{r.field}</td>
              <td className="py-2">
                <SourceBadge source={r.source} inline />
              </td>
              <td className="py-2 font-mono text-xs">{r.lastUpdated}</td>
              <td className="py-2 text-xs">{r.owner}</td>
              <td className="py-2 text-xs">{r.stale ? "Yes" : "—"}</td>
              <td className="py-2 text-xs text-muted">{r.detail ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <div className="text-sm text-muted mt-6">No rows match those filters.</div>
      )}
    </div>
  );
}
