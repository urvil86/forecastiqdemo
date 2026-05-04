"use client";

import { useMemo } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis, ReferenceLine } from "recharts";
import { Trash2, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { eventImpactSeries, sigmoidImpact } from "@/lib/engine";
import { EditableNumber } from "@/components/EditableNumber";
import { formatPct } from "@/lib/format";
import type { Event } from "@/lib/engine";

/**
 * v2.6 LRP Events card.
 *
 * Reuses the engine's eventImpactSeries / sigmoidImpact helpers so each row
 * shows the resulting uptake curve in a small inline sparkline.
 *
 * Sample events for Ocrevus (Kesimpta pressure, biosimilar entry, market
 * access win) are seeded by the existing Ocrevus seed; the card surfaces
 * them as the standing structural drivers in the LRP. STF events live
 * separately in the STF section.
 */
export function LrpEventsCard() {
  const events = useStore((s) => s.forecast.lrp.events);
  const updateEvent = useStore((s) => s.updateEvent);
  const toggleEvent = useStore((s) => s.toggleEvent);
  const removeEvent = useStore((s) => s.removeEvent);
  const addEvent = useStore((s) => s.addEvent);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="font-heading text-h4 text-secondary">2.3 LRP Events</h4>
        <span className="text-[11px] text-muted">
          {events.filter((e) => e.enabled).length} active · {events.length} total
        </span>
      </div>
      <p className="text-xs text-muted mb-3">
        Structural drivers shaping the LRP curve over the 10-year horizon
        (biosimilar entry, indication launches, competitive pressure, market
        access wins). Each event applies a sigmoid uptake curve from launch
        date to peak impact. Tactical events (DTC flights, congresses) belong
        in STF.
      </p>
      <div className="border border-border rounded overflow-x-auto">
        <table className="text-xs w-full">
          <thead className="bg-background">
            <tr className="border-b border-border">
              <th className="p-2 text-left">Event Name</th>
              <th className="p-2 text-left">Direction</th>
              <th className="p-2 text-center">On</th>
              <th className="p-2 text-left">Launch</th>
              <th className="p-2 text-right">Peak %</th>
              <th className="p-2 text-right">TTP (mo)</th>
              <th className="p-2 text-left">Curve</th>
              <th className="p-2 text-right">Now (2026)</th>
              <th className="p-2 text-left">Uptake curve</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                onUpdate={(patch) => updateEvent(e.id, patch)}
                onToggle={() => toggleEvent(e.id)}
                onRemove={() => removeEvent(e.id)}
              />
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={10} className="p-3 text-center text-muted italic">
                  No LRP events. Click "Add Event" to add a structural driver.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2">
        <button
          onClick={() => addEvent()}
          className="btn-ghost text-xs flex items-center gap-1"
        >
          <Plus size={12} /> Add Event
        </button>
      </div>
    </div>
  );
}

function EventRow({
  event,
  onUpdate,
  onToggle,
  onRemove,
}: {
  event: Event;
  onUpdate: (patch: Partial<Event>) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const series = useMemo(() => {
    return eventImpactSeries(2022, 2035, event).map((p) => ({
      year: p.year,
      impact: p.impact * 100,
    }));
  }, [event]);

  const nowFactorPct = useMemo(() => {
    const f = sigmoidImpact(2026, 6, event);
    const dir = event.type === "positive" ? 1 : -1;
    return dir * event.peakImpact * f * 100;
  }, [event]);

  return (
    <tr
      className={
        "border-b border-border last:border-0 " +
        (event.enabled ? "" : "opacity-50")
      }
    >
      <td className="p-1">
        <input
          type="text"
          value={event.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="input-cell !font-sans !text-xs w-44"
        />
      </td>
      <td className="p-1">
        <select
          value={event.type}
          onChange={(e) =>
            onUpdate({ type: e.target.value as Event["type"] })
          }
          className="input-cell !font-sans !text-xs w-24"
        >
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
        </select>
      </td>
      <td className="p-1 text-center">
        <input
          type="checkbox"
          checked={event.enabled}
          onChange={onToggle}
          className="accent-primary"
        />
      </td>
      <td className="p-1">
        <input
          type="date"
          value={
            event.launchDate.length > 7 ? event.launchDate : `${event.launchDate}-01`
          }
          onChange={(e) => onUpdate({ launchDate: e.target.value })}
          className="input-cell !font-sans !text-xs w-32"
        />
      </td>
      <td className="p-1">
        <EditableNumber
          value={event.peakImpact}
          onChange={(v) => onUpdate({ peakImpact: v })}
          format={(v) => formatPct(v, 1)}
          parse={(s) => parseFloat(s.replace("%", "")) / 100}
          className="input-cell !text-xs w-20 text-right"
        />
      </td>
      <td className="p-1">
        <EditableNumber
          value={event.timeToPeakMonths}
          onChange={(v) => onUpdate({ timeToPeakMonths: v })}
          format={(v) => String(v)}
          className="input-cell !text-xs w-16 text-right"
        />
      </td>
      <td className="p-1">
        <select
          value={event.curveShape}
          onChange={(e) =>
            onUpdate({ curveShape: e.target.value as Event["curveShape"] })
          }
          className="input-cell !font-sans !text-xs w-24"
        >
          <option value="slow">Slow</option>
          <option value="moderate">Moderate</option>
          <option value="fast">Fast</option>
        </select>
      </td>
      <td className="p-1 text-right">
        <span
          className={
            "font-mono text-[11px] " +
            (Math.abs(nowFactorPct) < 0.1
              ? "text-muted"
              : nowFactorPct > 0
              ? "text-emerald-700"
              : "text-red-600")
          }
        >
          {nowFactorPct >= 0 ? "+" : ""}
          {nowFactorPct.toFixed(1)}%
        </span>
      </td>
      <td className="p-1 w-36">
        <div className="h-8 w-32">
          <ResponsiveContainer>
            <LineChart
              data={series}
              margin={{ top: 2, bottom: 2, left: 0, right: 0 }}
            >
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <ReferenceLine y={0} stroke="#E6E1D6" />
              <Line
                type="monotone"
                dataKey="impact"
                stroke={event.type === "positive" ? "#1F8A5C" : "#C1423B"}
                strokeWidth={1.6}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </td>
      <td className="p-1">
        <button
          onClick={onRemove}
          className="text-muted hover:text-red-600"
          aria-label="Remove event"
        >
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
}
