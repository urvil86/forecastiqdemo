import type { Lever, ElasticityResponse } from "./types";

export function elasticityImpactPct(lever: Lever, intensity: number): number {
  const p = lever.elasticityParams;
  const x = Math.max(0, intensity);
  switch (lever.elasticityShape) {
    case "logarithmic":
      // impact = saturationImpact * (1 - exp(-k * x))
      return p.saturationImpact * (1 - Math.exp(-(p.decayRate ?? 0.2) * x));
    case "s-curve":
      // impact = saturationImpact / (1 + exp(-k * (x - x0)))
      return p.saturationImpact / (1 + Math.exp(-(p.steepness ?? 0.5) * (x - (p.midpoint ?? lever.maxIntensity / 2))));
    case "capacity-bounded": {
      const cap = p.capacityThreshold ?? lever.maxIntensity;
      if (x >= cap) return p.saturationImpact;
      const t = cap === 0 ? 0 : x / cap;
      return p.baselineImpact + (p.saturationImpact - p.baselineImpact) * t;
    }
    case "linear-bounded": {
      const cap = lever.maxIntensity;
      const t = cap === 0 ? 0 : Math.min(1, x / cap);
      return p.baselineImpact + (p.saturationImpact - p.baselineImpact) * t;
    }
  }
}

export function marginalImpact(lever: Lever, currentIntensity: number, unitDelta = 1): number {
  return elasticityImpactPct(lever, currentIntensity + unitDelta) - elasticityImpactPct(lever, currentIntensity);
}

export function elasticityCurve(lever: Lever, numPoints = 30): { intensity: number; impactPct: number }[] {
  const out: { intensity: number; impactPct: number }[] = [];
  // Start at 0 (not minIntensity) so the curve shows the threshold/ramp behavior visibly
  const start = 0;
  const end = lever.maxIntensity;
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const intensity = start + t * (end - start);
    out.push({ intensity, impactPct: elasticityImpactPct(lever, intensity) });
  }
  return out;
}

export function saturationIntensity(lever: Lever, fraction = 0.95): number {
  // Numerically scan the curve and return intensity at which `fraction` of saturationImpact is reached
  const target = lever.elasticityParams.saturationImpact * fraction;
  const samples = 200;
  for (let i = 0; i <= samples; i++) {
    const x = (i / samples) * lever.maxIntensity;
    if (elasticityImpactPct(lever, x) >= target) return x;
  }
  return lever.maxIntensity;
}

export function elasticityResponse(lever: Lever, currentIntensity: number): ElasticityResponse {
  const margAtCurrent = marginalImpact(lever, currentIntensity);
  const margAtMax = marginalImpact(lever, lever.maxIntensity - 1);
  const ratio = margAtCurrent === 0 ? 0 : margAtMax / margAtCurrent;
  return {
    leverId: lever.id,
    curvePoints: elasticityCurve(lever),
    marginalImpactAtCurrent: margAtCurrent,
    marginalImpactAtMax: margAtMax,
    diminishingReturnsRatio: ratio,
    saturationIntensity: saturationIntensity(lever),
  };
}
