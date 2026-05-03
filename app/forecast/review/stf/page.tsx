"use client";

import { useStore } from "@/lib/store";
import { ReviewZone } from "@/components/stf/ReviewZone";

export default function ForecastReviewStfPage() {
  const forecast = useStore((s) => s.forecast);
  return (
    <div className="p-8">
      <div className="mb-4">
        <h1 className="font-heading text-h2 text-secondary">STF Review</h1>
        <p className="text-xs text-muted">
          {forecast.brand} {forecast.geography} · v{forecast.version}
        </p>
      </div>
      <ReviewZone />
    </div>
  );
}
