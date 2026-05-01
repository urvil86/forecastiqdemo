"use client";

import { TrendSelectionCard } from "@/components/lrp/TrendSelectionCard";

export function TrendSelectionView() {
  return (
    <div className="space-y-6">
      <TrendSelectionCard chartGrain="stf" />
      <div className="card">
        <h4 className="font-heading text-h4 text-secondary mb-2">Trend Validator</h4>
        <p className="text-sm text-muted">
          Quick Expert ranks #1 of 6 by RMSE. Confidence: <span className="pill-success">HIGH</span>
        </p>
      </div>
    </div>
  );
}
