// Deterministic synthetic seed data used by the STF Review zone where
// the engine doesn't carry account-level or fully-granular daily history.
// Reproducible via seeded LCG so demos are stable across reloads.

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const REGIONS = ["Northeast", "Southeast", "Midwest", "West", "South-Central"] as const;
type Region = (typeof REGIONS)[number];

const REGION_COLOR: Record<Region, string> = {
  Northeast: "#004466",
  Southeast: "#C98B27",
  Midwest: "#0A5C82",
  West: "#1F8A5C",
  "South-Central": "#3B82C4",
};

const ACCOUNT_NAMES = [
  "Cleveland Clinic", "Mass General", "Mayo Rochester", "Johns Hopkins", "UCSF Health",
  "Cedars-Sinai", "Mount Sinai", "Northwestern Memorial", "Houston Methodist", "Duke Health",
  "NYU Langone", "Stanford Health", "UCLA Health", "Brigham & Women's", "Yale New Haven",
  "Penn Medicine", "Vanderbilt", "Emory Healthcare", "Mayo Phoenix", "Mayo Jacksonville",
  "Barnes-Jewish", "Henry Ford", "Cleveland MetroHealth", "Stony Brook", "Westchester Med",
  "MSK Cancer", "Hartford HealthCare", "Geisinger", "Lehigh Valley", "Beaumont Health",
  "Spectrum Health", "Kaiser Permanente NorCal", "Kaiser Permanente SoCal", "Sutter Health",
  "Banner Health", "HCA Houston", "Memorial Hermann", "Texas Health Resources", "Baylor Scott & White",
  "Mt Sinai Miami",
];

export interface AccountPerf {
  id: string;
  name: string;
  region: Region;
  qtdPctOfTarget: number;
  qoqGrowthPct: number;
  revenueUsd: number;
  topPrescribers: string[];
  variancePattern: string;
  recommendedAction: string;
}

export function getAccounts(): AccountPerf[] {
  const rand = seededRandom(2026);
  const accounts: AccountPerf[] = [];

  for (let i = 0; i < ACCOUNT_NAMES.length; i++) {
    const name = ACCOUNT_NAMES[i];
    const region = REGIONS[i % REGIONS.length];

    // Distribution: most accounts cluster around 95-105% of target with mild growth
    // A few outliers in each quadrant for visual richness
    const isStar = i % 11 === 0;
    const isUnderperf = i % 13 === 0;
    const isEmerging = i % 9 === 0 && !isStar;
    const isMature = i % 7 === 0 && !isStar && !isUnderperf;

    let qtd: number, growth: number, rev: number;
    if (isStar) {
      qtd = 105 + rand() * 10;
      growth = 8 + rand() * 12;
      rev = 12_000_000 + rand() * 5_000_000;
    } else if (isUnderperf) {
      qtd = 75 + rand() * 18;
      growth = -8 + rand() * 6;
      rev = 4_000_000 + rand() * 4_000_000;
    } else if (isEmerging) {
      qtd = 92 + rand() * 8;
      growth = 12 + rand() * 10;
      rev = 3_000_000 + rand() * 4_000_000;
    } else if (isMature) {
      qtd = 98 + rand() * 6;
      growth = -1 + rand() * 4;
      rev = 9_000_000 + rand() * 5_000_000;
    } else {
      qtd = 92 + rand() * 14;
      growth = 0 + rand() * 8;
      rev = 5_000_000 + rand() * 5_000_000;
    }

    accounts.push({
      id: `acct-${i}`,
      name,
      region,
      qtdPctOfTarget: qtd,
      qoqGrowthPct: growth,
      revenueUsd: rev,
      topPrescribers: [
        `Dr. ${["Patel", "Chen", "Smith", "Johnson", "Lee"][i % 5]}`,
        `Dr. ${["Williams", "Garcia", "Brown", "Davis"][i % 4]}`,
      ],
      variancePattern: isStar
        ? "Consistent over-performance; prescriber adoption strong."
        : isUnderperf
        ? "Sustained negative variance; investigate access barriers."
        : isEmerging
        ? "Accelerating growth on small base."
        : "Within normal range.",
      recommendedAction: isStar
        ? "Maintain coverage; protect from competitive pressure."
        : isUnderperf
        ? "Investigate variance cause; consider field-force or sample reallocation."
        : isEmerging
        ? "Concentrated targeting opportunity — invest to scale."
        : "Routine monitoring.",
    });
  }
  return accounts;
}

export function getRegionColor(region: string): string {
  return REGION_COLOR[region as Region] ?? "#5C6770";
}

// Daily variance heatmap: 26 weeks × 5 weekdays. Variance is % above/below forecast.
export function getDailyVariance(weeks = 26): { weekStart: string; days: { day: string; variancePct: number; date: string; forecast: number; actual: number }[] }[] {
  const rand = seededRandom(2027);
  const out: { weekStart: string; days: { day: string; variancePct: number; date: string; forecast: number; actual: number }[] }[] = [];
  const today = new Date("2026-04-12");
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStartDate = new Date(today.getTime() - w * 7 * 86_400_000);
    // Nudge to Monday
    const day = weekStartDate.getUTCDay();
    weekStartDate.setUTCDate(weekStartDate.getUTCDate() - ((day === 0 ? 6 : day - 1)));
    const weekStartIso = weekStartDate.toISOString().slice(0, 10);
    const days: { day: string; variancePct: number; date: string; forecast: number; actual: number }[] = [];
    for (let d = 0; d < 5; d++) {
      const date = new Date(weekStartDate.getTime() + d * 86_400_000);
      const dayKey = ["Mon", "Tue", "Wed", "Thu", "Fri"][d];
      // Wednesday-heavy realistic data; small noise
      const baseForecast = d === 2 ? 7500 : d === 1 ? 380 : d === 3 ? 510 : d === 4 ? 200 : 50;
      const noise = (rand() - 0.5) * 0.18; // ±9%
      const trendShift = w < 8 ? -0.02 : 0; // last 8 weeks slight underperformance
      const friCluster = d === 4 && w >= 3 && w <= 6 ? -0.06 : 0;
      const variance = noise + trendShift + friCluster;
      days.push({
        day: dayKey,
        date: date.toISOString().slice(0, 10),
        forecast: baseForecast,
        actual: baseForecast * (1 + variance),
        variancePct: variance,
      });
    }
    out.push({ weekStart: weekStartIso, days });
  }
  return out;
}

// Channel reconciliation table data: last 8 weeks
export function getChannelReconciliation(): {
  weekEnding: string;
  ins852: number;
  outs867: number;
  returns: number;
  netFlow: number;
  inventoryChange: number;
  inventoryEnd: number;
}[] {
  const rand = seededRandom(2028);
  const out: ReturnType<typeof getChannelReconciliation> = [];
  let inventory = 200_000;
  for (let i = 7; i >= 0; i--) {
    const weekEndDate = new Date("2026-04-12");
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() - i * 7);
    const ins = Math.round(50_000 + rand() * 10_000);
    const outs = Math.round(48_000 + rand() * 8_000);
    const returns = Math.round(rand() * 1500);
    const net = ins - outs - returns;
    inventory += net;
    out.push({
      weekEnding: weekEndDate.toISOString().slice(0, 10),
      ins852: ins,
      outs867: outs,
      returns,
      netFlow: net,
      inventoryChange: net,
      inventoryEnd: inventory,
    });
  }
  return out;
}

// Tier inventory time series
export function getTierInventoryHistory(weeks = 13): { weekStart: string; wholesaler: number; sp: number; hub: number }[] {
  const rand = seededRandom(2029);
  const out: ReturnType<typeof getTierInventoryHistory> = [];
  let w = 148_000, sp = 48_000, h = 8_000;
  for (let i = weeks - 1; i >= 0; i--) {
    const date = new Date("2026-04-12");
    date.setUTCDate(date.getUTCDate() - i * 7);
    out.push({ weekStart: date.toISOString().slice(0, 10), wholesaler: w, sp, hub: h });
    w += (rand() - 0.5) * 8000;
    sp += (rand() - 0.5) * 4000;
    h += (rand() - 0.5) * 800;
    w = Math.max(0, w);
    sp = Math.max(0, sp);
    h = Math.max(0, h);
  }
  return out;
}
