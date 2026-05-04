"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ForecastWorkspaceShell } from "@/components/forecast/ForecastWorkspaceShell";
import { ForecastSubTabBar } from "@/components/forecast/ForecastSubTabBar";

export default function ForecastLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Show sub-tab bar only on the Forecast top-tab (Input / Views / Reconcile)
  // Hide on Opportunities / Plan (those are top-level tabs of their own)
  const isForecastSubPath =
    !!pathname &&
    !pathname.startsWith("/forecast/opportunities") &&
    !pathname.startsWith("/forecast/plan") &&
    !pathname.startsWith("/forecast/calc-modules") &&
    !pathname.startsWith("/forecast/source-map");

  return (
    <ForecastWorkspaceShell>
      {isForecastSubPath && <ForecastSubTabBar />}
      {children}
    </ForecastWorkspaceShell>
  );
}
