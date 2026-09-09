/**
 * Fleet data model and fixture.
 *
 * Ported from the canvas mockup's tokenRows()/chart() in
 * `docs/Fleet Directions.dc.html`. Two deliberate changes from the mockup:
 *
 *  1. Figures are numbers, not preformatted strings. Formatting is a rendering
 *     concern and belongs in <Figure>.
 *  2. Platform totals and the chart's endpoint percentages are *derived* from
 *     the rows and deltas below rather than stored alongside them, so the
 *     header can never disagree with the table it summarizes.
 */

import { EVIDENCE_THRESHOLD } from "./design";

/**
 * What the signal slot renders (§6.2). This is the one region that varies by
 * strategy character, and picking the wrong one lies about the data: an
 * intraday strategy is flat ~80% of days, so a smooth line is never correct.
 */
export type StrategyCharacter = "intraday" | "continuous" | "pairs";

/** §2.5. Reuses gain/flat/loss rather than introducing new colors. */
export type ExecutorState = "open" | "idle" | "halted";

export interface Executor {
  id: string;
  /** Identifier as displayed, e.g. "gap-fade v3 · HOOD" (§7). */
  title: string;
  /** Row subtitle — strategy character in one lowercase clause (§7). */
  note: string;
  state: ExecutorState;
  character: StrategyCharacter;
  /** null renders as an em dash in `flat`, never as zero (§6.7). */
  allocated: number | null;
  deployed: number | null;
  cumulativePnl: number;
  closedTrades: number;
  /**
   * Raw win rate in percent units (58 → "58%"), or null when no source
   * supplied one. Being non-null is not sufficient to display it — a value
   * below the evidence threshold is withheld, not shown. See withhold().
   */
  winRate: number | null;
  /** Most recent mark is carried forward from a previous close (§6.3). */
  carriedMark: boolean;
  /** Label for the hatched placeholder standing in for real series data. */
  signalNote: string;
  tradesNote: string;
}

/** A single daily mark. */
export interface Mark {
  /** ISO date of the mark. */
  date: string;
  /**
   * Epoch milliseconds — the x coordinate. Real time, not array position, so
   * a weekend is genuinely absent from the domain rather than closed up (§6.6).
   */
  t: number;
  /** Cumulative return at this mark, percent. */
  value: number;
  /** Carried forward rather than live (§6.3). Renders as a hollow dot. */
  carried: boolean;
}

/** One row per mark, both series side by side — the shape Recharts consumes. */
export interface ChartRow {
  t: number;
  date: string;
  capitalWeighted: number;
  equalWeighted: number;
  carried: boolean;
}

export interface FleetSeries {
  capitalWeighted: Mark[];
  equalWeighted: Mark[];
  rows: ChartRow[];
  /** Range covered, for the axis domain and the footnote. */
  from: string;
  to: string;
  /**
   * Honest description of what the reader is looking at. Carried as data
   * because it stops being true the moment a real series lands.
   */
  provenance: string;
}

/* ── Evidence quality (§6.1) ──────────────────────────────────────────────── */

/** Figures at or above threshold render in `ink`; below, they recede to `flat`. */
export function isEvidenceStrong(sampleSize: number): boolean {
  return sampleSize >= EVIDENCE_THRESHOLD;
}

/**
 * Derived statistics below the evidence threshold are withheld, not shown.
 * Showing a number with a caveat is worse than not showing it.
 */
export function withhold<T>(value: T | null, sampleSize: number): T | null {
  return isEvidenceStrong(sampleSize) ? value : null;
}

/** Sample-size note shown adjacent to every derived statistic (§7). */
export function sampleNote(sampleSize: number): string {
  return `n=${sampleSize}${isEvidenceStrong(sampleSize) ? "" : " · weak"}`;
}

/** Why a withheld statistic is absent (§7). */
export const WITHHELD_NOTE = `not derived below n=${EVIDENCE_THRESHOLD}`;

/**
 * The note that sits under a derived statistic — either what it was derived
 * from, or why it is missing (§7). Never a number with a caveat attached.
 */
export function derivedNote(sampleSize: number): string {
  return isEvidenceStrong(sampleSize)
    ? `over ${sampleSize} closed`
    : WITHHELD_NOTE;
}

/* ── Fixture ──────────────────────────────────────────────────────────────── */

export const executors: Executor[] = [
  {
    id: "hood",
    title: "gap-fade v3 · HOOD",
    note: "intraday · does not trade every day",
    state: "idle",
    character: "intraday",
    allocated: 2400,
    deployed: null,
    cumulativePnl: 187.42,
    closedTrades: 31,
    winRate: 58,
    carriedMark: false,
    signalNote: "daily marks · ~80% flat days",
    tradesNote: "31 closed trades — most recent 5",
  },
  {
    id: "snow",
    title: "gap-fade v3 · SNOW",
    note: "intraday · 1 mark carried",
    state: "idle",
    character: "intraday",
    allocated: 2400,
    deployed: null,
    cumulativePnl: -43.1,
    closedTrades: 12,
    winRate: null,
    carriedMark: true,
    signalNote: "daily marks · 1 carried mark",
    tradesNote: "12 closed trades — most recent 5",
  },
  {
    id: "nvda",
    title: "mean-reversion v2 · NVDA",
    note: "paper · multi-day holds",
    state: "idle",
    character: "continuous",
    allocated: null,
    deployed: null,
    cumulativePnl: 22.9,
    closedTrades: 6,
    winRate: null,
    carriedMark: false,
    signalNote: "equity curve · continuous",
    tradesNote: "6 closed trades — all shown",
  },
];

/**
 * Daily deltas, percent. The curve shape is illustrative; the endpoints are
 * real — capital-weighted sums to +3.48% and equal-weighted is scaled to the
 * observed +2.60%.
 */
const CAPITAL_WEIGHTED_DELTAS = [
  0, 0.42, 0, 0, -0.18, 0.35, 0, 0, 0.61, -0.22, 0, 0.28,
  0, 0, -0.31, 0.44, 0, 0.19, 0, 0, 0.52, -0.27, 0.9, 0.75,
];

/** Per-day damping that turns the capital-weighted path into the average one. */
const EQUAL_WEIGHTED_DAMPING = [
  1, 0.72, 1, 1, 0.55, 0.81, 1, 1, 0.64, 0.9, 1, 0.77,
  1, 1, 0.6, 0.86, 1, 0.7, 1, 1, 0.75, 0.95, 0.68, 0.8,
];

/** Observed equal-weighted return the damped path is scaled to hit, percent. */
const EQUAL_WEIGHTED_TOTAL = 2.6;

/** Index of the one mark carried forward rather than observed live. */
const CARRIED_MARK_INDEX = 18;

/** First mark. Weekday, so the series starts on a session. */
const SERIES_START = "2026-07-20";

/**
 * `count` consecutive trading days from `start`, skipping weekends.
 *
 * Market holidays are not modelled — a real calendar would drop those too, and
 * the chart needs no change when it does, because the gap comes from the dates
 * themselves rather than from anything the renderer assumes.
 */
function tradingDays(start: string, count: number): string[] {
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);

  while (days.length < count) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function cumulative(deltas: number[]): number[] {
  let running = 0;
  return deltas.map((delta) => (running += delta));
}

function buildSeries(): FleetSeries {
  const cw = cumulative(CAPITAL_WEIGHTED_DELTAS);
  const damped = cumulative(
    CAPITAL_WEIGHTED_DELTAS.map((delta, i) => delta * EQUAL_WEIGHTED_DAMPING[i]),
  );
  const scale = EQUAL_WEIGHTED_TOTAL / damped[damped.length - 1];
  const ew = damped.map((v) => v * scale);

  const dates = tradingDays(SERIES_START, cw.length);

  const toMarks = (values: number[]): Mark[] =>
    values.map((value, i) => ({
      date: dates[i],
      t: Date.parse(dates[i]),
      value,
      carried: i === CARRIED_MARK_INDEX,
    }));

  const rows: ChartRow[] = dates.map((date, i) => ({
    t: Date.parse(date),
    date,
    capitalWeighted: cw[i],
    equalWeighted: ew[i],
    carried: i === CARRIED_MARK_INDEX,
  }));

  return {
    capitalWeighted: toMarks(cw),
    equalWeighted: toMarks(ew),
    rows,
    from: dates[0],
    to: dates[dates.length - 1],
    provenance: `curve shape illustrative · endpoints derived from sample data · ${cw.length} daily marks, gaps preserved`,
  };
}

export const series: FleetSeries = buildSeries();

/* ── Derived platform summary (§5.3, §6.4) ────────────────────────────────── */

export interface CarriedMarks {
  count: number;
  /** Which executors, for the freshness strip readout. */
  titles: string[];
}

export interface FleetSummary {
  /** Renders as an em dash when no timestamp is available (§6.4). */
  asOf: string | null;
  carried: CarriedMarks;
  executorCount: number;
  allocated: number;
  cumulativePnl: number;
  closedTrades: number;
  /** Endpoint of each series, percent. */
  capitalWeightedReturn: number;
  equalWeightedReturn: number;
  /** Invisible when zero, impossible to ignore when not (§6.5). */
  drift: boolean;
  openPositions: number;
}

function endpoint(marks: Mark[]): number {
  return marks.length === 0 ? 0 : marks[marks.length - 1].value;
}

export function summarize(
  rows: Executor[] = executors,
  marks: FleetSeries = series,
): FleetSummary {
  const carried = rows.filter((r) => r.carriedMark);

  return {
    asOf: null,
    carried: { count: carried.length, titles: carried.map((r) => r.title) },
    executorCount: rows.length,
    allocated: rows.reduce((sum, r) => sum + (r.allocated ?? 0), 0),
    cumulativePnl: rows.reduce((sum, r) => sum + r.cumulativePnl, 0),
    closedTrades: rows.reduce((sum, r) => sum + r.closedTrades, 0),
    capitalWeightedReturn: endpoint(marks.capitalWeighted),
    equalWeightedReturn: endpoint(marks.equalWeighted),
    drift: false,
    openPositions: rows.filter((r) => r.state === "open").length,
  };
}

export const summary: FleetSummary = summarize();

/** Rail navigation (§5.1). */
export const NAV_ITEMS = ["Fleet", "Trades", "Architecture", "About"] as const;
export type NavItem = (typeof NAV_ITEMS)[number];
