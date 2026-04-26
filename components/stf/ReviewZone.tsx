"use client";

import { PacingBurndown } from "./review/PacingBurndown";
import { DailyVarianceHeatmap } from "./review/DailyVarianceHeatmap";
import { AccountPerformanceBubble } from "./review/AccountPerformanceBubble";
import { ChannelInventoryFlow } from "./review/ChannelInventoryFlow";
import { SkuMixEvolution } from "./review/SkuMixEvolution";
import { SameWeekYoY } from "./review/SameWeekYoY";

const SECTIONS = [
  { id: "pacing", label: "1. Pacing Burndown" },
  { id: "heatmap", label: "2. Daily Variance Heatmap" },
  { id: "accounts", label: "3. Account Performance" },
  { id: "channel", label: "4. Channel Inventory Flow" },
  { id: "sku", label: "5. SKU Mix Evolution" },
  { id: "yoy", label: "6. Same-Week YoY" },
];

export function ReviewZone() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-4">
      <aside className="hidden lg:block sticky top-24 self-start">
        <div className="caption text-muted mb-2 px-2">Sections</div>
        <ul className="space-y-1 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block px-3 py-2 rounded hover:bg-primary-light/40 text-foreground">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </aside>
      <div className="space-y-12 min-w-0">
        <section id="pacing">
          <PacingBurndown />
        </section>
        <section id="heatmap">
          <DailyVarianceHeatmap />
        </section>
        <section id="accounts">
          <AccountPerformanceBubble />
        </section>
        <section id="channel">
          <ChannelInventoryFlow />
        </section>
        <section id="sku">
          <SkuMixEvolution />
        </section>
        <section id="yoy">
          <SameWeekYoY />
        </section>
      </div>
    </div>
  );
}
