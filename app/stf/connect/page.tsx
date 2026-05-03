"use client";

import { LegacyRedirectBanner } from "@/components/forecast/LegacyRedirectBanner";

export default function ConnectPage() {
  return <LegacyRedirectBanner target="/forecast/connect/" label="Compare LRP vs STF" />;
}
