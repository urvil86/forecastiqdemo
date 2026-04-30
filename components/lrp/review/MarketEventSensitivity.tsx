"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { compute, type ConnectedForecast } from "@/lib/engine";
import { SectionHeader } from "@/components/SectionHeader";
import { formatUsdShort, formatPct } from "@/lib/format";
import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";

interface EventDelta {
  id: string;
  name: string;
  type: "positive" | "negative";
  curveShape: "slow" | "moderate" | "fast";
  delta: number;
  positive: boolean;
}

const YEAR_OPTIONS = [2026, 2027, 2028, 2029, 2030, 2032, 2035];

export function MarketEventSensitivity() {
  const forecast = useStore((s) => s.forecast);
  const router = useRouter();
  const [year, setYear] = useState(2027);

  const result = useMemo(() => {
    // Baseline = compute with all events disabled
    const noEvents: ConnectedForecast = {
      ...forecast,
      lrp: {
        ...forecast.lrp,
        events: forecast.lrp.events.map((e) => ({ ...e, enabled: false })),
      },
    };
    const baselineNet = compute(noEvents).annual.find((a) => a.year === year)?.netSales ?? 0;

    // Cumulatively enable each event and measure marginal impact
    const enabledEvents = forecast.lrp.events.filter((e) => e.enabled);
    const deltas: EventDelta[] = [];
    let cur = noEvents;
    let running = baselineNet;
    for (const evt of enabledEvents) {
      cur = {
        ...cur,
        lrp: {
          ...cur.lrp,
          events: cur.lrp.events.map((e) => (e.id === evt.id ? { ...e, enabled: true } : e)),
        },
      };
      const v = compute(cur).annual.find((a) => a.year === year)?.netSales ?? running;
      deltas.push({
        id: evt.id,
        name: evt.name,
        type: evt.type,
        curveShape: evt.curveShape,
        delta: v - running,
        positive: v >= running,
      });
      running = v;
    }
    const finalNet = running;
    const netDrag = finalNet - baselineNet;
    return { baselineNet, finalNet, netDrag, deltas };
  }, [forecast, year]);

  const { baselineNet, finalNet, netDrag, deltas } = result;
  const negativeDrag = deltas.filter((d) => !d.positive).reduce((s, d) => s + d.delta, 0); // negative number
  const positiveLift = deltas.filter((d) => d.positive).reduce((s, d) => s + d.delta, 0);

  // Suggested investment to offset negative drag: industry-typical 5–8% of impact
  const suggestedBudget = Math.round(Math.abs(negativeDrag) * 0.06 / 1e6) * 1e6;
  const suggestedBudgetClamped = Math.max(5_000_000, Math.min(50_000_000, suggestedBudget));

  function openPromoMix() {
    const params = new URLSearchParams({
      budget: String(suggestedBudgetClamped),
      year: String(year),
      context: "offset-events",
    });
    router.push(`/growth?${params.toString()}`);
  }

  // Render scale: max bar width is bounded by the larger of baseline or finalNet
  const scale = Math.max(baselineNet, finalNet, 1);

  let runningTotal = baselineNet;

  return (
    <div>
      <SectionHeader
        title={`Market Event Sensitivity · ${year}`}
        subtitle="Per-event $ impact on the forecast. Each bar is the marginal contribution when that event is layered onto the cascade. Toggle events on /lrp authoring to test scenarios."
        right={
          <div className="flex items-center gap-2">
            <span className="caption text-muted">Year:</span>
            <select className="input-cell !font-sans" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        }
      />
      <div className="card">
        <div className="space-y-3">
          <WaterfallRow
            label={`Baseline ${year} (no events)`}
            value={baselineNet}
            type="anchor-baseline"
            widthPct={(baselineNet / scale) * 100}
          />
          {deltas.map((d) => {
            runningTotal += d.delta;
            const offsetStart = d.positive ? runningTotal - d.delta : runningTotal;
            return (
              <WaterfallRow
                key={d.id}
                label={d.name}
                badge={d.curveShape}
                value={d.delta}
                type={d.positive ? "positive" : "negative"}
                widthPct={(Math.abs(d.delta) / scale) * 100}
                offsetPct={(offsetStart / scale) * 100}
                runningTotal={runningTotal}
              />
            );
          })}
          <WaterfallRow
            label={`Forecast ${year} (with all events)`}
            value={finalNet}
            type="anchor-final"
            widthPct={(finalNet / scale) * 100}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-3 border-t border-border">
          <Stat label="Negative event drag" value={formatUsdShort(negativeDrag)} icon={<TrendingDown size={14} />} negative />
          <Stat label="Positive event lift" value={`+${formatUsdShort(positiveLift)}`} icon={<TrendingUp size={14} />} positive />
          <Stat
            label="Net effect on forecast"
            value={`${netDrag >= 0 ? "+" : ""}${formatUsdShort(netDrag)} (${formatPct(baselineNet === 0 ? 0 : netDrag / baselineNet)})`}
            negative={netDrag < 0}
            positive={netDrag >= 0}
          />
        </div>
      </div>

      <div className="card mt-4 border-2 border-primary bg-primary-light/40">
        <div className="flex items-start gap-3 flex-wrap">
          <Sparkles className="text-primary flex-shrink-0 mt-1" size={22} />
          <div className="flex-1 min-w-[280px]">
            <h4 className="font-heading text-h4 text-secondary">Address these headwinds with promo investment</h4>
            <p className="text-sm text-muted mt-1">
              {netDrag < 0 ? (
                <>
                  Net event drag of <strong className="text-danger">{formatUsdShort(netDrag)}</strong> in {year} could be partially
                  offset by targeted commercial-lever investment. Industry-typical benchmark: <strong>5–8%</strong> of impact in
                  promo mix yields meaningful offset.
                </>
              ) : (
                <>
                  Events are net-positive for {year}. Use Promo Mix Modeling to find investments that <em>compound</em> existing
                  tailwinds rather than offset headwinds.
                </>
              )}
            </p>
            <p className="text-xs text-muted mt-2">
              Suggested starting budget: <strong className="text-secondary font-mono">{formatUsdShort(suggestedBudgetClamped)}</strong>
              {" "}(the tool will let you tune this and explore alternative allocations).
            </p>
          </div>
          <button onClick={openPromoMix} className="btn-secondary flex items-center gap-2 self-center">
            <Sparkles size={14} /> Run Promo Mix Modeling →
          </button>
        </div>
      </div>
    </div>
  );
}

type RowType = "anchor-baseline" | "anchor-final" | "positive" | "negative";

function WaterfallRow({
  label,
  badge,
  value,
  type,
  widthPct,
  offsetPct,
  runningTotal,
}: {
  label: string;
  badge?: string;
  value: number;
  type: RowType;
  widthPct: number;
  offsetPct?: number;
  runningTotal?: number;
}) {
  const color =
    type === "anchor-baseline" ? "#004466"
    : type === "anchor-final" ? "#C98B27"
    : type === "positive" ? "#1F8A5C"
    : "#C1423B";
  const isAnchor = type === "anchor-baseline" || type === "anchor-final";
  return (
    <div className="grid grid-cols-[260px_1fr_140px] gap-3 items-center">
      <div className="text-sm flex items-center gap-2">
        {label}
        {badge && (
          <span className="text-[10px] uppercase tracking-wide bg-background border border-border rounded px-1.5 py-0.5 text-muted font-semibold">
            {badge}
          </span>
        )}
      </div>
      <div className="relative h-7 bg-background rounded">
        <div
          className="absolute top-0 bottom-0 rounded transition-all"
          style={{
            left: `${offsetPct ?? 0}%`,
            width: `${widthPct}%`,
            background: color,
            opacity: isAnchor ? 1 : 0.85,
          }}
        />
      </div>
      <div className={"font-mono text-sm text-right " + (type === "negative" ? "text-danger" : type === "positive" ? "text-success" : "text-secondary")}>
        {isAnchor ? formatUsdShort(value) : `${value >= 0 ? "+" : ""}${formatUsdShort(value)}`}
        {!isAnchor && runningTotal !== undefined && (
          <div className="text-[10px] text-muted">→ {formatUsdShort(runningTotal)}</div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon, positive, negative }: { label: string; value: string; icon?: React.ReactNode; positive?: boolean; negative?: boolean }) {
  return (
    <div className="text-center">
      <div className="caption text-muted flex items-center justify-center gap-1">
        {icon} {label}
      </div>
      <div className={"font-heading text-h4 mt-1 " + (positive ? "text-success" : negative ? "text-danger" : "text-secondary")}>
        {value}
      </div>
    </div>
  );
}
