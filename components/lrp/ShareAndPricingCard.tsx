"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { interpolateAnchors } from "@/lib/engine";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { EditableNumber } from "@/components/EditableNumber";
import { formatPct, formatNumber } from "@/lib/format";

export function ShareAndPricingCard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SharePanel />
      <PricingPanel />
    </div>
  );
}

function SharePanel() {
  const classShare = useStore((s) => s.forecast.lrp.classShare);
  const productShare = useStore((s) => s.forecast.lrp.productShare);
  const setLrpAnchor = useStore((s) => s.setLrpAnchor);

  const chartData = useMemo(() => {
    const cs = interpolateAnchors(classShare, 2022, 2035);
    const ps = interpolateAnchors(productShare, 2022, 2035);
    return cs.map((c, i) => ({ year: c.year, classShare: c.value * 100, productShare: ps[i].value * 100 }));
  }, [classShare, productShare]);

  return (
    <div className="card">
      <h4 className="font-heading text-h4 text-secondary mb-3">Share Cascade</h4>
      <div className="grid grid-cols-2 gap-4">
        <AnchorTable
          title="Class Share"
          help="Brand class % of treatable market"
          values={classShare}
          onChange={(year, val) => setLrpAnchor("classShare", year, val)}
          format={(v) => formatPct(v, 1)}
          parse={(s) => parseFloat(s.replace("%", "")) / 100}
        />
        <AnchorTable
          title="Product Share"
          help="Brand % within class"
          values={productShare}
          onChange={(year, val) => setLrpAnchor("productShare", year, val)}
          format={(v) => formatPct(v, 1)}
          parse={(s) => parseFloat(s.replace("%", "")) / 100}
        />
      </div>
      <div className="mt-4 h-44">
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v: number | string) => (typeof v === "number" ? `${v.toFixed(1)}%` : "—")} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="classShare" stroke="#0A5C82" name="Class share" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="productShare" stroke="#C98B27" name="Product share" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PricingPanel() {
  const grossPrice = useStore((s) => s.forecast.lrp.grossPrice);
  const gtnRate = useStore((s) => s.forecast.lrp.gtnRate);
  const setLrpAnchor = useStore((s) => s.setLrpAnchor);

  const chartData = useMemo(() => {
    const gp = interpolateAnchors(grossPrice, 2022, 2035);
    const gtn = interpolateAnchors(gtnRate, 2022, 2035);
    return gp.map((g, i) => ({
      year: g.year,
      grossPrice: g.value,
      netPrice: g.value * (1 - gtn[i].value),
    }));
  }, [grossPrice, gtnRate]);

  return (
    <div className="card">
      <h4 className="font-heading text-h4 text-secondary mb-3">Pricing</h4>
      <div className="grid grid-cols-2 gap-4">
        <AnchorTable
          title="Gross Price ($/dose)"
          help="Listed price per dose"
          values={grossPrice}
          onChange={(year, val) => setLrpAnchor("grossPrice", year, val)}
          format={(v) => `$${formatNumber(v)}`}
        />
        <AnchorTable
          title="Gross-to-Net Rate"
          help="GTN deduction (rebates, discounts, etc.)"
          values={gtnRate}
          onChange={(year, val) => setLrpAnchor("gtnRate", year, val)}
          format={(v) => formatPct(v, 1)}
          parse={(s) => parseFloat(s.replace("%", "")) / 100}
        />
      </div>
      <div className="mt-4 h-44">
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D6" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: number | string) => (typeof v === "number" ? `$${formatNumber(v)}` : "—")} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="grossPrice" stroke="#0A5C82" name="Gross price" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="netPrice" stroke="#C98B27" name="Net price" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AnchorTable({
  title,
  help,
  values,
  onChange,
  format,
  parse,
}: {
  title: string;
  help: string;
  values: { year: number; value: number }[];
  onChange: (year: number, val: number) => void;
  format: (v: number) => string;
  parse?: (s: string) => number;
}) {
  return (
    <div>
      <div className="caption text-muted">{title}</div>
      <p className="text-xs text-muted mb-2">{help}</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {values.map((v) => (
            <tr key={v.year}>
              <td className="font-mono">{v.year}</td>
              <td>
                <EditableNumber
                  value={v.value}
                  onChange={(val) => onChange(v.year, val)}
                  format={format}
                  parse={parse}
                  className="input-cell w-28 text-right"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
