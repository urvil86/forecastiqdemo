import * as XLSX from "xlsx";
import type { UploadPayload, ValidationIssue } from "./types";

type Cell = string | number | boolean | null;
type Row = Cell[];

const REQUIRED_SHEETS = ["Brand_Config", "LRP_Assumptions", "STF_Weekly"] as const;

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,%\s]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function asString(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fallback;
}

function isoFromCellValue(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + v * 86400_000);
    return d.toISOString().slice(0, 10);
  }
  const s = asString(v);
  if (!s) return "";
  const d = new Date(s);
  if (Number.isFinite(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

function getRows(workbook: XLSX.WorkBook, sheetName: string): Row[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Cell[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
  });
}

function findHeaderRow(rows: Row[], startsWith: string): number {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const c0 = asString(rows[i][0]).toLowerCase();
    if (c0.startsWith(startsWith.toLowerCase())) return i;
  }
  return -1;
}

function readBrandConfig(
  workbook: XLSX.WorkBook,
  issues: ValidationIssue[],
): Pick<
  UploadPayload,
  | "brand"
  | "geography"
  | "cycleName"
  | "cycleStartDate"
  | "lifecycleStage"
  | "defaultMethodology"
  | "stfHorizonWeeks"
> {
  const rows = getRows(workbook, "Brand_Config");
  if (rows.length === 0) {
    issues.push({
      sheet: "Brand_Config",
      severity: "error",
      message: "Brand_Config sheet missing or empty",
    });
    return {
      brand: "",
      geography: "",
      cycleName: "",
      cycleStartDate: "",
      lifecycleStage: "",
      defaultMethodology: "",
      stfHorizonWeeks: 13,
    };
  }
  const map: Record<string, Cell> = {};
  for (const r of rows) {
    const k = asString(r[0]).toLowerCase();
    if (!k) continue;
    map[k] = r[1] ?? null;
  }

  const cycleStart = isoFromCellValue(map["cycle start date"] ?? map["cycle_start_date"]);
  if (!cycleStart) {
    issues.push({
      sheet: "Brand_Config",
      severity: "warning",
      message: "Cycle Start Date missing or unparseable",
    });
  }

  return {
    brand: asString(map["brand"]),
    geography: asString(map["geography"]),
    cycleName: asString(map["cycle name"] ?? map["cycle_name"]),
    cycleStartDate: cycleStart,
    lifecycleStage: asString(map["lifecycle stage"] ?? map["lifecycle_stage"]),
    defaultMethodology: asString(
      map["default methodology"] ?? map["default_methodology"],
    ),
    stfHorizonWeeks: asNumber(map["stf horizon weeks"] ?? map["stf_horizon_weeks"], 13),
  };
}

function readLrpAssumptions(
  workbook: XLSX.WorkBook,
  issues: ValidationIssue[],
): UploadPayload["lrpAssumptions"] {
  const rows = getRows(workbook, "LRP_Assumptions");
  if (rows.length === 0) {
    issues.push({
      sheet: "LRP_Assumptions",
      severity: "error",
      message: "LRP_Assumptions sheet missing",
    });
    return [];
  }
  const headerIdx = findHeaderRow(rows, "driver");
  if (headerIdx < 0) {
    issues.push({
      sheet: "LRP_Assumptions",
      severity: "warning",
      message: "Could not locate 'Driver' header row",
    });
    return [];
  }
  const header = rows[headerIdx].map((c) => asString(c));
  const yearCols: { idx: number; year: number }[] = [];
  for (let i = 1; i < header.length; i++) {
    const y = parseInt(header[i]);
    if (Number.isFinite(y) && y >= 2020 && y <= 2050) {
      yearCols.push({ idx: i, year: y });
    }
  }
  const notesIdx = header.findIndex((h) => /notes?/i.test(h));

  const out: UploadPayload["lrpAssumptions"] = [];
  let currentSection = "";
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const driverCell = asString(row[0]);
    if (!driverCell) continue;
    // Section bands typically have only the section name and no year values
    const hasYearValues = yearCols.some(
      (yc) => row[yc.idx] !== null && row[yc.idx] !== "",
    );
    if (
      !hasYearValues &&
      driverCell === driverCell.toUpperCase() &&
      driverCell.length > 2
    ) {
      currentSection = driverCell;
      continue;
    }
    const yearValues = yearCols
      .map((yc) => ({ year: yc.year, value: asNumber(row[yc.idx]) }))
      .filter((v) => v.value !== 0 || row[yearCols.find((c) => c.year === v.year)?.idx ?? 0] === 0);
    out.push({
      section: currentSection,
      driver: driverCell,
      yearValues,
      notes: notesIdx >= 0 ? asString(row[notesIdx]) : "",
    });
  }
  return out;
}

function readLrpOutput(
  workbook: XLSX.WorkBook,
  issues: ValidationIssue[],
): UploadPayload["lrpOutput"] {
  const rows = getRows(workbook, "LRP_Output");
  if (rows.length === 0) {
    issues.push({
      sheet: "LRP_Output",
      severity: "info",
      message: "LRP_Output sheet missing — sanity comparison skipped",
    });
    return [];
  }
  const headerIdx = findHeaderRow(rows, "metric");
  if (headerIdx < 0) return [];
  const header = rows[headerIdx].map((c) => asString(c));
  const yearCols: { idx: number; year: number }[] = [];
  for (let i = 1; i < header.length; i++) {
    const y = parseInt(header[i]);
    if (Number.isFinite(y) && y >= 2020 && y <= 2050) {
      yearCols.push({ idx: i, year: y });
    }
  }
  const out: UploadPayload["lrpOutput"] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const metric = asString(row[0]);
    if (!metric) continue;
    out.push({
      metric,
      yearValues: yearCols.map((yc) => ({
        year: yc.year,
        value: asNumber(row[yc.idx]),
      })),
    });
  }
  return out;
}

function readStfWeekly(
  workbook: XLSX.WorkBook,
  issues: ValidationIssue[],
): UploadPayload["stfWeekly"] {
  const rows = getRows(workbook, "STF_Weekly");
  if (rows.length === 0) {
    issues.push({
      sheet: "STF_Weekly",
      severity: "error",
      message: "STF_Weekly sheet missing",
    });
    return [];
  }
  const headerIdx = findHeaderRow(rows, "week start");
  if (headerIdx < 0) {
    issues.push({
      sheet: "STF_Weekly",
      severity: "warning",
      message: "Could not locate 'Week Start' header",
    });
    return [];
  }
  const header = rows[headerIdx].map((c) => asString(c).toLowerCase());
  function col(...names: string[]): number {
    for (const n of names) {
      const i = header.findIndex((h) => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  }
  const cWeekStart = col("week start");
  const cWeekNum = col("week #", "week number");
  const cType = col("type");
  const cSku = col("sku");
  const cBaseline = col("baseline outs");
  const cHoliday = col("holiday adj");
  const cEvent = col("event impact");
  const cFinal = col("final outs");
  const cPrice = col("net price");
  const cRevenue = col("net revenue");
  const cNotes = col("notes");

  const out: UploadPayload["stfWeekly"] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const ws = asString(row[cWeekStart] ?? null);
    if (!ws) continue;
    if (/total|^subtotal/i.test(ws)) continue;
    const baseline = asNumber(row[cBaseline]);
    const holiday = asNumber(row[cHoliday]);
    const event = asNumber(row[cEvent]);
    const final = asNumber(row[cFinal]);
    const sum = baseline + holiday + event;
    if (final !== 0 && Math.abs(final - sum) > 1) {
      issues.push({
        sheet: "STF_Weekly",
        cell: `Row ${r + 1}`,
        severity: "warning",
        message: `Final OUTs (${final}) does not equal Baseline + Holiday + Event (${sum})`,
      });
    }
    out.push({
      weekStart: isoFromCellValue(row[cWeekStart]),
      weekNumber: asString(row[cWeekNum]),
      type: (asString(row[cType]) as "History" | "Partial" | "Forecast") || "Forecast",
      sku: asString(row[cSku]),
      baselineOuts: baseline,
      holidayAdj: holiday,
      eventImpact: event,
      finalOuts: final,
      netPrice: asNumber(row[cPrice]),
      netRevenueM: asNumber(row[cRevenue]),
      notes: asString(row[cNotes]),
    });
  }
  return out;
}

function readInventory(
  workbook: XLSX.WorkBook,
  issues: ValidationIssue[],
): UploadPayload["inventory"] {
  const rows = getRows(workbook, "STF_Inventory");
  if (rows.length === 0) {
    issues.push({
      sheet: "STF_Inventory",
      severity: "warning",
      message: "STF_Inventory sheet missing",
    });
    return [];
  }
  const headerIdx = findHeaderRow(rows, "tier");
  if (headerIdx < 0) return [];
  const header = rows[headerIdx].map((c) => asString(c).toLowerCase());
  const cTier = header.findIndex((h) => h.includes("tier"));
  const cSub = header.findIndex((h) => h.includes("sub-account") || h.includes("subaccount"));
  const cUnits = header.findIndex((h) => h.includes("units"));
  const cDaily = header.findIndex((h) => h.includes("daily consumption"));
  const cDoh = header.findIndex((h) => h.includes("doh") && !h.includes("target"));
  const cDohTarget = header.findIndex((h) => h.includes("doh target"));
  const cStatus = header.findIndex((h) => h.includes("status"));

  const out: UploadPayload["inventory"] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const tier = asString(row[cTier]);
    if (!tier) continue;
    const sub = asString(row[cSub]);
    const isSummary = sub.toUpperCase().startsWith("TOTAL");
    out.push({
      tier,
      subAccount: sub,
      units: asNumber(row[cUnits]),
      dailyConsumption: asNumber(row[cDaily]),
      dohComputed: asNumber(row[cDoh]),
      dohTargetRange: asString(row[cDohTarget]),
      status: asString(row[cStatus]),
      isSummary,
    });
  }
  return out;
}

function readPricing(
  workbook: XLSX.WorkBook,
  issues: ValidationIssue[],
): UploadPayload["pricing"] {
  const rows = getRows(workbook, "STF_Pricing");
  if (rows.length === 0) {
    issues.push({
      sheet: "STF_Pricing",
      severity: "warning",
      message: "STF_Pricing sheet missing",
    });
    return [];
  }
  const headerIdx = findHeaderRow(rows, "week start");
  if (headerIdx < 0) return [];
  const header = rows[headerIdx].map((c) => asString(c).toLowerCase());
  function col(...names: string[]): number {
    for (const n of names) {
      const i = header.findIndex((h) => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  }
  const cWeekStart = col("week start");
  const cWeekNum = col("week #", "week number");
  const cGross = col("gross price");
  const cTrade = col("trade discount");
  const cReserve = col("reserve rate");
  const cReserveAdj = col("reserve adj");
  const cNet = col("net price");
  const cNotes = col("notes");

  const out: UploadPayload["pricing"] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const ws = asString(row[cWeekStart] ?? null);
    if (!ws) continue;
    const trade = asNumber(row[cTrade]);
    const reserve = asNumber(row[cReserve]);
    if (trade + reserve > 100) {
      issues.push({
        sheet: "STF_Pricing",
        cell: `Row ${r + 1}`,
        severity: "warning",
        message: `Trade Discount + Reserve Rate exceeds 100% (${trade + reserve})`,
      });
    }
    out.push({
      weekStart: isoFromCellValue(row[cWeekStart]),
      weekNumber: asString(row[cWeekNum]),
      grossPrice: asNumber(row[cGross]),
      tradeDiscountPct: trade,
      reserveRatePct: reserve,
      reserveAdjPct: asNumber(row[cReserveAdj]),
      netPrice: asNumber(row[cNet]),
      notes: asString(row[cNotes]),
    });
  }
  return out;
}

function readEvents(
  workbook: XLSX.WorkBook,
  issues: ValidationIssue[],
): UploadPayload["events"] {
  const rows = getRows(workbook, "Events");
  if (rows.length === 0) {
    issues.push({
      sheet: "Events",
      severity: "info",
      message: "Events sheet missing",
    });
    return [];
  }
  const headerIdx = findHeaderRow(rows, "name");
  if (headerIdx < 0) return [];
  const header = rows[headerIdx].map((c) => asString(c).toLowerCase());
  function col(...names: string[]): number {
    for (const n of names) {
      const i = header.findIndex((h) => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  }
  const cName = col("name");
  const cType = col("type");
  const cStart = col("start date", "start");
  const cPeak = col("peak impact");
  const cTime = col("time to peak");
  const cDecay = col("decay shape");
  const cDir = col("direction");
  const cNotes = col("notes");

  const out: UploadPayload["events"] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const name = asString(row[cName]);
    if (!name) continue;
    out.push({
      name,
      type: asString(row[cType]),
      startDate: isoFromCellValue(row[cStart]),
      peakImpactPct: asNumber(row[cPeak]),
      timeToPeakWeeks: asNumber(row[cTime]),
      decayShape: asString(row[cDecay]),
      direction:
        (asString(row[cDir]) as "Positive" | "Negative") || "Positive",
      notes: asString(row[cNotes]),
    });
  }
  return out;
}

function readPhasing(
  workbook: XLSX.WorkBook,
  issues: ValidationIssue[],
): UploadPayload["phasing"] {
  const rows = getRows(workbook, "Phasing");
  const empty: UploadPayload["phasing"] = {
    dailyPattern: [],
    weeklyOfMonth: [],
    erdByMonth: [],
  };
  if (rows.length === 0) {
    issues.push({
      sheet: "Phasing",
      severity: "warning",
      message: "Phasing sheet missing",
    });
    return empty;
  }

  // Locate sub-sections by section title in column A
  const findSection = (text: string): number =>
    rows.findIndex((row) => asString(row[0]).toLowerCase().includes(text.toLowerCase()));

  const out: UploadPayload["phasing"] = {
    dailyPattern: [],
    weeklyOfMonth: [],
    erdByMonth: [],
  };

  // Daily Sales Pattern (DSP)
  const dspIdx = findSection("daily sales pattern");
  if (dspIdx >= 0) {
    for (let r = dspIdx + 2; r < rows.length; r++) {
      const day = asString(rows[r][0]);
      const weight = asNumber(rows[r][1]);
      if (!day || /weekly|erd/i.test(day)) break;
      out.dailyPattern.push({ day, weight });
    }
    const total = out.dailyPattern.reduce((a, p) => a + p.weight, 0);
    if (Math.abs(total - 100) > 0.5 && Math.abs(total - 1) > 0.005) {
      issues.push({
        sheet: "Phasing",
        severity: "warning",
        message: `Daily pattern weights sum to ${total.toFixed(2)} (expected ~100)`,
      });
    }
  }

  // Weekly of Month
  const womIdx = findSection("weekly of month");
  if (womIdx >= 0) {
    for (let r = womIdx + 2; r < rows.length; r++) {
      const week = asString(rows[r][0]);
      const weight = asNumber(rows[r][1]);
      if (!week || /erd/i.test(week)) break;
      out.weeklyOfMonth.push({ week, weight });
    }
    const total = out.weeklyOfMonth.reduce((a, p) => a + p.weight, 0);
    if (Math.abs(total - 100) > 0.5 && Math.abs(total - 1) > 0.005) {
      issues.push({
        sheet: "Phasing",
        severity: "warning",
        message: `Weekly-of-month weights sum to ${total.toFixed(2)} (expected ~100)`,
      });
    }
  }

  // ERD by Month
  const erdIdx = findSection("erd by month");
  if (erdIdx >= 0) {
    // Header row is erdIdx + 1
    const header = (rows[erdIdx + 1] ?? []).map((c) => asString(c).toLowerCase());
    const cMonth = header.findIndex((h) => h.includes("month"));
    const cBiz = header.findIndex((h) => h.includes("business days"));
    const cFed = header.findIndex((h) => h.includes("federal holidays"));
    const cPlant = header.findIndex((h) => h.includes("plant shutdowns"));
    const cSpecial = header.findIndex((h) => h.includes("special"));
    const cErd = header.findIndex((h) => h === "erd" || h.startsWith("erd "));
    const cBaseline = header.findIndex((h) => h.includes("baseline erd"));
    const cCalpac = header.findIndex((h) => h.includes("calpac"));
    for (let r = erdIdx + 2; r < rows.length; r++) {
      const row = rows[r];
      const month = asString(row[cMonth] ?? null);
      if (!month) continue;
      out.erdByMonth.push({
        month,
        businessDays: asNumber(row[cBiz]),
        federalHolidays: asNumber(row[cFed]),
        plantShutdowns: asNumber(row[cPlant]),
        specialAdj: asNumber(row[cSpecial]),
        erd: asNumber(row[cErd]),
        baselineErd: asNumber(row[cBaseline]),
        calpacRatio: asNumber(row[cCalpac]),
      });
    }
  }

  return out;
}

export async function parseUpload(file: File): Promise<UploadPayload> {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array", cellDates: true });
  const issues: ValidationIssue[] = [];

  const sheetNames = workbook.SheetNames;
  for (const required of REQUIRED_SHEETS) {
    if (!sheetNames.includes(required)) {
      issues.push({
        sheet: required,
        severity: "error",
        message: `Required sheet "${required}" is missing`,
      });
    }
  }

  const cfg = readBrandConfig(workbook, issues);
  const lrpAssumptions = readLrpAssumptions(workbook, issues);
  const lrpOutput = readLrpOutput(workbook, issues);
  const stfWeekly = readStfWeekly(workbook, issues);
  const inventory = readInventory(workbook, issues);
  const pricing = readPricing(workbook, issues);
  const events = readEvents(workbook, issues);
  const phasing = readPhasing(workbook, issues);

  const hasErrors = issues.some((i) => i.severity === "error");
  const hasWarnings = issues.some((i) => i.severity === "warning");
  const status: "valid" | "warnings" | "errors" = hasErrors
    ? "errors"
    : hasWarnings
    ? "warnings"
    : "valid";

  return {
    ...cfg,
    lrpAssumptions,
    lrpOutput,
    stfWeekly,
    inventory,
    pricing,
    events,
    phasing,
    validation: { status, issues },
    filename: file.name,
    parsedAt: new Date().toISOString(),
  };
}
