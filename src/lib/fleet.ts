/**
 * Fleet view model — the prop shapes the Fleet components consume.
 *
 * This file used to carry a fixture as well. The fixture is gone: the page now
 * renders live platform data, and leaving plausible-looking fake figures next to
 * real ones in the same module is exactly how a mock gets rendered as fact.
 * `lib/fleet-view.ts` builds these shapes from the data layer.
 *
 * Two fields widened from the fixture's types, because real data has absences
 * the fixture never did — see the Stage 4 report:
 *
 *   - Executor.cumulativePnl      null until an executor has a snapshot row
 *   - FleetSummary returns        null when the platform aggregate has no answer
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

/** One flattened parameter line for the expanded card. */
export interface ParameterLine {
  label: string;
  value: string;
}

/** A closed trade, reduced to what the expanded card shows. */
export interface RecentTrade {
  id: string;
  symbol: string | null;
  side: string | null;
  /** ISO timestamp, or null while still open. */
  exitDate: string | null;
  pnl: number | null;
}

export interface Executor {
  id: string;
  /** Identifier as displayed, e.g. "gap-fade v3 · HOOD" (§7). */
  title: string;
  /** Row subtitle — strategy character in one lowercase clause (§7). */
  note: string;
  /** Detail route. Built by executorHref() so the URL shape lives in one place. */
  href: string;
  state: ExecutorState;
  character: StrategyCharacter;
  /** null renders as an em dash in `flat`, never as zero (§6.7). */
  allocated: number | null;
  deployed: number | null;
  /**
   * Since inception, from the executor's latest snapshot row. Null when it has
   * no snapshot rows yet — a newly deployed executor has no P&L, which is not
   * the same as zero P&L.
   */
  cumulativePnl: number | null;
  /** Closed trades over the executor's whole history. A real count; 0 is honest. */
  closedTrades: number;
  /**
   * Raw win rate in percent units (58 → "58%"), or null when no source
   * supplied one. Being non-null is not sufficient to display it — a value
   * below the evidence threshold is withheld, not shown. See withhold().
   */
  winRate: number | null;
  /** Most recent mark is carried forward from a previous close (§6.3). */
  carriedMark: boolean;
  /** Label describing the signal series, shown when there is nothing to plot. */
  signalNote: string;
  tradesNote: string;
  /** Daily marks for the signal slot. Empty when the executor has no history. */
  marks: Mark[];
  /** Most recent closed trades, newest first. */
  recentTrades: RecentTrade[];
  /** Deployed parameter set, flattened. Empty when the manifest carried none. */
  parameters: ParameterLine[];
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
   * because it stops being true the moment the underlying series changes.
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

/* ── Platform summary (§5.3, §6.4) ────────────────────────────────────────── */

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
  /** Null when no executor has a snapshot row yet. */
  cumulativePnl: number | null;
  closedTrades: number;
  /** Endpoint of each series, percent. Null when the aggregate has no answer. */
  capitalWeightedReturn: number | null;
  equalWeightedReturn: number | null;
  /** Invisible when zero, impossible to ignore when not (§6.5). */
  drift: boolean;
  openPositions: number;
}

/** Rail navigation (§5.1). */
export const NAV_ITEMS = ["Fleet", "Trades", "Architecture", "About"] as const;
export type NavItem = (typeof NAV_ITEMS)[number];

/**
 * Route for a nav item.
 *
 * One mapping, because two things now depend on it: the rail's own links and
 * the environment toggle, which rewrites the *current* route's query string.
 * A second copy would let the toggle send you somewhere the nav doesn't.
 *
 * Note Fleet maps to `/fleet`, not `/`. It previously mapped to `/`, which is
 * the splash page — so the rail's Fleet link led away from the app. Harmless
 * while nothing depended on it; wrong the moment the toggle builds a URL from it.
 */
export function navHref(item: NavItem): string {
  return `/${item.toLowerCase()}`;
}
