"use client";

import { LegacyRedirectBanner } from "@/components/forecast/LegacyRedirectBanner";

export default function LrpPage() {
  return <LegacyRedirectBanner target="/forecast/#lrp" label="Long-Range Plan" />;
}
