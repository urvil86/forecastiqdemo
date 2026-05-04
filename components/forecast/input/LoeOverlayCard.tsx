"use client";

import { useStore } from "@/lib/store";
import type { LoeOverlay } from "@/lib/engine";

const POSTURES: { value: LoeOverlay["defenseStrategy"]["pricingPosture"]; label: string; help: string }[] = [
  { value: "hold", label: "Hold", help: "Maintain WAC, lose volume" },
  { value: "match", label: "Match", help: "Discount to defend share" },
  { value: "discount", label: "Discount", help: "Aggressive WAC drop pre-LoE" },
];

export function LoeOverlayCard() {
  const overlay = useStore((s) => s.forecast.loeOverlay);
  const update = useStore((s) => s.updateLoeOverlay);

  if (!overlay) return null;

  function setBio(patch: Partial<LoeOverlay["biosimilarEntry"]>) {
    if (!overlay) return;
    update({ biosimilarEntry: { ...overlay.biosimilarEntry, ...patch } });
  }

  function setDef(patch: Partial<LoeOverlay["defenseStrategy"]>) {
    if (!overlay) return;
    update({ defenseStrategy: { ...overlay.defenseStrategy, ...patch } });
  }

  function setErosionPct(yearsAfter: number, value: number) {
    if (!overlay) return;
    const next = overlay.biosimilarEntry.classPriceErosionByYear.map((c) =>
      c.yearsAfterEntry === yearsAfter
        ? { ...c, remainingClassPricePct: value }
        : c,
    );
    setBio({ classPriceErosionByYear: next });
  }
  function setShareRetentionPct(yearsAfter: number, value: number) {
    if (!overlay) return;
    const next = overlay.biosimilarEntry.originatorShareRetentionByYear.map(
      (c) =>
        c.yearsAfterEntry === yearsAfter
          ? { ...c, remainingOriginatorSharePct: value }
          : c,
    );
    setBio({ originatorShareRetentionByYear: next });
  }

  function setInvestment(
    series: "contractingInvestmentUsdM" | "patientRetentionInvestmentUsdM",
    year: number,
    amount: number,
  ) {
    if (!overlay) return;
    const cur = overlay.defenseStrategy[series];
    const next = cur.map((x) => (x.year === year ? { ...x, amount } : x));
    setDef({ [series]: next } as Partial<LoeOverlay["defenseStrategy"]>);
  }

  return (
    <div className="space-y-6">
      {/* 2.3 Biosimilar Entry */}
      <div>
        <h4 className="font-heading text-h4 text-secondary mb-2">
          2.3 Biosimilar Entry
        </h4>
        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
                Expected entry date
              </div>
              <input
                type="date"
                value={overlay.biosimilarEntry.expectedEntryDate.slice(0, 10)}
                onChange={(e) => setBio({ expectedEntryDate: e.target.value })}
                className="input-cell !font-sans w-full"
              />
            </label>
            <label className="block">
              <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
                Number of entrants
              </div>
              <input
                type="number"
                min={1}
                max={10}
                step={1}
                value={overlay.biosimilarEntry.entrantCount}
                onChange={(e) =>
                  setBio({ entrantCount: parseInt(e.target.value) || 1 })
                }
                className="input-cell !font-sans w-full"
              />
            </label>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
              Class price erosion (% remaining)
            </div>
            <div className="overflow-x-auto border border-border rounded">
              <table className="text-xs w-full">
                <thead className="bg-background">
                  <tr className="border-b border-border">
                    {overlay.biosimilarEntry.classPriceErosionByYear.map((c) => (
                      <th
                        key={c.yearsAfterEntry}
                        className="p-2 text-right font-mono"
                      >
                        Y{c.yearsAfterEntry}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {overlay.biosimilarEntry.classPriceErosionByYear.map((c) => (
                      <td key={c.yearsAfterEntry} className="p-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={c.remainingClassPricePct}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            setErosionPct(c.yearsAfterEntry, v);
                          }}
                          className="w-full px-1.5 py-1 border border-border rounded text-right font-mono text-xs"
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
              Originator share retention (% remaining)
            </div>
            <div className="overflow-x-auto border border-border rounded">
              <table className="text-xs w-full">
                <thead className="bg-background">
                  <tr className="border-b border-border">
                    {overlay.biosimilarEntry.originatorShareRetentionByYear.map(
                      (c) => (
                        <th
                          key={c.yearsAfterEntry}
                          className="p-2 text-right font-mono"
                        >
                          Y{c.yearsAfterEntry}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {overlay.biosimilarEntry.originatorShareRetentionByYear.map(
                      (c) => (
                        <td key={c.yearsAfterEntry} className="p-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={c.remainingOriginatorSharePct}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              setShareRetentionPct(c.yearsAfterEntry, v);
                            }}
                            className="w-full px-1.5 py-1 border border-border rounded text-right font-mono text-xs"
                          />
                        </td>
                      ),
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 2.4 Defense Strategy */}
      <div>
        <h4 className="font-heading text-h4 text-secondary mb-2">
          2.4 Defense Strategy
        </h4>
        <div className="card space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
              Pricing posture
            </div>
            <div className="flex flex-wrap gap-2">
              {POSTURES.map((p) => (
                <label
                  key={p.value}
                  className={
                    "flex items-baseline gap-2 px-3 py-1.5 border rounded cursor-pointer text-xs " +
                    (overlay.defenseStrategy.pricingPosture === p.value
                      ? "border-primary bg-primary-light/40"
                      : "border-border")
                  }
                  title={p.help}
                >
                  <input
                    type="radio"
                    name="posture"
                    checked={overlay.defenseStrategy.pricingPosture === p.value}
                    onChange={() => setDef({ pricingPosture: p.value })}
                    className="accent-primary"
                  />
                  {p.label}
                  <span className="text-[10px] text-muted">— {p.help}</span>
                </label>
              ))}
            </div>
          </div>

          <InvestmentTable
            label="Contracting investment ($M per year)"
            data={overlay.defenseStrategy.contractingInvestmentUsdM}
            onChange={(year, amount) =>
              setInvestment("contractingInvestmentUsdM", year, amount)
            }
          />
          <InvestmentTable
            label="Patient retention investment ($M per year)"
            data={overlay.defenseStrategy.patientRetentionInvestmentUsdM}
            onChange={(year, amount) =>
              setInvestment("patientRetentionInvestmentUsdM", year, amount)
            }
          />
        </div>
      </div>
    </div>
  );
}

function InvestmentTable({
  label,
  data,
  onChange,
}: {
  label: string;
  data: { year: number; amount: number }[];
  onChange: (year: number, amount: number) => void;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
        {label}
      </div>
      <div className="overflow-x-auto border border-border rounded">
        <table className="text-xs w-full">
          <thead className="bg-background">
            <tr className="border-b border-border">
              {data.map((d) => (
                <th key={d.year} className="p-2 text-right font-mono">
                  {d.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {data.map((d) => (
                <td key={d.year} className="p-1">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={d.amount}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      onChange(d.year, v);
                    }}
                    className="w-full px-1.5 py-1 border border-border rounded text-right font-mono text-xs"
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
