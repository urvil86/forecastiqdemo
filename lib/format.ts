export function formatUsdShort(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function formatUsdMillions(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return "—";
  return `$${(v / 1e6).toFixed(digits)}M`;
}

export function formatPct(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatNumber(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(v);
}

export function formatYoyArrow(curr: number, prev: number): { arrow: string; pct: string; positive: boolean } {
  if (!prev) return { arrow: "·", pct: "—", positive: true };
  const delta = (curr - prev) / prev;
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "·";
  return {
    arrow,
    pct: `${(delta * 100).toFixed(1)}%`,
    positive: delta >= 0,
  };
}

export function classNames(...cn: (string | false | null | undefined)[]): string {
  return cn.filter(Boolean).join(" ");
}
