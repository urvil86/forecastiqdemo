"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { ChryselysLogo } from "./ChryselysLogo";
import { Settings, RotateCcw, Keyboard, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AIAgent, AIAgentToggle } from "./AIAgent";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const forecast = useStore((s) => s.forecast);
  const resetToSeed = useStore((s) => s.resetToSeed);
  const demoMode = useStore((s) => s.demoMode);
  const setDemoMode = useStore((s) => s.setDemoMode);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);

  // Restore sidebar preference from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("forecastiq-sidebar-hidden");
      if (saved === "1") setSidebarHidden(true);
    }
  }, []);

  function toggleSidebar() {
    const next = !sidebarHidden;
    setSidebarHidden(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("forecastiq-sidebar-hidden", next ? "1" : "0");
    }
  }

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === "1") {
        e.preventDefault();
        router.push("/forecast/");
      } else if (e.key === "2") {
        e.preventDefault();
        router.push("/forecast/views/");
      } else if (e.key === "3") {
        e.preventDefault();
        router.push("/forecast/reconcile/");
      } else if (e.key === "4") {
        e.preventDefault();
        router.push("/forecast/plan/");
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        setConfirmReset(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 h-16 bg-secondary text-white flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            title={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
            className="text-white/80 hover:text-white"
          >
            {sidebarHidden ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <Link href="/forecast/" className="flex items-center gap-3">
            <ChryselysLogo size={36} />
            <div className="font-heading font-black tracking-wide text-lg">
              Forecast<span className="text-primary">IQ</span>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/70 hidden md:inline">{forecast.brand} {forecast.geography}</span>
          <span className="font-semibold">{forecast.versionLabel}</span>
          <span className="pill bg-primary/20 text-primary">v{forecast.version}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setConfirmReset(true)}
            title="Reset Demo (Cmd+R)"
            className="text-white/80 hover:text-white"
          >
            <RotateCcw size={18} />
          </button>
          <button onClick={() => setShowShortcuts((v) => !v)} title="Keyboard shortcuts" className="text-white/80 hover:text-white">
            <Keyboard size={18} />
          </button>
          <Settings size={18} className="text-white/60" />
          <div
            className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center text-xs font-bold"
            title="Forecaster"
          >
            FC
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {!sidebarHidden && (
        <aside className="w-64 bg-secondary text-white text-sm flex-shrink-0 sticky top-16 self-start h-[calc(100vh-4rem)] overflow-y-auto">
          <nav className="py-4">
            <SectionHeader>Workspace</SectionHeader>
            <NavItem
              href="/forecast/"
              active={
                (pathname === "/forecast" || pathname === "/forecast/") ||
                (pathname?.startsWith("/forecast/") &&
                  !pathname?.startsWith("/forecast/opportunities") &&
                  !pathname?.startsWith("/forecast/plan"))
                  ? true
                  : false
              }
              label="Forecast"
            />
            <NavItem href="/forecast/opportunities/" active={pathname?.startsWith("/forecast/opportunities") ?? false} label="Opportunities" />
            <NavItem href="/forecast/plan/" active={pathname?.startsWith("/forecast/plan") ?? false} label="Plan ★" highlight />

            <div className="mt-8" />
            <SectionHeader>Forecast Workflow</SectionHeader>
            <NavItem href="/forecast/" active={pathname === "/forecast" || pathname === "/forecast/" || pathname?.startsWith("/forecast/input") ? true : false} label="↳ Input" />
            <NavItem href="/forecast/views/" active={pathname?.startsWith("/forecast/views") ?? false} label="↳ Views" />
            <NavItem href="/forecast/reconcile/" active={pathname?.startsWith("/forecast/reconcile") ?? false} label="↳ Reconcile" />

            <div className="mt-8" />
            <SectionHeader>Tools</SectionHeader>
            <NavItem href="/forecast/calc-modules/" active={pathname?.startsWith("/forecast/calc-modules") ?? false} label="Calculation Modules" />

            <div className="mt-8" />
            <SectionHeader>Demo Helpers</SectionHeader>
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full text-left px-4 py-2 hover:bg-secondary-light text-white/70"
            >
              Reset to seed data
            </button>
            <label className="flex items-center px-4 py-2 text-white/70 cursor-pointer">
              <input
                type="checkbox"
                checked={demoMode}
                onChange={(e) => setDemoMode(e.target.checked)}
                className="mr-2 accent-primary"
              />
              Demo Mode
            </label>
          </nav>
        </aside>
        )}
        <main className="flex-1 bg-background min-w-0">{children}</main>
        <AIAgent />
      </div>
      <AIAgentToggle />

      {demoMode && (
        <div className="fixed bottom-4 right-4 pill bg-primary/20 text-primary z-30 pointer-events-none">DEMO</div>
      )}

      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="card max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-h3 mb-4">Keyboard Shortcuts</h3>
            <ul className="space-y-2 text-sm">
              <Shortcut keys="⌘ / Ctrl + 1" label="Forecast · Input" />
              <Shortcut keys="⌘ / Ctrl + 2" label="Forecast · Views" />
              <Shortcut keys="⌘ / Ctrl + 3" label="Forecast · Reconcile" />
              <Shortcut keys="⌘ / Ctrl + 4" label="Plan" />
              <Shortcut keys="⌘ / Ctrl + R" label="Reset Demo" />
            </ul>
            <div className="mt-4 text-right">
              <button className="btn-ghost" onClick={() => setShowShortcuts(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {confirmReset && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onClick={() => setConfirmReset(false)}>
          <div className="card max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-h3 mb-2">Reset Demo?</h3>
            <p className="text-sm text-muted mb-4">
              All edits and saved versions will be discarded. The seed forecast will be reloaded.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button
                className="btn-secondary"
                onClick={() => {
                  resetToSeed();
                  setConfirmReset(false);
                  router.push("/forecast/");
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="text-white/50 caption px-4 py-2">{children}</div>;
}

function NavItem({ href, label, active, highlight }: { href: string; label: string; active: boolean; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "block px-4 py-3 transition-colors relative",
        active ? "bg-secondary-light" : "hover:bg-secondary-light/60",
      ].join(" ")}
    >
      {active && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />}
      <span className={highlight ? "text-primary" : ""}>{label}</span>
    </Link>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <li className="flex justify-between">
      <span className="text-muted">{label}</span>
      <kbd className="px-2 py-1 bg-background rounded border border-border font-mono text-xs">{keys}</kbd>
    </li>
  );
}
