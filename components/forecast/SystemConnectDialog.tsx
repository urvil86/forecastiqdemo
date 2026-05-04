"use client";

import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { SYSTEMS, type SystemDefinition, type SyncFrequency } from "@/lib/systems";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Mode = "list" | "connect" | "configure";

interface Toast {
  text: string;
  tone: "success" | "warning";
}

const FREQ_LABELS: Record<SyncFrequency, string> = {
  realtime: "Real-time",
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  "on-demand": "On-demand",
};

function fmt(t?: string): string {
  if (!t) return "—";
  try {
    return new Date(t).toLocaleString();
  } catch {
    return t;
  }
}

export function SystemConnectDialog({ open, onClose }: Props) {
  const connectedSystems = useStore((s) => s.connectedSystems);
  const setSystemConnection = useStore((s) => s.setSystemConnection);
  const syncSystem = useStore((s) => s.syncSystem);
  const disconnectSystem = useStore((s) => s.disconnectSystem);
  const setSystemFrequency = useStore((s) => s.setSystemFrequency);
  const [mode, setMode] = useState<Mode>("list");
  const [activeSystem, setActiveSystem] = useState<SystemDefinition | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);

  if (!open) return null;

  function statusPill(systemId: string) {
    const conn = connectedSystems[systemId];
    if (!conn || conn.status === "not-connected") {
      return (
        <span className="pill bg-background border border-border text-muted text-[10px]">
          Not connected
        </span>
      );
    }
    if (conn.status === "error") {
      return (
        <span className="pill bg-red-500/10 text-red-700 border border-red-500/30 text-[10px]">
          Error
        </span>
      );
    }
    const overdue = conn.nextSync && new Date(conn.nextSync).getTime() < Date.now();
    if (overdue) {
      return (
        <span className="pill bg-amber-500/10 text-amber-700 border border-amber-500/30 text-[10px]">
          Sync overdue
        </span>
      );
    }
    return (
      <span className="pill bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 text-[10px]">
        Connected (demo)
      </span>
    );
  }

  function openConnect(sys: SystemDefinition) {
    setActiveSystem(sys);
    setMode("connect");
  }

  function openConfigure(sys: SystemDefinition) {
    setActiveSystem(sys);
    setMode("configure");
  }

  async function performConnect() {
    if (!activeSystem) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSystemConnection(activeSystem.id, {
      status: "connected",
      lastSync: new Date(Date.now() - 3600_000).toISOString(),
      nextSync: new Date(Date.now() + 23 * 3600_000).toISOString(),
      connectedAt: new Date().toISOString(),
      syncFrequency: activeSystem.defaultFrequency,
    });
    setBusy(false);
    setMode("list");
    setActiveSystem(null);
    setToast({
      text: `Connected to ${activeSystem.name} (demo mode).`,
      tone: "success",
    });
  }

  async function performSync() {
    if (!activeSystem) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 1500));
    const records = syncSystem(activeSystem.id);
    setBusy(false);
    setToast({
      text: `${activeSystem.name} synced. ${records} records updated.`,
      tone: "success",
    });
  }

  function performDisconnect(id: string) {
    disconnectSystem(id);
    setConfirmDisconnect(null);
    setMode("list");
    setActiveSystem(null);
    const sys = SYSTEMS.find((s) => s.id === id);
    setToast({
      text: `${sys?.name ?? "System"} disconnected.`,
      tone: "warning",
    });
  }

  function handleSaveChanges() {
    setMode("list");
    setActiveSystem(null);
    setToast({ text: "Configuration saved.", tone: "success" });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === "list" && (
          <>
            <div className="flex items-baseline gap-2 mb-1">
              <Link2 className="text-primary" size={18} />
              <h3 className="font-heading text-h3 text-secondary">
                Connect to existing systems
              </h3>
            </div>
            <p className="text-sm text-muted mb-4">
              ForecastIQ integrates with the systems your team already uses. Connect once, and
              forecast inputs sync automatically on the cadence you choose.
            </p>

            <ul className="divide-y divide-border border border-border rounded">
              {SYSTEMS.map((sys) => {
                const conn = connectedSystems[sys.id];
                const isConnected = conn?.status === "connected";
                return (
                  <li key={sys.id} className="p-3 flex items-start gap-3">
                    <div className="w-9 h-9 rounded bg-primary-light/40 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {sys.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-secondary">
                          {sys.name}
                        </span>
                        <span className="text-[11px] text-muted">{sys.category}</span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">{sys.description}</p>
                      {isConnected && (
                        <p className="text-[10px] text-muted mt-1">
                          Last sync: <span className="font-mono">{fmt(conn?.lastSync)}</span>
                          {" · Next: "}
                          <span className="font-mono">{fmt(conn?.nextSync)}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {statusPill(sys.id)}
                      {isConnected ? (
                        <button
                          className="btn-ghost text-[11px] !py-0.5 !px-2"
                          onClick={() => openConfigure(sys)}
                        >
                          Configure
                        </button>
                      ) : (
                        <button
                          className="btn-secondary text-[11px] !py-0.5 !px-2"
                          onClick={() => openConnect(sys)}
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 text-xs text-muted">
              <a
                className="underline cursor-pointer hover:text-primary"
                onClick={(e) => {
                  e.preventDefault();
                  setToast({
                    text: "Architecture diagram opens in production.",
                    tone: "success",
                  });
                }}
              >
                View full integration architecture →
              </a>
            </div>

            <div className="mt-4 flex justify-end">
              <button className="btn-ghost" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}

        {mode === "connect" && activeSystem && (
          <ConnectSubDialog
            sys={activeSystem}
            busy={busy}
            onCancel={() => {
              setMode("list");
              setActiveSystem(null);
            }}
            onConnect={performConnect}
          />
        )}

        {mode === "configure" && activeSystem && (
          <ConfigureSubDialog
            sys={activeSystem}
            conn={connectedSystems[activeSystem.id]}
            busy={busy}
            onCancel={() => {
              setMode("list");
              setActiveSystem(null);
            }}
            onSync={performSync}
            onSave={handleSaveChanges}
            onDisconnect={() => setConfirmDisconnect(activeSystem.id)}
            onSetFrequency={(f) => setSystemFrequency(activeSystem.id, f)}
          />
        )}

        {confirmDisconnect && (
          <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
            <div className="card max-w-sm w-full">
              <h4 className="font-heading text-h4 mb-2">Disconnect system?</h4>
              <p className="text-sm text-muted mb-4">
                Disconnecting stops automatic sync. Connected forecasts remain unchanged but
                will no longer receive updates from this source.
              </p>
              <div className="flex justify-end gap-2">
                <button className="btn-ghost" onClick={() => setConfirmDisconnect(null)}>
                  Cancel
                </button>
                <button
                  className="btn-secondary !bg-red-600 !border-red-600 hover:!bg-red-700 text-white"
                  onClick={() => performDisconnect(confirmDisconnect)}
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 z-[70] card max-w-sm shadow-lg">
            <div className="flex items-start gap-2">
              <div
                className={
                  "w-2 h-2 rounded-full mt-2 " +
                  (toast.tone === "success" ? "bg-emerald-500" : "bg-amber-500")
                }
              />
              <div className="flex-1 text-xs">{toast.text}</div>
              <button
                className="text-muted hover:text-secondary text-xs"
                onClick={() => setToast(null)}
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectSubDialog({
  sys,
  busy,
  onCancel,
  onConnect,
}: {
  sys: SystemDefinition;
  busy: boolean;
  onCancel: () => void;
  onConnect: () => void;
}) {
  const [frequency, setFrequency] = useState<SyncFrequency>(sys.defaultFrequency);
  return (
    <>
      <h3 className="font-heading text-h3 text-secondary mb-1">
        Connect to {sys.name}
      </h3>
      <p className="text-xs text-muted mb-4">{sys.category}</p>

      <div className="space-y-4 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Connection method
          </div>
          <div className="flex gap-2">
            {(["API Key", "OAuth", "Service Account"] as const).map((m) => (
              <label
                key={m}
                className={
                  "flex items-center gap-2 px-3 py-1.5 border rounded text-xs " +
                  (m === sys.authMethod
                    ? "border-primary bg-primary-light/40"
                    : "border-border opacity-50") +
                  " cursor-default"
                }
              >
                <input
                  type="radio"
                  name="auth"
                  checked={m === sys.authMethod}
                  readOnly
                  disabled
                  className="accent-primary"
                />
                {m}
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Endpoint URL
          </div>
          <div className="font-mono text-xs px-2 py-1.5 bg-background border border-border rounded">
            {sys.endpointUrl}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Sync frequency
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              ["realtime", "hourly", "daily", "weekly", "on-demand"] as SyncFrequency[]
            ).map((f) => (
              <label
                key={f}
                className={
                  "flex items-center gap-2 px-2 py-1 border rounded cursor-pointer text-xs " +
                  (frequency === f
                    ? "border-primary bg-primary-light/40"
                    : "border-border")
                }
              >
                <input
                  type="radio"
                  name="freq"
                  checked={frequency === f}
                  onChange={() => setFrequency(f)}
                  className="accent-primary"
                />
                {FREQ_LABELS[f]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Field mappings
          </div>
          <div className="border border-border rounded text-[11px] divide-y divide-border">
            {sys.fieldMappings.map((m) => (
              <div key={m.source} className="grid grid-cols-2 gap-2 px-2 py-1">
                <div className="font-mono text-secondary">{m.source}</div>
                <div className="font-mono text-muted">→ {m.target}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-muted italic">
          Demo mode: connection is simulated. In production, this step authenticates with{" "}
          {sys.name} and validates the connection. No data leaves your environment.
        </p>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          className="btn-secondary flex items-center gap-2"
          onClick={onConnect}
          disabled={busy}
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {busy ? "Establishing connection…" : "Connect"}
        </button>
      </div>
    </>
  );
}

function ConfigureSubDialog({
  sys,
  conn,
  busy,
  onCancel,
  onSync,
  onSave,
  onDisconnect,
  onSetFrequency,
}: {
  sys: SystemDefinition;
  conn: ReturnType<typeof useStore.getState>["connectedSystems"][string];
  busy: boolean;
  onCancel: () => void;
  onSync: () => void;
  onSave: () => void;
  onDisconnect: () => void;
  onSetFrequency: (f: SyncFrequency) => void;
}) {
  return (
    <>
      <h3 className="font-heading text-h3 text-secondary mb-1">
        Configure {sys.name}
      </h3>
      <p className="text-xs text-muted mb-4">{sys.category}</p>

      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-2 rounded bg-background border border-border">
            <div className="text-[10px] text-muted uppercase">Last sync</div>
            <div className="font-mono">{fmt(conn?.lastSync)}</div>
          </div>
          <div className="p-2 rounded bg-background border border-border">
            <div className="text-[10px] text-muted uppercase">Next sync</div>
            <div className="font-mono">{fmt(conn?.nextSync)}</div>
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Sync frequency
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              ["realtime", "hourly", "daily", "weekly", "on-demand"] as SyncFrequency[]
            ).map((f) => (
              <label
                key={f}
                className={
                  "flex items-center gap-2 px-2 py-1 border rounded cursor-pointer text-xs " +
                  ((conn?.syncFrequency ?? "daily") === f
                    ? "border-primary bg-primary-light/40"
                    : "border-border")
                }
              >
                <input
                  type="radio"
                  name="freq-cfg"
                  checked={(conn?.syncFrequency ?? "daily") === f}
                  onChange={() => onSetFrequency(f)}
                  className="accent-primary"
                />
                {FREQ_LABELS[f]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Field mappings
          </div>
          <div className="border border-border rounded text-[11px] divide-y divide-border">
            {sys.fieldMappings.map((m) => (
              <div key={m.source} className="grid grid-cols-2 gap-2 px-2 py-1">
                <div className="font-mono text-secondary">{m.source}</div>
                <div className="font-mono text-muted">→ {m.target}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          className="btn-secondary text-xs flex items-center gap-2"
          onClick={onSync}
          disabled={busy}
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {busy ? "Syncing…" : "Sync now"}
        </button>

        <div className="border-t border-border pt-3">
          <button
            className="text-[11px] text-red-600 hover:underline"
            onClick={onDisconnect}
            disabled={busy}
          >
            Disconnect this system
          </button>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="btn-secondary" onClick={onSave} disabled={busy}>
          Save changes
        </button>
      </div>
    </>
  );
}
