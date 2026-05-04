"use client";

import { LegacyRedirectBanner } from "@/components/forecast/LegacyRedirectBanner";

export default function LrpPage() {
  return <LegacyRedirectBanner target="/forecast/" label="Long-Range Plan" />;
}
