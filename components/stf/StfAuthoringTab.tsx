"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { SetupZone } from "@/components/stf/SetupZone";
import { BuildZone } from "@/components/stf/BuildZone";
import { ReviewZone } from "@/components/stf/ReviewZone";
import { AccountPerformanceView } from "@/components/stf/postloe/AccountPerformanceView";
import { SiteOfCareErosionView } from "@/components/stf/postloe/SiteOfCareErosionView";
import { BiosimilarDefenseView } from "@/components/stf/postloe/BiosimilarDefenseView";

type Zone =
  | "setup"
  | "build"
  | "review"
  | "account-performance"
  | "site-of-care"
  | "biosimilar";

export function StfAuthoringTab({ embeddedInWorkspace = false }: { embeddedInWorkspace?: boolean } = {}) {
  const forecast = useStore((s) => s.forecast);
  const mode = forecast.lifecycleContext?.mode ?? "exclusivity";
  const isPostLoe = mode === "post-loe";
  const [zone, setZone] = useState<Zone>(isPostLoe ? "account-performance" : "setup");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="font-heading text-h2 text-secondary">
            {isPostLoe ? "STF · Account-Based" : "Short Term Forecast"}
          </h1>
        </div>
        {!embeddedInWorkspace && (
          <Link href="/forecast/connect/" className="btn-secondary">Compare LRP vs STF →</Link>
        )}
      </div>
      <p className="text-xs text-muted">
        {forecast.brand} {forecast.geography} · Actuals Cutoff:{" "}
        <span className="font-mono">{forecast.stf.actualsCutoffDate}</span> · Latest Partial:{" "}
        <span className="font-mono">{forecast.stf.latestPartialDate}</span> · v{forecast.version}
      </p>

      <div className="flex items-center gap-2 mb-6 mt-4 border-b border-border flex-wrap">
        {isPostLoe ? (
          <>
            <ZTab active={zone === "account-performance"} onClick={() => setZone("account-performance")}>
              Account Performance
            </ZTab>
            <ZTab active={zone === "site-of-care"} onClick={() => setZone("site-of-care")}>
              Site-of-Care Erosion
            </ZTab>
            <ZTab active={zone === "biosimilar"} onClick={() => setZone("biosimilar")}>
              Biosimilar Defense
            </ZTab>
            <span className="px-2 text-[10px] text-muted">|</span>
            <span className="text-[10px] text-muted">Operational Inputs:</span>
            <ZTab active={zone === "setup"} onClick={() => setZone("setup")}>Setup</ZTab>
            <ZTab active={zone === "build"} onClick={() => setZone("build")}>Build</ZTab>
            <ZTab active={zone === "review"} onClick={() => setZone("review")}>Review</ZTab>
          </>
        ) : (
          <>
            <ZTab active={zone === "setup"} onClick={() => setZone("setup")}>Setup</ZTab>
            <ZTab active={zone === "build"} onClick={() => setZone("build")}>Build</ZTab>
            <ZTab active={zone === "review"} onClick={() => setZone("review")}>Review</ZTab>
          </>
        )}
      </div>

      {zone === "setup" && <SetupZone />}
      {zone === "build" && <BuildZone />}
      {zone === "review" && <ReviewZone />}
      {zone === "account-performance" && <AccountPerformanceView />}
      {zone === "site-of-care" && <SiteOfCareErosionView />}
      {zone === "biosimilar" && <BiosimilarDefenseView />}
    </div>
  );
}

function ZTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "px-5 py-2 text-sm font-semibold transition-colors -mb-px " +
        (active
          ? "text-secondary border-b-2 border-primary"
          : "text-muted hover:text-secondary border-b-2 border-transparent")
      }
    >
      {children}
    </button>
  );
}
