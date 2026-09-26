import { EVIDENCE_THRESHOLD } from "./design";

export type StrategyCharacter = "intraday" | "continuous" | "pairs";

export type ExecutorState = "open" | "idle" | "halted";

export type FleetScope = "si" | "current";

export const FLEET_SCOPES: readonly FleetScope[] = ["current", "si"] as const;

export const DEFAULT_FLEET_SCOPE: FleetScope = "current";

export const FLEET_SCOPE_LABELS: Record<FleetScope, string> = {
  current: "Current",
  si: "ITD",
};

export const FLEET_SCOPE_TITLES: Record<FleetScope, string> = {
  current: "Executors in the deployment manifest right now",
  si: "Inception to date — every executor that ever reported",
};

export function isFleetScope(value: unknown): value is FleetScope {
  return value === "si" || value === "current";
}

export function parseFleetScope(
  value: unknown,
  fallback: FleetScope = DEFAULT_FLEET_SCOPE,
): FleetScope {
  return isFleetScope(value) ? value : fallback;
}

export interface FleetParams {
  env?: string;
  scope?: string;
}

export function fleetHref(basePath: string, params: FleetParams = {}): string {
  const query = new URLSearchParams();
  if (params.env !== undefined) query.set("env", params.env);
  if (params.scope !== undefined) query.set("scope", params.scope);

  const search = query.toString();
  return search === "" ? basePath : `${basePath}?${search}`;
}

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

export interface ExecutorBase {
  id: string;
  title: string;
  href: string;
  allocated: number | null;
  deployed: number | null;
  cumulativePnl: number | null;
  closedTrades: number;
  winRate: number | null;
  tradesNote: string;
  recentTrades: RecentTrade[];
}

export interface LiveExecutor extends ExecutorBase {
  kind: "live";
  note: string;
  state: ExecutorState;
  character: StrategyCharacter;
  carriedMark: boolean;
  signalNote: string;
  marks: Mark[];
  parameters: ParameterLine[];
}

export interface RetiredExecutor extends ExecutorBase {
  kind: "retired";
  activeFrom: string;
  activeTo: string;
}

export type Executor = LiveExecutor | RetiredExecutor;

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

export function derivedNote(sampleSize: number): string {
  return `${sampleSize} closed`;
}

export interface CarriedMarks {
  count: number;
  titles: string[];
}

interface FleetSummaryBase {
  dataThrough: string | null;
  reconciledAsOf: string | null;
  carried: CarriedMarks;
  executorCount: number;
  retiredCount: number;
  cumulativePnl: number | null;
  closedTrades: number;
  allTimeClosedTrades: number;
  allTimePnl: number | null;
  capitalWeightedReturn: number | null;
  equalWeightedReturn: number | null;
  drift: boolean;
  openPositions: number;
}

export type FleetSummary =
  | (FleetSummaryBase & { scope: "current"; allocated: number })
  | (FleetSummaryBase & { scope: "si" });

export const NAV_ITEMS = ["Fleet", "Trades", "Architecture", "About"] as const;
export type NavItem = (typeof NAV_ITEMS)[number];

export function navHref(item: NavItem): string {
  return `/${item.toLowerCase()}`;
}
