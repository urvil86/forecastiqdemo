"use client";

import { useStore } from "@/lib/store";
import { X } from "lucide-react";

export function VersionDrawer({ onClose }: { onClose: () => void }) {
  const versions = useStore((s) => s.versionHistory);
  const loadVersion = useStore((s) => s.loadVersion);
  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <aside
        className="absolute right-0 top-0 bottom-0 w-96 bg-surface border-l border-border p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-heading text-h3 text-secondary">Version History</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        {versions.length === 0 ? (
          <p className="text-sm text-muted">No saved versions yet. Click "Save Version" to capture a snapshot.</p>
        ) : (
          <ul className="space-y-3">
            {versions.map((v) => (
              <li key={v.id} className="border border-border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-secondary">v{v.version}</div>
                  <button className="btn-ghost !py-1 !px-3" onClick={() => loadVersion(v.id)}>
                    Load
                  </button>
                </div>
                <div className="text-sm mt-1">{v.label}</div>
                <div className="text-xs text-muted mt-1">{new Date(v.timestamp).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
