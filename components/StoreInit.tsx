"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

export function StoreInit() {
  const recompute = useStore((s) => s.recompute);
  const seedDemoVersionsIfEmpty = useStore((s) => s.seedDemoVersionsIfEmpty);
  const computed = useStore((s) => s.computed);
  useEffect(() => {
    if (!computed) recompute();
    seedDemoVersionsIfEmpty();
  }, [computed, recompute, seedDemoVersionsIfEmpty]);
  return null;
}
