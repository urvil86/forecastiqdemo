"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { SetupZone } from "@/components/stf/SetupZone";
import { BuildZone } from "@/components/stf/BuildZone";
import { ReviewZone } from "@/components/stf/ReviewZone";

type Zone = "setup" | "build" | "review";

export default function StfPage() {
  const forecast = useStore((s) => s.forecast);
  const [zone, setZone] = useState<Zone>("setup");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="font-heading text-h2 text-secondary">Short Term Forecast</h1>
          <select
            value={forecast.brand}
            disabled
            className="input-cell !font-sans text-sm"
            title="Multi-brand selection available in production"
          >
            <option value="Ocrevus">Ocrevus</option>
          </select>
        </div>
        <Link href="/stf/connect" className="btn-secondary">Compare LRP vs STF →</Link>
      </div>
      <p className="text-xs text-muted">
        {forecast.brand} {forecast.geography} · Actuals Cutoff:{" "}
        <span className="font-mono">{forecast.stf.actualsCutoffDate}</span> · Latest Partial:{" "}
        <span className="font-mono">{forecast.stf.latestPartialDate}</span> · v{forecast.version} · {forecast.versionLabel}
      </p>

      <div className="flex items-center gap-2 mb-6 mt-4 border-b border-border">
        <TabButton active={zone === "setup"} onClick={() => setZone("setup")}>Setup</TabButton>
        <TabButton active={zone === "build"} onClick={() => setZone("build")}>Build</TabButton>
        <TabButton active={zone === "review"} onClick={() => setZone("review")}>Review</TabButton>
        <Link href="/stf/connect" className="ml-auto px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-light/40">
          Compare LRP vs STF →
        </Link>
      </div>

      {zone === "setup" && <SetupZone />}
      {zone === "build" && <BuildZone />}
      {zone === "review" && <ReviewZone />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "px-5 py-2 text-sm font-semibold transition-colors -mb-px " +
        (active ? "text-secondary border-b-2 border-primary" : "text-muted hover:text-secondary border-b-2 border-transparent")
      }
    >
      {children}
    </button>
  );
}
