"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { sigmoidImpactForDate } from "@/lib/engine";
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, ReferenceLine, Tooltip } from "recharts";
import { Trash2, Plus } from "lucide-react";
import { EditableNumber } from "@/components/EditableNumber";
import { formatPct } from "@/lib/format";

const WEEKS_PER_MONTH = 4.345;

export function EventsView() {
  const events = useStore((s) => s.forecast.stf.events);
  const updateStfEvent = useStore((s) => s.updateStfEvent);
  const toggleStfEvent = useStore((s) => s.toggleStfEvent);
  const removeStfEvent = useStore((s) => s.removeStfEvent);
  const addStfEvent = useStore((s) => s.addStfEvent);

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h3 className="font-heading text-h3 text-secondary">STF Events (short-horizon)</h3>
          <p className="text-sm text-muted">
            Operational events with a 4–12 week impact window. Edits apply at the <strong>weekly</strong> level on top of LRP cascade
            and are captured in <em>Build → Naive OUTs</em> within 100ms.
          </p>
        </div>
        <button onClick={addStfEvent} className="btn-secondary flex items-center gap-1">
          <Plus size={14} /> Add Custom Event
        </button>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">No STF events. Click "Add Custom Event" to create one.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[1100px]">
            <thead>
              <tr>
                <th>Event Name</th>
                <th>Type</th>
                <th>On</th>
                <th>Launch Date</th>
                <th>Peak %</th>
                <th>TTP (weeks)</th>
                <th>Curve</th>
                <th>Now</th>
                <th>Peak</th>
                <th>Weekly impact curve</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <EventRow
                  key={e.id}
                  event={e}
                  onUpdate={(patch) => updateStfEvent(e.id, patch)}
                  onToggle={() => toggleStfEvent(e.id)}
                  onRemove={() => removeStfEvent(e.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EventRow({
  event,
  onUpdate,
  onToggle,
  onRemove,
}: {
  event: ReturnType<typeof useStore.getState>["forecast"]["stf"]["events"][number];
  onUpdate: (patch: Partial<typeof event>) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  // Render a 26-week impact curve centered around the launch date — actual sigmoid the engine applies.
  const series = useMemo(() => {
    const launchParts = event.launchDate.split("-");
    const launch = new Date(Date.UTC(parseInt(launchParts[0]), parseInt(launchParts[1] ?? "1") - 1, parseInt(launchParts[2] ?? "1")));
    const arr: { week: string; impactPct: number }[] = [];
    // Start 4 weeks before launch, run 26 weeks total
    const start = new Date(launch.getTime() - 4 * 7 * 86_400_000);
    const dir = event.type === "positive" ? 1 : -1;
    for (let i = 0; i < 26; i++) {
      const d = new Date(start.getTime() + i * 7 * 86_400_000);
      const f = sigmoidImpactForDate(d, event);
      arr.push({ week: d.toISOString().slice(5, 10), impactPct: dir * event.peakImpact * f * 100 });
    }
    return arr;
  }, [event]);

  const nowFactorPct = useMemo(() => {
    const f = sigmoidImpactForDate(new Date("2026-04-22"), event);
    const dir = event.type === "positive" ? 1 : -1;
    return dir * event.peakImpact * f * 100;
  }, [event]);

  const peakPct = (event.type === "positive" ? 1 : -1) * event.peakImpact * 100;
  const ttpWeeks = event.timeToPeakMonths * WEEKS_PER_MONTH;

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
          value={ttpWeeks}
          onChange={(weeks) => onUpdate({ timeToPeakMonths: Math.max(0.1, weeks / WEEKS_PER_MONTH) })}
          format={(v) => v.toFixed(0)}
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
            (Math.abs(nowFactorPct) < 0.1 ? "text-muted" : nowFactorPct > 0 ? "text-success" : "text-danger")
          }
          title="Sigmoid factor at the current partial week (2026-04-22). Updates immediately on edit."
        >
          {nowFactorPct >= 0 ? "+" : ""}
          {nowFactorPct.toFixed(2)}%
        </span>
      </td>
      <td>
        <span
          className={
            "font-mono text-xs font-semibold " +
            (peakPct > 0 ? "text-success" : peakPct < 0 ? "text-danger" : "text-muted")
          }
        >
          {peakPct >= 0 ? "+" : ""}
          {peakPct.toFixed(1)}%
        </span>
      </td>
      <td className="w-52">
        <div className="h-12 w-48">
          <ResponsiveContainer>
            <LineChart data={series} margin={{ top: 4, bottom: 2, left: 0, right: 0 }}>
              <YAxis hide domain={[Math.min(0, peakPct * 1.1), Math.max(0, peakPct * 1.1)]} />
              <XAxis dataKey="week" tick={{ fontSize: 8 }} interval={5} />
              <ReferenceLine y={0} stroke="#E6E1D6" />
              <Tooltip formatter={(v: number | string) => (typeof v === "number" ? `${v.toFixed(2)}%` : "—")} />
              <Line
                type="monotone"
                dataKey="impactPct"
                stroke={event.type === "positive" ? "#1F8A5C" : "#C1423B"}
                strokeWidth={2}
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
