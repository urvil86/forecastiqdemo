"use client";

import { LegacyRedirectBanner } from "@/components/forecast/LegacyRedirectBanner";

export default function StfPage() {
  return <LegacyRedirectBanner target="/forecast/" label="Short-Term Forecast" />;
}
