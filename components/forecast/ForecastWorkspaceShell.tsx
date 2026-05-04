"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Link2, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { DEMO_USERS, getBrandConfig } from "@/lib/engine";
import type { BrandKey, DemoUser } from "@/lib/engine";
import { aggregateStatusDot } from "@/lib/systems";
import { SystemConnectDialog } from "./SystemConnectDialog";
import { UploadPreviewPanel } from "./UploadPreviewPanel";

interface TabDef {
  id: string;
  label: string;
  href: string;
}

const TABS: TabDef[] = [
  { id: "forecast", label: "Forecast", href: "/forecast/" },
  { id: "opportunities", label: "Opportunities", href: "/forecast/opportunities/" },
  { id: "plan", label: "Plan", href: "/forecast/plan/" },
];

const BRANDS: { key: BrandKey; label: string }[] = [
  { key: "Ocrevus", label: "Ocrevus" },
  { key: "Zunovo", label: "Zunovo" },
  { key: "Fenebrutinib", label: "Fenebrutinib" },
];

export function ForecastWorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const forecast = useStore((s) => s.forecast);
  const setBrand = useStore((s) => s.setBrand);
  const currentDemoUser = useStore((s) => s.currentDemoUser);
  const setDemoUser = useStore((s) => s.setDemoUser);
  const saveVersion = useStore((s) => s.saveVersion);
  const connectedSystems = useStore((s) => s.connectedSystems);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const brandConfig = useMemo(
    () => getBrandConfig(forecast.brand as BrandKey),
    [forecast.brand],
  );

  const activeTabId = useMemo(() => {
    const norm = (s: string) => (s.endsWith("/") ? s.slice(0, -1) : s);
    const cur = norm(pathname ?? "");
    if (cur === norm("/forecast")) return "forecast";
    const found = TABS.find(
      (t) => t.id !== "forecast" && cur.startsWith(norm(t.href)),
    );
    return found?.id ?? "forecast";
  }, [pathname]);

  function switchBrand(brand: BrandKey) {
    if (brand === forecast.brand) return;
    setBrand(brand);
    // Land on Forecast tab when brand switches
    if (activeTabId !== "forecast") {
      router.push("/forecast/");
    }
  }

  function pickUser(u: DemoUser) {
    setDemoUser(u);
    setUserMenuOpen(false);
  }

  const dotColor = useMemo(
    () => aggregateStatusDot(connectedSystems),
    [connectedSystems],
  );
  const dotBg =
    dotColor === "green"
      ? "bg-emerald-500"
      : dotColor === "amber"
      ? "bg-amber-500"
      : dotColor === "red"
      ? "bg-red-500"
      : "bg-gray-400";

  function handleFilePick(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadOpen(true);
    // Reset so picking the same file again still triggers the panel
    ev.target.value = "";
  }

  return (
    <div className="flex flex-col">
      {/* Top strip */}
      <div className="sticky top-16 z-20 bg-surface border-b border-border h-16 flex items-center px-6 gap-4 flex-wrap">
        {/* Brand selector */}
        <div className="flex items-center gap-3 min-w-0">
          <select
            value={forecast.brand}
            onChange={(e) => switchBrand(e.target.value as BrandKey)}
            className="input-cell !font-sans text-sm"
            title="Active brand"
          >
            {BRANDS.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        {/* Demo user dropdown — right of geography */}
        <div className="relative ml-auto flex items-center gap-3">
          <div className="flex flex-col items-end">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2"
              title="Demo user (active for attribution)"
            >
              <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                {currentDemoUser.initials}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-xs font-semibold leading-tight text-secondary">
                  {currentDemoUser.name}
                </div>
                <div className="text-[10px] text-muted leading-tight">Demo</div>
              </div>
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-12 z-30 bg-surface border border-border rounded shadow-lg w-64 py-1">
                {DEMO_USERS.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => pickUser(u)}
                    className={
                      "w-full flex items-center gap-3 px-3 py-2 hover:bg-background text-left " +
                      (u.id === currentDemoUser.id ? "bg-background" : "")
                    }
                  >
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold">
                      {u.initials}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-secondary">{u.name}</div>
                      <div className="text-[10px] text-muted">{u.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="btn-ghost text-xs"
            onClick={() => saveVersion(`Saved ${new Date().toLocaleString()}`)}
          >
            Save Version
          </button>

          {/* System Connect */}
          <button
            className="btn-ghost text-xs flex items-center gap-1.5 relative"
            onClick={() => setConnectDialogOpen(true)}
            title="Connect to existing systems"
          >
            <Link2 size={14} />
            <span className="hidden lg:inline">Connect</span>
            <span
              className={`w-2 h-2 rounded-full ${dotBg}`}
              aria-label={`Connection status: ${dotColor}`}
            />
          </button>

          {/* Excel Upload */}
          <label
            className="btn-ghost text-xs flex items-center gap-1.5 cursor-pointer"
            title="Upload Excel forecast template"
          >
            <Upload size={14} />
            <span className="hidden lg:inline">Upload</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFilePick}
            />
          </label>

          <button
            className="btn-secondary text-xs"
            disabled={!brandConfig.stfActive}
            title={
              brandConfig.stfActive
                ? "Push to TM1"
                : "STF not yet active for this brand — TM1 push disabled"
            }
          >
            Push to TM1
          </button>
        </div>
      </div>

      <SystemConnectDialog
        open={connectDialogOpen}
        onClose={() => setConnectDialogOpen(false)}
      />
      <UploadPreviewPanel
        open={uploadOpen}
        file={uploadFile}
        onClose={() => {
          setUploadOpen(false);
          setUploadFile(null);
        }}
      />

      {/* Tab bar — three tabs only, constant across brands */}
      <div className="sticky top-32 z-10 bg-background border-b border-border h-12 flex items-center px-6">
        <nav className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => (
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

      {/* Body */}
      <div className="flex-1">
        <div>{children}</div>
      </div>
    </div>
  );
}

// Click-outside hook for the user menu (best-effort, no portal)
if (typeof window !== "undefined") {
  document.addEventListener("click", (ev) => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    const root = target.closest("button, .absolute");
    if (!root) {
      // No-op; we rely on toggle for now. A full popover could use a portal.
    }
  });
}
