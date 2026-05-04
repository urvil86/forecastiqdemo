"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { ReconcileSection } from "@/components/forecast/ReconcileSection";
import { VersionLog } from "@/components/forecast/VersionLog";
import { getBrandConfig } from "@/lib/engine";
import type { BrandKey } from "@/lib/engine";

export default function ForecastReconcilePage() {
  const forecast = useStore((s) => s.forecast);
  const createSnapshot = useStore((s) => s.createSnapshot);
  const brandConfig = useMemo(
    () => getBrandConfig(forecast.brand as BrandKey),
    [forecast.brand],
  );
  const stage = forecast.lifecycleStage ?? brandConfig.defaultStage;

  if (stage === "pre-launch") {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="card border-l-4 border-primary">
          <h2 className="font-heading text-h3 text-secondary mb-2">
            Reconciliation activates at launch
          </h2>
          <p className="text-sm text-muted mb-3">
            Currently no STF actuals available for {forecast.brand} (stage:
            Pre-launch). Snapshots can still be saved as planned checkpoints.
          </p>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary text-xs"
              onClick={() =>
                createSnapshot({
                  triggerType: "manual-save",
                  triggerReason: "planned-checkpoint",
                })
              }
            >
              Save manual snapshot
            </button>
            <Link href="/forecast/" className="btn-ghost text-xs">
              Back to Input
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <VersionLog />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <ReconcileSection />
    </div>
  );
}
