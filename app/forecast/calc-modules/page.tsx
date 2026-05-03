"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { DEFAULT_CALC_MODULES, getActiveFormula } from "@/lib/engine";

export default function CalcModulesPage() {
  const forecast = useStore((s) => s.forecast);
  const [activeId, setActiveId] = useState(DEFAULT_CALC_MODULES[0].moduleId);
  const active = useMemo(
    () => DEFAULT_CALC_MODULES.find((m) => m.moduleId === activeId)!,
    [activeId]
  );
  const [sandboxInputs, setSandboxInputs] = useState<Record<string, string>>({});

  const activeFormula = getActiveFormula(active, forecast.brand, forecast.geography);
  const brandOverride = active.brandOverrides.find((o) => o.brand === forecast.brand);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] min-h-[calc(100vh-12rem)]">
      <aside className="border-r border-border p-4 bg-surface">
        <h2 className="font-heading text-h3 text-secondary mb-3">Modules</h2>
        <ul className="space-y-1">
          {DEFAULT_CALC_MODULES.map((m) => (
            <li key={m.moduleId}>
              <button
                onClick={() => setActiveId(m.moduleId)}
                className={
                  "w-full text-left px-3 py-2 rounded text-sm " +
                  (m.moduleId === activeId ? "bg-primary/10 text-secondary font-semibold" : "hover:bg-background")
                }
              >
                {m.moduleName}
                <div className="text-[10px] text-muted">
                  {m.brandOverrides.length > 0 ? `${m.brandOverrides.length} brand override(s)` : "Standard"}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="p-8 max-w-4xl space-y-6">
        <div>
          <h1 className="font-heading text-h2 text-secondary">{active.moduleName}</h1>
          <p className="text-sm text-muted mt-1">{active.description}</p>
        </div>

        <div className="card">
          <h3 className="font-heading text-h4 text-secondary mb-2">Active formula</h3>
          <code className="block bg-background p-3 rounded font-mono text-sm border border-border">
            {activeFormula}
          </code>
          {brandOverride?.overrideFormula && (
            <div className="mt-3 p-3 rounded bg-warning/5 border border-warning/30">
              <div className="text-xs uppercase text-warning font-semibold mb-1">
                Brand override active · {forecast.brand}
              </div>
              <div className="text-xs text-muted italic">"{brandOverride.overrideReason}"</div>
            </div>
          )}
          <div className="text-[10px] text-muted mt-2">
            Default ({active.constraints.unitLabel}):{" "}
            <code className="font-mono">{active.formula.expression}</code>
          </div>
        </div>

        <div className="card">
          <h3 className="font-heading text-h4 text-secondary mb-2">Variables</h3>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase text-muted">
              <tr>
                <th className="text-left py-1">Variable</th>
                <th className="text-left py-1">Source</th>
                <th className="text-left py-1">Source detail</th>
              </tr>
            </thead>
            <tbody>
              {active.formula.variables.map((v) => (
                <tr key={v.varName} className="border-t border-border">
                  <td className="py-1.5 font-mono text-xs">{v.varName}</td>
                  <td className="py-1.5">
                    <span className={"pill " + sourceClass(v.source)}>{v.source}</span>
                  </td>
                  <td className="py-1.5 text-xs text-muted">{v.sourceDetail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {active.brandOverrides.length > 0 && (
          <div className="card">
            <h3 className="font-heading text-h4 text-secondary mb-2">Brand overrides</h3>
            {active.brandOverrides.map((o) => (
              <div key={o.brand} className="mb-3 p-3 bg-background rounded border border-border">
                <div className="text-sm font-semibold mb-1">{o.brand}</div>
                <code className="block font-mono text-xs bg-surface p-2 rounded mb-2">
                  {o.overrideFormula}
                </code>
                {o.overrideReason && <p className="text-xs text-muted">{o.overrideReason}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <h3 className="font-heading text-h4 text-secondary mb-2">Test formula sandbox</h3>
          <p className="text-xs text-muted mb-3">
            Plug in sample values for each variable to preview the result.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            {active.formula.variables.map((v) => (
              <label key={v.varName} className="block text-xs">
                <span className="text-muted">{v.varName}</span>
                <input
                  type="number"
                  className="input-cell w-full mt-1"
                  value={sandboxInputs[v.varName] ?? ""}
                  onChange={(e) =>
                    setSandboxInputs((s) => ({ ...s, [v.varName]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          <SandboxResult formula={activeFormula} inputs={sandboxInputs} unit={active.constraints.unitLabel} />
        </div>

        <div className="card">
          <h3 className="font-heading text-h4 text-secondary mb-2">Constraints</h3>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <KV label="Min" value={String(active.constraints.minValue ?? "—")} />
            <KV label="Max" value={String(active.constraints.maxValue ?? "—")} />
            <KV label="Unit" value={active.constraints.unitLabel} />
          </div>
        </div>
      </section>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded bg-background border border-border">
      <div className="text-[10px] text-muted">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}

function SandboxResult({
  formula,
  inputs,
  unit,
}: {
  formula: string;
  inputs: Record<string, string>;
  unit: string;
}) {
  let result: string | number = "—";
  try {
    let expr = formula;
    for (const [k, v] of Object.entries(inputs)) {
      const n = parseFloat(v);
      if (!isNaN(n)) {
        expr = expr.replace(new RegExp(`\\b${k}\\b`, "g"), String(n));
      }
    }
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${expr.replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (m) => (isNaN(parseFloat(m)) ? "0" : m))})`);
    const out = fn();
    if (typeof out === "number" && Number.isFinite(out)) result = out.toFixed(2);
  } catch {
    result = "—";
  }

  return (
    <div className="p-3 bg-background rounded border border-border text-sm">
      <span className="text-muted text-xs">Result: </span>
      <span className="font-mono text-primary font-bold">
        {result} {result !== "—" ? unit : ""}
      </span>
    </div>
  );
}

function sourceClass(source: string) {
  switch (source) {
    case "auto-pipelined":
      return "bg-info/15 text-info";
    case "manual":
      return "bg-muted/15 text-muted";
    case "analog-derived":
      return "bg-warning/15 text-warning";
    case "override":
      return "bg-danger/15 text-danger";
    default:
      return "bg-secondary/10 text-secondary";
  }
}
