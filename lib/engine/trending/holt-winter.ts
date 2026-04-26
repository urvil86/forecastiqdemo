interface HWResult {
  projection: { year: number; value: number }[];
  rmse: number;
  rsq: number;
}

export function fitHoltWinterAdditive(
  actuals: { year: number; value: number }[],
  projectToYear: number,
  params: { alpha?: number; beta?: number } = {}
): HWResult {
  const alpha = params.alpha ?? 0.4;
  const beta = params.beta ?? 0.2;
  const n = actuals.length;
  if (n < 2) {
    const v = n ? actuals[0].value : 0;
    const projection: { year: number; value: number }[] = [];
    const lastYear = n ? actuals[n - 1].year : projectToYear;
    for (let y = lastYear + 1; y <= projectToYear; y++) projection.push({ year: y, value: v });
    return { projection, rmse: 0, rsq: 0 };
  }
  let level = actuals[0].value;
  let trend = actuals[1].value - actuals[0].value;
  const fitted: number[] = [level];
  for (let i = 1; i < n; i++) {
    const prevLevel = level;
    level = alpha * actuals[i].value + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    fitted.push(level);
  }
  let ssRes = 0;
  const meanY = actuals.reduce((s, a) => s + a.value, 0) / n;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (actuals[i].value - fitted[i]) ** 2;
    ssTot += (actuals[i].value - meanY) ** 2;
  }
  const rmse = Math.sqrt(ssRes / n);
  const rsq = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  const lastYear = actuals[n - 1].year;
  const projection: { year: number; value: number }[] = [];
  for (let y = lastYear + 1; y <= projectToYear; y++) {
    const h = y - lastYear;
    projection.push({ year: y, value: Math.max(0, level + h * trend) });
  }
  return { projection, rmse, rsq };
}

export function fitHoltWinterMultiplicative(
  actuals: { year: number; value: number }[],
  projectToYear: number,
  params: { alpha?: number; beta?: number } = {}
): HWResult {
  const alpha = params.alpha ?? 0.4;
  const beta = params.beta ?? 0.2;
  const n = actuals.length;
  if (n < 2) {
    const v = n ? actuals[0].value : 0;
    const projection: { year: number; value: number }[] = [];
    const lastYear = n ? actuals[n - 1].year : projectToYear;
    for (let y = lastYear + 1; y <= projectToYear; y++) projection.push({ year: y, value: v });
    return { projection, rmse: 0, rsq: 0 };
  }
  let level = actuals[0].value;
  let growth =
    actuals[0].value > 0 ? actuals[1].value / actuals[0].value : 1;
  const fitted: number[] = [level];
  for (let i = 1; i < n; i++) {
    const prevLevel = level;
    level = alpha * actuals[i].value + (1 - alpha) * (level * growth);
    growth =
      prevLevel > 0
        ? beta * (level / prevLevel) + (1 - beta) * growth
        : growth;
    fitted.push(level);
  }
  let ssRes = 0;
  const meanY = actuals.reduce((s, a) => s + a.value, 0) / n;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (actuals[i].value - fitted[i]) ** 2;
    ssTot += (actuals[i].value - meanY) ** 2;
  }
  const rmse = Math.sqrt(ssRes / n);
  const rsq = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  const lastYear = actuals[n - 1].year;
  const projection: { year: number; value: number }[] = [];
  let cur = level;
  // Dampen multiplicative growth slightly for long horizons
  const dampedGrowth = 1 + (growth - 1) * 0.85;
  for (let y = lastYear + 1; y <= projectToYear; y++) {
    cur = cur * dampedGrowth;
    projection.push({ year: y, value: Math.max(0, cur) });
  }
  return { projection, rmse, rsq };
}
