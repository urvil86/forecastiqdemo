"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatUsdShort } from "@/lib/format";
import type { LeverId } from "@/lib/growth-intel";

interface OpportunityCard {
  id: string;
  title: string;
  /** Expected revenue lift in USD */
  impact: number;
  /** Default budget in USD when opening in Plan Mode */
  budget: number;
  description: string;
  lever: LeverId;
  cta: string;
}

const DEFAULT_OPPORTUNITIES: OpportunityCard[] = [
  {
    id: "site-of-care",
    title: "Site-of-care optimization",
    impact: 19_000_000,
    budget: 19_000_000,
    description:
      "Migrating Top-50 IDN volume to community infusion suites would reduce cost-of-care friction and capture 4% incremental volume retention through year 3.",
    lever: "site-of-care-optimization",
    cta: "Open in Plan Mode",
  },
];

const LEVER_OPTIONS: { id: LeverId; label: string }[] = [
  { id: "site-of-care-optimization", label: "Site-of-Care Optimization" },
  { id: "field-force-expansion", label: "Field Force Expansion" },
  { id: "field-force-reallocation", label: "Field Force Reallocation" },
  { id: "account-targeting", label: "Account Targeting Refinement" },
  { id: "patient-services-capacity", label: "Patient Services Capacity" },
  { id: "sample-allocation", label: "Sample Allocation" },
  { id: "dtc-spend", label: "DTC Spend" },
];

export function OpportunitiesTab() {
  const computed = useStore((s) => s.computed);
  const [opportunities, setOpportunities] = useState<OpportunityCard[]>(
    DEFAULT_OPPORTUNITIES,
  );
  const [showAdd, setShowAdd] = useState(false);

  const baseline =
    computed?.annual.find((a) => a.year === new Date().getUTCFullYear() + 1)
      ?.netSales ?? 0;

  function addOpportunity(card: OpportunityCard) {
    setOpportunities((cur) => [...cur, card]);
    setShowAdd(false);
  }

  function removeOpportunity(id: string) {
    setOpportunities((cur) => cur.filter((c) => c.id !== id));
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-h2 text-secondary">
            Investment Opportunities
          </h1>
          <p className="text-sm text-muted mt-1">
            Forecast-aware opportunities ranked by expected mid-impact. Each
            card opens Plan Mode with the relevant lever and budget pre-filled.
          </p>
        </div>
        <button
          className="btn-secondary text-xs flex items-center gap-1"
          onClick={() => setShowAdd(true)}
        >
          <Plus size={12} /> Add new opportunity
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {opportunities.map((c) => (
          <div key={c.id} className="card border-l-4 border-primary relative">
            <button
              onClick={() => removeOpportunity(c.id)}
              className="absolute top-2 right-2 text-muted hover:text-red-600"
              title="Remove opportunity"
            >
              <Trash2 size={14} />
            </button>
            <div className="text-[10px] uppercase text-muted">
              Expected revenue lift
            </div>
            <div className="text-h2 text-primary font-bold mb-2">
              {formatUsdShort(c.impact)}
            </div>
            <h3 className="font-heading text-h3 text-secondary mb-2">
              {c.title}
            </h3>
            <p className="text-sm text-muted mb-3">{c.description}</p>
            <div className="text-[10px] uppercase text-muted mb-1">
              Suggested budget
            </div>
            <div className="text-sm font-semibold mb-4">
              {formatUsdShort(c.budget)}
            </div>
            <Link
              href={`/forecast/plan/?budget=${c.budget}&lever=${c.lever}&action=manual&label=${encodeURIComponent(c.title)}`}
              className="btn-secondary text-xs"
            >
              {c.cta}
            </Link>
          </div>
        ))}

        {opportunities.length === 0 && (
          <div className="col-span-full card text-center text-muted text-sm">
            No opportunities yet. Click <strong>Add new opportunity</strong> to
            configure one.
          </div>
        )}
      </div>

      <p className="text-xs text-muted">
        Baseline next-year net sales: {formatUsdShort(baseline)}
      </p>

      {showAdd && (
        <AddOpportunityDialog
          onCancel={() => setShowAdd(false)}
          onAdd={addOpportunity}
        />
      )}
    </div>
  );
}

function AddOpportunityDialog({
  onCancel,
  onAdd,
}: {
  onCancel: () => void;
  onAdd: (c: OpportunityCard) => void;
}) {
  const [title, setTitle] = useState("");
  const [impact, setImpact] = useState(10_000_000);
  const [budget, setBudget] = useState(10_000_000);
  const [description, setDescription] = useState("");
  const [lever, setLever] = useState<LeverId>("site-of-care-optimization");

  function handleAdd() {
    if (!title.trim()) return;
    onAdd({
      id: `opp-${Date.now().toString(36)}`,
      title: title.trim(),
      impact,
      budget,
      description: description.trim() || "Custom investment opportunity.",
      lever,
      cta: "Open in Plan Mode",
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="card max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading text-h3 mb-3">Add investment opportunity</h3>

        <label className="block mb-3">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Title
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Specialty pharmacy contract refresh"
            className="input-cell !font-sans w-full"
            autoFocus
          />
        </label>

        <label className="block mb-3">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Description (optional)
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Why is this opportunity worth investing in?"
            className="w-full px-2 py-1 border border-border rounded text-sm"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
              Expected impact ($)
            </div>
            <input
              type="number"
              value={impact}
              step={500000}
              onChange={(e) => setImpact(parseFloat(e.target.value) || 0)}
              className="input-cell !font-sans w-full"
            />
          </label>
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
              Suggested budget ($)
            </div>
            <input
              type="number"
              value={budget}
              step={500000}
              onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
              className="input-cell !font-sans w-full"
            />
          </label>
        </div>

        <label className="block mb-4">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Plan Mode lever
          </div>
          <select
            value={lever}
            onChange={(e) => setLever(e.target.value as LeverId)}
            className="input-cell !font-sans w-full"
          >
            {LEVER_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-secondary"
            onClick={handleAdd}
            disabled={!title.trim()}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
