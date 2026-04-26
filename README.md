# ForecastIQ

Connected long-range and short-term forecasting platform with growth-intelligence allocation.
Built on a pure, deterministic computation engine; AI Copilot placeholder; Chryselys brand tokens.

**Live demo (Vercel):** _add link after deploy_

## Stack

- Next.js 14 (App Router) + TypeScript strict
- TailwindCSS with Chryselys brand tokens
- Zustand with persist middleware for global state
- Recharts for all data visualization
- Vitest for engine validation (20/20 passing)
- date-fns

No backend. All compute is client-side, in-memory; localStorage persists state across reloads.

## Getting Started

```bash
npm install
npm run dev          # http://localhost:3000
npm run test         # 20-test validation suite (engine + growth-intel)
npm run build        # production build
```

## Routes

- `/lrp` — Long-Range Plan authoring (10-year horizon, annual + monthly grain)
- `/lrp/review` — LRP decision-support review (7 sections: trajectory, variance waterfall, evolution, sensitivity, peak-year, subnational US, confidence cone)
- `/stf` — Short-Term Forecast (Setup / Build / Review zones; 13-week horizon)
- `/stf/connect` — Compare LRP vs STF (Forecast Stack, Variance Monitor, Seek-to-Forecast ★, Source-of-Truth, Reconciliation Log)
- `/growth` — Growth Intelligence (budget optimization + manual allocation across six commercial levers, with calculation breakdowns)

AI Copilot floats on every page (placeholder; deterministic canned responses with action chips).

## Architecture

### `lib/engine` — pure deterministic forecast computation engine

- `compute.ts` — main entry; produces multi-grain forecast (annual / monthly / weekly / daily) from a single `ConnectedForecast`
- `trending/*` — Linear, Exp Smoothing, Holt-Winter (additive & multiplicative), SMA-Auto, Quick Expert (picks lowest RMSE), plus user-supplied Customization curves
- `events.ts` — sigmoid event impact (slow / moderate / fast curves), date-aware for weekly grain
- `cascade.ts` — class share × product share interpolation
- `pricing.ts` — net price = gross × (1 − GTN)
- `phasing.ts` — annual ↔ monthly via ERDs; monthly ↔ weekly via week-of-month weights; weekly ↔ daily via daily profiles
- `seek.ts` — Seek-to-Forecast goal-seek
- `reconciliation.ts` — drift detection on rolling 4/13/26-week variance
- `seed.ts` — Ocrevus US synthetic seed forecast (2022 actuals → 2035 horizon)

The engine is **pure** — same inputs → same outputs. Tests enforce determinism, multi-grain consistency, and edit cascades.

### `lib/growth-intel` — investment optimizer

- `levers.ts` — six commercial levers (Field Force Expansion, Field Force Reallocation, Sample Reallocation, Patient Services Capacity, DTC Spend, Account Targeting), each with elasticity calibration and benchmark provenance
- `elasticity.ts` — four elasticity shapes: logarithmic, s-curve, capacity-bounded, linear-bounded
- `sensitivity.ts` — partial derivative at current operating point
- `optimizer.ts` — gradient-ascent allocation with budget conservation, category caps, and lever exclusion
- `explainer.ts` — deterministic rationale generator (LLM-pluggable)
- `breakdown.ts` — four-layer calculation chain per lever (Investment → Activity → Reach → Outcome → Revenue) with citations
- `index.ts` — `generateRecommendation()` for optimizer mode, `evaluateAllocation()` for manual mode

### `lib/store.ts`

Zustand store wired to both engines. Edits trigger a debounced (~100ms) recompute. State persists to `localStorage` under `forecastiq-v2`.

## Validation

```bash
npm run test
```

20 tests across two suites:

- **Forecast engine (10):** determinism, magnitude sanity, multi-grain consistency, LRP→STF edit cascade, STF→LRP rollup, all six trending algorithms, phasing arithmetic, Seek-to-Forecast, reconciliation drift, performance budget
- **Growth intel (10):** determinism, budget conservation, diminishing returns monotonicity, constraint enforcement, sensitivity ranking, capacity caps, LLM fallback, performance, calculation breakdown integrity, demo readiness

## Brand

Ocrevus US is the active brand. Zunovo and Fenebrutinib appear in selectors but are disabled with a "Available in production" tooltip.

All numbers are synthetic but plausible. Elasticity calibrations are tuned against published industry benchmarks (ZS Associates, IQVIA, Komodo, Nielsen) — replaceable with internal historical data.

## Keyboard Shortcuts

- `Cmd/Ctrl + 1` — LRP
- `Cmd/Ctrl + 2` — STF
- `Cmd/Ctrl + 3` — Compare LRP vs STF
- `Cmd/Ctrl + 4` — Growth Intelligence
- `Cmd/Ctrl + R` — Reset Demo

## Deployment

Designed for Vercel zero-config deploy:

1. Push to a Git repo
2. Import the repo in Vercel
3. Vercel auto-detects Next.js; defaults work
4. Live in ~30 seconds at `<project>.vercel.app`

## License

Internal demo. Synthetic data only.
