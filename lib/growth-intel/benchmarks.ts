// Benchmark provenance for elasticity calibrations.
// Cited names are real organizations that publish these kinds of studies.
// Specific numerical calibrations are synthetic-but-plausible for demo;
// replaceable with internal historical data on day-one of production.

export const BENCHMARKS = {
  "ZS Associates 2023 sales force productivity benchmarks for specialty pharma":
    "Field-force productivity: each incremental rep adds ~0.2% revenue lift at the margin in saturated specialty markets, with logarithmic decay as territory coverage approaches 100%.",
  "IQVIA Channel Dynamics 2023 — territory realignment ROI study":
    "Reallocating high-performing reps from low-elasticity to high-elasticity territories yields 1–3% revenue lift with strong diminishing returns past 30 rep-months shifted.",
  "Komodo Sample-to-NBRx conversion benchmarks 2023, MS therapeutic area":
    "Sample reallocation in MS shows S-curve response: needs threshold of ~$3M concentrated to register meaningful NBRx lift; saturates around $8M.",
  "Genentech-comparable specialty hub operations benchmark, 2023":
    "Patient services capacity is operationally capacity-bounded — linear lift up to ~$6M annual headcount, then flat (training and process bottlenecks).",
  "Nielsen DTC effectiveness study 2023, MS therapeutic category":
    "Specialty MS DTC has S-curve response with high steepness; below $5M annual spend, impact is near zero. $8M is approximately the 50% saturation point.",
  "IDN account targeting program ROI benchmarks, MS specialty therapeutics":
    "Targeting program investment shows strong logarithmic diminishing returns; first $1M produces majority of impact.",
};
