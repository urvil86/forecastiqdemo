export function fitLinear(
  actuals: { year: number; value: number }[],
  projectToYear: number
): { projection: { year: number; value: number }[]; rmse: number; rsq: number } {
  const n = actuals.length;
  if (n < 2) {
    const v = n ? actuals[0].value : 0;
    const projection: { year: number; value: number }[] = [];
    const lastYear = n ? actuals[n - 1].year : projectToYear;
    for (let y = lastYear + 1; y <= projectToYear; y++) projection.push({ year: y, value: v });
    return { projection, rmse: 0, rsq: 0 };
  }
  const xs = actuals.map((_, i) => i);
  const ys = actuals.map((a) => a.value);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  let ssRes = 0,
    ssTot = 0;
  for (let i = 0; i < n; i++) {
    const yhat = intercept + slope * xs[i];
    ssRes += (ys[i] - yhat) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const rmse = Math.sqrt(ssRes / n);
  const rsq = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  const lastYear = actuals[n - 1].year;
  const projection: { year: number; value: number }[] = [];
  for (let y = lastYear + 1; y <= projectToYear; y++) {
    const idx = y - actuals[0].year;
    projection.push({ year: y, value: Math.max(0, intercept + slope * idx) });
  }
  return { projection, rmse, rsq };
}
