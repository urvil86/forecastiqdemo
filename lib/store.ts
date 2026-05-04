"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  computeWithLifecycle,
  getSeedForecast,
  getSeedForecastByKey,
  saveSnapshot,
  restoreFromSnapshot,
  computeVariance,
  statusForVariance,
  DEMO_USERS,
  DEFAULT_DEMO_USER,
  DEFAULT_THRESHOLD,
  type ConnectedForecast,
  type ComputedForecastConnected,
  type DemoUser,
  type ForecastSeedKey,
  type LifecycleMode,
  type ReconciliationAction,
  type ThresholdConfig,
  type VarianceStatus,
  type VersionSnapshot,
} from "./engine";
import {
  generateRecommendation,
  evaluateAllocation,
  generateBreakdown,
  type AllocationRequest,
  type AllocationResult,
  type LeverId,
  type OptimizationConstraint,
} from "./growth-intel";
import {
  defaultConnections,
  type SystemConnection,
  type SyncFrequency,
} from "./systems";
import {
  applyUploadToForecast,
  type UploadPayload,
} from "./upload-parser";

type Zone = "setup" | "build" | "review" | "connect";

export interface AgentMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: number;
  actions?: { label: string; tone?: "primary" | "ghost" }[];
}

interface AppStore {
  forecast: ConnectedForecast;
  computed: ComputedForecastConnected | null;
  versionHistory: VersionSnapshot[];
  selectedYear: number;
  selectedZone: Zone;
  selectedSubview: string;
  demoMode: boolean;

  updateLRPInput: (path: string, value: unknown) => void;
  updateSTFInput: (week: string, sku: string, field: string, value: number | undefined) => void;
  setSelectedAlgorithm: (algo: ConnectedForecast["lrp"]["selectedAlgorithm"]) => void;
  toggleEvent: (eventId: string) => void;
  updateEvent: (eventId: string, patch: Partial<ConnectedForecast["lrp"]["events"][number]>) => void;
  removeEvent: (eventId: string) => void;
  addEvent: () => void;
  setLrpAnchor: (
    field: "classShare" | "productShare" | "grossPrice" | "gtnRate",
    year: number,
    value: number
  ) => void;
  setCustomizationPoint: (year: number, value: number) => void;
  resetCustomizationToTrend: () => void;

  // Daily Sales Pattern profiles
  setDailyProfileWeight: (profileId: string, day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun", value: number) => void;
  normalizeDailyProfile: (profileId: string) => void;
  renameDailyProfile: (profileId: string, name: string) => void;
  addDailyProfile: (basedOn?: string) => void;
  removeDailyProfile: (profileId: string) => void;
  assignProfileToWeek: (weekStart: string, profileId: string | null) => void;
  setSelectedZone: (z: Zone) => void;
  setSelectedSubview: (s: string) => void;
  setDemoMode: (v: boolean) => void;

  // STF events (short-horizon)
  toggleStfEvent: (eventId: string) => void;
  updateStfEvent: (eventId: string, patch: Partial<ConnectedForecast["stf"]["events"][number]>) => void;
  removeStfEvent: (eventId: string) => void;
  addStfEvent: () => void;

  // NFS / Samples
  updateNfs: (field: keyof ConnectedForecast["stf"]["nfs"], value: number) => void;

  // SKU mix horizon — locks current defaultMixPct as a per-week override for the next N weeks
  applySkuMixForWeeks: (weeks: number) => void;
  // Apply user-specified mix values for the next N weeks (instead of reading defaultMixPct)
  applySkuMixCustomForWeeks: (weeks: number, mixBySkuId: Record<string, number>) => void;
  clearSkuMixOverrides: () => void;

  // NFS forward plan — set planned samples/PAP/bridge per-week values for a forward window
  applyNfsPlanForWeeks: (
    weeks: number,
    samplesPerWeek: number,
    papPerWeek: number,
    bridgePerWeek: number
  ) => void;
  clearNfsPlan: () => void;

  recompute: () => void;
  saveVersion: (label: string) => void;
  loadVersion: (versionId: string) => void;
  resetToSeed: () => void;

  // Lifecycle / demo seeds
  activeSeedKey: ForecastSeedKey;
  loadSeed: (key: ForecastSeedKey) => void;
  setLifecycleMode: (mode: LifecycleMode) => void;
  selectedTab: string;
  setSelectedTab: (tab: string) => void;

  // Growth Intelligence
  growthIntel: {
    lastRequest: AllocationRequest | null;
    lastResult: AllocationResult | null;
    isComputing: boolean;
    alternativeBeingViewed: number | null;
  };
  runGrowthIntel: (params: {
    budgetUsd: number;
    forecastYear: number;
    timelineWeeks: number;
    constraints: OptimizationConstraint[];
    objective: AllocationRequest["objective"];
    useLLM?: boolean;
  }) => Promise<void>;
  clearGrowthIntel: () => void;
  setGrowthAlternative: (idx: number | null) => void;
  pushAllocationToScenario: () => string | null;
  runManualEvaluation: (params: {
    forecastYear: number;
    timelineWeeks: number;
    manualAllocations: { leverId: LeverId; investmentUsd: number }[];
  }) => Promise<void>;

  // AI Copilot (placeholder, non-functioning — canned responses only)
  agentOpen: boolean;
  agentMessages: AgentMessage[];
  agentTyping: boolean;
  setAgentOpen: (open: boolean) => void;
  sendAgentMessage: (text: string, pageContext?: string) => Promise<void>;
  clearAgentMessages: () => void;

  // v2.5 Demo user, threshold, snapshot system
  currentDemoUser: DemoUser;
  threshold: ThresholdConfig;
  setDemoUser: (user: DemoUser) => void;
  setThreshold: (threshold: ThresholdConfig) => void;
  createSnapshot: (ctx: {
    triggerType: VersionSnapshot["triggerType"];
    triggerReason: VersionSnapshot["triggerReason"];
    action?: ReconciliationAction;
    reason?: string;
    notify?: { name: string; email: string }[];
    label?: string;
  }) => VersionSnapshot | null;
  restoreSnapshot: (snapshotId: string) => void;
  /** Compute current variance status against current threshold */
  varianceStatus: () => {
    rolling4Week: number;
    rolling13Week: number;
    ytd: number;
    status: VarianceStatus;
  };

  // v2.5 Brand selection (independent of seed/lifecycle)
  setBrand: (brand: ConnectedForecast["brand"]) => void;

  // v2.5 Addendum: System connections
  connectedSystems: Record<string, SystemConnection>;
  setSystemConnection: (
    systemId: string,
    config: Partial<SystemConnection> & { status: SystemConnection["status"] },
  ) => void;
  syncSystem: (systemId: string) => number;
  disconnectSystem: (systemId: string) => void;
  setSystemFrequency: (systemId: string, frequency: SyncFrequency) => void;

  // v2.5 Addendum: Excel upload
  applyUpload: (
    payload: UploadPayload,
    options: { mode: "active" | "scenario"; reason?: string },
  ) => void;
}

let recomputeTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRecompute(get: () => AppStore) {
  if (recomputeTimer) clearTimeout(recomputeTimer);
  recomputeTimer = setTimeout(() => {
    get().recompute();
  }, 100);
}

function setNested(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const parts = path.split(".");
  const next: Record<string, unknown> = Array.isArray(obj) ? ([...obj] as unknown as Record<string, unknown>) : { ...obj };
  let cur: Record<string, unknown> = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const child = cur[p];
    cur[p] = Array.isArray(child)
      ? ([...child] as unknown as Record<string, unknown>)
      : { ...(child as Record<string, unknown>) };
    cur = cur[p] as Record<string, unknown>;
  }
  const lastKey = parts[parts.length - 1];
  // Coerce numeric keys to integer indices for array clarity
  cur[lastKey] = value;
  return next;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      forecast: getSeedForecast(),
      computed: null,
      versionHistory: [],
      selectedYear: 2026,
      selectedZone: "setup",
      selectedSubview: "trend-selection",
      demoMode: false,
      activeSeedKey: "ocrevus-exclusivity",
      selectedTab: "lrp",

      updateLRPInput: (path, value) => {
        set((state) => ({
          forecast: setNested(state.forecast as unknown as Record<string, unknown>, path, value) as unknown as ConnectedForecast,
        }));
        scheduleRecompute(get);
      },
      updateSTFInput: (week, sku, field, value) => {
        set((state) => {
          const inputs = [...state.forecast.stf.weeklyInputs];
          let idx = inputs.findIndex((w) => w.weekStart === week && w.sku === sku);
          if (idx < 0) {
            inputs.push({ weekStart: week, sku, trendValue: 0 });
            idx = inputs.length - 1;
          }
          const updated = { ...inputs[idx] };
          if (value === undefined || Number.isNaN(value)) {
            delete (updated as Record<string, unknown>)[field];
          } else {
            (updated as Record<string, unknown>)[field] = value;
          }
          inputs[idx] = updated;
          return {
            forecast: { ...state.forecast, stf: { ...state.forecast.stf, weeklyInputs: inputs } },
          };
        });
        scheduleRecompute(get);
      },
      setSelectedAlgorithm: (algo) => {
        set((state) => ({
          forecast: { ...state.forecast, lrp: { ...state.forecast.lrp, selectedAlgorithm: algo } },
        }));
        scheduleRecompute(get);
      },
      toggleEvent: (eventId) => {
        set((state) => ({
          forecast: {
            ...state.forecast,
            lrp: {
              ...state.forecast.lrp,
              events: state.forecast.lrp.events.map((e) =>
                e.id === eventId ? { ...e, enabled: !e.enabled } : e
              ),
            },
          },
        }));
        scheduleRecompute(get);
      },
      updateEvent: (eventId, patch) => {
        set((state) => ({
          forecast: {
            ...state.forecast,
            lrp: {
              ...state.forecast.lrp,
              events: state.forecast.lrp.events.map((e) =>
                e.id === eventId ? { ...e, ...patch } : e
              ),
            },
          },
        }));
        scheduleRecompute(get);
      },
      removeEvent: (eventId) => {
        set((state) => ({
          forecast: {
            ...state.forecast,
            lrp: {
              ...state.forecast.lrp,
              events: state.forecast.lrp.events.filter((e) => e.id !== eventId),
            },
          },
        }));
        scheduleRecompute(get);
      },
      addEvent: () => {
        const id = `event-${Date.now().toString(36)}`;
        set((state) => ({
          forecast: {
            ...state.forecast,
            lrp: {
              ...state.forecast.lrp,
              events: [
                ...state.forecast.lrp.events,
                {
                  id,
                  name: "New Event",
                  type: "positive",
                  enabled: true,
                  launchDate: "2027-01-01",
                  peakImpact: 0.05,
                  timeToPeakMonths: 24,
                  curveShape: "moderate",
                },
              ],
            },
          },
        }));
        scheduleRecompute(get);
      },
      setLrpAnchor: (field, year, value) => {
        set((state) => {
          const list = [...state.forecast.lrp[field]];
          const idx = list.findIndex((x) => x.year === year);
          if (idx >= 0) list[idx] = { year, value };
          else list.push({ year, value });
          list.sort((a, b) => a.year - b.year);
          return {
            forecast: { ...state.forecast, lrp: { ...state.forecast.lrp, [field]: list } },
          };
        });
        scheduleRecompute(get);
      },
      setCustomizationPoint: (year, value) => {
        set((state) => {
          const existing = state.forecast.lrp.customizationCurve ?? [];
          const next = [...existing];
          const idx = next.findIndex((p) => p.year === year);
          if (idx >= 0) next[idx] = { year, value };
          else next.push({ year, value });
          next.sort((a, b) => a.year - b.year);
          return {
            forecast: { ...state.forecast, lrp: { ...state.forecast.lrp, customizationCurve: next } },
          };
        });
        scheduleRecompute(get);
      },
      resetCustomizationToTrend: () => {
        // Use whichever non-customization algorithm fits best — re-run trend on annualActuals projecting through forecastEnd
        // Then write its projection into customizationCurve as a starting point for manual editing.
        const state = get();
        const endYear = parseInt(state.forecast.timeframe.forecastEnd.split("-")[0]);
        // Lazy import to avoid a circular module load in zustand's createStore initializer
        import("./engine/trending").then((mod) => {
          const fit = mod.trend(
            "quick-expert",
            state.forecast.lrp.annualActuals,
            endYear,
            state.forecast.lrp.algorithmParams
          );
          set((s) => ({
            forecast: { ...s.forecast, lrp: { ...s.forecast.lrp, customizationCurve: fit.projection } },
          }));
          scheduleRecompute(get);
        });
      },
      setDailyProfileWeight: (profileId, day, value) => {
        set((state) => ({
          forecast: {
            ...state.forecast,
            phasing: {
              ...state.forecast.phasing,
              dailyProfiles: state.forecast.phasing.dailyProfiles.map((p) =>
                p.id === profileId
                  ? { ...p, dayWeights: { ...p.dayWeights, [day]: Math.max(0, value) } }
                  : p
              ),
            },
          },
        }));
        scheduleRecompute(get);
      },
      normalizeDailyProfile: (profileId) => {
        set((state) => ({
          forecast: {
            ...state.forecast,
            phasing: {
              ...state.forecast.phasing,
              dailyProfiles: state.forecast.phasing.dailyProfiles.map((p) => {
                if (p.id !== profileId) return p;
                const total =
                  p.dayWeights.Mon + p.dayWeights.Tue + p.dayWeights.Wed + p.dayWeights.Thu + p.dayWeights.Fri + p.dayWeights.Sat + p.dayWeights.Sun;
                if (total === 0) return p;
                const k = 1 / total;
                return {
                  ...p,
                  dayWeights: {
                    Mon: p.dayWeights.Mon * k,
                    Tue: p.dayWeights.Tue * k,
                    Wed: p.dayWeights.Wed * k,
                    Thu: p.dayWeights.Thu * k,
                    Fri: p.dayWeights.Fri * k,
                    Sat: p.dayWeights.Sat * k,
                    Sun: p.dayWeights.Sun * k,
                  },
                };
              }),
            },
          },
        }));
        scheduleRecompute(get);
      },
      renameDailyProfile: (profileId, name) => {
        set((state) => ({
          forecast: {
            ...state.forecast,
            phasing: {
              ...state.forecast.phasing,
              dailyProfiles: state.forecast.phasing.dailyProfiles.map((p) => (p.id === profileId ? { ...p, name } : p)),
            },
          },
        }));
      },
      addDailyProfile: (basedOn) => {
        const id = `profile-${Date.now().toString(36)}`;
        set((state) => {
          const base =
            state.forecast.phasing.dailyProfiles.find((p) => p.id === basedOn) ?? state.forecast.phasing.dailyProfiles[0];
          const seed = base
            ? { ...base.dayWeights }
            : { Mon: 0.14, Tue: 0.14, Wed: 0.16, Thu: 0.16, Fri: 0.14, Sat: 0.13, Sun: 0.13 };
          return {
            forecast: {
              ...state.forecast,
              phasing: {
                ...state.forecast.phasing,
                dailyProfiles: [...state.forecast.phasing.dailyProfiles, { id, name: "Custom profile", dayWeights: seed }],
              },
            },
          };
        });
        scheduleRecompute(get);
      },
      removeDailyProfile: (profileId) => {
        set((state) => {
          if (state.forecast.phasing.dailyProfiles.length <= 1) return state; // keep at least one
          // Drop assignments referencing this profile
          const remainingId =
            state.forecast.phasing.dailyProfiles.find((p) => p.id !== profileId)?.id ?? "standard";
          const newMap = state.forecast.phasing.weeklyProfileMap.filter((m) => m.profileId !== profileId);
          return {
            forecast: {
              ...state.forecast,
              phasing: {
                ...state.forecast.phasing,
                dailyProfiles: state.forecast.phasing.dailyProfiles.filter((p) => p.id !== profileId),
                weeklyProfileMap: newMap,
              },
            },
          };
        });
        scheduleRecompute(get);
      },
      assignProfileToWeek: (weekStart, profileId) => {
        set((state) => {
          const existing = state.forecast.phasing.weeklyProfileMap.filter((m) => m.weekStart !== weekStart);
          const next =
            profileId && profileId !== "standard"
              ? [...existing, { weekStart, profileId }].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
              : existing;
          return {
            forecast: { ...state.forecast, phasing: { ...state.forecast.phasing, weeklyProfileMap: next } },
          };
        });
        scheduleRecompute(get);
      },
      setSelectedZone: (z) => set({ selectedZone: z }),
      setSelectedSubview: (s) => set({ selectedSubview: s }),
      setDemoMode: (v) => set({ demoMode: v }),

      toggleStfEvent: (eventId) => {
        set((state) => ({
          forecast: {
            ...state.forecast,
            stf: {
              ...state.forecast.stf,
              events: state.forecast.stf.events.map((e) =>
                e.id === eventId ? { ...e, enabled: !e.enabled } : e
              ),
            },
          },
        }));
        scheduleRecompute(get);
      },
      updateStfEvent: (eventId, patch) => {
        set((state) => ({
          forecast: {
            ...state.forecast,
            stf: {
              ...state.forecast.stf,
              events: state.forecast.stf.events.map((e) => (e.id === eventId ? { ...e, ...patch } : e)),
            },
          },
        }));
        scheduleRecompute(get);
      },
      removeStfEvent: (eventId) => {
        set((state) => ({
          forecast: {
            ...state.forecast,
            stf: {
              ...state.forecast.stf,
              events: state.forecast.stf.events.filter((e) => e.id !== eventId),
            },
          },
        }));
        scheduleRecompute(get);
      },
      addStfEvent: () => {
        const id = `stf-event-${Date.now().toString(36)}`;
        set((state) => ({
          forecast: {
            ...state.forecast,
            stf: {
              ...state.forecast.stf,
              events: [
                ...state.forecast.stf.events,
                {
                  id,
                  name: "New STF Event",
                  type: "positive",
                  enabled: true,
                  launchDate: "2026-06-01",
                  peakImpact: 0.03,
                  timeToPeakMonths: 2,
                  curveShape: "moderate",
                },
              ],
            },
          },
        }));
        scheduleRecompute(get);
      },
      updateNfs: (field, value) => {
        set((state) => ({
          forecast: {
            ...state.forecast,
            stf: { ...state.forecast.stf, nfs: { ...state.forecast.stf.nfs, [field]: value } },
          },
        }));
      },
      applySkuMixForWeeks: (weeks) => {
        set((state) => {
          const cutoff = new Date(state.forecast.stf.actualsCutoffDate);
          // Snap cutoff to following Monday so weekStarts align with engine grid
          const day = cutoff.getUTCDay();
          const offsetToMon = day === 0 ? 1 : (8 - day) % 7 || 7;
          const firstWeek = new Date(cutoff.getTime());
          firstWeek.setUTCDate(firstWeek.getUTCDate() + offsetToMon);
          const activeSkus = state.forecast.stf.skus.filter((s) => s.active);
          // Drop existing skuMixOverride entries for the affected window first
          const cleaned = state.forecast.stf.weeklyInputs.filter((wi) => wi.skuMixOverride === undefined);
          const next = [...cleaned];
          for (let i = 0; i < weeks; i++) {
            const wd = new Date(firstWeek.getTime());
            wd.setUTCDate(wd.getUTCDate() + i * 7);
            const weekStart = wd.toISOString().slice(0, 10);
            for (const sku of activeSkus) {
              const idx = next.findIndex((wi) => wi.weekStart === weekStart && wi.sku === sku.id);
              if (idx >= 0) {
                next[idx] = { ...next[idx], skuMixOverride: sku.defaultMixPct };
              } else {
                next.push({ weekStart, sku: sku.id, trendValue: 0, skuMixOverride: sku.defaultMixPct });
              }
            }
          }
          return {
            forecast: { ...state.forecast, stf: { ...state.forecast.stf, weeklyInputs: next } },
          };
        });
        scheduleRecompute(get);
      },
      applySkuMixCustomForWeeks: (weeks, mixBySkuId) => {
        set((state) => {
          const cutoff = new Date(state.forecast.stf.actualsCutoffDate);
          const day = cutoff.getUTCDay();
          const offsetToMon = day === 0 ? 1 : (8 - day) % 7 || 7;
          const firstWeek = new Date(cutoff.getTime());
          firstWeek.setUTCDate(firstWeek.getUTCDate() + offsetToMon);
          const activeSkus = state.forecast.stf.skus.filter((s) => s.active);
          const cleaned = state.forecast.stf.weeklyInputs.filter((wi) => wi.skuMixOverride === undefined);
          const next = [...cleaned];
          for (let i = 0; i < weeks; i++) {
            const wd = new Date(firstWeek.getTime());
            wd.setUTCDate(wd.getUTCDate() + i * 7);
            const weekStart = wd.toISOString().slice(0, 10);
            for (const sku of activeSkus) {
              const mix = mixBySkuId[sku.id] ?? sku.defaultMixPct;
              const idx = next.findIndex((wi) => wi.weekStart === weekStart && wi.sku === sku.id);
              if (idx >= 0) {
                next[idx] = { ...next[idx], skuMixOverride: mix };
              } else {
                next.push({ weekStart, sku: sku.id, trendValue: 0, skuMixOverride: mix });
              }
            }
          }
          return {
            forecast: { ...state.forecast, stf: { ...state.forecast.stf, weeklyInputs: next } },
          };
        });
        scheduleRecompute(get);
      },
      applyNfsPlanForWeeks: (weeks, samplesPerWeek, papPerWeek, bridgePerWeek) => {
        set((state) => {
          const cutoff = new Date(state.forecast.stf.actualsCutoffDate);
          const day = cutoff.getUTCDay();
          const offsetToMon = day === 0 ? 1 : (8 - day) % 7 || 7;
          const firstWeek = new Date(cutoff.getTime());
          firstWeek.setUTCDate(firstWeek.getUTCDate() + offsetToMon);
          const fromWeek = firstWeek.toISOString().slice(0, 10);
          return {
            forecast: {
              ...state.forecast,
              stf: {
                ...state.forecast.stf,
                nfs: {
                  ...state.forecast.stf.nfs,
                  plan: { samplesPerWeek, papPerWeek, bridgePerWeek, weeks, fromWeek },
                },
              },
            },
          };
        });
        scheduleRecompute(get);
      },
      clearNfsPlan: () => {
        set((state) => {
          const { plan: _drop, ...nfsRest } = state.forecast.stf.nfs;
          return {
            forecast: {
              ...state.forecast,
              stf: { ...state.forecast.stf, nfs: nfsRest },
            },
          };
        });
        scheduleRecompute(get);
      },
      clearSkuMixOverrides: () => {
        set((state) => {
          const cleaned = state.forecast.stf.weeklyInputs
            .map((wi) => {
              if (wi.skuMixOverride === undefined) return wi;
              const { skuMixOverride: _drop, ...rest } = wi;
              return rest;
            })
            .filter((wi) => {
              // skuMixOverride was just stripped above, so don't check it here
              return (
                wi.override !== undefined ||
                wi.holidayAdjPct !== undefined ||
                wi.eventImpactUnits !== undefined ||
                wi.nfsUnits !== undefined ||
                wi.dohTargetOverride !== undefined ||
                wi.grossPriceOverride !== undefined ||
                wi.tradeDiscountOverride !== undefined ||
                wi.reserveRateOverride !== undefined
              );
            });
          return {
            forecast: {
              ...state.forecast,
              stf: { ...state.forecast.stf, weeklyInputs: cleaned },
            },
          };
        });
        scheduleRecompute(get);
      },

      recompute: () => {
        const result = computeWithLifecycle(get().forecast);
        set({ computed: result });
      },

      loadSeed: (key) => {
        const next = getSeedForecastByKey(key);
        set({ forecast: next, activeSeedKey: key });
        scheduleRecompute(get);
      },
      setLifecycleMode: (mode) => {
        // Lifecycle mode switching loads the matching demo seed.
        const map: Record<LifecycleMode, ForecastSeedKey> = {
          "pre-launch": "fenebrutinib-prelaunch",
          exclusivity: "zunovo-exclusivity",
          "post-loe": "ocrevus-postloe",
        };
        const key = map[mode];
        const next = getSeedForecastByKey(key);
        set({ forecast: next, activeSeedKey: key });
        scheduleRecompute(get);
      },
      setSelectedTab: (tab) => set({ selectedTab: tab }),

      growthIntel: { lastRequest: null, lastResult: null, isComputing: false, alternativeBeingViewed: null },
      runGrowthIntel: async ({ budgetUsd, forecastYear, timelineWeeks, constraints, objective, useLLM }) => {
        set((s) => ({ growthIntel: { ...s.growthIntel, isComputing: true, alternativeBeingViewed: null } }));
        // Tiny await so the UI can render the loading state before sync work runs
        await new Promise((resolve) => setTimeout(resolve, 50));
        const state = get();
        let computed = state.computed;
        if (!computed) {
          computed = computeWithLifecycle(state.forecast);
          set({ computed });
        }
        const result = generateRecommendation(state.forecast, computed, budgetUsd, {
          forecastYear,
          timelineWeeks,
          constraints,
          objective,
          useLLM,
          includeBreakdowns: true,
        });
        set({
          growthIntel: {
            lastRequest: result.request,
            lastResult: result,
            isComputing: false,
            alternativeBeingViewed: null,
          },
        });
      },
      agentOpen: false,
      agentMessages: [],
      agentTyping: false,
      setAgentOpen: (open) => set({ agentOpen: open }),
      sendAgentMessage: async (text, pageContext) => {
        const userMsg: AgentMessage = {
          id: `m-${Date.now().toString(36)}-u`,
          role: "user",
          content: text.trim(),
          timestamp: Date.now(),
        };
        set((s) => ({ agentMessages: [...s.agentMessages, userMsg], agentTyping: true }));
        // Simulate agent thinking
        await new Promise((resolve) => setTimeout(resolve, 700 + Math.random() * 600));
        const reply = cannedAgentReply(text, pageContext);
        const agentMsg: AgentMessage = {
          id: `m-${Date.now().toString(36)}-a`,
          role: "agent",
          content: reply.content,
          timestamp: Date.now(),
          actions: reply.actions,
        };
        set((s) => ({ agentMessages: [...s.agentMessages, agentMsg], agentTyping: false }));
      },
      clearAgentMessages: () => set({ agentMessages: [], agentTyping: false }),

      runManualEvaluation: async ({ forecastYear, timelineWeeks, manualAllocations }) => {
        set((s) => ({ growthIntel: { ...s.growthIntel, isComputing: true, alternativeBeingViewed: null } }));
        await new Promise((resolve) => setTimeout(resolve, 50));
        const state = get();
        let computed = state.computed;
        if (!computed) {
          computed = computeWithLifecycle(state.forecast);
          set({ computed });
        }
        const result = evaluateAllocation(state.forecast, computed, forecastYear, manualAllocations, { timelineWeeks });
        result.breakdowns = result.allocations.map((a) => generateBreakdown(a, state.forecast, computed!, forecastYear));
        set({
          growthIntel: {
            lastRequest: result.request,
            lastResult: result,
            isComputing: false,
            alternativeBeingViewed: null,
          },
        });
      },
      clearGrowthIntel: () =>
        set({ growthIntel: { lastRequest: null, lastResult: null, isComputing: false, alternativeBeingViewed: null } }),
      setGrowthAlternative: (idx) =>
        set((s) => ({ growthIntel: { ...s.growthIntel, alternativeBeingViewed: idx } })),
      pushAllocationToScenario: () => {
        const r = get().growthIntel.lastResult;
        if (!r) return null;
        const lift = r.summary.totalExpectedImpactUsdMid;
        const label = `Growth Intel scenario · $${(r.summary.totalAllocatedUsd / 1e6).toFixed(0)}M budget · +${(lift / 1e6).toFixed(0)}M expected lift`;
        const next = get().forecast.version + 1;
        const updatedForecast = { ...get().forecast, version: next, versionLabel: label };
        const computed = get().computed ?? computeWithLifecycle(updatedForecast);
        const variance = computeVariance(computed);
        const snap = saveSnapshot(updatedForecast, computed, {
          user: get().currentDemoUser,
          triggerType: "manual-save",
          triggerReason: "user-initiated",
          threshold: get().threshold,
          variance,
          label,
          version: next,
        });
        set((state) => ({
          forecast: updatedForecast,
          versionHistory: [snap, ...state.versionHistory],
        }));
        return snap.id;
      },
      saveVersion: (label) => {
        set((state) => {
          const next = state.forecast.version + 1;
          const updated = { ...state.forecast, version: next, versionLabel: label };
          const computed = state.computed ?? computeWithLifecycle(updated);
          const variance = computeVariance(computed);
          const snap = saveSnapshot(updated, computed, {
            user: state.currentDemoUser,
            triggerType: "manual-save",
            triggerReason: "user-initiated",
            threshold: state.threshold,
            variance,
            label,
            version: next,
          });
          return {
            forecast: updated,
            versionHistory: [snap, ...state.versionHistory],
          };
        });
      },
      loadVersion: (versionId) => {
        set((state) => {
          const snap = state.versionHistory.find((v) => v.id === versionId);
          if (!snap) return state;
          return { forecast: snap.forecastSnapshot ?? snap.forecast };
        });
        scheduleRecompute(get);
      },
      resetToSeed: () => {
        set({ forecast: getSeedForecast(), versionHistory: [] });
        scheduleRecompute(get);
      },

      // ─── v2.5 demo user / threshold / snapshot ─────────────────────
      currentDemoUser: DEFAULT_DEMO_USER,
      threshold: DEFAULT_THRESHOLD,
      setDemoUser: (user) => set({ currentDemoUser: user }),
      setThreshold: (threshold) => set({ threshold }),
      createSnapshot: (ctx) => {
        const state = get();
        const next = state.forecast.version + 1;
        const label = ctx.label ?? `${ctx.action ? ctx.action : "Snapshot"} ${new Date().toLocaleTimeString()}`;
        const updated = { ...state.forecast, version: next, versionLabel: label };
        const computed = state.computed ?? computeWithLifecycle(updated);
        const variance = computeVariance(computed);
        const snap = saveSnapshot(updated, computed, {
          user: state.currentDemoUser,
          triggerType: ctx.triggerType,
          triggerReason: ctx.triggerReason,
          action: ctx.action,
          reason: ctx.reason,
          notify: ctx.notify,
          threshold: state.threshold,
          variance,
          label,
          version: next,
        });
        set((s) => ({
          forecast: updated,
          versionHistory: [snap, ...s.versionHistory],
        }));
        return snap;
      },
      restoreSnapshot: (snapshotId) => {
        const state = get();
        const snap = state.versionHistory.find((v) => v.id === snapshotId);
        if (!snap) return;
        const { newForecastState, newSnapshot } = restoreFromSnapshot(
          snap,
          state.currentDemoUser,
          state.threshold,
        );
        set((s) => ({
          forecast: newForecastState,
          versionHistory: [newSnapshot, ...s.versionHistory],
        }));
        scheduleRecompute(get);
      },
      varianceStatus: () => {
        const state = get();
        const v = computeVariance(state.computed);
        const rollingPick =
          state.threshold.rollingWindow === "13-week"
            ? v.rolling13Week
            : v.rolling4Week;
        const status = statusForVariance(rollingPick, state.threshold);
        return { ...v, status };
      },
      setBrand: (brand) => {
        const map: Record<ConnectedForecast["brand"], ForecastSeedKey> = {
          Ocrevus: "ocrevus-exclusivity",
          Zunovo: "zunovo-exclusivity",
          Fenebrutinib: "fenebrutinib-prelaunch",
        };
        const next = getSeedForecastByKey(map[brand]);
        set({ forecast: next, activeSeedKey: map[brand] });
        scheduleRecompute(get);
      },

      // ─── v2.5 Addendum: System connections ─────────────────────────
      connectedSystems: defaultConnections(),
      setSystemConnection: (systemId, config) => {
        set((s) => ({
          connectedSystems: {
            ...s.connectedSystems,
            [systemId]: {
              ...(s.connectedSystems[systemId] ?? {
                status: "not-connected",
                syncFrequency: "daily",
              }),
              ...config,
            },
          },
        }));
      },
      syncSystem: (systemId) => {
        const now = new Date();
        const recordsUpdated = 12 + Math.floor(Math.random() * 36);
        const nextSyncOffsetH =
          get().connectedSystems[systemId]?.syncFrequency === "weekly"
            ? 168
            : get().connectedSystems[systemId]?.syncFrequency === "hourly"
            ? 1
            : get().connectedSystems[systemId]?.syncFrequency === "realtime"
            ? 0.05
            : 24;
        set((s) => {
          const existing = s.connectedSystems[systemId];
          if (!existing) return s;
          return {
            connectedSystems: {
              ...s.connectedSystems,
              [systemId]: {
                ...existing,
                status: "connected",
                lastSync: now.toISOString(),
                nextSync: new Date(
                  now.getTime() + nextSyncOffsetH * 3600_000,
                ).toISOString(),
              },
            },
          };
        });
        return recordsUpdated;
      },
      disconnectSystem: (systemId) => {
        set((s) => {
          const existing = s.connectedSystems[systemId];
          if (!existing) return s;
          return {
            connectedSystems: {
              ...s.connectedSystems,
              [systemId]: {
                status: "not-connected",
                syncFrequency: existing.syncFrequency,
              },
            },
          };
        });
      },
      setSystemFrequency: (systemId, frequency) => {
        set((s) => {
          const existing = s.connectedSystems[systemId];
          if (!existing) return s;
          return {
            connectedSystems: {
              ...s.connectedSystems,
              [systemId]: { ...existing, syncFrequency: frequency },
            },
          };
        });
      },

      // ─── v2.5 Addendum: Excel upload apply ───────────────────────
      applyUpload: (payload, options) => {
        const state = get();
        const merged = applyUploadToForecast(payload, state.forecast);
        const next = merged.version + 1;
        const versionLabel =
          options.mode === "scenario"
            ? `Upload scenario · ${payload.filename}`
            : `Applied upload · ${payload.filename}`;
        const updated = { ...merged, version: next, versionLabel };
        const computed = computeWithLifecycle(updated);
        const variance = computeVariance(computed);
        const reason = `Applied upload: ${payload.filename}${
          options.reason ? ` — ${options.reason}` : ""
        }`;
        const snap = saveSnapshot(updated, computed, {
          user: state.currentDemoUser,
          triggerType: "manual-save",
          triggerReason: "user-initiated",
          threshold: state.threshold,
          variance,
          label: versionLabel,
          reason,
          version: next,
        });
        set((s) => ({
          forecast: updated,
          computed,
          versionHistory: [snap, ...s.versionHistory],
        }));
      },
    }),
    {
      name: "forecastiq-v2",
      version: 5,
      partialize: (state) => ({
        forecast: state.forecast,
        versionHistory: state.versionHistory,
        selectedYear: state.selectedYear,
        selectedZone: state.selectedZone,
        selectedSubview: state.selectedSubview,
        selectedTab: state.selectedTab,
        demoMode: state.demoMode,
        growthIntel: state.growthIntel,
        activeSeedKey: state.activeSeedKey,
        currentDemoUser: state.currentDemoUser,
        threshold: state.threshold,
        connectedSystems: state.connectedSystems,
      }),
      migrate: ((persisted: unknown, version: number) => {
        // Drop any state from < v5 — v2.5 introduced new VersionSnapshot
        // shape, demo user, and threshold persistence.
        if (version < 5) return undefined;
        return persisted;
      }) as never,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppStore>;
        const seed = getSeedForecast();
        const f = p.forecast as ConnectedForecast | undefined;
        const valid =
          f &&
          Array.isArray(f.stf?.skus) &&
          Array.isArray(f.lrp?.events) &&
          Array.isArray(f.phasing?.dailyProfiles) &&
          Array.isArray(f.phasing?.erdByMonth) &&
          f.lifecycleContext &&
          typeof f.lifecycleContext.mode === "string";
        // Drop legacy snapshots that don't have the v2.5 shape
        const vh = (p.versionHistory ?? []).filter(
          (v) => (v as VersionSnapshot).forecastId && (v as VersionSnapshot).createdBy,
        );
        return {
          ...current,
          ...p,
          versionHistory: vh,
          currentDemoUser: p.currentDemoUser ?? DEFAULT_DEMO_USER,
          threshold: p.threshold ?? DEFAULT_THRESHOLD,
          connectedSystems: p.connectedSystems ?? defaultConnections(),
          forecast: valid ? (f as ConnectedForecast) : seed,
        };
      },
    }
  )
);

if (typeof window !== "undefined") {
  // Initial compute
  setTimeout(() => useStore.getState().recompute(), 0);
}

// ─── Placeholder agent canned-reply logic ─────────────────────────
// Demo-only: deterministic keyword routing. In production this would call
// an LLM with tool-calling against the engine + store.
function cannedAgentReply(input: string, pageContext?: string): { content: string; actions?: { label: string; tone?: "primary" | "ghost" }[] } {
  const t = input.toLowerCase();

  // LRP / forecast trajectory questions
  if (/(driv|peak|2027|2030|trajectory|forecast)/.test(t) && /(why|what|driv|explain)/.test(t)) {
    return {
      content:
        "The 2027 peak (~$5.0B) is set by three forces: Holt-Winter trending of 2022–2025 actuals projects ~640K class-volume baseline; the Market Access Win event adds +8% by then; Kesimpta competitive pressure subtracts ~12%. Class share × product share filters that to ~150K Ocrevus doses, priced at net $33K/dose. Biosimilar entry in 2027-Q2 starts compressing the curve from there.",
      actions: [
        { label: "Open Variance Waterfall", tone: "primary" },
        { label: "Show Driver Sensitivity" },
      ],
    };
  }

  // Version comparison
  if (/(version|compare|prior|v\d|waterfall|change)/.test(t)) {
    return {
      content:
        "I can show you the v-over-v variance waterfall on /lrp/review · Section 2. The biggest contributors between v3 and v4 are usually Product Share revisions (Kesimpta switching signal) and Pricing/GTN drift. Want me to open it for the current year?",
      actions: [
        { label: "Open variance waterfall" },
        { label: "Compare 2027 specifically", tone: "primary" },
      ],
    };
  }

  // Growth / investment
  if (/(growth|invest|allocat|budget|10m|25m|lever|portfolio|optim)/.test(t)) {
    return {
      content:
        "I'll set up a $25M optimization on Ocrevus 2027 with Balanced risk and Maximize Revenue. The optimizer will iterate until marginal $/$ across allocated levers equalizes — typically 4-6 levers receive funding, with diminishing returns past $20M. Ready?",
      actions: [
        { label: "Run $25M Balanced", tone: "primary" },
        { label: "Run $25M Conservative" },
        { label: "Show me the elasticity curves" },
      ],
    };
  }

  // STF / weekly / pacing
  if (/(weekly|stf|pacing|burndown|mtd|qtd|short|today|this week)/.test(t)) {
    return {
      content:
        "April 2026 MTD is at $342M against a $356M target — running 3.9% behind. To recover and hit plan you need $1.75M/day for the remaining 8 days vs the current $15.5M run rate. The gap is concentrated in two underperforming territories with Friday softness. Want me to flag those territories?",
      actions: [
        { label: "Show Pacing Burndown", tone: "primary" },
        { label: "Surface underperforming accounts" },
      ],
    };
  }

  // Scenario / what-if
  if (/(scenario|what.?if|simulate|biosim|earlier|later|push)/.test(t)) {
    return {
      content:
        "I can model that. If biosimilar entry shifts from 2027-04 to 2028-04, 2030 net sales rises by ~$420M (current $4.0B → $4.4B). I'd save it as a scenario tagged 'Biosim delayed 1 year' and you can compare it to the base in Version History.",
      actions: [
        { label: "Apply and save scenario", tone: "primary" },
        { label: "Show side-by-side comparison" },
      ],
    };
  }

  // Update assumption
  if (/(update|set|change|adjust|move)/.test(t) && /(share|price|gtn|event|peak|launch|cutoff)/.test(t)) {
    return {
      content:
        "I'll prepare that change. Note this is a placeholder — in production I'd update the LRP anchor, debounce-recompute the forecast, and surface the impact on KPIs. For demo purposes I'll just describe the result. Confirm?",
      actions: [
        { label: "Apply change", tone: "primary" },
        { label: "Cancel" },
      ],
    };
  }

  // Account / territory
  if (/(account|territory|hcp|prescriber|underperform)/.test(t)) {
    return {
      content:
        "Top 5 at-risk accounts this quarter (sized by revenue, sorted by negative variance): Mt Sinai Miami (-7%), Henry Ford (-5%), Banner Health (-4%), HCA Houston (-4%), Spectrum Health (-3%). Combined revenue exposure: ~$28M. Want me to open the Account Performance bubble chart filtered to these?",
      actions: [
        { label: "Open accounts view", tone: "primary" },
      ],
    };
  }

  // Default — context-aware
  const ctx = pageContext ?? "/lrp";
  const ctxHint =
    ctx.startsWith("/lrp/review")
      ? "On the LRP Review page, I can walk through the variance waterfall, sensitivity drivers, peak-year analysis, or confidence cone."
      : ctx.startsWith("/lrp")
      ? "On the LRP page, I can adjust trending methods, share/pricing anchors, or events — just describe the change."
      : ctx.startsWith("/stf/connect")
      ? "On the Compare LRP vs STF page, I can run Seek-to-Forecast for any target or surface drift between the two forecasts."
      : ctx.startsWith("/stf")
      ? "On the STF page, I can override weekly forecasts, configure phasing, or interrogate the operational pacing."
      : ctx.startsWith("/growth")
      ? "On the Growth Intelligence page, I can run optimizations, explain elasticity curves, or drill into the per-lever calculation breakdown."
      : "I can help across LRP authoring, STF operations, LRP-vs-STF comparison, and Growth Intelligence allocation.";
  return {
    content: `I'm ForecastIQ Copilot. ${ctxHint} Try a more specific question — for example: "what's driving 2027?" or "run a $25M growth scenario" or "show me underperforming accounts."`,
    actions: [
      { label: "What's driving 2027?" },
      { label: "Run $25M growth scenario" },
      { label: "Show MTD pacing" },
    ],
  };
}
