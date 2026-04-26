import { classNames, formatYoyArrow } from "@/lib/format";

export function KpiCard({
  label,
  value,
  sub,
  prevValue,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  prevValue?: number;
  accent?: "primary" | "secondary" | "info";
}) {
  let yoy: { arrow: string; pct: string; positive: boolean } | null = null;
  if (typeof prevValue === "number") {
    const cur = parseFloat(value.replace(/[^0-9.\-]/g, ""));
    yoy = formatYoyArrow(cur, prevValue);
  }
  return (
    <div className="card flex-1 min-w-[160px]">
      <div className="caption text-muted">{label}</div>
      <div
        className={classNames(
          "font-heading font-extrabold text-h2 leading-none mt-2",
          accent === "primary" && "text-primary",
          accent === "secondary" && "text-secondary"
        )}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
      {yoy && (
        <div className={classNames("text-xs mt-1", yoy.positive ? "text-success" : "text-danger")}>
          {yoy.arrow} {yoy.pct} vs prior
        </div>
      )}
    </div>
  );
}
