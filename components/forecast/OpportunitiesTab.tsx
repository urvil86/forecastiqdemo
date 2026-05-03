"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { formatUsdShort } from "@/lib/format";

const STATIC_CARDS = [
  {
    title: "Site-of-care optimization",
    impact: 18.5e6,
    description:
      "Migrating Top-50 IDN volume to community infusion suites would reduce cost-of-care friction and capture 4% incremental volume retention through year 3.",
    cta: "Open in Plan Mode",
  },
  {
    title: "DTC awareness lift on SC reformulation",
    impact: 32.8e6,
    description:
      "Industry SC-conversion analogs show $1 of DTC at this stage returns ~$3.20 in NBRx lift, with 8-12 week payback.",
    cta: "Run $10M scenario",
  },
  {
    title: "Hub enrollment friction reduction",
    impact: 11.4e6,
    description:
      "Patient services investment closes the IV-to-SC enrollment gap; observed 14% conversion improvement in matched analog cohorts.",
    cta: "Show calculation",
  },
];

export function OpportunitiesTab() {
  const computed = useStore((s) => s.computed);
  const baseline =
    computed?.annual.find((a) => a.year === new Date().getUTCFullYear() + 1)?.netSales ?? 0;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-heading text-h2 text-secondary">Investment Opportunities</h1>
        <p className="text-sm text-muted mt-1">
          Forecast-aware opportunities ranked by expected mid-impact. Each card links to Plan Mode
          with the relevant lever pre-selected.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {STATIC_CARDS.map((c) => (
          <div key={c.title} className="card border-l-4 border-primary">
            <div className="text-[10px] uppercase text-muted">Expected revenue lift</div>
            <div className="text-h2 text-primary font-bold mb-2">{formatUsdShort(c.impact)}</div>
            <h3 className="font-heading text-h3 text-secondary mb-2">{c.title}</h3>
            <p className="text-sm text-muted mb-4">{c.description}</p>
            <Link href="/forecast/plan" className="btn-secondary text-xs">
              {c.cta}
            </Link>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted">
        Baseline next-year net sales: {formatUsdShort(baseline)}
      </p>
    </div>
  );
}
