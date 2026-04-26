"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { ForecastStackView } from "@/components/connect/ForecastStackView";
import { VarianceMonitor } from "@/components/connect/VarianceMonitor";
import { SeekToForecast } from "@/components/connect/SeekToForecast";
import { SourceOfTruthMap } from "@/components/connect/SourceOfTruthMap";
import { ReconciliationLog } from "@/components/connect/ReconciliationLog";

export default function ConnectPage() {
  const forecast = useStore((s) => s.forecast);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr]">
      <aside className="hidden lg:block sticky top-16 self-start h-[calc(100vh-4rem)] p-4 border-r border-border bg-surface">
        <ul className="space-y-1 text-sm">
          {[
            { id: "stack", label: "1. Forecast Stack" },
            { id: "variance", label: "2. LRP vs STF Variance" },
            { id: "seek", label: "3. Seek-to-Forecast ★" },
            { id: "source", label: "4. Source-of-Truth" },
            { id: "log", label: "5. Reconciliation Log" },
          ].map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block px-3 py-2 rounded hover:bg-primary-light/40 text-foreground">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </aside>

      <div className="p-8 space-y-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-h2 text-secondary">Compare LRP vs STF</h1>
            <p className="text-sm text-muted mt-1">
              See where the long-range plan and the short-term forecast agree, where they diverge, and what to do about it ·{" "}
              {forecast.brand} {forecast.geography} · v{forecast.version} · {forecast.versionLabel}
            </p>
          </div>
          <Link href="/stf" className="btn-ghost">← Back to STF Build</Link>
        </div>

        <section id="stack">
          <ForecastStackView />
        </section>
        <section id="variance">
          <VarianceMonitor />
        </section>
        <section id="seek">
          <SeekToForecast />
        </section>
        <section id="source">
          <SourceOfTruthMap />
        </section>
        <section id="log">
          <ReconciliationLog />
        </section>
      </div>
    </div>
  );
}
