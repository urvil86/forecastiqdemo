"use client";

import { useStore } from "@/lib/store";
import { formatUsdShort } from "@/lib/format";

export function BiosimilarDefenseView() {
  const forecast = useStore((s) => s.forecast);
  const cfg = forecast.lifecycleContext?.postLoeConfig?.biosimilarEntry;
  if (!cfg) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h3 className="font-heading text-h3 text-secondary mb-2">Biosimilar Entry</h3>
        <p className="text-sm text-muted mb-3">
          Expected entry: <span className="font-mono">{cfg.expectedEntryDate}</span> ·{" "}
          {cfg.entrantCount} entrants
        </p>

        <h4 className="text-sm font-semibold mt-4 mb-1">Class Price Erosion</h4>
        <table className="w-full text-xs">
          <thead className="text-[10px] text-muted uppercase">
            <tr>
              <th className="text-left">Years after entry</th>
              <th className="text-right">Remaining class price</th>
            </tr>
          </thead>
          <tbody>
            {cfg.classPriceErosionCurve.map((p) => (
              <tr key={p.yearsAfterEntry} className="border-t border-border">
                <td className="py-1.5">+{p.yearsAfterEntry}y</td>
                <td className="py-1.5 text-right font-mono">
                  {(p.remainingClassPricePct * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4 className="text-sm font-semibold mt-4 mb-1">Originator Share Loss</h4>
        <table className="w-full text-xs">
          <thead className="text-[10px] text-muted uppercase">
            <tr>
              <th className="text-left">Years after entry</th>
              <th className="text-right">Remaining originator share</th>
            </tr>
          </thead>
          <tbody>
            {cfg.shareLossCurve.map((p) => (
              <tr key={p.yearsAfterEntry} className="border-t border-border">
                <td className="py-1.5">+{p.yearsAfterEntry}y</td>
                <td className="py-1.5 text-right font-mono">
                  {(p.remainingOriginatorSharePct * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="font-heading text-h3 text-secondary mb-2">Annual Revenue Projection</h3>
        <ProjectionChart entryDate={cfg.expectedEntryDate} priceCurve={cfg.classPriceErosionCurve} shareCurve={cfg.shareLossCurve} />
      </div>
    </div>
  );
}

function ProjectionChart({
  entryDate,
  priceCurve,
  shareCurve,
}: {
  entryDate: string;
  priceCurve: { yearsAfterEntry: number; remainingClassPricePct: number }[];
  shareCurve: { yearsAfterEntry: number; remainingOriginatorSharePct: number }[];
}) {
  const computed = useStore((s) => s.computed);
  if (!computed) return null;

  const entryYear = new Date(entryDate).getUTCFullYear();
  const annual = computed.annual.filter((a) => a.year >= entryYear - 2 && a.year <= entryYear + 5);
  const max = Math.max(...annual.map((a) => a.netSales), 1);

  return (
    <div className="space-y-2 text-xs">
      {annual.map((a) => {
        const w = (a.netSales / max) * 100;
        const isAfterEntry = a.year >= entryYear;
        return (
          <div key={a.year} className="flex items-center gap-2">
            <div className="w-12 font-mono">{a.year}</div>
            <div className="flex-1 h-6 bg-background rounded relative">
              <div
                className={"h-full rounded " + (isAfterEntry ? "bg-danger/40" : "bg-primary/40")}
                style={{ width: `${w}%` }}
              />
              <span className="absolute inset-0 flex items-center px-2 font-semibold">
                {formatUsdShort(a.netSales)}
              </span>
            </div>
          </div>
        );
      })}
      <div className="text-[10px] text-muted pt-2 border-t border-border">
        Gold = pre-biosimilar · Red = post-biosimilar entry. Class price drops to{" "}
        {(priceCurve[priceCurve.length - 1].remainingClassPricePct * 100).toFixed(0)}% by Y+
        {priceCurve[priceCurve.length - 1].yearsAfterEntry}; originator share to{" "}
        {(shareCurve[shareCurve.length - 1].remainingOriginatorSharePct * 100).toFixed(0)}%.
      </div>
    </div>
  );
}
