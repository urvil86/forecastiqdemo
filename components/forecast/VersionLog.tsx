"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { DEMO_USERS } from "@/lib/engine";
import type { VersionSnapshot } from "@/lib/engine";

type TriggerFilter = "all" | "reconciliation" | "manual-save" | "scheduled";
type ScopeFilter = "all" | "lrp" | "stf" | "full";
type Sort = "newest" | "oldest";

export function VersionLog() {
  const versions = useStore((s) => s.versionHistory);
  const restoreSnapshot = useStore((s) => s.restoreSnapshot);
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingRestore, setPendingRestore] = useState<VersionSnapshot | null>(null);

  const filtered = useMemo(() => {
    const list = versions.filter((v) => {
      if (triggerFilter !== "all" && v.triggerType !== triggerFilter) return false;
      if (scopeFilter !== "all") {
        if (scopeFilter === "lrp" && v.scope !== "lrp" && v.scope !== "full") return false;
        if (scopeFilter === "stf" && v.scope !== "stf" && v.scope !== "full") return false;
        if (scopeFilter === "full" && v.scope !== "full") return false;
      }
      if (userFilter !== "all" && v.createdBy?.id !== userFilter) return false;
      return true;
    });
    list.sort((a, b) => {
      const cmp = (a.createdAt ?? a.timestamp).localeCompare(b.createdAt ?? b.timestamp);
      return sort === "newest" ? -cmp : cmp;
    });
    return list;
  }, [versions, triggerFilter, scopeFilter, userFilter, sort]);

  function toggle(id: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function actionLabel(v: VersionSnapshot): string {
    if (v.label) return v.label;
    if (v.reconciliationAction === "refresh-lrp") return "Refreshed LRP from STF";
    if (v.reconciliationAction === "adjust-stf") return "Adjusted STF to LRP target";
    if (v.reconciliationAction === "document-accept") return "Documented & accepted variance";
    if (v.triggerType === "manual-save") return "Manual checkpoint";
    return "Snapshot";
  }

  function fmtTime(s: string): string {
    try {
      const d = new Date(s);
      return d.toLocaleString();
    } catch {
      return s;
    }
  }

  return (
    <div id="version-log" className="card scroll-mt-40">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <div>
          <h3 className="font-heading text-h3 text-secondary">Version Log</h3>
          <p className="text-xs text-muted">
            {versions.length} snapshot{versions.length === 1 ? "" : "s"}
            {versions.length > 0 && (
              <>
                {" · Most recent: "}
                <span className="font-mono">
                  {fmtTime(versions[0].createdAt ?? versions[0].timestamp)}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <select
          value={triggerFilter}
          onChange={(e) => setTriggerFilter(e.target.value as TriggerFilter)}
          className="input-cell !font-sans !text-xs"
        >
          <option value="all">All triggers</option>
          <option value="reconciliation">Reconciliation</option>
          <option value="manual-save">Manual</option>
          <option value="scheduled">Scheduled</option>
        </select>
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}
          className="input-cell !font-sans !text-xs"
        >
          <option value="all">All scopes</option>
          <option value="lrp">LRP only</option>
          <option value="stf">STF only</option>
          <option value="full">Full submits</option>
        </select>
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="input-cell !font-sans !text-xs"
        >
          <option value="all">All users</option>
          {DEMO_USERS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="input-cell !font-sans !text-xs"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-xs text-muted py-6 text-center border border-dashed border-border rounded">
          No snapshots match the current filters.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((v) => {
            const isOpen = expanded.has(v.id);
            const v4 = (v.varianceAtSave?.rolling4Week ?? 0) * 100;
            return (
              <li key={v.id} className="border border-border rounded p-3 bg-background">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                    {v.createdBy?.initials ?? "??"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <div className="font-semibold text-sm text-secondary">
                        {actionLabel(v)}
                      </div>
                      {v.scope && (
                        <span
                          className={
                            "pill text-[9px] uppercase tracking-wider " +
                            (v.scope === "lrp"
                              ? "bg-sky-500/10 text-sky-700 border border-sky-500/30"
                              : v.scope === "stf"
                              ? "bg-purple-500/10 text-purple-700 border border-purple-500/30"
                              : "bg-gray-500/10 text-gray-700 border border-gray-500/30")
                          }
                        >
                          {v.scope}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted">
                      {v.createdBy?.name ?? "Unknown"} · {v.createdBy?.role ?? ""} ·{" "}
                      {fmtTime(v.createdAt ?? v.timestamp)}
                    </div>
                    {v.reasonNote && (
                      <div className="text-[11px] text-secondary mt-1">
                        Reason: {v.reasonNote}
                      </div>
                    )}
                    {isOpen && (
                      <div className="mt-3 p-3 rounded bg-surface border border-border text-[11px] space-y-1">
                        <div>
                          <span className="text-muted">Forecast: </span>
                          <span className="font-mono">
                            {v.forecastSnapshot?.brand ?? v.forecast?.brand} ·{" "}
                            {v.forecastSnapshot?.geography ?? v.forecast?.geography} · v{v.version}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted">Threshold at save: </span>
                          <span className="font-mono">
                            ±{v.thresholdAtSave?.thresholdPct ?? "?"}% ·{" "}
                            {v.thresholdAtSave?.rollingWindow ?? "?"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted">Variance at save: </span>
                          <span className="font-mono">
                            4w {((v.varianceAtSave?.rolling4Week ?? 0) * 100).toFixed(2)}% · 13w{" "}
                            {((v.varianceAtSave?.rolling13Week ?? 0) * 100).toFixed(2)}% · YTD{" "}
                            {((v.varianceAtSave?.ytd ?? 0) * 100).toFixed(2)}%
                          </span>
                        </div>
                        {v.notifyList && v.notifyList.length > 0 && (
                          <div>
                            <span className="text-muted">Notified: </span>
                            <span>{v.notifyList.map((n) => n.name).join(", ")}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="pill bg-background border border-border text-[10px] font-mono">
                      Var: {v4 >= 0 ? "+" : ""}
                      {v4.toFixed(1)}%
                    </span>
                    <div className="flex gap-1">
                      <button
                        className="btn-ghost text-[10px] !py-0.5 !px-2"
                        onClick={() => toggle(v.id)}
                      >
                        {isOpen ? "Hide" : "View"} details
                      </button>
                      <button
                        className="btn-ghost text-[10px] !py-0.5 !px-2"
                        onClick={() => setPendingRestore(v)}
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pendingRestore && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setPendingRestore(null)}
        >
          <div
            className="card max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-h3 mb-2">Restore snapshot?</h3>
            <p className="text-sm text-muted mb-4">
              Restoring will create a new snapshot capturing this restore action. The original
              snapshot is preserved. Continue?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="btn-ghost"
                onClick={() => setPendingRestore(null)}
              >
                Cancel
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  restoreSnapshot(pendingRestore.id);
                  setPendingRestore(null);
                }}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
