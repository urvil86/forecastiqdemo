"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LegacyRedirectBanner({ target, label }: { target: string; label: string }) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(3);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    const r = setTimeout(() => router.replace(target), 3000);
    return () => {
      clearInterval(t);
      clearTimeout(r);
    };
  }, [router, target]);

  return (
    <div className="card max-w-2xl mx-auto mt-12 border-l-4 border-primary">
      <h3 className="font-heading text-h3 text-secondary mb-1">This view has moved</h3>
      <p className="text-sm text-muted mb-3">
        The <strong>{label}</strong> page is now part of the unified <code>/forecast</code> workspace.
        You'll be redirected automatically in {seconds} second{seconds === 1 ? "" : "s"}.
      </p>
      <button className="btn-secondary text-xs" onClick={() => router.replace(target)}>
        Go now →
      </button>
    </div>
  );
}
