"use client";

import Link from "next/link";

export function PostLoeDerivativeBanner() {
  return (
    <div className="card mt-4 border-l-4 border-warning bg-warning/5">
      <h3 className="font-heading text-h3 text-secondary mb-1">
        LRP is derivative in Post-LoE mode
      </h3>
      <p className="text-sm text-muted">
        These annual numbers are rolled up from the account-based STF.{" "}
        <Link href="/forecast/stf" className="text-primary hover:underline font-semibold">
          Edit account forecasts in the STF tab →
        </Link>{" "}
        The LRP shown here is read-only and updates automatically.
      </p>
    </div>
  );
}
