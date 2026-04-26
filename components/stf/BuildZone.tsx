"use client";

import { useState } from "react";
import { TrendSelectionView } from "./build/TrendSelectionView";
import { NaiveOutsView } from "./build/NaiveOutsView";
import { HolidayAdjustmentsView } from "./build/HolidayAdjustmentsView";
import { EventsView } from "./build/EventsView";
import { SkuMixView } from "./build/SkuMixView";
import { NfsSamplesView } from "./build/NfsSamplesView";
import { InventoryDohView } from "./build/InventoryDohView";
import { PricingGtnView } from "./build/PricingGtnView";
import { NetRevenueView } from "./build/NetRevenueView";

const SUBVIEWS = [
  { id: "trend", label: "Trend Selection", priority: true },
  { id: "naive-outs", label: "Naive OUTs", priority: true },
  { id: "holiday", label: "Holiday Adjustments", priority: true },
  { id: "events", label: "Events" },
  { id: "sku-mix", label: "SKU Mix" },
  { id: "nfs", label: "NFS / Samples" },
  { id: "inventory", label: "Inventory & DOH", priority: true },
  { id: "pricing", label: "Pricing & GTN" },
  { id: "net-revenue", label: "Net Revenue Build-up", priority: true },
];

export function BuildZone() {
  const [active, setActive] = useState("naive-outs");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
      <aside className="bg-surface rounded-xl border border-border p-2 self-start sticky top-24 h-fit">
        <ul className="space-y-1">
          {SUBVIEWS.map((s, i) => (
            <li key={s.id}>
              <button
                className={
                  "w-full text-left px-3 py-2 rounded text-sm transition-colors " +
                  (active === s.id ? "bg-primary-light text-secondary font-semibold" : "hover:bg-background text-foreground")
                }
                onClick={() => setActive(s.id)}
              >
                <span className="text-muted mr-2 font-mono">{i + 1}.</span>
                {s.label}
                {s.priority && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle" />}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div>
        {active === "trend" && <TrendSelectionView />}
        {active === "naive-outs" && <NaiveOutsView />}
        {active === "holiday" && <HolidayAdjustmentsView />}
        {active === "events" && <EventsView />}
        {active === "sku-mix" && <SkuMixView />}
        {active === "nfs" && <NfsSamplesView />}
        {active === "inventory" && <InventoryDohView />}
        {active === "pricing" && <PricingGtnView />}
        {active === "net-revenue" && <NetRevenueView />}
      </div>
    </div>
  );
}
