"use client";

import { useStore } from "@/lib/store";
import { reconcile } from "@/lib/engine";
import { useMemo } from "react";

export function ReconciliationStatusPanel() {
  const computed = useStore((s) => s.computed);
  const forecast = useStore((s) => s.forecast);

  const events = useMemo(() => {
    if (!computed) return [];
    try {
      return reconcile(forecast, computed);
    } catch {
      return [];
    }
  }, [computed, forecast]);

  return (
    <div className="p-4 text-sm">
      <h3 className="font-heading text-h4 text-secondary mb-3">Reconciliation Status</h3>
      <div className="space-y-2">
        {events.length === 0 ? (
          <div className="text-xs text-muted">
            No drift detected. STF actuals are reconciling within tolerance.
          </div>
        ) : (
          events.slice(0, 5).map((e) => (
            <div
              key={e.id}
              className={
                "p-2 rounded border " +
                (e.severity === "critical"
                  ? "border-danger/40 bg-danger/5"
                  : e.severity === "warning"
                  ? "border-warning/40 bg-warning/5"
                  : "border-border bg-background")
              }
            >
              <div className="text-xs font-semibold">{e.type.replace(/-/g, " ")}</div>
              <div className="text-[11px] text-muted mt-1">{e.message}</div>
              <div className="text-[10px] mt-1">
                4w: {(e.rolling4WeekVariancePct * 100).toFixed(1)}% · 13w:{" "}
                {(e.rolling13WeekVariancePct * 100).toFixed(1)}%
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
