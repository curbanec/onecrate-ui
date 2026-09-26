import {
  executorHref,
  executorKey,
  isCarriedMark,
  type CurrentExecutor,
  type CurrentState,
  type DailyPerformanceRow,
  type DriftRow,
  type PlatformPerformanceRow,
  type TradeRow,
} from "@/lib/data";
import {
  DEFAULT_FLEET_SCOPE,
  type CarriedMarks,
  type ChartRow,
  type Executor,
  type ExecutorState,
  type FleetScope,
  type FleetSeries,
  type FleetSummary,
  type LiveExecutor,
  type Mark,
  type ParameterLine,
  type RecentTrade,
  type RetiredExecutor,
  type StrategyCharacter,
} from "./fleet";

const RECENT_TRADES = 5;

const POPULATION: Record<FleetScope, string> = {
  current: "currently deployed executors",
  si: "every executor that ever reported",
};

export interface FleetViewInput {
  current: CurrentState;
  daily: DailyPerformanceRow[];
  platform: PlatformPerformanceRow[];
  closedTrades: TradeRow[];
  drift: DriftRow[];
  scope?: FleetScope;
}

export interface FleetView {
  executors: Executor[];
  summary: FleetSummary;
  series: FleetSeries;
}

function groupBy<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (k === null) continue;
    const existing = out.get(k);
    if (existing) existing.push(row);
    else out.set(k, [row]);
  }
  return out;
}

function characterOf(executor: CurrentExecutor): {
  character: StrategyCharacter;
  timeframe: string | null;
} {
  const timeframe = readTimeframe(executor.execution);

  if (timeframe === null) return { character: "continuous", timeframe: null };

  return {
    character: /min|hour/i.test(timeframe) ? "intraday" : "continuous",
    timeframe,
  };
}

export function readTimeframe(execution: Record<string, unknown>): string | null {
  const requirements = execution.dataRequirements;
  if (requirements === null || typeof requirements !== "object") return null;

  const timeframe = (requirements as Record<string, unknown>).timeframe;
  return typeof timeframe === "string" && timeframe !== "" ? timeframe : null;
}

export function flattenParameters(
  parameters: Record<string, unknown> | null,
): ParameterLine[] {
  if (parameters === null) return [];

  const lines: ParameterLine[] = [];

  const push = (label: string, value: unknown) => {
    if (value === null || value === undefined) {
      lines.push({ label, value: "—" });
      return;
    }
    if (typeof value === "object") return;
    lines.push({ label, value: String(value) });
  };

  for (const [group, body] of Object.entries(parameters)) {
    if (body !== null && typeof body === "object" && !Array.isArray(body)) {
      for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
        push(key, value);
      }
    } else {
      push(group, body);
    }
  }

  return lines;
}

function toRecentTrade(trade: TradeRow): RecentTrade {
  return {
    id: trade.tradeId,
    symbol: trade.symbol,
    side: trade.side,
    exitDate: trade.exitDate,
    pnl: trade.pnl,
  };
}

export function winRateOf(trades: TradeRow[]): number | null {
  const settled = trades.filter((trade) => trade.pnl !== null);
  if (settled.length === 0) return null;

  const wins = settled.filter((trade) => (trade.pnl as number) > 0).length;
  return (wins / settled.length) * 100;
}

function isMarked(row: DailyPerformanceRow): boolean {
  return row.cumulativePnl !== null;
}

function marksOf(rows: DailyPerformanceRow[]): Mark[] {
  return rows
    .filter(isMarked)
    .map((row) => ({
      date: row.date,
      t: Date.parse(`${row.date}T00:00:00.000Z`),
      value: row.cumulativePnl as number,
      carried: isCarriedMark(row.markSource),
    }));
}

function stateOf(executor: CurrentExecutor, halted: boolean): ExecutorState {
  if (halted) return "halted";
  return executor.openTrades.length > 0 ? "open" : "idle";
}

function tradesNoteOf(closed: number): string {
  return closed === 0
    ? "no closed trades yet"
    : `${closed} closed trades — most recent ${Math.min(RECENT_TRADES, closed)}`;
}

function compound(rows: PlatformPerformanceRow[], pick: (row: PlatformPerformanceRow) => number | null): Mark[] {
  let factor = 1;

  return rows.map((row) => {
    const daily = pick(row);
    if (daily !== null) factor *= 1 + daily;

    return {
      date: row.date,
      t: Date.parse(`${row.date}T00:00:00.000Z`),
      value: (factor - 1) * 100,
      carried: false,
    };
  });
}

function buildSeries(
  platform: PlatformPerformanceRow[],
  population: string,
): FleetSeries {
  const capitalWeighted = compound(platform, (row) => row.capitalWeightedReturn);
  const equalWeighted = compound(platform, (row) => row.equalWeightedReturn);

  const rows: ChartRow[] = platform.map((row, i) => ({
    t: capitalWeighted[i]!.t,
    date: row.date,
    capitalWeighted: capitalWeighted[i]!.value,
    equalWeighted: equalWeighted[i]!.value,
    carried: false,
  }));

  const incomplete = platform.filter((row) => row.isComplete === false).length;

  return {
    capitalWeighted,
    equalWeighted,
    rows,
    from: platform[0]?.date ?? "",
    to: platform[platform.length - 1]?.date ?? "",
    provenance:
      platform.length === 0
        ? `no platform history · ${population}`
        : `${population} · from ${platform[0]!.date} · ${platform.length} trading days · daily platform returns compounded · gaps preserved` +
          (incomplete > 0 ? ` · ${incomplete} estimated` : ""),
  };
}

function endpoint(marks: Mark[]): number | null {
  return marks.length === 0 ? null : marks[marks.length - 1]!.value;
}

function retiredOf(
  daily: DailyPerformanceRow[],
  liveKeys: Set<string>,
  closedByExecutor: Map<string, TradeRow[]>,
): RetiredExecutor[] {
  const byExecutor = groupBy(daily, (row) => {
    const key = executorKey(row.triple);
    return liveKeys.has(key) ? null : key;
  });

  const out: RetiredExecutor[] = [];

  for (const [key, rows] of byExecutor) {
    const last = rows[rows.length - 1]!;
    const closed = closedByExecutor.get(key) ?? [];

    out.push({
      kind: "retired",
      id: key,
      title: `${last.triple.strategyName} ${last.triple.strategyVersion}`,
      href: executorHref(last.triple),
      allocated: last.allocatedCapital,
      deployed: last.deployedCapital,
      cumulativePnl: last.cumulativePnl,
      closedTrades: closed.length,
      winRate: winRateOf(closed),
      activeFrom: rows[0]!.date,
      activeTo: last.date,
      tradesNote: tradesNoteOf(closed.length),
      recentTrades: closed.slice(0, RECENT_TRADES).map(toRecentTrade),
    });
  }

  return out;
}

export function buildFleetView(input: FleetViewInput): FleetView {
  const { current, daily, platform, closedTrades, drift } = input;
  const scope = input.scope ?? DEFAULT_FLEET_SCOPE;

  const dailyByExecutor = groupBy(daily, (row) => executorKey(row.triple));
  const closedByExecutor = groupBy(closedTrades, (row) =>
    row.triple === null ? null : executorKey(row.triple),
  );

  const halted = current.halt === "halted";
  const liveKeys = new Set(current.executors.map((executor) => executor.key));

  const liveDaily = daily.filter((row) => liveKeys.has(executorKey(row.triple)));
  const dataThrough =
    liveDaily.length === 0
      ? null
      : liveDaily.reduce(
          (latest, row) => (row.date > latest ? row.date : latest),
          liveDaily[0]!.date,
        );

  const live: LiveExecutor[] = current.executors.map((executor) => {
    const key = executor.key;
    const rows = dailyByExecutor.get(key) ?? [];
    const latest = rows.length === 0 ? null : rows[rows.length - 1]!;
    const closed = closedByExecutor.get(key) ?? [];
    const { character, timeframe } = characterOf(executor);
    const marks = marksOf(rows);
    const deployedDays = rows.length;
    const tradedDays = rows.filter(
      (row) => row.tradesOpened > 0 || row.tradesClosed > 0,
    ).length;
    const heldDays = rows.filter((row) => row.openPositions > 0).length;

    return {
      kind: "live",
      id: key,
      title: `${executor.triple.strategyName} ${executor.triple.strategyVersion} · ${executor.symbols.join(" / ")}`,
      note: timeframe === null ? character : `${character} · ${timeframe} bars`,
      href: executorHref(executor.triple),
      state: stateOf(executor, halted),
      character,
      allocated: executor.allocatedCapital,
      deployed: executor.deployedCapital,
      cumulativePnl: latest?.cumulativePnl ?? null,
      closedTrades: closed.length,
      winRate: winRateOf(closed),
      carriedMark: latest === null ? false : isCarriedMark(latest.markSource),
      signalNote:
        deployedDays === 0
          ? "no daily history yet"
          : [
              `${deployedDays} ${deployedDays === 1 ? "day" : "days"} deployed`,
              `${tradedDays} traded`,
              ...(character === "intraday" ? [] : [`${heldDays} held`]),
            ].join(" · "),
      tradesNote: tradesNoteOf(closed.length),
      marks,
      recentTrades: closed.slice(0, RECENT_TRADES).map(toRecentTrade),
      parameters: flattenParameters(executor.parameters),
    };
  });

  const retired = retiredOf(daily, liveKeys, closedByExecutor);
  const executors: Executor[] = scope === "si" ? [...live, ...retired] : [...live];

  const carriedToday = live.filter(
    (executor) => executor.carriedMark && dataThrough !== null,
  );
  const carried: CarriedMarks = {
    count: carriedToday.length,
    titles: carriedToday.map((executor) => executor.title),
  };

  const withPnl = live.filter((executor) => executor.cumulativePnl !== null);

  const reconciled = drift.filter((row) => row.unattributedDelta !== null);
  const latestDrift = reconciled.length === 0 ? null : reconciled[reconciled.length - 1]!;

  const series = buildSeries(platform, POPULATION[scope]);

  const allTimeClosedTrades = closedTrades.length;
  const allTimePnl = closedTrades.reduce<number | null>(
    (sum, trade) => (trade.pnl === null ? sum : (sum ?? 0) + trade.pnl),
    null,
  );

  const liveClosedTrades = live.reduce(
    (sum, executor) => sum + executor.closedTrades,
    0,
  );
  const liveCumulativePnl =
    withPnl.length === 0
      ? null
      : withPnl.reduce((sum, executor) => sum + (executor.cumulativePnl as number), 0);

  const base = {
    dataThrough,
    reconciledAsOf: latestDrift?.date ?? null,
    carried,
    executorCount: scope === "si" ? live.length + retired.length : live.length,
    retiredCount: retired.length,
    cumulativePnl: scope === "si" ? allTimePnl : liveCumulativePnl,
    closedTrades: scope === "si" ? allTimeClosedTrades : liveClosedTrades,
    allTimeClosedTrades,
    allTimePnl,
    capitalWeightedReturn: endpoint(series.capitalWeighted),
    equalWeightedReturn: endpoint(series.equalWeighted),
    drift: latestDrift?.deltaExceedsThreshold === true,
    openPositions: live.filter((executor) => executor.state === "open").length,
  };

  const summary: FleetSummary =
    scope === "current"
      ? {
          ...base,
          scope: "current",
          allocated: live.reduce(
            (sum, executor) => sum + (executor.allocated ?? 0),
            0,
          ),
        }
      : { ...base, scope: "si" };

  return { executors, summary, series };
}
