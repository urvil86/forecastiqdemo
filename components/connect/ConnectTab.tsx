"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { ForecastStackView } from "@/components/connect/ForecastStackView";
import { VarianceMonitor } from "@/components/connect/VarianceMonitor";
import { SeekToForecast } from "@/components/connect/SeekToForecast";
import { SourceOfTruthMap } from "@/components/connect/SourceOfTruthMap";
import { ReconciliationLog } from "@/components/connect/ReconciliationLog";
import { ReverseCascadeCard } from "@/components/connect/ReverseCascadeCard";

export function ConnectTab() {
  const forecast = useStore((s) => s.forecast);
  const mode = forecast.lifecycleContext?.mode ?? "exclusivity";
  const isPreLaunch = mode === "pre-launch";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr]">
      <aside className="hidden lg:block sticky top-44 self-start h-[calc(100vh-12rem)] p-4 border-r border-border bg-surface">
        <ul className="space-y-1 text-sm">
          {[
            { id: "stack", label: "1. Forecast Stack" },
            ...(isPreLaunch ? [] : [{ id: "variance", label: "2. LRP vs STF Variance" }]),
            { id: "seek", label: "3. Seek-to-Forecast ★" },
            ...(isPreLaunch ? [] : [{ id: "reverse", label: "4. Reverse Cascade ★" }]),
            { id: "source", label: "5. Source-of-Truth" },
            ...(isPreLaunch ? [] : [{ id: "log", label: "6. Reconciliation Log" }]),
          ].map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block px-3 py-2 rounded hover:bg-primary-light/40 text-foreground"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </aside>

      <div className="p-8 space-y-12">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-h2 text-secondary">Connect</h1>
            <p className="text-sm text-muted mt-1">
              See where the long-range plan and the short-term forecast agree, where they diverge,
              and what to do about it · {forecast.brand} {forecast.geography} · v{forecast.version}
            </p>
          </div>
          <Link href="/forecast/source-map/" className="btn-secondary text-xs">
            Open Authoring Source Map →
          </Link>
        </div>

        <section id="stack">
          <ForecastStackView />
        </section>
        {!isPreLaunch && (
          <section id="variance">
            <VarianceMonitor />
          </section>
        )}
        <section id="seek">
          <SeekToForecast />
        </section>
        {!isPreLaunch && (
          <section id="reverse">
            <ReverseCascadeCard />
          </section>
        )}
        <section id="source">
          <SourceOfTruthMap />
        </section>
        {!isPreLaunch && (
          <section id="log">
            <ReconciliationLog />
          </section>
        )}
      </div>
    </div>
  );
}
