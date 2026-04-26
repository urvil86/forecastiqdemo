export function fitExpSmoothing(
  actuals: { year: number; value: number }[],
  projectToYear: number,
  params: { alpha?: number } = {}
): { projection: { year: number; value: number }[]; rmse: number; rsq: number } {
  const alpha = params.alpha ?? 0.3;
  const n = actuals.length;
  if (n < 2) {
    const v = n ? actuals[0].value : 0;
    const projection: { year: number; value: number }[] = [];
    const lastYear = n ? actuals[n - 1].year : projectToYear;
    for (let y = lastYear + 1; y <= projectToYear; y++) projection.push({ year: y, value: v });
    return { projection, rmse: 0, rsq: 0 };
  }
  const smoothed: number[] = [actuals[0].value];
  for (let i = 1; i < n; i++) {
    smoothed.push(alpha * actuals[i].value + (1 - alpha) * smoothed[i - 1]);
  }
  let ssRes = 0;
  const meanY = actuals.reduce((s, a) => s + a.value, 0) / n;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (actuals[i].value - smoothed[i]) ** 2;
    ssTot += (actuals[i].value - meanY) ** 2;
  }
  const rmse = Math.sqrt(ssRes / n);
  const rsq = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  const lastYear = actuals[n - 1].year;
  const lastVal = smoothed[n - 1];
  const lastDelta = smoothed[n - 1] - smoothed[n - 2];
  const projection: { year: number; value: number }[] = [];
  for (let y = lastYear + 1; y <= projectToYear; y++) {
    const stepsAhead = y - lastYear;
    projection.push({ year: y, value: Math.max(0, lastVal + stepsAhead * lastDelta) });
  }
  return { projection, rmse, rsq };
}
