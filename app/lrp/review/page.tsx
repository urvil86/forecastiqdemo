"use client";

import { LegacyRedirectBanner } from "@/components/forecast/LegacyRedirectBanner";

export default function LrpReviewLegacyPage() {
  return <LegacyRedirectBanner target="/forecast/review/lrp" label="LRP Review" />;
}
