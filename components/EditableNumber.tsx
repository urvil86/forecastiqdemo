"use client";

import { useEffect, useState } from "react";

export function EditableNumber({
  value,
  onChange,
  format = (v: number) => String(v),
  parse = (s: string) => parseFloat(s.replace(/[^0-9.\-]/g, "")),
  className,
  suffix,
  prefix,
  step,
  disabled,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  parse?: (s: string) => number;
  className?: string;
  suffix?: string;
  prefix?: string;
  step?: number;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value === undefined ? "" : format(value));

  useEffect(() => {
    if (!editing) setDraft(value === undefined ? "" : format(value));
  }, [value, editing, format]);

  function commit() {
    const parsed = parse(draft);
    if (Number.isFinite(parsed)) onChange(parsed);
    else if (value !== undefined) setDraft(format(value));
    setEditing(false);
  }

  if (disabled) {
    return <span className={className ?? "computed-cell"}>{prefix ?? ""}{value === undefined ? "—" : format(value)}{suffix ?? ""}</span>;
  }

  return (
    <input
      type="text"
      value={editing ? draft : (value === undefined ? "" : format(value))}
      onFocus={(e) => {
        setEditing(true);
        setDraft(value === undefined ? "" : format(value));
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value === undefined ? "" : format(value));
          setEditing(false);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={className ?? "input-cell"}
      step={step}
    />
  );
}
