"use client";

import { LegacyRedirectBanner } from "@/components/forecast/LegacyRedirectBanner";

export default function ForecastConnectPage() {
  return <LegacyRedirectBanner target="/forecast/#reconcile" label="Connect" />;
}
