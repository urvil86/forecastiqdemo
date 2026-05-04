"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { DEMO_USERS } from "@/lib/engine";
import type { ReconciliationAction } from "@/lib/engine";

interface Props {
  open: boolean;
  onClose: () => void;
  /** When set, modal is for a reconciliation action. Otherwise it's a manual save. */
  action: ReconciliationAction | null;
  /** When provided, text shown in the action label area */
  triggerLabel?: string;
}

export function SaveSnapshotModal({ open, onClose, action, triggerLabel }: Props) {
  const forecast = useStore((s) => s.forecast);
  const computed = useStore((s) => s.computed);
  const currentDemoUser = useStore((s) => s.currentDemoUser);
  const createSnapshot = useStore((s) => s.createSnapshot);
  const variance = useStore((s) => s.varianceStatus)();
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const isManual = action === null;
  const reasonRequired = action === "document-accept" || isManual;

  const otherUsers = useMemo(
    () => DEMO_USERS.filter((u) => u.id !== currentDemoUser.id),
    [currentDemoUser.id],
  );

  if (!open) return null;

  function actionDisplayLabel(): string {
    if (action === "refresh-lrp") return "Refresh LRP from STF";
    if (action === "adjust-stf") return "Adjust STF to LRP target";
    if (action === "document-accept") return "Document & Accept";
    return "Manual checkpoint";
  }

  function handleSave() {
    if (reasonRequired && !reason.trim()) return;
    setSaving(true);
    try {
      const notifyList = notify
        .map((id) => DEMO_USERS.find((u) => u.id === id))
        .filter((u): u is (typeof DEMO_USERS)[number] => Boolean(u))
        .map((u) => ({ name: u.name, email: `${u.id}@chryselys.demo` }));
      createSnapshot({
        triggerType: isManual ? "manual-save" : "reconciliation",
        triggerReason: isManual ? "user-initiated" : "variance-breach",
        action: action ?? undefined,
        reason: reason.trim() || undefined,
        notify: notifyList.length > 0 ? notifyList : undefined,
      });
      setReason("");
      setNotify([]);
      onClose();
      // Toast + scroll to log
      if (typeof window !== "undefined") {
        const log = document.getElementById("version-log");
        if (log) log.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="card max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading text-h3 mb-3">
          {isManual ? "Save checkpoint snapshot" : "Save reconciliation snapshot"}
        </h3>

        {!isManual && (
          <div className="mb-4 p-3 rounded bg-background border border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
              Action selected
            </div>
            <div className="font-semibold text-secondary">
              {triggerLabel ?? actionDisplayLabel()}
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Variance at save
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded bg-background border border-border">
              <div className="text-muted text-[10px]">4-week</div>
              <div className="font-mono">{(variance.rolling4Week * 100).toFixed(2)}%</div>
            </div>
            <div className="p-2 rounded bg-background border border-border">
              <div className="text-muted text-[10px]">13-week</div>
              <div className="font-mono">{(variance.rolling13Week * 100).toFixed(2)}%</div>
            </div>
            <div className="p-2 rounded bg-background border border-border">
              <div className="text-muted text-[10px]">YTD</div>
              <div className="font-mono">{(variance.ytd * 100).toFixed(2)}%</div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Active user
          </div>
          <div className="text-sm">
            <span className="font-semibold">{currentDemoUser.name}</span>
            <span className="text-muted"> · {currentDemoUser.role}</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-[10px] uppercase tracking-wider text-muted block mb-1">
            Reason {reasonRequired ? <span className="text-red-600">*</span> : "(optional)"}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you saving this snapshot?"
            rows={3}
            className="w-full px-2 py-1 border border-border rounded text-sm"
            autoFocus={reasonRequired}
          />
        </div>

        <div className="mb-4">
          <label className="text-[10px] uppercase tracking-wider text-muted block mb-1">
            Notify (optional, demo only)
          </label>
          <div className="flex flex-wrap gap-2">
            {otherUsers.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-2 text-xs px-2 py-1 border border-border rounded cursor-pointer hover:bg-background"
              >
                <input
                  type="checkbox"
                  checked={notify.includes(u.id)}
                  onChange={(e) =>
                    setNotify((cur) =>
                      e.target.checked
                        ? [...cur, u.id]
                        : cur.filter((x) => x !== u.id),
                    )
                  }
                  className="accent-primary"
                />
                {u.name}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-4 p-3 rounded border border-border bg-background text-xs space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted">Preview</div>
          <div>
            Forecast snapshot:{" "}
            <span className="font-mono">{forecast.brand} · {forecast.geography}</span>
          </div>
          <div>
            LRP at this version:{" "}
            <span className="font-mono">
              v{forecast.version} · {forecast.versionLabel}
            </span>
          </div>
          <div>
            STF: 13 weeks forward · Last actuals{" "}
            <span className="font-mono">{forecast.stf.actualsCutoffDate}</span>
          </div>
          <div className="text-muted mt-1">
            After this snapshot the forecast continues running. The snapshot is archived to the
            version log.
          </div>
          {computed && (
            <div className="text-muted">
              Annual ({forecast.timeframe.forecastEnd.slice(0, 4)}): $
              {(
                (computed.annual.find((a) => a.year === parseInt(forecast.timeframe.forecastEnd.slice(0, 4)))?.netSales ?? 0) /
                1e9
              ).toFixed(2)}
              B
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn-secondary"
            onClick={handleSave}
            disabled={saving || (reasonRequired && !reason.trim())}
            title={
              reasonRequired && !reason.trim()
                ? "A reason is required for this action"
                : undefined
            }
          >
            {saving ? "Saving…" : "Save snapshot"}
          </button>
        </div>
      </div>
    </div>
  );
}
