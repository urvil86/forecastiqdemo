"use client";

import { LegacyRedirectBanner } from "@/components/forecast/LegacyRedirectBanner";

export default function ForecastLaunchReadinessPage() {
  return <LegacyRedirectBanner target="/forecast/#lrp" label="Launch Readiness" />;
}
