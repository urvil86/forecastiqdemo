"use client";

import { LEVERS } from "@/lib/growth-intel";
import { formatUsdShort } from "@/lib/format";
import type { GrowthFormState } from "@/app/growth/page";
import { Info, Sparkles } from "lucide-react";
import { useState } from "react";

export function SetupCard({
  form,
  update,
  onOptimize,
  isComputing,
}: {
  form: GrowthFormState;
  update: <K extends keyof GrowthFormState>(key: K, value: GrowthFormState[K]) => void;
  onOptimize: () => void;
  isComputing: boolean;
}) {
  function toggleExclude(id: string) {
    const next = form.excludedLevers.includes(id)
      ? form.excludedLevers.filter((x) => x !== id)
      : [...form.excludedLevers, id];
    update("excludedLevers", next);
  }

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <div>
          <h3 className="font-heading text-h3 text-secondary">Step 1 — Set the question</h3>
          <p className="text-xs text-muted mt-1">
            Choose a budget, an objective, and any constraints. Hit <strong>Optimize</strong> and the engine fills in the per-lever
            sliders below with the recommended allocation. You can then tweak any slider before computing the final result.
          </p>
        </div>
        <button onClick={onOptimize} disabled={isComputing} className="btn-secondary flex items-center gap-1 disabled:opacity-50">
          <Sparkles size={14} /> {isComputing ? "Optimizing…" : "Optimize"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
        {/* Budget + objective */}
        <div className="border border-border rounded-md p-3 bg-background">
          <div className="caption text-muted">Budget</div>
          <div className="text-h2 font-heading text-primary text-center mb-2">{formatUsdShort(form.budgetUsd)}</div>
          <input
            type="range"
            min={1_000_000}
            max={50_000_000}
            step={1_000_000}
            value={form.budgetUsd}
            onChange={(e) => update("budgetUsd", parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted">
            <span>$1M</span><span>$10M</span><span>$25M</span><span>$50M</span>
          </div>
          <div className="caption text-muted mt-4 mb-1">Objective</div>
          <Radio name="obj" value="max-revenue" current={form.objective} onChange={(v) => update("objective", v)}
            label="Maximize revenue" help="Find the portfolio with highest mid-case lift." />
          <Radio name="obj" value="max-roi" current={form.objective} onChange={(v) => update("objective", v)}
            label="Maximize ROI ($/$)" help="Pick low-cost, high-marginal levers regardless of total." />
          <Radio name="obj" value="max-confidence" current={form.objective} onChange={(v) => update("objective", v)}
            label="Maximize confidence" help="Excludes high-risk levers; tighter range, lower mid-case." />
        </div>

        {/* Constraints */}
        <div className="border border-border rounded-md p-3 bg-background">
          <ConstraintsHelp />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <div>
              <div className="caption text-muted mb-1 flex items-center gap-1">
                Exclude levers
                <HelpPop title="Exclude levers" body="Force the optimizer to skip these levers entirely (zero allocation). Use when a lever isn't operationally available — e.g., DTC isn't approved this year." />
              </div>
              <div className="space-y-1">
                {LEVERS.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-surface rounded px-1 py-0.5" title={l.description}>
                    <input type="checkbox" checked={form.excludedLevers.includes(l.id)} onChange={() => toggleExclude(l.id)} className="accent-primary" />
                    <span className="flex-1">{l.displayName}</span>
                    <span className={"text-[10px] " + (l.riskScore === "high" ? "text-danger" : l.riskScore === "medium" ? "text-warning" : "text-muted")}>
                      {l.riskScore}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="caption text-muted mb-1 flex items-center gap-1">
                Category caps
                <HelpPop title="Category caps" body="Hard ceilings on how much can be spent in a category. The optimizer will redistribute residuals to other categories. Default $20M = effectively unbounded." />
              </div>
              <CapRow label="Commercial Investment" value={form.categoryCaps.commercial} onChange={(v) => update("categoryCaps", { ...form.categoryCaps, commercial: v })} />
              <CapRow label="Commercial Optimization" value={form.categoryCaps.optimization} onChange={(v) => update("categoryCaps", { ...form.categoryCaps, optimization: v })} />
              <CapRow label="Operations Investment" value={form.categoryCaps.operations} onChange={(v) => update("categoryCaps", { ...form.categoryCaps, operations: v })} />
            </div>
            <div>
              <div className="caption text-muted mb-1 flex items-center gap-1">
                Risk tolerance
                <HelpPop title="Risk tolerance" body="Conservative auto-excludes high-risk levers (DTC, Field Force Expansion). Aggressive switches the optimizer's objective to maximize ROI regardless of risk. Balanced uses your chosen objective unmodified." />
              </div>
              <Radio name="risk" value="balanced" current={form.riskTolerance} onChange={(v) => update("riskTolerance", v)} label="Balanced" help="All enabled levers; uses chosen objective." />
              <Radio name="risk" value="conservative" current={form.riskTolerance} onChange={(v) => update("riskTolerance", v)} label="Conservative" help="Excludes DTC + Field Force Expansion." />
              <Radio name="risk" value="aggressive" current={form.riskTolerance} onChange={(v) => update("riskTolerance", v)} label="Aggressive" help="Switch to max-ROI regardless of risk." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConstraintsHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between">
        <h4 className="font-heading text-h4 text-secondary">Constraints</h4>
        <button onClick={() => setOpen((v) => !v)} className="text-xs text-primary hover:underline flex items-center gap-1">
          <Info size={12} /> {open ? "Hide" : "What are constraints?"}
        </button>
      </div>
      {open && (
        <div className="text-xs text-muted bg-surface rounded-md p-3 mt-2 leading-relaxed">
          <p className="mb-2">
            Constraints tell the optimizer what's <em>not allowed</em>. The optimizer treats your budget as a maximum and your
            constraints as boundaries within which it searches for the best allocation.
          </p>
          <ul className="list-disc ml-4 space-y-1">
            <li>
              <strong>Exclude levers</strong> — checked levers get $0 allocation. The optimizer redistributes residuals to other
              levers. Use when a lever isn't operationally available (e.g., DTC not approved this year).
            </li>
            <li>
              <strong>Category caps</strong> — dollar ceilings per category. If you cap Operations at $1M but the unconstrained
              optimizer wanted $4M into Patient Services Capacity, it caps that lever at $1M and redistributes the freed $3M
              across other categories.
            </li>
            <li>
              <strong>Risk tolerance</strong> — preset filters. <em>Conservative</em> excludes high-risk levers (DTC, Field Force
              Expansion). <em>Aggressive</em> switches to max-ROI mode. <em>Balanced</em> respects your chosen objective.
            </li>
          </ul>
          <p className="mt-2">
            All constraints are <strong>hard</strong> — the optimizer never violates them. If they over-constrain (e.g., you exclude
            every lever), the result is empty with a clear note.
          </p>
        </div>
      )}
    </div>
  );
}

function HelpPop({ title, body }: { title: string; body: string }) {
  return (
    <span title={`${title}\n\n${body}`} className="cursor-help text-muted">
      <Info size={11} />
    </span>
  );
}

function Radio<T extends string>({
  name,
  value,
  current,
  onChange,
  label,
  help,
}: {
  name: string;
  value: T;
  current: T;
  onChange: (v: T) => void;
  label: string;
  help?: string;
}) {
  const checked = current === value;
  return (
    <label className={"block px-2 py-1 rounded mb-1 cursor-pointer border " + (checked ? "border-primary bg-primary-light/40" : "border-transparent hover:bg-surface")}>
      <div className="flex items-center gap-2 text-sm">
        <input type="radio" name={name} className="accent-primary" checked={checked} onChange={() => onChange(value)} />
        {label}
      </div>
      {help && <div className="text-[10px] text-muted ml-5">{help}</div>}
    </label>
  );
}

function CapRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[11px]">
        <span>{label}</span>
        <span className="font-mono">{value >= 20_000_000 ? "—" : `$${(value / 1e6).toFixed(0)}M`}</span>
      </div>
      <input type="range" min={0} max={20_000_000} step={500_000} value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="w-full accent-primary" />
    </div>
  );
}
