"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { eventImpactSeries, sigmoidImpact } from "@/lib/engine";
import { LineChart, Line, ResponsiveContainer, YAxis, ReferenceLine } from "recharts";
import { Trash2, Plus } from "lucide-react";
import { EditableNumber } from "@/components/EditableNumber";
import { formatPct } from "@/lib/format";

export function EventsCard() {
  const events = useStore((s) => s.forecast.lrp.events);
  const updateEvent = useStore((s) => s.updateEvent);
  const toggleEvent = useStore((s) => s.toggleEvent);
  const removeEvent = useStore((s) => s.removeEvent);
  const addEvent = useStore((s) => s.addEvent);

  return (
    <div className="card overflow-x-auto">
      <p className="text-xs text-muted mb-2">
        Edits below propagate to the LRP forecast curve <em>and</em> to STF weekly forecasts (because LRP events shape the annual
        baseline that cascades down to weekly). Look at the <strong>Now (2026)</strong> column to confirm an edit took effect.
      </p>
      <table className="data-table min-w-[1000px]">
        <thead>
          <tr>
            <th>Event Name</th>
            <th>Type</th>
            <th>Enabled</th>
            <th>Launch Date</th>
            <th>Peak %</th>
            <th>TTP (months)</th>
            <th>Curve</th>
            <th>Now (2026)</th>
            <th>Annual Impact</th>
            <th></th>
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
        </tbody>
      </table>
      <div className="mt-3">
        <button onClick={() => addEvent()} className="btn-ghost flex items-center gap-1">
          <Plus size={14} /> Add Event
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
  event: ReturnType<typeof useStore.getState>["forecast"]["lrp"]["events"][number];
  onUpdate: (patch: Partial<typeof event>) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const series = useMemo(() => {
    return eventImpactSeries(2022, 2035, event).map((p) => ({ year: p.year, impact: p.impact * 100 }));
  }, [event]);

  const nowFactorPct = useMemo(() => {
    const f = sigmoidImpact(2026, 6, event);
    const dir = event.type === "positive" ? 1 : -1;
    return dir * event.peakImpact * f * 100;
  }, [event]);

  return (
    <tr className={event.enabled ? "" : "opacity-50"}>
      <td>
        <input
          type="text"
          value={event.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="input-cell !text-sm !font-sans w-44"
        />
      </td>
      <td>
        <select
          value={event.type}
          onChange={(e) => onUpdate({ type: e.target.value as "positive" | "negative" })}
          className="input-cell !font-sans w-24"
        >
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
        </select>
      </td>
      <td>
        <input type="checkbox" checked={event.enabled} onChange={onToggle} className="accent-primary" />
      </td>
      <td>
        <input
          type="date"
          value={event.launchDate.length > 7 ? event.launchDate : `${event.launchDate}-01`}
          onChange={(e) => onUpdate({ launchDate: e.target.value })}
          className="input-cell !font-sans w-36"
        />
      </td>
      <td>
        <EditableNumber
          value={event.peakImpact}
          onChange={(v) => onUpdate({ peakImpact: v })}
          format={(v) => formatPct(v, 1)}
          parse={(s) => parseFloat(s.replace("%", "")) / 100}
          className="input-cell w-20 text-right"
        />
      </td>
      <td>
        <EditableNumber
          value={event.timeToPeakMonths}
          onChange={(v) => onUpdate({ timeToPeakMonths: v })}
          format={(v) => String(v)}
          className="input-cell w-16 text-right"
        />
      </td>
      <td>
        <select
          value={event.curveShape}
          onChange={(e) => onUpdate({ curveShape: e.target.value as "slow" | "moderate" | "fast" })}
          className="input-cell !font-sans w-24"
        >
          <option value="slow">Slow</option>
          <option value="moderate">Moderate</option>
          <option value="fast">Fast</option>
        </select>
      </td>
      <td>
        <span
          className={
            "font-mono text-xs " +
            (Math.abs(nowFactorPct) < 0.1
              ? "text-muted"
              : nowFactorPct > 0
              ? "text-success"
              : "text-danger")
          }
          title="Sigmoid factor applied to 2026 baseline. Updates immediately when you edit Peak/TTP/Curve/Launch."
        >
          {nowFactorPct >= 0 ? "+" : ""}
          {nowFactorPct.toFixed(1)}%
        </span>
      </td>
      <td className="w-40">
        <div className="h-10 w-36">
          <ResponsiveContainer>
            <LineChart data={series} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
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
      <td>
        <button onClick={onRemove} className="text-muted hover:text-danger" aria-label="Remove event">
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}
