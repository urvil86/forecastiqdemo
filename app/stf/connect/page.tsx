"use client";

import { LegacyRedirectBanner } from "@/components/forecast/LegacyRedirectBanner";

export default function ConnectPage() {
  return <LegacyRedirectBanner target="/forecast/#reconcile" label="Compare LRP vs STF" />;
}
