"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import type { LifecycleMode, ForecastSeedKey } from "@/lib/engine";
import { ReconciliationStatusPanel } from "./ReconciliationStatusPanel";

const DEMO_SCENARIOS: { key: ForecastSeedKey; label: string; mode: LifecycleMode }[] = [
  { key: "fenebrutinib-prelaunch", label: "Fenebrutinib · Pre-launch", mode: "pre-launch" },
  { key: "zunovo-exclusivity", label: "Zunovo · Exclusivity", mode: "exclusivity" },
  { key: "ocrevus-postloe", label: "Ocrevus · Post-LoE", mode: "post-loe" },
];

interface TabDef {
  id: string;
  label: string;
  href: string;
}

function tabsForMode(mode: LifecycleMode): TabDef[] {
  if (mode === "pre-launch") {
    return [
      { id: "lrp", label: "LRP", href: "/forecast/lrp" },
      { id: "launch-readiness", label: "Launch Readiness", href: "/forecast/launch-readiness" },
      { id: "connect", label: "Connect", href: "/forecast/connect" },
      { id: "plan", label: "Plan", href: "/forecast/plan" },
      { id: "review", label: "Review", href: "/forecast/review/lrp" },
    ];
  }
  if (mode === "post-loe") {
    return [
      { id: "stf", label: "STF (Account-based)", href: "/forecast/stf" },
      { id: "lrp", label: "LRP (Derivative)", href: "/forecast/lrp" },
      { id: "connect", label: "Connect", href: "/forecast/connect" },
      { id: "opportunities", label: "Opportunities", href: "/forecast/opportunities" },
      { id: "plan", label: "Plan", href: "/forecast/plan" },
      { id: "review", label: "Review", href: "/forecast/review/stf" },
    ];
  }
  // exclusivity
  return [
    { id: "lrp", label: "LRP", href: "/forecast/lrp" },
    { id: "stf", label: "STF", href: "/forecast/stf" },
    { id: "connect", label: "Connect", href: "/forecast/connect" },
    { id: "opportunities", label: "Opportunities", href: "/forecast/opportunities" },
    { id: "plan", label: "Plan", href: "/forecast/plan" },
    { id: "review", label: "Review", href: "/forecast/review/lrp" },
  ];
}

export function ForecastWorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const forecast = useStore((s) => s.forecast);
  const activeSeedKey = useStore((s) => s.activeSeedKey);
  const setLifecycleMode = useStore((s) => s.setLifecycleMode);
  const loadSeed = useStore((s) => s.loadSeed);
  const demoMode = useStore((s) => s.demoMode);
  const setDemoMode = useStore((s) => s.setDemoMode);
  const saveVersion = useStore((s) => s.saveVersion);
  const [transitioning, setTransitioning] = useState(false);

  const mode = forecast.lifecycleContext?.mode ?? "exclusivity";
  const tabs = useMemo(() => tabsForMode(mode), [mode]);

  // Pick the active tab from the URL
  const activeTabId = useMemo(() => {
    const found = tabs.find((t) => pathname?.startsWith(t.href));
    return found?.id ?? tabs[0]?.id;
  }, [pathname, tabs]);

  function switchMode(nextMode: LifecycleMode) {
    if (nextMode === mode) return;
    setTransitioning(true);
    setLifecycleMode(nextMode);
    // Land on default tab for new mode
    const defaults: Record<LifecycleMode, string> = {
      "pre-launch": "/forecast/lrp",
      exclusivity: "/forecast/stf",
      "post-loe": "/forecast/stf",
    };
    setTimeout(() => {
      router.push(defaults[nextMode]);
      setTimeout(() => setTransitioning(false), 300);
    }, 50);
  }

  function switchScenario(key: ForecastSeedKey) {
    if (key === activeSeedKey) return;
    setTransitioning(true);
    loadSeed(key);
    const found = DEMO_SCENARIOS.find((s) => s.key === key);
    const defaults: Record<LifecycleMode, string> = {
      "pre-launch": "/forecast/lrp",
      exclusivity: "/forecast/stf",
      "post-loe": "/forecast/stf",
    };
    setTimeout(() => {
      if (found) router.push(defaults[found.mode]);
      setTimeout(() => setTransitioning(false), 400);
    }, 60);
  }

  // Whenever route is just `/forecast`, push to the default tab for current mode
  useEffect(() => {
    if (pathname === "/forecast") {
      const defaults: Record<LifecycleMode, string> = {
        "pre-launch": "/forecast/lrp",
        exclusivity: "/forecast/stf",
        "post-loe": "/forecast/stf",
      };
      router.replace(defaults[mode]);
    }
  }, [pathname, mode, router]);

  return (
    <div className="flex flex-col">
      {/* Top strip */}
      <div className="sticky top-16 z-20 bg-surface border-b border-border h-16 flex items-center px-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {!demoMode && (
            <select
              value={activeSeedKey}
              onChange={(e) => switchScenario(e.target.value as ForecastSeedKey)}
              className="input-cell !font-sans text-sm"
              title="Active forecast"
            >
              <option value="ocrevus-exclusivity">Ocrevus · Exclusivity</option>
              <option value="zunovo-exclusivity">Zunovo · Exclusivity</option>
              <option value="fenebrutinib-prelaunch">Fenebrutinib · Pre-launch</option>
              <option value="ocrevus-postloe">Ocrevus · Post-LoE</option>
            </select>
          )}
          <span className="pill bg-secondary/10 text-secondary uppercase tracking-wider text-[10px]">
            {mode === "pre-launch" ? "Pre-launch" : mode === "post-loe" ? "Post-LoE" : "Exclusivity"}
          </span>
          <span className="text-xs text-muted hidden md:inline">
            {forecast.brand} · {forecast.geography}
          </span>
        </div>

        {/* Lifecycle pill bar */}
        <div className="flex items-center gap-1 mx-auto bg-background border border-border rounded-full p-1">
          {(["pre-launch", "exclusivity", "post-loe"] as LifecycleMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={
                "px-3 py-1 rounded-full text-xs font-semibold transition-colors " +
                (m === mode ? "bg-primary text-white" : "text-muted hover:text-secondary")
              }
            >
              {m === "pre-launch" ? "Pre-launch" : m === "post-loe" ? "Post-LoE" : "Exclusivity"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {demoMode ? (
            <select
              value={activeSeedKey}
              onChange={(e) => switchScenario(e.target.value as ForecastSeedKey)}
              className="input-cell !font-sans text-sm"
            >
              {DEMO_SCENARIOS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <>
              <button
                className="btn-ghost text-xs"
                onClick={() => saveVersion(`Saved ${new Date().toLocaleString()}`)}
              >
                Save Version
              </button>
              <button
                className="btn-secondary text-xs"
                disabled={mode === "pre-launch"}
                title={mode === "pre-launch" ? "No STF in Pre-launch — TM1 push disabled" : "Push to TM1"}
              >
                Push to TM1
              </button>
            </>
          )}
          <label className="flex items-center text-xs text-muted gap-1 ml-2">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
              className="accent-primary"
            />
            Demo
          </label>
        </div>
      </div>

      {/* Tab bar */}
      <div className="sticky top-32 z-10 bg-background border-b border-border h-12 flex items-center px-6">
        <nav className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              className={
                "px-4 py-2 text-sm font-semibold transition-colors -mb-px border-b-2 " +
                (t.id === activeTabId
                  ? "text-secondary border-primary"
                  : "text-muted hover:text-secondary border-transparent")
              }
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Body: 2-col when reconciliation panel visible (Exclusivity / Post-LoE) */}
      <div
        className={
          "flex-1 transition-opacity duration-300 " + (transitioning ? "opacity-0" : "opacity-100")
        }
      >
        {mode !== "pre-launch" ? (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px]">
            <div className="min-w-0">{children}</div>
            <aside className="hidden xl:block border-l border-border bg-surface min-h-[calc(100vh-12rem)]">
              <ReconciliationStatusPanel />
            </aside>
          </div>
        ) : (
          <div>{children}</div>
        )}
      </div>
    </div>
  );
}
