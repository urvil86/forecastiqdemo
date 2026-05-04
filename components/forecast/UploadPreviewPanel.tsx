"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Check, AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  parseUpload,
  diffAgainstActive,
  type UploadDiff,
  type UploadPayload,
} from "@/lib/upload-parser";

interface Props {
  open: boolean;
  file: File | null;
  onClose: () => void;
}

type ApplyMode = "active" | "scenario";

const SECTIONS = [
  "summary",
  "validation",
  "lrp",
  "stf",
  "inventory",
  "events",
] as const;

export function UploadPreviewPanel({ open, file, onClose }: Props) {
  const forecast = useStore((s) => s.forecast);
  const applyUpload = useStore((s) => s.applyUpload);
  const [payload, setPayload] = useState<UploadPayload | null>(null);
  const [diff, setDiff] = useState<UploadDiff | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [mode, setMode] = useState<ApplyMode>("active");
  const [reason, setReason] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["summary", "validation"]));
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    setParsing(true);
    setParseError(null);
    setPayload(null);
    setDiff(null);
    parseUpload(file)
      .then((p) => {
        if (cancelled) return;
        setPayload(p);
        setDiff(diffAgainstActive(p, forecast));
      })
      .catch((err) => {
        if (cancelled) return;
        setParseError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setParsing(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file]);

  function toggle(id: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function handleApply() {
    if (!payload || !diff) return;
    if (payload.validation.status === "errors") return;
    setApplying(true);
    try {
      applyUpload(payload, { mode, reason: reason.trim() || undefined });
      setToast("Upload applied. Snapshot saved to version log.");
      setTimeout(() => {
        onClose();
        setToast(null);
        // Scroll to top
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }, 900);
    } finally {
      setApplying(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={() => {
          if (!applying) onClose();
        }}
      />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-[480px] max-w-full bg-surface border-l border-border shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface border-b border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-heading text-h3 text-secondary">
                Review upload before applying
              </h3>
              <p className="text-[11px] text-muted truncate">
                {file?.name ?? "—"}
                {payload && ` · parsed ${new Date(payload.parsedAt).toLocaleTimeString()}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-secondary"
              disabled={applying}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={16} className="animate-spin text-primary" />
              Parsing workbook…
            </div>
          )}
          {parseError && (
            <div className="card border-l-4 border-red-500">
              <div className="text-sm font-semibold text-red-700">Parse error</div>
              <div className="text-xs text-muted mt-1">{parseError}</div>
            </div>
          )}

          {payload && diff && (
            <>
              {/* Section 1 — Workbook summary */}
              <Section
                id="summary"
                expanded={expanded.has("summary")}
                onToggle={toggle}
                title="1. Workbook summary"
              >
                <div className="space-y-1 text-xs">
                  <SummaryRow
                    label="Brand"
                    value={payload.brand || "—"}
                    match={diff.brandMatch}
                    note={
                      !diff.brandMatch
                        ? `current workspace is ${forecast.brand}`
                        : undefined
                    }
                  />
                  <SummaryRow
                    label="Geography"
                    value={payload.geography || "—"}
                    match={diff.geographyMatch}
                    note={
                      !diff.geographyMatch
                        ? `current workspace is ${forecast.geography}`
                        : undefined
                    }
                  />
                  <SummaryRow label="Cycle" value={payload.cycleName || "—"} />
                  <SummaryRow label="Cycle start" value={payload.cycleStartDate || "—"} />
                  <SummaryRow
                    label="Methodology"
                    value={payload.defaultMethodology || "—"}
                  />
                  <SummaryRow
                    label="STF horizon"
                    value={`${payload.stfHorizonWeeks} weeks`}
                  />
                </div>
                {(!diff.brandMatch || !diff.geographyMatch) && (
                  <div className="mt-3 p-2 rounded bg-amber-50 border border-amber-300 text-[11px] text-amber-800">
                    Upload is for <strong>{payload.brand}</strong> /{" "}
                    <strong>{payload.geography}</strong>. Switch workspace before applying, or
                    apply as a new scenario.
                  </div>
                )}
              </Section>

              {/* Section 2 — Validation */}
              <Section
                id="validation"
                expanded={expanded.has("validation")}
                onToggle={toggle}
                title="2. Validation"
                titleRight={<ValidationPill status={payload.validation.status} count={payload.validation.issues.length} />}
              >
                {payload.validation.issues.length === 0 ? (
                  <div className="text-xs text-muted">No issues detected.</div>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {payload.validation.issues.map((iss, i) => (
                      <li
                        key={i}
                        className={
                          "flex items-start gap-2 p-2 rounded border " +
                          (iss.severity === "error"
                            ? "border-red-300 bg-red-50"
                            : iss.severity === "warning"
                            ? "border-amber-300 bg-amber-50"
                            : "border-border bg-background")
                        }
                      >
                        {iss.severity === "error" ? (
                          <AlertCircle size={14} className="text-red-600 mt-0.5 shrink-0" />
                        ) : iss.severity === "warning" ? (
                          <AlertTriangle
                            size={14}
                            className="text-amber-600 mt-0.5 shrink-0"
                          />
                        ) : (
                          <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold">
                            {iss.sheet}
                            {iss.cell && ` · ${iss.cell}`}
                          </div>
                          <div className="text-muted">{iss.message}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Section 3 — Change summary cards */}
              <div className="grid grid-cols-2 gap-2">
                <SummaryCard
                  label="LRP Drivers"
                  value={`${diff.summary.lrpDriversChanged} of ${payload.lrpAssumptions.length} drivers will change`}
                />
                <SummaryCard
                  label="STF Weekly"
                  value={`${diff.summary.stfWeeksChanged} forward weeks will change`}
                />
                <SummaryCard
                  label="Inventory"
                  value={`${diff.summary.inventoryRowsChanged} tier positions will update`}
                />
                <SummaryCard
                  label="Events"
                  value={`${diff.summary.eventsAdded} new, ${diff.summary.eventsModified} modified`}
                />
              </div>

              {/* Section 4 — Detailed diff */}
              <Section
                id="lrp"
                expanded={expanded.has("lrp")}
                onToggle={toggle}
                title="LRP driver diff"
                titleRight={
                  <span className="text-[10px] text-muted">
                    {diff.lrpDriverDiffs.length} changes
                  </span>
                }
              >
                <DiffList
                  rows={diff.lrpDriverDiffs.slice(0, 10).map((d) => ({
                    key: `${d.driver}-${d.year}`,
                    title: `${d.driver} (${d.year})`,
                    detail: `${formatNum(d.currentValue)} → ${formatNum(d.uploadValue)}${
                      d.deltaPct !== null
                        ? ` (${d.deltaPct >= 0 ? "+" : ""}${(d.deltaPct * 100).toFixed(1)}%)`
                        : ""
                    }`,
                  }))}
                  totalCount={diff.lrpDriverDiffs.length}
                />
              </Section>

              <Section
                id="stf"
                expanded={expanded.has("stf")}
                onToggle={toggle}
                title="STF weekly diff"
                titleRight={
                  <span className="text-[10px] text-muted">
                    {diff.stfWeeklyDiffs.length} changes
                  </span>
                }
              >
                <DiffList
                  rows={diff.stfWeeklyDiffs.slice(0, 10).map((d) => ({
                    key: `${d.weekStart}-${d.sku}-${d.field}`,
                    title: `${d.field} ${d.weekStart} (${d.sku})`,
                    detail: `${formatNum(d.currentValue)} → ${formatNum(d.uploadValue)} (${d.deltaAbs >= 0 ? "+" : ""}${formatNum(d.deltaAbs)})`,
                  }))}
                  totalCount={diff.stfWeeklyDiffs.length}
                />
              </Section>

              <Section
                id="inventory"
                expanded={expanded.has("inventory")}
                onToggle={toggle}
                title="Inventory diff"
                titleRight={
                  <span className="text-[10px] text-muted">
                    {diff.inventoryDiffs.length} changes
                  </span>
                }
              >
                <DiffList
                  rows={diff.inventoryDiffs.map((d) => ({
                    key: `${d.tier}-${d.subAccount}`,
                    title: `${d.tier}: ${d.subAccount}`,
                    detail: `${formatNum(d.currentValue)} → ${formatNum(d.uploadValue)} (${
                      d.deltaAbs >= 0 ? "+" : ""
                    }${formatNum(d.deltaAbs)})`,
                  }))}
                  totalCount={diff.inventoryDiffs.length}
                />
              </Section>

              <Section
                id="events"
                expanded={expanded.has("events")}
                onToggle={toggle}
                title="Events diff"
                titleRight={
                  <span className="text-[10px] text-muted">
                    {diff.summary.eventsAdded} new · {diff.summary.eventsModified} modified
                  </span>
                }
              >
                <ul className="text-xs space-y-1">
                  {payload.events.map((ev) => (
                    <li
                      key={ev.name}
                      className="flex items-baseline gap-2 p-1 border-b border-border last:border-0"
                    >
                      <span
                        className={`pill text-[9px] ${
                          ev.direction === "Negative"
                            ? "bg-red-500/10 text-red-700"
                            : "bg-emerald-500/10 text-emerald-700"
                        }`}
                      >
                        {ev.direction}
                      </span>
                      <span className="font-semibold">{ev.name}</span>
                      <span className="text-muted">
                        · peak {ev.peakImpactPct.toFixed(1)}% in {ev.timeToPeakWeeks}w
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>

              {/* Section 5 — Apply controls */}
              <div className="border-t border-border pt-4 space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
                    Apply mode
                  </div>
                  <label className="flex items-start gap-2 text-xs cursor-pointer mb-1">
                    <input
                      type="radio"
                      name="applymode"
                      checked={mode === "active"}
                      onChange={() => setMode("active")}
                      className="accent-primary mt-0.5"
                    />
                    <div>
                      <div className="font-semibold">Apply to active forecast</div>
                      <div className="text-muted">Overwrites current values.</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="applymode"
                      checked={mode === "scenario"}
                      onChange={() => setMode("scenario")}
                      className="accent-primary mt-0.5"
                    />
                    <div>
                      <div className="font-semibold">Apply as new scenario</div>
                      <div className="text-muted">
                        Creates a scenario with these values, leaves active unchanged.
                      </div>
                    </div>
                  </label>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
                    Reason note (optional)
                  </div>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="Why are you applying this upload? (e.g., 'Updated S&OP cycle from gSTARR')"
                    className="w-full px-2 py-1 border border-border rounded text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    className="btn-ghost text-xs"
                    onClick={onClose}
                    disabled={applying}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-secondary text-xs flex items-center gap-1"
                    onClick={handleApply}
                    disabled={
                      applying ||
                      payload.validation.status === "errors" ||
                      !diff.brandMatch
                    }
                    title={
                      payload.validation.status === "errors"
                        ? "Cannot apply — validation errors must be fixed first"
                        : !diff.brandMatch
                        ? "Cannot apply to this brand — switch workspace or apply as scenario"
                        : undefined
                    }
                  >
                    {applying && <Loader2 size={12} className="animate-spin" />}
                    Apply upload
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {toast && (
          <div className="fixed bottom-4 right-4 z-[60] card max-w-sm shadow-lg">
            <div className="flex items-center gap-2">
              <Check size={14} className="text-emerald-600" />
              <div className="text-xs">{toast}</div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function Section({
  id,
  expanded,
  onToggle,
  title,
  titleRight,
  children,
}: {
  id: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  title: string;
  titleRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-background"
      >
        <span className="text-sm font-semibold text-secondary">{title}</span>
        <div className="flex items-center gap-2">
          {titleRight}
          <span className="text-muted text-xs">{expanded ? "−" : "+"}</span>
        </div>
      </button>
      {expanded && <div className="p-3 border-t border-border">{children}</div>}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  match,
  note,
}: {
  label: string;
  value: string;
  match?: boolean;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-1 font-mono">
        {value}
        {match === true && <Check size={12} className="text-emerald-600" />}
        {match === false && (
          <AlertTriangle size={12} className="text-amber-600" />
        )}
      </span>
      {note && (
        <span className="text-[10px] text-amber-700 ml-auto">{note}</span>
      )}
    </div>
  );
}

function ValidationPill({
  status,
  count,
}: {
  status: "valid" | "warnings" | "errors";
  count: number;
}) {
  if (status === "valid")
    return (
      <span className="pill text-[10px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
        Valid — ready to apply
      </span>
    );
  if (status === "warnings")
    return (
      <span className="pill text-[10px] bg-amber-500/10 text-amber-700 border border-amber-500/30">
        Warnings ({count})
      </span>
    );
  return (
    <span className="pill text-[10px] bg-red-500/10 text-red-700 border border-red-500/30">
      Errors ({count}) — cannot apply
    </span>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card !p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
        {label}
      </div>
      <div className="text-xs font-semibold text-secondary">{value}</div>
    </div>
  );
}

function DiffList({
  rows,
  totalCount,
}: {
  rows: { key: string; title: string; detail: string }[];
  totalCount: number;
}) {
  if (rows.length === 0)
    return <div className="text-xs text-muted">No changes in this category.</div>;
  return (
    <div className="space-y-1 text-xs">
      {rows.map((r) => (
        <div
          key={r.key}
          className="flex items-baseline justify-between border-b border-border py-1 last:border-0"
        >
          <span className="font-semibold truncate">{r.title}</span>
          <span className="font-mono text-[11px] text-muted shrink-0 ml-2">
            {r.detail}
          </span>
        </div>
      ))}
      {totalCount > rows.length && (
        <div className="text-[10px] text-muted italic mt-1">
          {totalCount - rows.length} more not shown
        </div>
      )}
    </div>
  );
}

function formatNum(n: number | null): string {
  if (n === null) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toFixed(4);
}
