"use client";

import { useMemo } from "react";
import { useStore } from "./store";

export interface ForecastWindow {
  cutoff: string;
  partial: string;
  horizonWeeks: number;
  historyWeeks: number;
  granularity: "weekly" | "daily";
  windowStart: string;
  windowEnd: string;
}

export function useForecastWindow(): ForecastWindow {
  const cutoff = useStore((s) => s.forecast.stf.actualsCutoffDate);
  const partial = useStore((s) => s.forecast.stf.latestPartialDate);
  const horizonWeeks = useStore((s) => s.forecast.stf.horizonWeeks);
  const historyWeeks = useStore((s) => s.forecast.stf.historyWeeksShown);
  const granularity = useStore((s) => s.forecast.stf.granularity);

  return useMemo(() => {
    const cutoffDate = new Date(cutoff);
    const start = new Date(cutoffDate.getTime());
    start.setUTCDate(start.getUTCDate() - historyWeeks * 7);
    const end = new Date(cutoffDate.getTime());
    end.setUTCDate(end.getUTCDate() + horizonWeeks * 7);
    return {
      cutoff,
      partial,
      horizonWeeks,
      historyWeeks,
      granularity,
      windowStart: start.toISOString().slice(0, 10),
      windowEnd: end.toISOString().slice(0, 10),
    };
  }, [cutoff, partial, horizonWeeks, historyWeeks, granularity]);
}
