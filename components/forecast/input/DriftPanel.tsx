"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { diffForecast, type ForecastDiff } from "./diffForecast";
import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * v2.6 Drift panel — surfaces what changed since a comparison version.
 *
 * Default comparison: latest snapshot in version history (i.e., the prior
 * Submit). User can pick any version to compare against. Shows a grouped
 * list of changed assumptions sorted by magnitude.
 */
export function DriftPanel() {
  const forecast = useStore((s) => s.forecast);
  const versions = useStore((s) => s.versionHistory);

  const [compareTo, setCompareTo] = useState<string>("latest");
  const [expanded, setExpanded] = useState<boolean>(true);
  const [showAll, setShowAll] = useState<boolean>(false);

  const baseline = useMemo(() => {
    if (versions.length === 0) return null;
    if (compareTo === "latest") return versions[0];
    return versions.find((v) => v.id === compareTo) ?? null;
  }, [versions, compareTo]);

  const diffs = useMemo<ForecastDiff[]>(() => {
    if (!baseline) return [];
    return diffForecast(
      baseline.forecastSnapshot ?? baseline.forecast,
      forecast,
    );
  }, [baseline, forecast]);

  if (versions.length === 0 || !baseline) {
    return null;
  }

  const grouped = diffs.reduce<Record<string, ForecastDiff[]>>((acc, d) => {
    (acc[d.driver] ??= []).push(d);
    return acc;
  }, {});

  const visible = showAll ? diffs : diffs.slice(0, 8);

  return (
    <section
      id="drift"
      className="card border-l-4 border-amber-500 bg-amber-50/40 scroll-mt-32"
    >
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setExpanded((s) => !s)}
      >
        <div className="flex items-baseline gap-3 flex-wrap text-left">
          {expanded ? (
            <ChevronDown size={16} className="text-secondary mt-0.5 shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-secondary mt-0.5 shrink-0" />
          )}
          <span className="font-heading text-h4 text-secondary">
            Forecast drift
          </span>
          <span className="text-xs text-muted">
            vs <span className="font-mono">{baseline.label}</span> · v
            {baseline.version}
            {" · "}
            <span className="font-semibold text-secondary">
              {diffs.length}
            </span>{" "}
            changed assumption{diffs.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={compareTo}
            onChange={(e) => {
              e.stopPropagation();
              setCompareTo(e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            className="input-cell !font-sans !text-xs"
          >
            <option value="latest">Compare to latest</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version} · {v.label}
              </option>
            ))}
          </select>
        </div>
      </button>

      {expanded && (
        <div className="mt-4">
          {diffs.length === 0 ? (
            <div className="text-xs text-muted italic">
              No changes vs the comparison version. Edit any assumption to see
              drift surface here.
            </div>
          ) : (
            <>
              <ul className="space-y-1 text-xs">
                {visible.map((d, i) => (
                  <li
                    key={`${d.driver}-${d.field}-${d.period}-${i}`}
                    className="flex items-baseline justify-between gap-2 p-2 border border-border bg-surface rounded"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-secondary">
                        {d.driver}
                      </span>
                      <span className="text-muted"> · </span>
                      <span>{d.field}</span>
                      <span className="text-muted"> · </span>
                      <span className="font-mono text-[11px]">{d.period}</span>
                    </div>
                    <span className="font-mono text-[11px] shrink-0">
                      {d.display ??
                        `${String(d.before)} → ${String(d.after)}`}
                    </span>
                  </li>
                ))}
              </ul>
              {diffs.length > 8 && (
                <button
                  className="btn-ghost text-[11px] mt-2"
                  onClick={() => setShowAll((s) => !s)}
                >
                  {showAll
                    ? "Show top 8 only"
                    : `Show all ${diffs.length} changes`}
                </button>
              )}

              {/* Per-group counts */}
              <div className="flex flex-wrap gap-2 mt-3 text-[10px]">
                {Object.entries(grouped).map(([driver, items]) => (
                  <span
                    key={driver}
                    className="pill bg-background border border-border text-muted"
                  >
                    {driver}: {items.length}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
