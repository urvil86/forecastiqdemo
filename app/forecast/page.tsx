"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function ForecastIndex() {
  const router = useRouter();
  const mode = useStore((s) => s.forecast.lifecycleContext?.mode ?? "exclusivity");
  useEffect(() => {
    const defaults = {
      "pre-launch": "/forecast/lrp",
      exclusivity: "/forecast/stf",
      "post-loe": "/forecast/stf",
    } as const;
    router.replace(defaults[mode]);
  }, [router, mode]);
  return null;
}
