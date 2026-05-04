"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { getBrandConfig } from "@/lib/engine";
import type { BrandKey } from "@/lib/engine";

const SUBTABS = [
  { id: "input", label: "Input", href: "/forecast/" },
  { id: "views", label: "Views", href: "/forecast/views/" },
  { id: "reconcile", label: "Reconcile", href: "/forecast/reconcile/" },
] as const;

export function ForecastSubTabBar() {
  const pathname = usePathname();
  const forecast = useStore((s) => s.forecast);
  const varianceStatus = useStore((s) => s.varianceStatus);
  const computed = useStore((s) => s.computed);
  const threshold = useStore((s) => s.threshold);

  const brandConfig = getBrandConfig(forecast.brand as BrandKey);
  const stage = forecast.lifecycleStage ?? brandConfig.defaultStage;
  const draft = forecast.draftStatus ?? "draft";

  const variance = useMemo(() => varianceStatus(), [
    varianceStatus,
    computed,
    threshold,
  ]);

  const activeId = useMemo(() => {
    const norm = (s: string) => (s.endsWith("/") ? s.slice(0, -1) : s);
    const cur = norm(pathname ?? "");
    if (cur.endsWith("/forecast/views")) return "views";
    if (cur.endsWith("/forecast/reconcile")) return "reconcile";
    if (cur.endsWith("/forecast")) return "input";
    // /forecast/input or any sub-path
    if (cur.includes("/forecast/input")) return "input";
    return "input";
  }, [pathname]);

  function statusIndicator(id: (typeof SUBTABS)[number]["id"]): React.ReactNode {
    if (id === "input") {
      const tone =
        draft === "draft"
          ? "bg-gray-500/10 text-gray-700 border-gray-500/30"
          : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
      return (
        <span className={`pill text-[9px] border ${tone}`}>
          {draft === "draft" ? "Draft" : "Submitted"}
        </span>
      );
    }
    if (id === "views") {
      if (draft === "submitted") return null;
      return (
        <span className="pill text-[9px] bg-gray-500/10 text-gray-600 border border-gray-500/30">
          Submit forecast to view
        </span>
      );
    }
    // reconcile
    if (stage === "pre-launch") {
      return (
        <span className="pill text-[9px] bg-gray-500/10 text-gray-600 border border-gray-500/30">
          Activates at launch
        </span>
      );
    }
    const tone =
      variance.status === "aligned"
        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
        : variance.status === "watching"
        ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
        : "bg-red-500/10 text-red-700 border-red-500/30";
    const label =
      variance.status === "aligned"
        ? "Aligned"
        : variance.status === "watching"
        ? "Watching"
        : "Drift";
    return <span className={`pill text-[9px] border ${tone}`}>{label}</span>;
  }

  return (
    <div className="sticky top-32 z-10 bg-background border-b border-border h-12 flex items-center px-6">
      <nav className="flex items-center gap-1 overflow-x-auto">
        {SUBTABS.map((t) => {
          const isActive = t.id === activeId;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={
                "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold transition-colors -mb-px border-b-2 " +
                (isActive
                  ? "text-secondary border-primary"
                  : "text-muted hover:text-secondary border-transparent")
              }
            >
              <span>{t.label}</span>
              {statusIndicator(t.id)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
