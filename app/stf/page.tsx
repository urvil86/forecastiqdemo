"use client";

import { LegacyRedirectBanner } from "@/components/forecast/LegacyRedirectBanner";

export default function StfPage() {
  return <LegacyRedirectBanner target="/forecast/stf/" label="Short-Term Forecast" />;
}
