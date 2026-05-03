# ForecastIQ — Antigravity Prompt Pack v2.4 (Connected Lifecycle Forecasting)
## Replaces v2.3 architecturally. Built for the Monday Working Session with Sid.

This pack supersedes v2.3 in two ways and preserves it in every other way.

**What changes.** The shell collapses. `/lrp` and `/stf` are no longer sibling routes; they become tabs of a single unified workspace at `/forecast`. Lifecycle mode (Pre-launch / Exclusivity / Post-LoE) becomes a first-class concept that drives default authoring patterns. Decision support (Growth Intelligence) wires into the workspace as a Plan tab, not a separate route.

**What carries forward intact.** The forecast computation engine from v2.1. The Connect zone, Forecast Stack View, Variance Monitor, Seek-to-Forecast, Source-of-Truth Map from v2.3. Investment Opportunities. Growth Intelligence engine and the Show Calculation breakdown. LRP Review and STF Review pages. Every store, every type, every computation. The shell changes; the engine and the modules don't.

**Why this matters for Monday.** Sid asked for a deck or live walkthrough across three brand-lifecycle scenarios. He framed the pushback as "one framework with sections, not two parallel models." This pack makes the unified framework literal at the URL level, with the three lifecycle scenarios as switchable demo states. The narrative we tell on Monday is the architecture we ship.

---

## PART 1 — DESIGN PRINCIPLES (carry from v2.3, plus three additions)

The four v2.3 principles still hold: tab consolidation, visual-first defaults, inline editing with live preview, connection is the headline. Three additions for v2.4:

**Lifecycle is a workspace mode, not a brand attribute.** A brand can move through lifecycle modes over time (Fenebrutinib transitions from Pre-launch to Exclusivity at launch; Ocrevus transitions from Exclusivity to Post-LoE at biosimilar entry). The workspace adapts. The lifecycle selector is editorial: it lets the user switch perspective without changing the underlying brand record. For demo purposes, each of the three modes uses a different brand seed. In production, a single brand carries a current lifecycle mode plus a transition date.

**Authoring is grain-aware and source-tagged.** Every input cell shows where it came from: Auto-Pipelined (data feed), Manual (user-typed), Analog-Derived (analog mapping), Override (user changed an automated value). The user can always see what the system computed vs what they own. This is the direct answer to Ashwin's "where is the forecast actually created" question.

**Connection is bidirectional by default.** v2.3's Seek-to-Forecast handled top-down (LT target cascades to ST execution). v2.4 adds the reverse cascade explicitly: when STF actuals show sustained drift, the ST→LT roll-up suggests an LRP refresh with the implied annual delta pre-computed. This is what closes Sid's "when forecasters work in ST, how does that flow back into LT" question.

---

## PART 2 — LIFECYCLE MODES (the framing every prompt builds against)

Three modes. Each has a characteristic data shape, a default authoring entry point, and a different relationship between LT and ST.

### Pre-launch
**Brand seed:** Fenebrutinib (BTK inhibitor, Phase 3, pre-approval).
**Data shape:** Zero historical actuals. No NBRx, no TRx, no specialty pharmacy data. Clinical trial enrollment data only.
**LT authoring:** Analog-driven. Methodology = Analog-Weighted (existing v2.1 capability). User selects 2-4 analogs (Kesimpta, Briumvi, Tysabri launch curves), weights them, applies adjustments for differential clinical profile and competitive context. PoS overlay multiplies the curve by approval probability through key milestones.
**ST authoring:** Suppressed. The STF tab is hidden in Pre-launch mode. Replaced with a "Launch Readiness" tab that shows pre-launch tactical inputs (DTC build, MSL deployment, formulary positioning).
**Connect:** No bidirectional flow yet. Connect zone shows the analog-derived LT and a "post-launch this becomes Exclusivity" forward path.
**RFP linkage:** Addresses Pre-Launch + PoS Modeling + Analog Selection requirements explicitly named for Fenebrutinib.

### Exclusivity
**Brand seed:** Zunovo (SC formulation in active launch, ~18 months of post-launch history). Demo also supports Ocrevus current-state as an alternative seed.
**Data shape:** Limited-to-mature historical actuals. NBRx, TRx, specialty pharmacy data, account-level activity.
**LT authoring:** Hybrid trend + analog. For Zunovo, the analog component is IV-to-SC conversion analogs (Herceptin SC, Rituxan SC, Darzalex Faspro). The trend component fits to the limited post-launch data. The hybrid blender weights them by data sufficiency: at 6 months, 80% analog / 20% trend; at 18 months, 30% analog / 70% trend; at 36+ months, 100% trend.
**ST authoring:** Full STF Build zone (all v2.3 sub-views: Trend Selection, Naive OUTs, Holiday Adjustments, Events, SKU Mix, NFS, Inventory & DOH, Pricing & GTN, Net Revenue Build-up).
**Connect:** Bidirectional. LT cascades down via Seek-to-Forecast. ST rolls up via Variance Monitor. Reverse cascade triggers reconciliation events when sustained drift exceeds threshold.
**RFP linkage:** Addresses Launch Dynamics + IV-to-SC Conversion + Profitability for Zunovo, and Long-term Forecast + Account-based for Ocrevus.

### Post-LoE
**Brand seed:** Ocrevus future state (post-biosimilar, ~2028 onwards). Demo represents the eventual state, not current state.
**Data shape:** Mature historical actuals. Patient-based LT model breaks because biosimilar erosion isn't a clean function of class share. Account-level dynamics dominate.
**LT authoring:** Derivative. The LRP isn't authored directly anymore. It's a roll-up of account-based ST forecasts plus a Bottoms-Up Site-of-Care Erosion curve overlay. Annual numbers are derived; the user can't edit them as primary inputs.
**ST authoring:** Account-based. Primary surface. The STF tab leads with an Account Performance view (top accounts, fair share methodology, custom allocation ratios per account 80/20 or 70/30, caps and floors, baseline carve-outs for non-strategic accounts). Site-of-Care Erosion curves model the migration from infusion centers to community / lower-cost sites.
**Connect:** Inverted. ST is source of truth. LRP is the rollup view. Reconciliation isn't "did STF drift from LRP" — it's "did the account-based STF roll-up produce an annual that leadership accepts."
**RFP linkage:** Addresses Biosimilar Defense + Account-based + Bottoms-Up Site-of-Care Erosion for LOE brands explicitly named in subnational scope.

---

## PART 3 — PROMPTS

Run in order. After each prompt, run a smoke test: app builds, app loads, no console errors, prior capabilities still render. Prompt 1.5 is the explicit validation gate after the shell change.

### PROMPT 0.5-LIFE — ENGINE EXTENSION FOR LIFECYCLE MODES

Run after v2.3 Prompt 0.5-CON. Extends, doesn't replace.

```
Extend the forecast computation engine at /lib/forecast-engine to 
support lifecycle-mode-aware forecasting and a reverse cascade 
function (ST→LT roll-up).

NEW TYPES (extend types.ts)

type LifecycleMode = 'pre-launch' | 'exclusivity' | 'post-loe'

interface LifecycleContext {
  mode: LifecycleMode
  
  // Mode-specific configuration
  preLaunchConfig?: PreLaunchConfig
  exclusivityConfig?: ExclusivityConfig
  postLoeConfig?: PostLoeConfig
  
  // Transition planning
  expectedTransitionDate?: string      // when this brand will move 
                                        // to next lifecycle mode
  expectedNextMode?: LifecycleMode
}

interface PreLaunchConfig {
  // Analog selection
  analogs: {
    analogBrand: string                // "Kesimpta", "Briumvi", etc.
    weight: number                     // 0-1, must sum to 1.0
    adjustments: {
      clinicalProfile: number          // -0.3 to +0.3, adjusts curve 
                                        // for differential efficacy/
                                        // safety profile
      competitiveContext: number       // -0.3 to +0.3, adjusts for 
                                        // current vs analog's launch 
                                        // competitive environment
      marketAccess: number             // -0.2 to +0.2, formulary/
                                        // payer environment
    }
  }[]
  
  // PoS modeling
  posModel: {
    currentStage: 'preclinical' | 'phase1' | 'phase2' | 'phase3' | 
                  'filed' | 'approved'
    milestoneProbabilities: {
      milestone: string                // "Phase 3 readout positive"
      expectedDate: string
      probability: number              // 0-1
    }[]
    cumulativeApprovalProbability: number
  }
  
  // Pre-launch tactical inputs (for Launch Readiness tab)
  tacticalInputs: {
    msldDeploymentMonths: number       // months of MSL deployment 
                                        // pre-launch
    dtcBuildSpend: number              // pre-launch DTC investment
    formularyTier: 'preferred' | 'covered' | 'pa-required' | 'unknown'
    expectedLaunchDate: string
  }
}

interface ExclusivityConfig {
  // History characterization
  monthsOfHistory: number              // drives hybrid blender weight
  
  // Hybrid blender weights (auto-computed from monthsOfHistory, 
  // user-overridable)
  blenderWeights: {
    analogWeight: number               // 0-1
    trendWeight: number                // 0-1
    // Must sum to 1.0
  }
  
  // For SC reformulations specifically
  scReformulationConfig?: {
    parentIvBrand: string              // "Ocrevus IV" for Zunovo
    conversionAnalogs: string[]        // ["Herceptin SC", 
                                        //  "Rituxan SC", 
                                        //  "Darzalex Faspro"]
    targetConversionRate: number       // 0-1, eventual steady state
    conversionCurveYears: number       // typical 3-5 years to plateau
  }
  
  // Standard exclusivity LT inputs (existing v2.1 PatientBasedInputs 
  // or TrendFitInputs apply here)
}

interface PostLoeConfig {
  // Biosimilar entry
  biosimilarEntry: {
    expectedEntryDate: string
    entrantCount: number               // typical 2-4 in MS class
    classPriceErosionCurve: {
      yearsAfterEntry: number
      remainingClassPricePct: number   // e.g., year 1: 0.65 (35% drop)
    }[]
    shareLossCurve: {
      yearsAfterEntry: number
      remainingOriginatorSharePct: number
    }[]
  }
  
  // Site-of-care erosion (RFP-named requirement)
  siteOfCareErosion: {
    sourceOfCareSegments: {
      segmentName: string              // "Hospital Outpatient Infusion"
      currentSharePct: number          // current % of total volume
      erosionRatePerYear: number       // expected annual decline 
                                        // (negative number) or growth
      destinationSegment?: string      // where the erosion lands 
                                        // (e.g., "Community Infusion 
                                        // Suite")
    }[]
  }
  
  // Account-based primary forecast inputs
  accountBasedInputs: {
    fairShareMethodology: 'historical-baseline' | 'access-weighted' | 
                          'capacity-constrained' | 'custom'
    
    // Custom allocation ratios per account tier
    allocationRatios: {
      tierName: string                 // "Top 50 IDNs", "Academic MS 
                                        // Centers", "Community Neuro"
      ratioName: '80/20' | '70/30' | '60/40' | 'custom'
      customRatio?: { numerator: number; denominator: number }
      capUnits?: number                // forecast constraint cap
      floorUnits?: number              // forecast constraint floor
      baselineCarveout?: boolean       // exclude from baseline trend
    }[]
    
    accountForecasts: {
      accountId: string
      accountName: string
      tier: string
      currentMonthlyDemand: number
      projectedMonthlyDemand: number[] // 36 months forward
      siteOfCareSegment: string
    }[]
  }
}

EXTEND ConnectedForecast (from v2.3):

interface ConnectedForecast {
  // ... all existing v2.3 fields
  
  lifecycleContext: LifecycleContext   // NEW — required field
}

NEW FUNCTIONS

// Compute LT from analogs only (Pre-launch mode)
export function computeFromAnalogs(
  config: PreLaunchConfig,
  scenario?: Scenario
): AnnualDataPoint[]

// Apply PoS multiplier to a Pre-launch curve
export function applyPosMultiplier(
  baseCurve: AnnualDataPoint[],
  posModel: PreLaunchConfig['posModel']
): AnnualDataPoint[]

// Hybrid blender for Exclusivity mode with limited history
export function blendAnalogAndTrend(
  analogCurve: AnnualDataPoint[],
  trendCurve: AnnualDataPoint[],
  weights: ExclusivityConfig['blenderWeights']
): AnnualDataPoint[]

// Auto-compute hybrid blender weights from data sufficiency
export function computeBlenderWeights(
  monthsOfHistory: number
): ExclusivityConfig['blenderWeights']
// Rule: 0-6mo → 90/10, 6-12mo → 70/30, 12-24mo → 50/50, 
//       24-36mo → 30/70, 36+mo → 10/90 (analog/trend)
// User can override.

// Roll up account-based ST to annual (Post-LoE mode)
export function rollUpAccountBased(
  accountForecasts: PostLoeConfig['accountBasedInputs']['accountForecasts'],
  siteOfCareErosion: PostLoeConfig['siteOfCareErosion']
): AnnualDataPoint[]

// Reverse cascade — proposes LRP refresh from sustained ST drift
export function reverseCascade(
  forecast: ConnectedForecast,
  windowWeeks: number = 13                // 13-week sustained window
): {
  detectedDriftPct: number
  impliedAnnualDelta: number
  proposedRefresh: {
    affectedYears: number[]
    suggestedAnnualValues: { year: number; newValue: number }[]
    confidenceScore: number             // 0-1
  }
  reconciliationEventId: string         // links to ReconciliationEvent
}

// Lifecycle-aware compute — dispatches to mode-specific path
export function computeWithLifecycle(
  forecast: ConnectedForecast,
  scenario?: Scenario
): ComputedForecastConnected
// Pre-launch: computeFromAnalogs → applyPosMultiplier → no ST 
//   computation, returns annual + monthly
// Exclusivity: existing v2.3 computeConnected, optionally with 
//   blendAnalogAndTrend if hybrid mode enabled
// Post-LoE: rollUpAccountBased + applyBiosimilarErosion → returns 
//   annual + monthly + weekly (account-based ST is canonical)

SEED DATA — THREE LIFECYCLE DEMO BRANDS

Pre-launch seed (Fenebrutinib):
  brand: 'Fenebrutinib'
  geography: 'US'
  lifecycleContext.mode: 'pre-launch'
  lifecycleContext.preLaunchConfig:
    analogs:
      - Kesimpta (S1P functional analog), weight 0.45, 
        clinicalAdj +0.05 (oral convenience advantage), 
        competitiveAdj -0.10 (more crowded class), 
        marketAccessAdj +0.00
      - Briumvi (anti-CD20 mechanism analog), weight 0.30, 
        clinicalAdj -0.05, competitiveAdj -0.05, marketAccessAdj 0.00
      - Tysabri (high-efficacy precedent), weight 0.25, 
        clinicalAdj -0.10 (different MOA), competitiveAdj +0.05, 
        marketAccessAdj 0.00
    posModel:
      currentStage: 'phase3'
      milestoneProbabilities:
        - "Phase 3 primary endpoint readout", 2026-09-15, 0.72
        - "FDA filing acceptance", 2027-01-30, 0.95
        - "FDA approval", 2027-11-15, 0.78
      cumulativeApprovalProbability: 0.54
    tacticalInputs:
      msldDeploymentMonths: 9
      dtcBuildSpend: 0 (pre-approval, no DTC)
      formularyTier: 'unknown'
      expectedLaunchDate: '2027-12-01'

Exclusivity seed (Zunovo, SC reformulation, 18 months post-launch):
  brand: 'Zunovo'
  geography: 'US'
  lifecycleContext.mode: 'exclusivity'
  lifecycleContext.exclusivityConfig:
    monthsOfHistory: 18
    blenderWeights: { analogWeight: 0.35, trendWeight: 0.65 }
    scReformulationConfig:
      parentIvBrand: 'Ocrevus IV'
      conversionAnalogs: 
        ['Herceptin SC', 'Rituxan SC', 'Darzalex Faspro']
      targetConversionRate: 0.55       // 55% IV→SC at steady state
      conversionCurveYears: 4
  
  Plus standard v2.3 STFInputs and a TrendFitInputs LRP for the 
  trend portion of the hybrid.

Post-LoE seed (Ocrevus post-biosimilar, year 2028+):
  brand: 'Ocrevus'
  geography: 'US'
  lifecycleContext.mode: 'post-loe'
  lifecycleContext.postLoeConfig:
    biosimilarEntry:
      expectedEntryDate: '2028-04-01'
      entrantCount: 3
      classPriceErosionCurve:
        - {yearsAfterEntry: 0, remainingClassPricePct: 1.00}
        - {yearsAfterEntry: 1, remainingClassPricePct: 0.65}
        - {yearsAfterEntry: 2, remainingClassPricePct: 0.45}
        - {yearsAfterEntry: 3, remainingClassPricePct: 0.35}
      shareLossCurve:
        - {yearsAfterEntry: 0, remainingOriginatorSharePct: 1.00}
        - {yearsAfterEntry: 1, remainingOriginatorSharePct: 0.62}
        - {yearsAfterEntry: 2, remainingOriginatorSharePct: 0.38}
        - {yearsAfterEntry: 3, remainingOriginatorSharePct: 0.25}
    siteOfCareErosion:
      sourceOfCareSegments:
        - "Hospital Outpatient Infusion": 
            current 58%, erosion -0.04/yr, → "Community Infusion Suite"
        - "Academic MS Center": 
            current 22%, erosion -0.01/yr, → "Community Infusion Suite"
        - "Community Infusion Suite": 
            current 18%, erosion +0.04/yr (gaining)
        - "Home Infusion": 
            current 2%, erosion +0.01/yr (gaining)
    accountBasedInputs:
      fairShareMethodology: 'access-weighted'
      allocationRatios:
        - "Top 50 IDNs": 80/20, capUnits 4500/mo, floorUnits 1800/mo
        - "Academic MS Centers": 70/30, capUnits 1200/mo
        - "Community Neuro": 60/40
        - "Long-tail Accounts": baseline carveout
      accountForecasts: 50 representative accounts seeded with 
        plausible monthly demand patterns

VALIDATION CHECKLIST

  ☐ computeFromAnalogs returns a valid 10-year annual curve for 
    Fenebrutinib seed
  ☐ applyPosMultiplier scales the curve correctly (Y1 net revenue 
    × 0.54 cumulative PoS = expected post-PoS Y1 value)
  ☐ blendAnalogAndTrend produces a hybrid curve where the early 
    years are analog-dominated and later years are trend-dominated 
    for Zunovo seed
  ☐ computeBlenderWeights(18) returns approximately 
    { analogWeight: 0.35, trendWeight: 0.65 }
  ☐ rollUpAccountBased on Ocrevus Post-LoE seed produces an annual 
    curve that respects all caps, floors, and carveouts
  ☐ reverseCascade with simulated 13 weeks of -6% sustained STF 
    variance returns a proposed annual delta in the right ballpark 
    (i.e., scaled to remaining-year duration)
  ☐ computeWithLifecycle dispatches correctly: pre-launch returns 
    no weekly grain, post-loe returns weekly account-based grain, 
    exclusivity returns full multi-grain
```

---

### PROMPT 1-WORKSPACE — UNIFIED /forecast SHELL

Run after Prompt 0.5-LIFE.

```
Build a unified forecast workspace at /forecast that hosts all 
forecast authoring, review, and decision support in a single shell.

PRE-BUILD CLEANUP
Before writing new code:
- Keep /lrp and /stf routes functional but mark them as deprecated 
  with a banner ("This view is now part of /forecast. You'll be 
  redirected.") and a 3-second auto-redirect to the equivalent tab 
  in /forecast.
- Do NOT delete /lrp or /stf code; they're being repurposed as 
  embedded tab content in the new shell.

ROUTE STRUCTURE

/forecast                              → unified workspace shell
/forecast/lrp                          → LRP authoring tab 
                                          (was /lrp)
/forecast/stf                          → STF authoring tab 
                                          (was /stf)
/forecast/connect                      → Connect zone tab 
                                          (was /stf/connect or 
                                          /lrp's connect view)
/forecast/opportunities                → Investment Opportunities 
                                          (was inside /stf)
/forecast/plan                         → Plan Mode (Growth 
                                          Intelligence wired in)
/forecast/review/lrp                   → LRP Review (was /lrp/review)
/forecast/review/stf                   → STF Review (was /stf/review)

/lrp                                   → redirects to /forecast/lrp
/stf                                   → redirects to /forecast/stf
/growth-intel                          → redirects to /forecast/plan
                                          (Growth Intelligence is 
                                          subsumed)

WORKSPACE LAYOUT

The /forecast shell is a persistent layout. The inner tabs swap 
content. Layout structure:

Top strip (sticky, height 64px):
  Left:
    Brand selector: Ocrevus / Zunovo / Fenebrutinib / Ocrevus 
      Post-LoE (demo seed)
    Lifecycle mode badge: shows current lifecycle mode for 
      selected brand (read-only display, derived from 
      forecast.lifecycleContext.mode)
    Geography: US / EU5 / Japan / RoW
  
  Center:
    Lifecycle Mode selector pill bar: 
      [Pre-launch] [Exclusivity] [Post-LoE]
    Active mode highlighted in Chryselys gold.
    Switching modes switches the active forecast seed.
    For demo: clicking switches to that mode's demo brand 
    automatically (Pre-launch → Fenebrutinib, Exclusivity → Zunovo, 
    Post-LoE → Ocrevus Post-LoE).
  
  Right:
    Scenario selector: pulls from store
    "Save Version" secondary button
    "Push to TM1" primary button (disabled in Pre-launch mode 
      since no STF)

Below top strip: Tab bar (sticky, height 48px)
  Tab visibility depends on lifecycle mode:
  
  Pre-launch mode tabs:
    [LRP] [Launch Readiness] [Connect] [Plan] [Review]
    (No STF, no Opportunities)
  
  Exclusivity mode tabs:
    [LRP] [STF] [Connect] [Opportunities] [Plan] [Review]
    (Full set)
  
  Post-LoE mode tabs:
    [STF (Account-based)] [LRP (Derivative)] [Connect] 
    [Opportunities] [Plan] [Review]
    (STF first, LRP labeled as derivative)

Each tab shows the corresponding existing component, embedded in 
the shell. Navigation between tabs uses Next.js parallel routes or 
client-side state — pick whichever is cleaner. State is preserved 
across tab switches (the user doesn't lose their place).

Right-side persistent panel: Reconciliation Status (carry from 
v2.3, 280px wide, always visible across all tabs)
  Already exists in v2.3; lift it from /stf and make it part of 
  the /forecast shell instead of the STF page.
  Hidden in Pre-launch mode (no STF, nothing to reconcile yet).

Left-side collapsed nav rail (40px wide when collapsed):
  Workspace shortcuts (icon + tooltip):
    Home / All Brands
    Templates
    Recent Forecasts
    Settings
  Expandable on hover to 200px.

LIFECYCLE MODE SWITCHING BEHAVIOR

When user clicks a different lifecycle mode pill in the top strip:
  1. Confirm if there are unsaved changes ("Save changes before 
     switching modes?")
  2. Switch active forecast to the mode's demo seed
  3. Re-render tab bar with mode-appropriate tabs
  4. Default tab depends on mode:
     - Pre-launch → LRP (since no STF)
     - Exclusivity → STF (the operational view, primary user 
       persona)
     - Post-LoE → STF (Account-based) (since LRP is derivative)
  5. Update lifecycle mode badge in top strip
  6. Animate the transition (300ms fade) so the mode change is 
     visible and not jarring

DEMO MODE

Add a "Demo" toggle in the workspace settings (top right user menu) 
that, when on:
  - Switches the brand selector and lifecycle mode pill into a 
    single combined "Demo Scenario" selector
  - Three options: 
    "Fenebrutinib · Pre-launch", 
    "Zunovo · Exclusivity", 
    "Ocrevus · Post-LoE"
  - Selecting one switches both brand and mode atomically with a 
    400ms morph animation
  - Hides the "Save Version" and "Push to TM1" buttons (demo mode)
  
This is what gets used Monday. In production, the toggle is off 
and the user navigates brand + mode independently.

SHELL VALIDATION

  ☐ /forecast loads and renders the workspace layout correctly
  ☐ /lrp redirects to /forecast/lrp with a banner notice 
    (3-second auto-redirect)
  ☐ /stf redirects to /forecast/stf with a banner notice
  ☐ Brand + lifecycle mode selectors at top work
  ☐ Tab bar reflects lifecycle mode (Pre-launch hides STF and 
    Opportunities)
  ☐ Each tab loads its existing component without errors
  ☐ Reconciliation Status panel appears on the right in 
    Exclusivity and Post-LoE modes; hidden in Pre-launch
  ☐ Demo Mode toggle in user menu switches to the 3-scenario 
    selector
  ☐ Switching scenarios in Demo Mode produces a clean visual 
    transition
```

---

### PROMPT 1.5-VALIDATION — POST-SHELL SMOKE TEST GATE

Run immediately after Prompt 1-WORKSPACE. Do not proceed to Prompt 2 until all checks pass.

```
Validate that the v2.3 capabilities still render correctly inside 
the new /forecast shell. This is a smoke test, not a unit test 
suite. The goal is to catch shell-induced regressions before 
adding new functionality on top.

CHECKS — PRODUCE A PASS/FAIL REPORT IN CONSOLE

For Exclusivity mode (Zunovo seed):
  ☐ /forecast/lrp renders the Forecast Architect with all v2.1 
    methodology editors functional
  ☐ /forecast/stf renders the STF Build zone with all 9 sub-views 
    accessible
  ☐ /forecast/connect renders the Forecast Stack View, Variance 
    Monitor, Seek-to-Forecast, and Source-of-Truth Map
  ☐ Seek-to-Forecast on Zunovo $1.2B target produces valid 
    weekly intervention map
  ☐ /forecast/opportunities renders the Investment Opportunities 
    card list with at least 3 cards
  ☐ /forecast/review/lrp renders all 7 LRP review sections
  ☐ /forecast/review/stf renders all STF review visualizations
  ☐ Editing a weekly cell in STF Build still triggers live impact 
    preview within 200ms
  ☐ Reconciliation Status panel updates when STF actuals change

For Pre-launch mode (Fenebrutinib seed):
  ☐ /forecast/lrp renders the Analog-Weighted methodology editor 
    (existing v2.1 capability)
  ☐ STF tab is not visible in tab bar
  ☐ Opportunities tab is not visible in tab bar
  ☐ LRP curve reflects the analog blend × PoS multiplier
  ☐ Editing analog weights triggers re-compute and re-render

For Post-LoE mode (Ocrevus Post-LoE seed):
  ☐ /forecast/stf renders Account-based view as primary
  ☐ /forecast/lrp shows LRP labeled as "Derivative — rolled up 
    from account-based STF"
  ☐ Annual numbers in LRP match the rollup of account-based STF 
    within 0.5%
  ☐ Site-of-Care Erosion curve renders correctly
  ☐ Biosimilar entry effects show on the annual trajectory

Performance checks:
  ☐ Tab switch latency < 300ms
  ☐ Lifecycle mode switch latency < 600ms (allowing for re-seed)
  ☐ No console errors on any route
  ☐ No hydration mismatches

Output format:
  ✓ TEST 1: PASS
  ✓ TEST 2: PASS
  ✗ TEST 3: FAIL — [specific reason]
  ...
  
  SUMMARY: 24/26 PASSED, 2 FAILED
  PROCEED TO PROMPT 2: NO (resolve failures first)

If any test fails, do not proceed to Prompt 2. Report the failures, 
fix them, and re-run validation.
```

---

### PROMPT 2-LIFECYCLE-DEFAULTS — MODE-AWARE DEFAULT VIEWS

Run after Prompt 1.5-VALIDATION passes.

```
Wire lifecycle-mode-aware default views into each tab. The shell 
already routes correctly; this prompt makes each tab adapt its 
content based on the active lifecycle mode.

PRE-LAUNCH MODE BEHAVIORS

LRP tab (in Pre-launch):
  Default methodology = Analog-Weighted (lock the methodology 
    selector so the user can't switch to TrendFit or PatientBased — 
    those don't apply with zero history)
  Top of LRP page shows a Pre-launch banner card:
    "Pre-launch forecast for Fenebrutinib. Built from analog 
     weighting + PoS modeling. Trending and patient-based methods 
     are unavailable until launch."
  
  Replace the standard LRP top metrics with Pre-launch-specific:
    Cumulative PoS: 54%
    Expected approval: Nov 2027
    Analog blend: Kesimpta 45% / Briumvi 30% / Tysabri 25%
    Risk-adjusted Y1 peak revenue: $XXX M (computed from blended 
      curve × PoS)
  
  Add a PoS Sensitivity card below the methodology editor:
    "What if Phase 3 readout probability drops from 72% to 60%?"
    Slider with live re-compute of the curve.

STF tab is not visible.

Opportunities tab is not visible.

Add a new Launch Readiness tab (Pre-launch only):
  Sections:
    1. Pre-launch Tactical Inputs (MSL deployment, DTC build, 
       formulary positioning) — editable
    2. Launch Curve Sensitivity (slope of ramp, time to peak, 
       peak share)
    3. Competitor Launch Comparison (overlay of Fenebrutinib 
       projected curve vs the three analog launches)
    4. Pre-launch Milestone Tracker (Phase 3 readout, FDA filing, 
       FDA approval — visual timeline with PoS at each)

Connect tab (in Pre-launch):
  Forecast Stack View: shows annual + monthly only (no weekly 
    bottom strip since no STF).
  Variance Monitor: hidden (no actuals yet).
  Seek-to-Forecast: shows but limited to LT-only mode (intervention 
    radio defaults to "LRP-only — modify annual assumption").
  Source-of-Truth Map: shows Pre-launch-relevant rows only 
    (analog selections, PoS milestones, tactical inputs).

EXCLUSIVITY MODE BEHAVIORS

This is the v2.3 default behavior. No major changes needed beyond 
making sure the existing tabs render correctly.

One addition: in the LRP tab, if exclusivityConfig.scReformulationConfig 
is populated (Zunovo case), show a Hybrid Blender card at the top 
of the LRP page:
  "Hybrid Forecast — Trend (65%) + IV-to-SC Conversion Analogs (35%)"
  Slider to adjust the blend (0% to 100% for each component).
  Live preview of the hybrid curve.
  Conversion analog table (Herceptin SC, Rituxan SC, Darzalex 
    Faspro) with their conversion-rate trajectories overlaid for 
    reference.

For Zunovo specifically, the LRP top-of-page shows:
  Months of post-launch history: 18
  Auto-suggested blend weights: 35% analog / 65% trend
  Current target conversion rate: 55%
  Time-to-plateau: 4 years
  Current actual conversion rate: 22% (vs trajectory at month 18: 
    23% — slightly below)

POST-LOE MODE BEHAVIORS

The big inversion. STF is the source of truth. LRP is derivative.

STF (Account-based) tab (in Post-LoE):
  Default sub-view = Account Performance (NEW — replaces v2.3 
    Trend Selection as the default).
  
  Account Performance sub-view content:
    Top: Bar chart of top 50 accounts ranked by current monthly 
      demand
    Filter: Account tier (Top 50 IDNs / Academic MS Centers / 
      Community Neuro / Long-tail)
    Editable per-account fields:
      Current monthly demand
      Projected 36-month curve (auto-fitted, user-overridable)
      Site-of-care segment assignment
      Allocation ratio (80/20, 70/30, etc., dropdown)
      Cap and floor constraints
      Baseline carveout flag
    
    Right-side panel: Roll-up summary
      Sum of account-level forecasts → monthly total
      Monthly total → annual total
      Annual total → "this is what flows to LRP"
  
  Add a Site-of-Care Erosion sub-view:
    Stacked area chart: % volume by site-of-care segment over time
    Editable erosion rates per segment
    Animation: drag a slider to "fast-forward" the erosion 
      visualization
  
  Add a Biosimilar Defense sub-view:
    Class price erosion curve (editable)
    Originator share loss curve (editable)
    Annual revenue projection with biosimilar entry vs without 
      (for comparison)
  
  Existing v2.3 STF sub-views (Trend Selection, Naive OUTs, 
    Holiday Adjustments, etc.) are all still accessible but 
    secondary in Post-LoE mode. They show as "Operational Inputs" 
    section in the sub-view nav, below the primary Account-based 
    sub-views.

LRP (Derivative) tab (in Post-LoE):
  Top of page shows a Derivative banner card:
    "LRP is rolled up from account-based STF in Post-LoE mode. 
     Edit account forecasts in the STF tab to change these 
     numbers. The LRP shown here is read-only and updates 
     automatically."
  
  All editing controls are disabled. The forecast displays as 
  read-only with a "View Source in STF" button per row that 
  navigates to the STF tab.

Connect tab (in Post-LoE):
  Forecast Stack View: inverted — weekly STF on top (as the 
    canonical), monthly aggregate in middle, annual rollup at 
    bottom.
  Reverse Cascade is the primary action, not Seek-to-Forecast 
    (since LRP no longer drives ST).
  Source-of-Truth Map: most rows now show STF as the source 
    (account-level demand, fair share methodology, allocation 
    ratios, caps/floors). Only biosimilar entry assumptions and 
    site-of-care erosion rates show LRP-level governance.

VALIDATION

  ☐ Switching from Exclusivity to Pre-launch via the lifecycle 
    pill correctly hides STF and Opportunities tabs and shows 
    Launch Readiness
  ☐ Pre-launch LRP shows the Analog-Weighted methodology only
  ☐ Pre-launch banner card and PoS sensitivity card render
  ☐ Exclusivity Hybrid Blender card renders for Zunovo seed but 
    not for Ocrevus current-state seed (since Ocrevus exclusivity 
    has full history)
  ☐ Post-LoE STF tab opens on Account Performance sub-view by 
    default
  ☐ Post-LoE LRP shows Derivative banner and all controls disabled
  ☐ Post-LoE Site-of-Care Erosion sub-view renders correctly
  ☐ Lifecycle mode switching preserves user's tab selection where 
    possible (e.g., if user is on Connect tab, switching modes 
    keeps them on Connect)
```

---

### PROMPT 3-AUTHORING-SURFACE — SOURCE TAGS ON EVERY INPUT

Run after Prompt 2-LIFECYCLE-DEFAULTS.

```
Add an authoring surface system that tags every editable input 
cell in the forecast workspace with its data source. This makes 
explicit what the system computed vs what the user owns — the 
direct answer to "where is the forecast actually created?"

NEW TYPES (extend types.ts)

type DataSourceTag = 
  | 'auto-pipelined'      // came from a data feed (Oasis, Symphony, 
                           // GPS, internal pricing system)
  | 'manual'              // user typed the value
  | 'analog-derived'      // computed from analog mapping logic
  | 'override'            // user changed an automated value
  | 'derived'             // computed from other inputs in the model

interface InputCellMetadata {
  cellId: string                      // unique identifier per cell
  fieldName: string                   // human-readable name
  
  source: DataSourceTag
  sourceDetail?: string               // e.g., "Symphony PHAST W16, 
                                       // last sync 2026-04-22 09:30"
  
  // For overrides
  overrideOriginalValue?: number | string
  overrideChangedAt?: string
  overrideChangedBy?: string
  overrideReason?: string             // optional user-entered note
  
  // For analog-derived
  analogDerivation?: {
    analogs: { analog: string; weight: number }[]
    formula: string                   // human-readable description
  }
  
  // For pipelined
  pipelineSource?: {
    system: string                    // "Oasis", "Symphony", "GPS", 
                                       // "Internal Pricing"
    lastSync: string
    nextScheduledRefresh: string
    isStale: boolean                  // true if last sync > expected 
                                       // refresh interval
  }
}

VISUAL TREATMENT

Every editable cell shows a small source badge in the top-right 
corner:
  Auto-Pipelined: blue dot, tooltip "From [system]" with last-sync 
    timestamp
  Manual: gray dot, tooltip "Manually entered by [user] on [date]"
  Analog-Derived: amber dot, tooltip "Derived from analog blend"
  Override: red dot with small triangle, tooltip "Overridden from 
    [original value]"
  Derived: no dot (computed values aren't authored)

Hover any cell: a small popover appears showing source detail. 
Click the badge: opens a side panel with full source history 
(last 5 changes, who changed it, when, why if reason was provided).

PER-GRAIN AUTHORING VIEW

Add a new "Authoring Source Map" panel accessible via a button 
in the Connect tab. Layout:

  Tab bar: [Annual] [Monthly] [Weekly] [Daily]
  
  For each grain, a sortable, filterable table:
    Field | Source | Last Updated | Owner | Stale? | Actions
  
  Filters: 
    Show only: Auto-Pipelined / Manual / Analog-Derived / Override / 
      All
    Stale only: yes/no
    Owner: [filter by user]
  
  Click any row → navigates to the actual cell in the relevant tab 
  with the cell highlighted.

RFP-RELEVANT INTEGRATION POINTS

The Auto-Pipelined source detail should reference the RFP-named 
integration systems where applicable:
  Gross Price → "Oasis Pricing Master"
  Trade Discount, Reserve Rate → "Finance & Reserves system"
  NBRx, TRx weekly → "Symphony PHAST" (illustrative)
  Specialty pharmacy data → "Accredo / CVS Specialty hub feeds"
  Patient enrollment → "GPS"
  PAA constraints → "Patient Access and Affordability system"

Don't fabricate sync timestamps that look real but aren't 
defensible. Use a single demo timestamp pattern: 
"Last sync 2026-04-22 09:30 PT, next scheduled 2026-04-29 09:00 PT"

PRE-LAUNCH SOURCE BEHAVIOR

In Pre-launch mode, most cells are Manual or Analog-Derived since 
there's no commercial data yet. Specifically:
  Analog selections → Manual (user picks the analogs)
  Analog weights → Manual
  Adjustments → Manual
  PoS milestone probabilities → Manual (with sourceDetail 
    suggesting "Internal R&D estimate" or "BLA tracker — last 
    update [date]")
  Resulting LRP curve cells → Derived

POST-LOE SOURCE BEHAVIOR

Post-LoE has the most pipeline-heavy authoring (since account-level 
data flows in):
  Account current monthly demand → Auto-Pipelined from "Account 
    Demand Tracker"
  Account allocation ratios → Manual (strategy decision, not data)
  Caps and floors → Manual
  Site-of-care erosion rates → Manual (with reference to 
    "Site-of-Care Migration Study")
  Biosimilar class price erosion → Manual (with reference to 
    "Biosimilar Reference Curves Library")

VALIDATION

  ☐ Every editable cell across LRP, STF, and Connect tabs has a 
    source badge
  ☐ Hovering a cell shows the source tooltip
  ☐ Clicking a source badge opens the detail side panel
  ☐ Authoring Source Map panel renders with grain tabs
  ☐ Filtering works correctly
  ☐ Row click navigates to the cell with highlight
  ☐ Override changes flag the cell as 'override' with the 
    original value preserved
```

---

### PROMPT 4-CALC-MODULES — CONFIGURABLE CALCULATION LOGIC

Run after Prompt 3-AUTHORING-SURFACE. This is the prompt that closes Sid's data-nuance concern.

```
Add a configurable calculation modules system to the forecast 
engine. The goal: calculations like DOH, ERD (Effective Revenue 
Days), and Calpac aren't hardcoded — they're configurable per 
brand, with user-editable formulas, override-able defaults, and 
visible calculation logic.

This addresses Sid's specific concern that IQVIA-class platforms 
historically can't wrap around Genentech's brand-specific 
calculations.

NEW TYPES (extend types.ts)

interface CalcModule {
  moduleId: string                    // 'doh', 'erd', 'calpac', 
                                       // 'inventory-tier', etc.
  moduleName: string                  // "Days on Hand"
  description: string                 // human-readable description
  
  // The formula
  formula: {
    expression: string                // e.g., "starting_units / 
                                       //  daily_consumption_rate"
    variables: {
      varName: string                 // "starting_units"
      source: DataSourceTag           // where this variable comes 
                                       // from (reuse from Prompt 3)
      sourceDetail?: string
    }[]
  }
  
  // Brand-specific overrides
  brandOverrides: {
    brand: string
    overrideFormula?: string          // brand-specific formula
    overrideReason?: string           // why this brand needs custom 
                                       // logic
  }[]
  
  // Geography-specific overrides
  geoOverrides: {
    geography: string
    overrideFormula?: string
    overrideReason?: string
  }[]
  
  // Validation rules
  constraints: {
    minValue?: number
    maxValue?: number
    unitLabel: string                 // "days", "units", "weeks"
  }
  
  // Default values when inputs are missing
  defaultValue?: number
}

DEFAULT MODULES TO SEED

Module 1: Days on Hand (DOH)
  formula: "starting_units / daily_consumption_rate"
  variables:
    - starting_units (Auto-Pipelined from "Inventory Master")
    - daily_consumption_rate (Derived from weekly OUTs / 7)
  constraints: minValue 0, maxValue 365, unitLabel "days"
  
  Brand override for Ocrevus:
    overrideFormula: 
      "starting_units / (rolling_4wk_avg_outs / 
       effective_business_days_per_week)"
    overrideReason: 
      "Ocrevus consumption is Wednesday-heavy (88% of weekly volume 
       on Wed). Standard daily average understates true DOH because 
       most weekdays have near-zero consumption. Genentech's 
       calculation uses effective business days that exclude near-
       zero days from the denominator."

Module 2: Effective Revenue Days (ERD)
  formula: 
    "business_days_in_period - federal_holidays - 
     plant_shutdowns - special_calendar_adjustments"
  variables:
    - business_days_in_period (Derived from calendar)
    - federal_holidays (Auto-Pipelined from holiday calendar)
    - plant_shutdowns (Manual)
    - special_calendar_adjustments (Manual, optional)
  constraints: minValue 0, maxValue 31, unitLabel "days"
  
  Note: ERD is the source of variance like "this April has 22 
  business days vs baseline 21". Auto-computed but overridable for 
  plant shutdowns or special calendars.

Module 3: Calpac (Calendar Pacing Adjustment)
  formula: 
    "current_period_erd / baseline_period_erd"
  variables:
    - current_period_erd (from ERD module)
    - baseline_period_erd (Auto-Pipelined from "Baseline Calendar")
  constraints: minValue 0.5, maxValue 2.0, unitLabel "ratio"
  
  Brand override for Ocrevus:
    overrideFormula: 
      "current_period_business_wednesdays / 
       baseline_period_business_wednesdays"
    overrideReason: 
      "For Ocrevus, the true pacing driver is the count of business 
       Wednesdays in the period (since infusions are Wed-heavy), 
       not all business days. Genentech uses Wednesday-count Calpac 
       for Ocrevus and standard Calpac for Zunovo (SC, no infusion 
       day concentration)."

Module 4: Inventory Tier Allocation
  formula: 
    "total_inventory * tier_share_pct"
  variables:
    - total_inventory (sum of all tiers)
    - tier_share_pct (Manual per tier)
  
  Brand override (none currently, but the structure is there)

UI: CALCULATION MODULES PAGE

Add a new tab in the workspace (in Settings menu, not the main tab 
bar): "Calculation Modules"

Layout:
  Sidebar list of modules (DOH, ERD, Calpac, Inventory Tier 
    Allocation)
  Main pane: editor for selected module
  
  Module editor sections:
    1. Module metadata (name, description, unit)
    2. Default formula (read-only display + "Edit formula" button)
    3. Variables table (editable: name, source, source detail)
    4. Brand overrides (one row per override, expandable to show 
       formula + reason)
    5. Validation constraints
    6. Test formula sandbox (input sample values, see computed 
       output)
  
  "Save Changes" button (Chryselys gold). Saving triggers a forecast 
  recompute.

WHERE THE MODULES ARE INVOKED

DOH module: invoked in STF Build → Inventory & DOH sub-view. The 
  computed DOH per tier uses the active formula (brand-specific 
  override if applicable).

ERD module: invoked in Setup → Phasing Profiles → Effective Revenue 
  Days card. The computed ERD per month uses the active formula.

Calpac module: invoked in Review → Pacing Hero gauges. The pacing 
  comparison uses the active formula.

In every case, the calculation is shown with a small "ⓘ" icon next 
to the result. Hovering shows the formula being applied. Clicking 
opens the Calculation Modules page with that module active.

DEMO MOMENT

For Monday, prepare a specific moment in the demo:

When walking the Ocrevus Post-LoE scenario, click on a DOH value in 
the Inventory & DOH sub-view. The hover tooltip shows:
  "DOH = 20.1 days
   Formula: starting_units / (rolling_4wk_avg_outs / 
            effective_business_days_per_week)
   Inputs: 
     starting_units: 148,000 (from Inventory Master, last sync 
       2026-04-22)
     rolling_4wk_avg_outs: 7,650 (computed from STF actuals)
     effective_business_days_per_week: 1.04 (Wednesday-weighted, 
       per Ocrevus override)
   Note: Standard DOH formula would compute 19.4 days. The Ocrevus 
   override accounts for Wednesday-heavy consumption."

Clicking opens the Calculation Modules page with DOH active and 
the Ocrevus override highlighted.

The narrative line: "Sid asked whether we can wrap around your 
specific calculation logic. Here's how. Every calculation is a 
configurable module. The default formulas are biopharma-standard. 
Brand overrides capture your specific business rules. The 
overrides are version-controlled and auditable."

VALIDATION

  ☐ Calculation Modules page renders with all 4 default modules
  ☐ DOH module shows the Ocrevus brand override
  ☐ Editing a formula and saving triggers a forecast recompute
  ☐ DOH values in STF Inventory & DOH sub-view reflect the active 
    formula (different for Ocrevus vs Zunovo)
  ☐ Calculation tooltip on hover renders correctly
  ☐ Test formula sandbox produces correct output for sample inputs
  ☐ Brand override clearly visible and explained in the UI
```

---

### PROMPT 5-PLAN-MODE — GROWTH INTELLIGENCE WIRED INTO WORKSPACE

Run after Prompt 4-CALC-MODULES.

```
Wire the Growth Intelligence engine (from Growth Intelligence Pack 
G1, G1.5, G2, G3, G4) into the unified workspace as a Plan tab. 
The Growth Intelligence module currently lives at /growth-intel as 
a separate route. Move it into /forecast/plan and tighten the 
integration so investments flow visibly into the forecast.

ARCHITECTURE

The Growth Intelligence engine at /lib/growth-intel/ stays as is. 
What changes is the UI surface and how it integrates with the 
active forecast.

ROUTE
/growth-intel → redirects to /forecast/plan (already done in 
                Prompt 1-WORKSPACE)
/forecast/plan → new Plan Mode tab content

PLAN MODE LAYOUT

Top section: Plan Mode header
  "Plan Mode — model investments, see forecast impact"
  Active forecast: [Brand · Lifecycle Mode] (read from store)
  Total budget input: $___ M (default $10M, slider 1-100M)
  Time horizon: [12 weeks] dropdown (8/12/26/52)
  Risk tolerance: [Balanced] dropdown (Conservative/Balanced/
    Aggressive)
  "Run Optimizer" primary button

Middle section: Two-column layout
  Left column (60% width): Lever cards (existing G2 component)
    Each lever card: Field Force / Patient Services / DTC Spend / 
      Sample Allocation / Channel Investment / Pricing Action / 
      Access Investment
    Each card shows allocated budget, projected impact, payback, 
      ROI, risk
    "Show Calculation" expandable on each card (existing G3/G4 
      component)
  
  Right column (40% width): Forecast Impact Preview
    NEW component for v2.4. Shows live preview of how the 
    investment changes the forecast.
    
    Top: Mini line chart with two lines
      Baseline forecast (blue, thin)
      With Plan forecast (gold, thick)
      Time axis: next 26 weeks
    
    Below chart: Impact summary
      Baseline 26-week net revenue: $X M
      With Plan 26-week net revenue: $Y M
      Lift: +$Z M (+W%)
      
    Below summary: Tab bar
      [Forecast Impact] [P&L Impact] [LRP Rollup]
      
      Forecast Impact tab:
        Per-lever waterfall showing how each allocated dollar 
        contributes to the total lift
      
      P&L Impact tab:
        Income statement view: Gross Revenue, Trade Discount, 
        Reserve, Net Revenue, COGS, Gross Profit, Investment Cost, 
        Operating Profit
        Each row shows Baseline / With Plan / Delta
      
      LRP Rollup tab:
        Annual view of the impact:
        Year | Baseline LRP | With Plan LRP | Delta ($M) | Delta (%)

Bottom section: Trade-off Analysis (NEW for v2.4)
  Heading: "Trade-off Analysis for Finance Conversation"
  
  Three side-by-side scenario cards:
    Card 1: Baseline (no investment)
    Card 2: Recommended Plan (the optimizer output)
    Card 3: Alternative Plan (slider lets user vary the budget 
      allocation)
  
  Each card shows:
    Total investment
    Projected revenue lift (range, with confidence interval)
    Payback weeks
    ROI
    Risk score
    Top 3 levers
  
  Below the cards: 
    "Send to Finance" button — generates a one-page brief PDF/MD
    "Save as Scenario" button — creates a Scenario in Scenario 
      Planner
    "Push to STF" button — applies lever-implied weekly overrides 
      to STF Build (e.g., DTC investment lifts weekly NBRx 
      forecast by elasticity-derived amount)

DEMO SCENARIO — ZUNOVO $10M DTC

This is the Monday demo moment for Plan Mode. Pre-seed it.

Setup:
  Active forecast: Zunovo (Exclusivity mode)
  Budget: $10M
  Horizon: 26 weeks
  Risk: Balanced
  
Optimizer should allocate (approximately):
  DTC Spend: $5.5M (highest elasticity for SC reformulation 
    awareness)
  Patient Services: $2.0M (IV-to-SC conversion smoothing — hub 
    enrollment friction)
  Field Force: $1.5M (academic MS center concentration)
  Sample Allocation: $0.8M
  Channel Investment: $0.2M
  
Forecast impact:
  Baseline 26-week net revenue: $XX M (from current Zunovo seed)
  With Plan 26-week net revenue: $XX + $Y M
  Lift: +$Y M (Y/XX %)
  Payback weeks: 8-12

P&L Impact (annualized):
  Show full income statement view with the $10M investment line 
  and the resulting Operating Profit lift.

LRP Rollup:
  Show the multi-year impact: $Y M in Year 1, additional pull-
  forward effect in Year 2 (since Y1 conversion accelerates), 
  smaller Year 3 impact.

Trade-off Analysis cards:
  Baseline: $0 invest, $XX revenue, ROI N/A, Risk Low
  Recommended: $10M invest, $XX+Y revenue, ROI W%, Risk Medium
  Alternative (user-varied): demo shows $5M version that gets ~60% 
    of the lift at 50% of the cost — illustrating diminishing 
    returns

The narrative line for Monday:
  "Ashwin asked whether the platform supports decision support — 
  combining sensitivity inputs with forecasted upsides and 
  downsides, then running scenarios for trade-off analysis with 
  Finance. Here's that workflow on Zunovo. We're modeling a $10M 
  incremental DTC investment. The optimizer allocates across the 
  six commercial levers using published industry elasticities. 
  The forecast view updates live. The P&L view shows what Finance 
  would see. The LRP rollup shows the multi-year impact. And the 
  trade-off cards let you compare the recommended plan to a 
  smaller-budget alternative — the conversation you'd have with 
  Finance about how much investment is enough."

VALIDATION

  ☐ /forecast/plan renders with the Plan Mode layout
  ☐ /growth-intel correctly redirects to /forecast/plan
  ☐ Lever cards from G2 still render in the new layout
  ☐ Show Calculation breakdown still works on each lever
  ☐ Forecast Impact Preview chart renders with baseline + with-plan 
    lines
  ☐ P&L Impact tab renders income statement structure
  ☐ LRP Rollup tab renders multi-year delta
  ☐ Trade-off Analysis cards render
  ☐ Alternative Plan slider produces a different allocation in 
    real-time
  ☐ Zunovo $10M DTC scenario produces approximately the expected 
    allocation
  ☐ Push to STF correctly applies lever-implied weekly overrides 
    visible in STF Build
```

---

### PROMPT 6-DEMO-SEEDS — THREE LIFECYCLE DEMO STATES

Run last, after all other prompts pass. Seeds the demo data and validates the full Monday demo flow end-to-end.

```
Finalize the three lifecycle demo seeds and validate that the 
full Monday demo flow works end-to-end without manual intervention.

THREE DEMO SEEDS — ENSURE PROPERLY POPULATED

Demo Seed 1: Fenebrutinib Pre-launch
  ConnectedForecast.brand: 'Fenebrutinib'
  ConnectedForecast.geography: 'US'
  ConnectedForecast.lifecycleContext.mode: 'pre-launch'
  ConnectedForecast.lifecycleContext.preLaunchConfig: 
    [seed from Prompt 0.5-LIFE]
  
  Computed annual values (post-blend, post-PoS):
    2027: $0.04B (partial year, Dec launch)
    2028: $0.42B
    2029: $0.94B
    2030: $1.38B
    2031: $1.62B (peak approximate)
    2032: $1.58B
    ...
  
  Source-of-Truth Map should show:
    - Analog selections: Manual
    - Analog weights: Manual
    - PoS milestones: Manual
    - Tactical inputs: Manual
    - Resulting curve: Derived

Demo Seed 2: Zunovo Exclusivity (the headline demo)
  ConnectedForecast.brand: 'Zunovo'
  ConnectedForecast.geography: 'US'
  ConnectedForecast.lifecycleContext.mode: 'exclusivity'
  ConnectedForecast.lifecycleContext.exclusivityConfig: 
    [seed from Prompt 0.5-LIFE, with scReformulationConfig]
  ConnectedForecast.stfInputs: full seed (13-week forward with 
    realistic numbers)
  ConnectedForecast.lrpInputs: TrendFitInputs hybrid-blended with 
    SC conversion analogs
  
  Computed annual values:
    2026: $1.18B (current year, partial actuals + forecast)
    2027: $1.84B
    2028: $2.42B
    2029: $2.78B
    2030: $2.96B
  
  Pre-seeded for Plan Mode demo: $10M DTC scenario configuration 
  loaded but not yet executed (so user clicks Run Optimizer live 
  during demo).

Demo Seed 3: Ocrevus Post-LoE
  ConnectedForecast.brand: 'Ocrevus'
  ConnectedForecast.geography: 'US'
  ConnectedForecast.lifecycleContext.mode: 'post-loe'
  ConnectedForecast.lifecycleContext.postLoeConfig: 
    [seed from Prompt 0.5-LIFE]
  ConnectedForecast.stfInputs: account-based, populated with 50 
    representative accounts
  ConnectedForecast.lrpInputs: minimal — LRP is derivative
  
  Computed annual values (post-biosimilar entry 2028-04-01):
    2026: $4.25B (current)
    2027: $4.18B
    2028: $3.62B (partial-year biosimilar impact)
    2029: $2.74B
    2030: $1.95B
    2031: $1.42B
    2032: $1.08B
  
  Post-LoE STF account view: top 10 accounts pre-populated with 
    realistic monthly demand patterns and site-of-care segment 
    assignments.

DEMO MODE TOGGLE

Verify the Demo Mode toggle (added in Prompt 1-WORKSPACE) switches 
between the three seeds atomically. Each switch should:
  1. Update brand, lifecycle mode, geography
  2. Re-render tab bar with mode-appropriate tabs
  3. Land on the appropriate default tab for that mode
  4. Take less than 600ms total

END-TO-END DEMO FLOW VALIDATION

Run through the Monday demo flow as a script. Each step should 
work without manual configuration:

  Scene 1: Open /forecast in Demo Mode. Default scenario = Zunovo 
    Exclusivity. ☐
  
  Scene 2: Switch to Fenebrutinib Pre-launch via Demo selector. 
    Tab bar updates (no STF, no Opportunities, Launch Readiness 
    visible). LRP tab opens. PoS sensitivity card visible. ☐
  
  Scene 3: Adjust analog weights (Kesimpta 45→55%). Curve 
    re-renders. PoS multiplier still applies. ☐
  
  Scene 4: Switch back to Zunovo Exclusivity. STF tab visible. 
    Click STF tab. Build zone loads with sub-views. Hybrid Blender 
    card visible at top of LRP. ☐
  
  Scene 5: Click Connect tab. Forecast Stack View renders with 
    annual + monthly + weekly. Click Run Seek with $1.5B target. 
    Weekly intervention map populates. ☐
  
  Scene 6: Switch to Ocrevus Post-LoE. STF (Account-based) tab 
    opens by default. Account Performance sub-view shows top 50 
    accounts. ☐
  
  Scene 7: Click Site-of-Care Erosion sub-view. Stacked area 
    chart renders with editable erosion rates. ☐
  
  Scene 8: Click LRP (Derivative) tab. Banner shows "Derivative — 
    rolled up from account-based STF". Numbers reflect the 
    account rollup. ☐
  
  Scene 9: Open Calculation Modules (from Settings menu). Click 
    DOH module. Show Ocrevus brand override with Wednesday-weighted 
    formula explained. ☐
  
  Scene 10: Switch to Zunovo Exclusivity. Click Plan tab. Plan 
    Mode opens with $10M default budget. Click Run Optimizer. 
    Lever cards populate. Forecast Impact Preview renders. ☐
  
  Scene 11: Click P&L Impact tab inside the Forecast Impact 
    Preview. Income statement renders with $10M investment line. ☐
  
  Scene 12: Click Trade-off Analysis section. Three scenario cards 
    visible. Drag the Alternative Plan slider to $5M. Card updates 
    in real-time. ☐
  
  Scene 13: Click "Send to Finance" — generates a one-page brief. ☐

If any scene fails, surface the failure and stop. The demo must 
work end-to-end without intervention before Monday.
```

---

## PART 4 — DEMO SCRIPT FOR MONDAY (12:00–13:00 PT WORKING SESSION WITH SID)

Six scenes, ~35 minutes plus 25 minutes for Sid's questions and discussion. The architectural reframe lands in Scene 1. The three lifecycle scenarios anchor Scenes 2-4. The calpac answer lands in Scene 5. Decision support lands in Scene 6.

**Scene 1 (3 min) — The architectural reframe.** Open `/forecast` in Demo Mode. Land on Zunovo Exclusivity by default. Don't dive in. Frame first.

> "On Friday you said you wanted one framework with sections, not two parallel models. We rebuilt around that. What you're looking at is the unified forecast workspace. One URL. One brand selector. One lifecycle mode selector. Every section of forecasting work — long-term authoring, short-term execution, connection, decision support — is a tab in this workspace. The same forecast computes across grains. The same governance rails apply. Three lifecycle modes drive different defaults: pre-launch, exclusivity, post-loss-of-exclusivity. Let me walk you through each."

**Scene 2 (6 min) — Fenebrutinib Pre-launch.** Switch via the Demo Mode selector. Pause for the transition animation.

> "First scenario you raised: a pipeline brand with no historical data. Fenebrutinib. Phase 3, expected approval late 2027. The workspace adapts. The STF tab is gone — there's no commercial data to work with yet. The LRP authoring is locked to Analog-Weighted methodology because nothing else applies. We've blended three analogs: Kesimpta as the convenience-driven oral comparator, Briumvi as the anti-CD20 mechanism comparator, Tysabri as the high-efficacy precedent. Each is weighted. Each has differential adjustments for clinical profile and competitive context."

Click the LRP tab. Show the analog blender. Adjust a weight live. Curve re-renders.

> "And critically, every cell here is tagged with its source. These aren't computed values pretending to be data. The analog weights are Manual — strategy decisions you own. The PoS milestone probabilities are Manual, sourced from your internal R&D estimates. The resulting curve is Derived. When Sandra asks 'where did this number come from,' the answer is one click away."

Click the Launch Readiness tab.

> "And this tab — Launch Readiness — replaces STF in Pre-launch mode. Pre-launch tactical inputs: MSL deployment, DTC build, formulary positioning. The forecast curve is sensitive to these. They flow through."

**Scene 3 (8 min) — Zunovo Exclusivity. The bidirectional flow moment.** Switch to Zunovo via the Demo Mode selector.

> "Second scenario: a brand with limited history. Zunovo, 18 months post-launch. Active IV-to-SC conversion. The workspace is now the full set of tabs. LRP, STF, Connect, Opportunities, Plan, Review."

Click the LRP tab. Point at the Hybrid Blender card.

> "The LRP for Zunovo is hybrid. Trend gets 65% weight because there's enough history to fit a curve. The remaining 35% comes from IV-to-SC conversion analogs — Herceptin SC, Rituxan SC, Darzalex Faspro. As more history accumulates, the blender shifts toward trend. At 36 months, it's 90% trend, 10% analog."

Click the STF tab. Show the Build zone briefly.

> "STF is the operational layer. Trend selection, weekly forecasts, inventory, pricing. This is what the brand ops team works in day to day."

Click the Connect tab. Show the Forecast Stack View.

> "And here's where the connection lives. Annual at the top, monthly in the middle, weekly at the bottom. One forecast, three grains. They're not three forecasts that happen to be related — they reconcile by construction. The sum of weekly equals monthly. The sum of monthly equals annual."

Click Run Seek with a target. Pause for the animation.

> "Top-down: leadership says 2027 needs to be $1.85B, not $1.84B. Seek-to-Forecast decomposes that lift across months and weeks. Most weeks are achievable. A few are stretch. A few require intervention."

Now show the reverse cascade.

> "And here's what's new. Bottom-up. Sustained drift in STF actuals automatically rolls up. We've simulated four weeks of STF running 6% above forecast. The system proposes an LRP refresh — 'your annual is implicitly $X M higher than what's in the LRP, do you want to update?' The forecaster confirms or defers. They're never overridden. This is the bidirectional flow you asked about on Friday."

**Scene 4 (6 min) — Ocrevus Post-LoE. The inversion.** Switch to Ocrevus Post-LoE.

> "Third scenario: a brand that's gone biosimilar. The patient-based LT model breaks. Class share isn't a clean function anymore. The work is account-based ST."

Note the tab order has changed: STF is first now, LRP is second.

> "And the workspace inverts. STF is the source of truth. LRP is derivative. The tab order reflects that. The user works in accounts."

Click STF (Account-based). Show the Account Performance sub-view.

> "Top 50 accounts. Fair share methodology — access-weighted in this case. Custom allocation ratios per account tier — 80/20 for top IDNs, 70/30 for academic centers. Caps and floors per account. Baseline carve-outs for non-strategic accounts. This is exactly the subnational forecasting capability your RFP names."

Click Site-of-Care Erosion sub-view.

> "And the bottoms-up site-of-care erosion curves. Hospital outpatient infusion declining 4% per year, migrating to community infusion suites. This isn't a global rate — it's segment-specific, with destination tracking."

Click the LRP (Derivative) tab.

> "And the LRP. Read-only. Banner says it's rolled up from the account-based STF. Edit the accounts in STF; this updates automatically. The annual numbers leadership sees are an artifact of the operational forecast, not a separate model."

**Scene 5 (4 min) — The calpac answer.** Open Settings → Calculation Modules. Click DOH.

> "On Friday you raised DOH, inventory, DOH targets, and calpac as the wedge where IQVIA-class platforms historically can't wrap around your business rules. Here's our position."

Show the DOH module page. Point at the Ocrevus brand override.

> "Every calculation in the engine is a configurable module. Default formulas are biopharma-standard. Brand overrides capture your specific logic. For Ocrevus, the standard DOH formula doesn't work — your consumption is Wednesday-heavy, 88% of weekly volume on Wed. Standard daily-average DOH understates true coverage. Your business rule uses effective business days. The override implements that. The reason is documented. The override is version-controlled."

Click on Calpac. Show the Ocrevus override that uses Wednesday-count.

> "Same pattern for Calpac. For Ocrevus, the pacing driver is business Wednesdays in the period, not all business days. For Zunovo, which is SC and has no infusion-day concentration, the standard formula applies. Both live in the platform. Both are auditable. We'll model your specific calculation logic in the scoping phase. The architecture exists today to absorb it."

**Scene 6 (5 min) — Plan Mode. The decision support close.** Switch back to Zunovo Exclusivity. Click Plan tab.

> "Last thing. Ashwin, on Friday you asked whether the platform supports decision support — combining sensitivity inputs with forecasted event upsides and downsides, then running scenarios for trade-off analysis with Finance. Here's that workflow."

Set budget to $10M. Click Run Optimizer.

> "We're modeling a $10M incremental investment on Zunovo. The optimizer allocates across six commercial levers using published industry elasticities. DTC gets the largest slice — $5.5M — because for an SC reformulation, awareness is the binding constraint. Patient services gets $2M for hub enrollment friction in the IV-to-SC transition. Field force, samples, channel investment fill out the rest."

Click on a lever card. Show Calculation breakdown.

> "And every number is defensible. Click any lever — $5.5M of DTC. Show calculation. The math is right here: dollars to impressions, impressions to reach, reach to NBRx lift, NBRx to revenue. Each step has citations. Published elasticities, Genentech-comparable analogs."

Click P&L Impact tab.

> "P&L view. This is what Finance sees. Net revenue lift, COGS, investment cost, operating profit delta. Annualized."

Click Trade-off Analysis. Drag the alternative slider to $5M.

> "And here's the Finance conversation. Recommended plan: $10M, $Y revenue lift. Alternative: $5M gets us roughly 60% of the lift. Diminishing returns. The trade-off is visible. Send to Finance generates the brief."

**Wrap (3 min).** Return to the workspace home.

> "What you're looking at — and what you'll have a hands-on shot at next week — is the unified framework you described on Friday. Three lifecycle modes. Bidirectional connection. Configurable calculations. Decision support wired into the forecast. We can talk through the phased delivery plan now if you'd like, or take questions on what you've seen."

---

## PART 5 — BUILD SEQUENCING AND RISK

**Run order.** 0.5-LIFE → 1-WORKSPACE → 1.5-VALIDATION → 2-LIFECYCLE-DEFAULTS → 3-AUTHORING-SURFACE → 4-CALC-MODULES → 5-PLAN-MODE → 6-DEMO-SEEDS.

**Critical gate: Prompt 1.5-VALIDATION.** Do not proceed past the shell change without confirming v2.3 capabilities still render. The shell collapse is the highest-risk single change in this pack.

**If time runs out before Monday.** Priority order for partial completion:

1. P0 (must land): 0.5-LIFE, 1-WORKSPACE, 1.5-VALIDATION, 6-DEMO-SEEDS. With these four, the unified workspace exists, the three lifecycle scenarios switch, and the demo flow runs even if individual prompts are stubbed.

2. P1 (should land): 2-LIFECYCLE-DEFAULTS, 4-CALC-MODULES. These deliver Scenes 2-5 of the demo. Scene 4 (Post-LoE) and Scene 5 (Calpac) are the two scenes that directly close Sid's pushback.

3. P2 (nice to have): 3-AUTHORING-SURFACE, 5-PLAN-MODE. Source tags are credibility plumbing — they make the platform feel real, but a single hover popover demo gets the same effect. Plan Mode is Ashwin's ask, not Sid's; if it's stubbed for Monday, we promise it for the next session.

**What to drop first if behind.** Drop 3-AUTHORING-SURFACE before 5-PLAN-MODE. Plan Mode is a visible product capability with a clean demo moment. Source tags are a quality signal that's easier to defer.

**What we are not building in this pack.** Workflow Agent. Conversational Interface. Intelligent QC. These three GenAI capabilities are named in the new RFP as Net-New requirements. They go in the proposal as Phase 2/3 deliverables, not the Monday build. If Sid asks specifically about them, the answer is: "Demo-able prototypes by mid-Q3 as part of Phase 3. The architecture in front of you supports them — the workspace shell is where they plug in."

---

## PART 6 — PROPOSAL ANCHORING NOTES

The RFP response and this demo are the same thing told twice. Anchor the proposal to what the demo shows.

**Phase 1 (Early-Mid May).** Architecture alignment. Workspace shell stand-up. Lifecycle mode framework defined. Calculation modules library spec'd against Genentech business rules. Data access agreements for the three brands.

**Phase 2 (Late May-June, Q2).** Core Workbench buildout. Scenario Simulation and Driver-based Forecasting modules expanded. Ecosystem/Account-based Subnational Forecasting fully wired with fair share, custom allocation ratios, caps and floors, baseline carve-outs. Foundational AI agent capabilities (workflow scaffolding, basic NLP routing). Q2 mid-checkpoint readout.

**Phase 3 (July-August, Q3).** Advanced modules. Deviation Attributor wired into the Performance Narratives system. S&OP Anomaly Detection with P&L impact. Biosimilar Impact Predictor for Ocrevus. Analog Selection & Curve Generation system formalized. Cross-system handshakes with Finance & Reserves, PAA, Access Solutions & PCD, PT (USOP), GPS.

**Phase 4 (September, Late Q3).** UAT with NI squad and Finance. PoC readout. Enterprise scale-up recommendation document.

**The wedge for early Q3 working slice.** Sid offered to shift the Q3 hard deadline if we show something working in early Q3. Phase 2 already lands a working slice mid-Q2 (the Q2 mid-checkpoint readout). We propose showing Genentech leadership a hardened version of the unified workspace with two of the three lifecycle scenarios fully operational by end of June. That's the early-Q3 working slice. Final hard deadline shifts to early Q4 to absorb the Phase 3 advanced modules and integrations without compressing UAT.

**Team composition (per RFP Section 8).** Engagement Lead/Program Manager (1.0), Product Manager (1.0), Data Engineers (2-3), Forecasting/Analytics SME (1-2), Full-stack Developers (2-3), GenAI/ML Engineer (1.0), QA/UAT Lead (0.5-1.0). Total 8.5-12 FTE. Names committed in the proposal — Chetan owns this list before May 8.

---

## PART 7 — WHAT WE ARE NOT DOING (DEFERRED, INTENTIONAL)

Honesty about scope keeps the proposal credible.

**Conversational Interface as a primary surface.** Phase 3. The architecture supports it (workspace shell can host a command bar); we are not demoing it Monday.

**Workflow Agent that actively manages cycle calendars.** Phase 3. This is a real capability commitment, not vapor. Delivered as part of the integrations track.

**Real Oasis integration.** Phase 1 architecture work, Phase 3 integration. The demo uses representative seed data with source tags pointing to where Oasis would feed in.

**Real GPS / Symphony / Access Solutions feeds.** Phase 3 integration. Same as above.

**MMM-engine integration with Genentech's actual marketing mix model.** Plan Mode uses published industry elasticities for the demo. Production wires into Genentech's MARS/DeepSense and MMM outputs. Phase 2 spike, Phase 3 production integration.

**End-to-end SOC 2 Type II certification of the demo build.** The demo lives on Antigravity infrastructure. Production deployment for the PoC will run in a Genentech-approved cloud environment with SOC 2 attestation in place. Phase 1 work.

If Sid asks about any of these, the answer is the same shape: phase commitment, not vapor, with a clear architectural pathway from what he's seeing today.

---

End of pack.
