"use client";

import { ReactNode } from "react";
import { ForecastWorkspaceShell } from "@/components/forecast/ForecastWorkspaceShell";

export default function ForecastLayout({ children }: { children: ReactNode }) {
  return <ForecastWorkspaceShell>{children}</ForecastWorkspaceShell>;
}
