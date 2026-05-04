export type SyncFrequency =
  | "realtime"
  | "hourly"
  | "daily"
  | "weekly"
  | "on-demand";

export type ConnectionStatus = "not-connected" | "connected" | "error";

export type AuthMethod = "API Key" | "OAuth" | "Service Account";

export interface SystemDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  endpointUrl: string;
  authMethod: AuthMethod;
  defaultFrequency: SyncFrequency;
  fieldMappings: { source: string; target: string }[];
}

export interface SystemConnection {
  status: ConnectionStatus;
  lastSync?: string;
  nextSync?: string;
  syncFrequency: SyncFrequency;
  connectedAt?: string;
}

export const SYSTEMS: SystemDefinition[] = [
  {
    id: "gstarr",
    name: "gSTARR",
    category: "Operational Forecasting Platform",
    description: "Pull weekly STF inputs, inventory positions, and pricing assumptions",
    endpointUrl: "https://gstarr.gene.com/api/v1/forecasting",
    authMethod: "API Key",
    defaultFrequency: "daily",
    fieldMappings: [
      { source: "gSTARR.weekly_outs", target: "STFInputs.weeklyInputs.baselineOuts" },
      { source: "gSTARR.holiday_adj", target: "STFInputs.weeklyInputs.holidayAdjPct" },
      { source: "gSTARR.inventory_position", target: "STFInputs.inventoryStart" },
      { source: "gSTARR.event_impact", target: "STFInputs.weeklyInputs.eventImpactUnits" },
    ],
  },
  {
    id: "tm1",
    name: "TM1",
    category: "Long-Range Planning",
    description: "Pull annual LRP assumptions; push reconciled forecasts as governed versions",
    endpointUrl: "https://tm1.gene.com/api/v2/lrp",
    authMethod: "Service Account",
    defaultFrequency: "weekly",
    fieldMappings: [
      { source: "TM1.class_share", target: "TrendFitInputs.classShare" },
      { source: "TM1.product_share", target: "TrendFitInputs.productShare" },
      { source: "TM1.gross_price", target: "TrendFitInputs.grossPrice" },
      { source: "TM1.gtn_rate", target: "TrendFitInputs.gtnRate" },
    ],
  },
  {
    id: "oasis",
    name: "Oasis",
    category: "Pricing & GTN Master",
    description: "Gross price, trade discount, reserve rate sync nightly",
    endpointUrl: "https://oasis.gene.com/api/v2/forecasting",
    authMethod: "OAuth",
    defaultFrequency: "daily",
    fieldMappings: [
      { source: "Oasis.gross_price", target: "STFInputs.weeklyInputs.grossPriceOverride" },
      { source: "Oasis.trade_discount", target: "STFInputs.weeklyInputs.tradeDiscountOverride" },
      { source: "Oasis.reserve_rate", target: "STFInputs.weeklyInputs.reserveRateOverride" },
    ],
  },
  {
    id: "symphony",
    name: "Symphony PHAST",
    category: "Weekly NBRx/TRx Data",
    description: "Weekly NBRx and TRx by territory, refresh Friday afternoons",
    endpointUrl: "https://api.symphonyhealth.com/phast/v3",
    authMethod: "API Key",
    defaultFrequency: "weekly",
    fieldMappings: [
      { source: "Symphony.nbrx_weekly", target: "Engine.demandSignal.nbrx" },
      { source: "Symphony.trx_weekly", target: "Engine.demandSignal.trx" },
      { source: "Symphony.territory", target: "Engine.demandSignal.territory" },
    ],
  },
  {
    id: "sphub",
    name: "Specialty Pharmacy Hub Feeds",
    category: "Accredo, CVS Specialty, Walgreens",
    description: "Daily inventory and dispense data",
    endpointUrl: "https://hub-feeds.gene.com/api/v1",
    authMethod: "Service Account",
    defaultFrequency: "daily",
    fieldMappings: [
      { source: "Hub.inventory_units", target: "STFInputs.inventoryStart.units" },
      { source: "Hub.dispenses_daily", target: "Engine.demandSignal.dispenses" },
      { source: "Hub.tier_share", target: "STFInputs.inventoryStart.tierShare" },
    ],
  },
  {
    id: "gps",
    name: "GPS",
    category: "Patient Services",
    description: "Patient enrollment, hub workflow, prior-auth status",
    endpointUrl: "https://gps.gene.com/api/v1/patients",
    authMethod: "OAuth",
    defaultFrequency: "daily",
    fieldMappings: [
      { source: "GPS.enrollment_status", target: "Engine.patientFlow.enrollment" },
      { source: "GPS.pa_outcome", target: "Engine.patientFlow.priorAuth" },
    ],
  },
  {
    id: "finance",
    name: "Finance & Reserves",
    category: "Reserve & GTN Truing",
    description: "Reserve rate updates, gross-to-net true-ups",
    endpointUrl: "https://finance.gene.com/api/v1/reserves",
    authMethod: "Service Account",
    defaultFrequency: "weekly",
    fieldMappings: [
      { source: "Finance.reserve_rate", target: "STFInputs.weeklyInputs.reserveRateOverride" },
      { source: "Finance.gtn_true_up", target: "TrendFitInputs.gtnRate" },
    ],
  },
];

export const PRE_CONNECTED_IDS = ["oasis", "symphony", "sphub"] as const;

function isoMinus(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

function isoPlus(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

export function defaultConnections(): Record<string, SystemConnection> {
  const out: Record<string, SystemConnection> = {};
  for (const s of SYSTEMS) {
    if (PRE_CONNECTED_IDS.includes(s.id as (typeof PRE_CONNECTED_IDS)[number])) {
      out[s.id] = {
        status: "connected",
        syncFrequency: s.defaultFrequency,
        connectedAt: isoMinus(48),
        lastSync: isoMinus(s.id === "symphony" ? 72 : s.id === "sphub" ? 4 : 8),
        nextSync: isoPlus(s.id === "symphony" ? 96 : 20),
      };
    } else {
      out[s.id] = {
        status: "not-connected",
        syncFrequency: s.defaultFrequency,
      };
    }
  }
  return out;
}

export function aggregateStatusDot(
  connections: Record<string, SystemConnection>,
): "gray" | "green" | "amber" | "red" {
  const values = Object.values(connections);
  if (values.some((v) => v.status === "error")) return "red";
  const connected = values.filter((v) => v.status === "connected");
  if (connected.length === 0) return "gray";
  // Amber if any sync overdue (nextSync in the past)
  const now = Date.now();
  const overdue = connected.some(
    (v) => v.nextSync && new Date(v.nextSync).getTime() < now,
  );
  return overdue ? "amber" : "green";
}
