export function interpolateAnchors(
  anchors: { year: number; value: number }[],
  startYear: number,
  endYear: number
): { year: number; value: number }[] {
  const sorted = [...anchors].sort((a, b) => a.year - b.year);
  const out: { year: number; value: number }[] = [];
  if (sorted.length === 0) {
    for (let y = startYear; y <= endYear; y++) out.push({ year: y, value: 0 });
    return out;
  }
  for (let y = startYear; y <= endYear; y++) {
    if (y <= sorted[0].year) {
      out.push({ year: y, value: sorted[0].value });
      continue;
    }
    if (y >= sorted[sorted.length - 1].year) {
      out.push({ year: y, value: sorted[sorted.length - 1].value });
      continue;
    }
    let prev = sorted[0];
    let next = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].year <= y && sorted[i + 1].year >= y) {
        prev = sorted[i];
        next = sorted[i + 1];
        break;
      }
    }
    const span = next.year - prev.year;
    const t = span === 0 ? 0 : (y - prev.year) / span;
    out.push({ year: y, value: prev.value + t * (next.value - prev.value) });
  }
  return out;
}
