"use client";

import { LegacyRedirectBanner } from "@/components/forecast/LegacyRedirectBanner";

export default function ForecastLrpPage() {
  return <LegacyRedirectBanner target="/forecast/#lrp" label="LRP" />;
}
