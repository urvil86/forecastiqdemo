"use client";

import { useEffect } from "react";
import type {
  BreakdownInput,
  BreakdownInputSource,
  BreakdownLayer,
  BreakdownUncertainty,
  CalculationBreakdown,
} from "@/lib/growth-intel";
import { formatUsdShort, formatNumber } from "@/lib/format";
import { X, AlertTriangle, BookOpen, ChevronDown } from "lucide-react";
import { useState } from "react";

const SOURCE_PILL: Record<BreakdownInputSource, { label: string; bg: string; fg: string }> = {
  "user-input": { label: "User Input", bg: "rgba(92,103,112,0.15)", fg: "#5C6770" },
  "lever-config": { label: "Lever Config", bg: "rgba(0,68,102,0.15)", fg: "#004466" },
  "benchmark": { label: "Industry Benchmark", bg: "rgba(201,139,39,0.18)", fg: "#A26F1C" },
  "forecast-engine": { label: "Forecast Engine", bg: "rgba(31,138,92,0.15)", fg: "#1F8A5C" },
  "computed": { label: "Computed", bg: "rgba(155,89,182,0.15)", fg: "#7D3C98" },
};

const SEVERITY_PILL: Record<string, string> = {
  low: "bg-success/15 text-success",
  medium: "bg-warning/15 text-warning",
  high: "bg-danger/15 text-danger",
};

function renderInputValue(input: BreakdownInput): string {
  if (typeof input.value === "string") return input.value;
  if (input.unit === "$") return `$${formatNumber(input.value, 0)}`;
  if (input.unit === "%") return `${(input.value * 100).toFixed(input.precision ?? 1)}%`;
  if (input.precision !== undefined) return formatNumber(input.value, input.precision);
  return formatNumber(input.value, 2);
}

function renderOutputValue(value: number, unit: string, precision: number): string {
  if (unit === "$") return formatUsdShort(value);
  if (unit === "%") return `${(value * 100).toFixed(precision)}%`;
  return formatNumber(value, precision);
}

export function CalculationBreakdownPanel({
  breakdown,
  onClose,
}: {
  breakdown: CalculationBreakdown;
  onClose: () => void;
}) {
  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Trap escape to close
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-stretch justify-end" onClick={onClose}>
      <div
        className="bg-surface w-full max-w-3xl h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-start justify-between gap-3 z-10">
          <div className="flex-1">
            <div className="caption text-muted">Show calculation</div>
            <h2 className="font-heading text-h3 text-secondary">{breakdown.leverName}</h2>
            <div className="text-sm mt-1">
              <span className="font-mono">{formatUsdShort(breakdown.investmentUsd)}</span> invested →{" "}
              <span className="font-mono text-success">{formatUsdShort(breakdown.expectedImpactUsd)}</span> expected impact
            </div>
            <p className="text-xs text-muted mt-2 leading-snug">{breakdown.summaryLine}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground p-1" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <LayerCard num={1} layer={breakdown.layers.investmentToActivity} />
          <LayerCard num={2} layer={breakdown.layers.activityToReach} />
          <LayerCard num={3} layer={breakdown.layers.activityToOutcome} />
          <LayerCard num={4} layer={breakdown.layers.outcomeToRevenue} />

          {breakdown.uncertainties.length > 0 && (
            <UncertaintiesPanel uncertainties={breakdown.uncertainties} />
          )}
        </div>
      </div>
    </div>
  );
}

function LayerCard({ num, layer }: { num: number; layer: BreakdownLayer }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border rounded-md overflow-hidden bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between bg-background hover:bg-primary-light/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white font-heading font-bold text-sm">
            {num}
          </span>
          <div className="text-left">
            <div className="font-heading text-h4 text-secondary">{layer.title}</div>
            <div className="text-[11px] text-muted">
              {layer.inputs.length} input{layer.inputs.length === 1 ? "" : "s"} ·{" "}
              {layer.steps.length} step{layer.steps.length === 1 ? "" : "s"} · {layer.outputs.length} output
              {layer.outputs.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <ChevronDown size={18} className={"text-muted transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="p-4 space-y-4 bg-surface">
          {/* Inputs */}
          <div>
            <div className="caption text-muted mb-2">Inputs</div>
            <div className="space-y-1">
              {layer.inputs.map((input, i) => {
                const pill = SOURCE_PILL[input.source];
                return (
                  <div key={i} className="flex items-center justify-between text-sm bg-background rounded px-3 py-1.5">
                    <span className="text-muted">{input.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">
                        {renderInputValue(input)} {input.unit && input.unit !== "$" && input.unit !== "%" ? input.unit : ""}
                      </span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide"
                        style={{ background: pill.bg, color: pill.fg }}
                      >
                        {pill.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="caption text-muted mb-2">Computation</div>
            <ol className="space-y-2">
              {layer.steps.map((step, i) => (
                <li key={i} className="border-l-2 border-primary pl-3 py-1">
                  <div className="text-sm font-medium">
                    Step {i + 1} — {step.description}
                  </div>
                  <div className="font-mono text-xs text-muted mt-1 italic">{step.formula}</div>
                  <div className="font-mono text-xs bg-background rounded px-2 py-1 mt-1 text-foreground">
                    {step.computation}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Outputs */}
          <div>
            <div className="caption text-muted mb-2">Outputs</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {layer.outputs.map((out, i) => (
                <div key={i} className="flex items-center justify-between bg-primary-light/30 rounded px-3 py-2">
                  <span className="text-xs text-muted">{out.label}</span>
                  <span className="font-mono font-bold text-secondary">
                    {renderOutputValue(out.value, out.unit, out.precision)}{" "}
                    {out.unit && out.unit !== "$" && out.unit !== "%" ? (
                      <span className="text-[10px] text-muted font-normal">{out.unit}</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Citations */}
          <div>
            <div className="caption text-muted mb-2 flex items-center gap-1">
              <BookOpen size={12} /> Sources
            </div>
            <ul className="space-y-1 text-xs">
              {layer.citations.map((c, i) => (
                <li key={i} className="border-l border-muted pl-2">
                  <div className="font-semibold text-foreground">{c.source}</div>
                  <div className="text-muted">{c.relevance}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function UncertaintiesPanel({ uncertainties }: { uncertainties: BreakdownUncertainty[] }) {
  return (
    <div className="border border-warning/40 rounded-md p-4 bg-warning/5">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="text-warning" size={16} />
        <h4 className="font-heading text-h4 text-secondary">What could affect these estimates</h4>
      </div>
      <p className="text-xs text-muted mb-3">Uncertainties named honestly — variance lives here, not in the headline number.</p>
      <div className="space-y-2">
        {uncertainties.map((u, i) => (
          <div key={i} className="flex gap-2 items-start bg-surface border border-border rounded p-2">
            <span className="pill text-[10px] flex-shrink-0" style={{ background: "rgba(0,68,102,0.1)", color: "#004466" }}>
              {u.layer}
            </span>
            <div className="flex-1 text-sm">{u.description}</div>
            <span className={"pill text-[10px] flex-shrink-0 " + SEVERITY_PILL[u.impactOnEstimate]}>
              {u.impactOnEstimate.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
