"use client";

import Link from "next/link";
import { SectionHeader } from "@/components/SectionHeader";
import { Sparkles } from "lucide-react";

const HISTORY = [
  { date: "2026-03-15", title: "Q1 YOY variance review", status: "Aligned", severity: "info", actor: "System", note: "No action" },
  { date: "2026-03-22", title: "Sustained drift detected (Symphony W12 lag)", status: "Resolved", severity: "warning", actor: "A. Patel", note: "Data reload" },
  { date: "2026-04-01", title: "Quarterly LRP refresh proposal", status: "Accepted", severity: "info", actor: "J. Chen", note: "Version v2 created" },
  { date: "2026-04-12", title: "Cutoff transition", status: "Aligned", severity: "info", actor: "System", note: "No action" },
  { date: "2026-04-20", title: "Current period monitoring", status: "Watching", severity: "info", actor: "Brand Ops", note: "Continue monitoring" },
];

export function ReconciliationLog() {
  return (
    <div>
      <SectionHeader
        title="Reconciliation Event Log"
        subtitle="Chronological feed of past reconciliation events."
        right={
          <Link href="/forecast/plan/" className="btn-secondary flex items-center gap-1">
            <Sparkles size={14} /> View Plan Mode →
          </Link>
        }
      />
      <div className="card">
        <ul className="space-y-3">
          {HISTORY.map((h) => (
            <li key={h.date + h.title} className="border-b border-border last:border-0 pb-3 last:pb-0">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="flex gap-2 items-center mb-1">
                    <span className="font-mono text-xs text-muted">{h.date}</span>
                    <span className={"pill " + (h.severity === "warning" ? "bg-warning/15 text-warning" : "bg-info/15 text-info")}>
                      {h.status}
                    </span>
                  </div>
                  <div className="font-semibold">{h.title}</div>
                  <div className="text-xs text-muted mt-1">By {h.actor} · {h.note}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
