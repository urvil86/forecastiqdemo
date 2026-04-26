"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useForecastWindow } from "@/lib/useForecastWindow";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from "recharts";
import { EditableNumber } from "@/components/EditableNumber";
import { formatPct, formatNumber } from "@/lib/format";

export function NfsSamplesView() {
  const computed = useStore((s) => s.computed);
  const nfs = useStore((s) => s.forecast.stf.nfs);
  const updateNfs = useStore((s) => s.updateNfs);
  const skus = useStore((s) => s.forecast.stf.skus);
  const win = useForecastWindow();

  const sampleSku = skus.find((s) => s.category === "sample" && s.active);

  const data = useMemo(() => {
    if (!computed) return [];
    return computed.weekly
      .filter((w) => w.weekStart >= win.windowStart && w.weekStart <= win.windowEnd)
      .map((w) => {
        // Engine-driven sample units = active sample SKU's weekly volume from compute()
        const engineSamples = sampleSku
          ? w.skuValues.find((sv) => sv.sku === sampleSku.id)?.volume ?? 0
          : 0;
        // Use the sample SKU output as the seed; PAP and Bridge scale relative to sample baseline
        const samples = engineSamples > 0 ? engineSamples : nfs.samplesPerWeek;
        const ratio = nfs.samplesPerWeek > 0 ? samples / nfs.samplesPerWeek : 1;
        return {
          week: w.weekStart,
          samples,
          pap: nfs.papPerWeek * ratio,
          bridge: nfs.bridgePerWeek * ratio,
          isActual: w.isActual,
        };
      });
  }, [computed, win, nfs, sampleSku]);

  // Convert engine units to expected NBRx contribution
  const nbrxThisHorizon = useMemo(() => {
    return data
      .filter((d) => !d.isActual)
      .slice(0, win.horizonWeeks)
      .reduce(
        (s, d) => s + d.samples * nfs.samplesConversionRate + d.pap * nfs.papConversionRate + d.bridge * nfs.bridgeConversionRate,
        0
      );
  }, [data, nfs, win]);

  if (!computed) return <div className="shimmer h-72 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <h3 className="font-heading text-h3 text-secondary">Not-for-Sale Units</h3>
            <p className="text-sm text-muted">
              Samples drive NBRx via conversion. Sample units come from the engine&apos;s active sample-SKU output;
              PAP and Bridge scale alongside.
            </p>
          </div>
          <div className="text-right">
            <div className="caption text-muted">Forward NBRx contribution</div>
            <div className="font-heading text-h3 text-primary">{formatNumber(nbrxThisHorizon)}</div>
            <div className="text-xs text-muted">over {win.horizonWeeks} weeks</div>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(data.length / 13))} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number | string) => (typeof v === "number" ? formatNumber(v) : "—")} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine x={win.cutoff} stroke="#C1423B" strokeDasharray="3 3" label={{ value: "Cutoff", fontSize: 10, fill: "#C1423B" }} />
              <Bar dataKey="samples" stackId="nfs" fill="#0A5C82" name="Samples" />
              <Bar dataKey="pap" stackId="nfs" fill="#C98B27" name="PAP" />
              <Bar dataKey="bridge" stackId="nfs" fill="#1F8A5C" name="Bridge" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card">
        <h4 className="font-heading text-h4 text-secondary mb-2">Calibration</h4>
        <p className="text-xs text-muted mb-3">Baselines and sample-to-NBRx conversion rates.</p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Avg Weekly Units</th>
              <th>Conversion Rate</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Physician Samples</td>
              <td>
                <EditableNumber
                  value={nfs.samplesPerWeek}
                  onChange={(v) => updateNfs("samplesPerWeek", v)}
                  format={formatNumber}
                  className="input-cell w-20 text-right"
                />
              </td>
              <td>
                <EditableNumber
                  value={nfs.samplesConversionRate}
                  onChange={(v) => updateNfs("samplesConversionRate", v)}
                  format={(v) => formatPct(v, 1)}
                  parse={(s) => parseFloat(s.replace("%", "")) / 100}
                  className="input-cell w-20 text-right"
                />
              </td>
              <td className="text-xs text-muted">Engine-linked (active sample SKU)</td>
            </tr>
            <tr>
              <td>PAP</td>
              <td>
                <EditableNumber
                  value={nfs.papPerWeek}
                  onChange={(v) => updateNfs("papPerWeek", v)}
                  format={formatNumber}
                  className="input-cell w-20 text-right"
                />
              </td>
              <td>
                <EditableNumber
                  value={nfs.papConversionRate}
                  onChange={(v) => updateNfs("papConversionRate", v)}
                  format={(v) => formatPct(v, 1)}
                  parse={(s) => parseFloat(s.replace("%", "")) / 100}
                  className="input-cell w-20 text-right"
                />
              </td>
              <td className="text-xs text-muted">Scales w/ samples</td>
            </tr>
            <tr>
              <td>Bridge Units</td>
              <td>
                <EditableNumber
                  value={nfs.bridgePerWeek}
                  onChange={(v) => updateNfs("bridgePerWeek", v)}
                  format={formatNumber}
                  className="input-cell w-20 text-right"
                />
              </td>
              <td>
                <EditableNumber
                  value={nfs.bridgeConversionRate}
                  onChange={(v) => updateNfs("bridgeConversionRate", v)}
                  format={(v) => formatPct(v, 1)}
                  parse={(s) => parseFloat(s.replace("%", "")) / 100}
                  className="input-cell w-20 text-right"
                />
              </td>
              <td className="text-xs text-muted">Scales w/ samples</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
