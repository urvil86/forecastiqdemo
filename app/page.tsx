"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Static export can't do server-side redirect(), so this is a client-side
// redirect that fires immediately on mount.
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/forecast");
  }, [router]);
  return null;
}
