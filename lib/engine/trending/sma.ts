export function fitSmaAuto(
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
  const candidates = [2, 3, 4, 5].filter((w) => w < n);
  if (candidates.length === 0) candidates.push(2);

  let bestWindow = candidates[0];
  let bestMse = Infinity;
  let bestFitted: number[] = [];
  for (const w of candidates) {
    const fitted: number[] = [];
    let mse = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (i < w) {
        fitted.push(actuals[i].value);
        continue;
      }
      let s = 0;
      for (let j = i - w; j < i; j++) s += actuals[j].value;
      const ma = s / w;
      fitted.push(ma);
      mse += (actuals[i].value - ma) ** 2;
      count++;
    }
    mse = count > 0 ? mse / count : Infinity;
    if (mse < bestMse) {
      bestMse = mse;
      bestWindow = w;
      bestFitted = fitted;
    }
  }
  const meanY = actuals.reduce((s, a) => s + a.value, 0) / n;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (actuals[i].value - bestFitted[i]) ** 2;
    ssTot += (actuals[i].value - meanY) ** 2;
  }
  const rmse = Math.sqrt(ssRes / n);
  const rsq = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  const lastYear = actuals[n - 1].year;
  const lastWindow = actuals.slice(-bestWindow).map((a) => a.value);
  let cur = lastWindow.reduce((a, b) => a + b, 0) / bestWindow;
  // Average per-step delta over the last window
  let avgDelta = 0;
  for (let i = 1; i < lastWindow.length; i++) avgDelta += lastWindow[i] - lastWindow[i - 1];
  avgDelta = lastWindow.length > 1 ? avgDelta / (lastWindow.length - 1) : 0;

  const projection: { year: number; value: number }[] = [];
  for (let y = lastYear + 1; y <= projectToYear; y++) {
    cur += avgDelta;
    projection.push({ year: y, value: Math.max(0, cur) });
  }
  return { projection, rmse, rsq };
}
