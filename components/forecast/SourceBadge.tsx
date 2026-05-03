"use client";

import type { DataSourceTag } from "@/lib/engine";

interface SourceBadgeProps {
  source: DataSourceTag;
  detail?: string;
  inline?: boolean;
}

const STYLES: Record<DataSourceTag, { dot: string; label: string }> = {
  "auto-pipelined": { dot: "bg-info", label: "Auto-Pipelined" },
  manual: { dot: "bg-muted", label: "Manual" },
  "analog-derived": { dot: "bg-warning", label: "Analog-Derived" },
  override: { dot: "bg-danger", label: "Override" },
  derived: { dot: "bg-secondary/60", label: "Derived" },
};

export function SourceBadge({ source, detail, inline }: SourceBadgeProps) {
  const style = STYLES[source];
  return (
    <span
      className={
        "group relative inline-flex items-center gap-1 " +
        (inline ? "" : "absolute top-1 right-1 z-10")
      }
      title={detail ?? style.label}
    >
      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      {inline && (
        <span className="text-[10px] uppercase text-muted">{style.label}</span>
      )}
      {detail && (
        <span className="hidden group-hover:block absolute z-50 left-3 top-3 bg-secondary text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
          {detail}
        </span>
      )}
    </span>
  );
}
