"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

export function StoreInit() {
  const recompute = useStore((s) => s.recompute);
  const computed = useStore((s) => s.computed);
  useEffect(() => {
    if (!computed) recompute();
  }, [computed, recompute]);
  return null;
}
