import { EVIDENCE_THRESHOLD } from "./design";

export type StrategyCharacter = "intraday" | "continuous" | "pairs";

export type ExecutorState = "open" | "idle" | "halted";

export interface ParameterLine {
  label: string;
  value: string;
}

export interface RecentTrade {
  id: string;
  symbol: string | null;
  side: string | null;
  exitDate: string | null;
  pnl: number | null;
}

export interface Executor {
  id: string;
  title: string;
  note: string;
  href: string;
  state: ExecutorState;
  character: StrategyCharacter;
  allocated: number | null;
  deployed: number | null;
  cumulativePnl: number | null;
  closedTrades: number;
  winRate: number | null;
  carriedMark: boolean;
  signalNote: string;
  tradesNote: string;
  marks: Mark[];
  recentTrades: RecentTrade[];
  parameters: ParameterLine[];
}

export interface Mark {
  date: string;
  t: number;
  value: number;
  carried: boolean;
}

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
  from: string;
  to: string;
  provenance: string;
}

export function isEvidenceStrong(sampleSize: number): boolean {
  return sampleSize >= EVIDENCE_THRESHOLD;
}

export function withhold<T>(value: T | null, sampleSize: number): T | null {
  return isEvidenceStrong(sampleSize) ? value : null;
}

export function sampleNote(sampleSize: number): string {
  return `n=${sampleSize}${isEvidenceStrong(sampleSize) ? "" : " · weak"}`;
}

export const WITHHELD_NOTE = `not derived below n=${EVIDENCE_THRESHOLD}`;

export function derivedNote(sampleSize: number): string {
  return isEvidenceStrong(sampleSize)
    ? `over ${sampleSize} closed`
    : WITHHELD_NOTE;
}

export interface CarriedMarks {
  count: number;
  titles: string[];
}

export interface FleetSummary {
  asOf: string | null;
  carried: CarriedMarks;
  executorCount: number;
  allocated: number;
  cumulativePnl: number | null;
  closedTrades: number;
  allTimeClosedTrades: number;
  allTimePnl: number | null;
  capitalWeightedReturn: number | null;
  equalWeightedReturn: number | null;
  drift: boolean;
  openPositions: number;
}

export const NAV_ITEMS = ["Fleet", "Trades", "Architecture", "About"] as const;
export type NavItem = (typeof NAV_ITEMS)[number];

export function navHref(item: NavItem): string {
  return `/${item.toLowerCase()}`;
}
