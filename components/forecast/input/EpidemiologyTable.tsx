"use client";

import { useStore } from "@/lib/store";
import type { EpidemiologyInputs } from "@/lib/engine";

type Field = keyof EpidemiologyInputs["yearly"][number];

const ROWS: { field: Field; label: string; suffix?: string; min?: number; max?: number; step?: number }[] = [
  { field: "prevalence", label: "Total US prevalence (000s)", min: 0, step: 10 },
  { field: "diagnosisRatePct", label: "Diagnosis rate", suffix: "%", min: 0, max: 100, step: 1 },
  { field: "treatedRatePct", label: "Treated rate", suffix: "%", min: 0, max: 100, step: 1 },
  { field: "classSharePct", label: "Class share", suffix: "%", min: 0, max: 100, step: 0.5 },
  { field: "brandSharePct", label: "Brand share within class", suffix: "%", min: 0, max: 100, step: 0.5 },
  { field: "persistenceY1Pct", label: "Persistence Year 1", suffix: "%", min: 0, max: 100, step: 1 },
  { field: "persistenceY2Pct", label: "Persistence Year 2", suffix: "%", min: 0, max: 100, step: 1 },
  { field: "dosesPerPatientYear", label: "Doses per patient per year", min: 0, step: 0.1 },
];

export function EpidemiologyTable() {
  const inputs = useStore((s) => s.forecast.epidemiologyInputs);
  const updateCell = useStore((s) => s.updateEpidemiologyCell);
  const updatePricingCell = useStore((s) => s.updatePricingCell);

  if (!inputs) {
    return (
      <div className="text-xs text-muted italic p-4 border border-dashed border-border rounded">
        Methodology not set to Epidemiology, or inputs not yet seeded.
      </div>
    );
  }

  const years = inputs.yearly.map((y) => y.year);

  function fillSame(field: Field, value: number) {
    for (const y of years) updateCell(y, field, value);
  }
  function fillLinear(field: Field, start: number, end: number) {
    if (years.length < 2) return;
    for (let i = 0; i < years.length; i++) {
      const t = i / (years.length - 1);
      updateCell(years[i], field, start + (end - start) * t);
    }
  }

  return (
    <div className="space-y-6">
      {/* Patient funnel */}
      <div>
        <h4 className="font-heading text-h4 text-secondary mb-2">
          2.1 Patient Funnel
        </h4>
        <FunnelTable
          years={years}
          rows={ROWS}
          getValue={(field, year) => {
            const y = inputs.yearly.find((x) => x.year === year);
            return y ? (y[field] as number) : 0;
          }}
          onChange={(field, year, value) => updateCell(year, field, value)}
          onFillSame={fillSame}
          onFillLinear={fillLinear}
        />
      </div>

      {/* Pricing */}
      <div>
        <h4 className="font-heading text-h4 text-secondary mb-2">2.2 Pricing</h4>
        <PricingTable
          years={years}
          getValue={(field, year) => {
            const p = inputs.pricing.yearly.find((x) => x.year === year);
            return p ? (p[field] as number) : 0;
          }}
          onChange={(field, year, value) =>
            updatePricingCell(year, field, value)
          }
        />
      </div>
    </div>
  );
}

interface FunnelRowDef {
  field: string;
  label: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}

interface FunnelTableProps<F extends string> {
  years: number[];
  rows: FunnelRowDef[];
  getValue: (field: F, year: number) => number;
  onChange: (field: F, year: number, value: number) => void;
  onFillSame?: (field: F, value: number) => void;
  onFillLinear?: (field: F, start: number, end: number) => void;
}

function FunnelTable<F extends string>({
  years,
  rows,
  getValue,
  onChange,
  onFillSame,
  onFillLinear,
}: FunnelTableProps<F>) {
  return (
    <div className="overflow-x-auto border border-border rounded">
      <table className="text-xs w-full">
        <thead>
          <tr className="bg-background border-b border-border">
            <th className="text-left p-2 sticky left-0 bg-background z-10 min-w-[14rem]">
              Driver
            </th>
            {years.map((y) => (
              <th key={y} className="p-2 text-right font-mono font-semibold">
                {y}
              </th>
            ))}
            <th className="p-2 text-right text-[10px] text-muted">Helpers</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field} className="border-b border-border last:border-0">
              <td className="p-2 sticky left-0 bg-surface z-10 font-semibold">
                {r.label}
              </td>
              {years.map((y) => (
                <td key={y} className="p-1">
                  <input
                    type="number"
                    value={getValue(r.field as F, y)}
                    min={r.min}
                    max={r.max}
                    step={r.step}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) onChange(r.field as F, y, v);
                    }}
                    className="w-full px-1.5 py-1 border border-border rounded text-right font-mono text-xs"
                  />
                  {r.suffix && (
                    <span className="text-[9px] text-muted ml-0.5">
                      {r.suffix}
                    </span>
                  )}
                </td>
              ))}
              <td className="p-1 text-right">
                <FillHelpers
                  onSame={
                    onFillSame
                      ? () => {
                          const v = getValue(r.field as F, years[0]);
                          onFillSame(r.field as F, v);
                        }
                      : undefined
                  }
                  onLinear={
                    onFillLinear
                      ? () => {
                          const start = getValue(r.field as F, years[0]);
                          const end = getValue(
                            r.field as F,
                            years[years.length - 1],
                          );
                          onFillLinear(r.field as F, start, end);
                        }
                      : undefined
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FillHelpers({
  onSame,
  onLinear,
}: {
  onSame?: () => void;
  onLinear?: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5 text-[10px] text-muted">
      {onSame && (
        <button
          className="hover:text-primary text-right"
          onClick={onSame}
          title="Apply year 1 value to all years"
        >
          ≡ same
        </button>
      )}
      {onLinear && (
        <button
          className="hover:text-primary text-right"
          onClick={onLinear}
          title="Linear interp between first and last year values"
        >
          ↗ linear
        </button>
      )}
    </div>
  );
}

function PricingTable({
  years,
  getValue,
  onChange,
}: {
  years: number[];
  getValue: (
    field: "grossPriceUsd" | "tradeDiscountPct" | "reserveRatePct",
    year: number,
  ) => number;
  onChange: (
    field: "grossPriceUsd" | "tradeDiscountPct" | "reserveRatePct",
    year: number,
    value: number,
  ) => void;
}) {
  const rows: {
    field: "grossPriceUsd" | "tradeDiscountPct" | "reserveRatePct";
    label: string;
  }[] = [
    { field: "grossPriceUsd", label: "Gross price per dose ($)" },
    { field: "tradeDiscountPct", label: "Trade discount (%)" },
    { field: "reserveRatePct", label: "Reserve rate / GTN (%)" },
  ];
  return (
    <div className="overflow-x-auto border border-border rounded">
      <table className="text-xs w-full">
        <thead>
          <tr className="bg-background border-b border-border">
            <th className="text-left p-2 sticky left-0 bg-background z-10 min-w-[14rem]">
              Driver
            </th>
            {years.map((y) => (
              <th key={y} className="p-2 text-right font-mono font-semibold">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field} className="border-b border-border last:border-0">
              <td className="p-2 sticky left-0 bg-surface z-10 font-semibold">
                {r.label}
              </td>
              {years.map((y) => (
                <td key={y} className="p-1">
                  <input
                    type="number"
                    value={getValue(r.field, y)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) onChange(r.field, y, v);
                    }}
                    className="w-full px-1.5 py-1 border border-border rounded text-right font-mono text-xs"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
