"use client";

import { LegacyRedirectBanner } from "@/components/forecast/LegacyRedirectBanner";

export default function ForecastLaunchReadinessPage() {
  return <LegacyRedirectBanner target="/forecast/" label="Launch Readiness" />;
}
