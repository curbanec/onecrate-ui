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
import type {
  CarriedMarks,
  ChartRow,
  Executor,
  ExecutorState,
  FleetSeries,
  FleetSummary,
  Mark,
  ParameterLine,
  RecentTrade,
  StrategyCharacter,
} from "./fleet";

const RECENT_TRADES = 5;

export interface FleetViewInput {
  current: CurrentState;
  daily: DailyPerformanceRow[];
  platform: PlatformPerformanceRow[];
  closedTrades: TradeRow[];
  drift: DriftRow[];
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

function marksOf(rows: DailyPerformanceRow[]): Mark[] {
  return rows
    .filter((row) => row.cumulativePnl !== null)
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

function buildSeries(platform: PlatformPerformanceRow[]): FleetSeries {
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
        ? "no platform history for this environment"
        : `${platform.length} trading days · daily platform returns compounded · gaps preserved` +
          (incomplete > 0 ? ` · ${incomplete} estimated` : ""),
  };
}

function endpoint(marks: Mark[]): number | null {
  return marks.length === 0 ? null : marks[marks.length - 1]!.value;
}

export function buildFleetView(input: FleetViewInput): FleetView {
  const { current, daily, platform, closedTrades, drift } = input;

  const dailyByExecutor = groupBy(daily, (row) => executorKey(row.triple));
  const closedByExecutor = groupBy(closedTrades, (row) =>
    row.triple === null ? null : executorKey(row.triple),
  );

  const halted = current.halt === "halted";

  const asOf =
    daily.length === 0
      ? null
      : daily.reduce((latest, row) => (row.date > latest ? row.date : latest), daily[0]!.date);

  const executors: Executor[] = current.executors.map((executor) => {
    const key = executor.key;
    const rows = dailyByExecutor.get(key) ?? [];
    const latest = rows.length === 0 ? null : rows[rows.length - 1]!;
    const closed = closedByExecutor.get(key) ?? [];
    const { character, timeframe } = characterOf(executor);
    const marks = marksOf(rows);

    return {
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
        marks.length === 0
          ? "no daily marks yet"
          : `${marks.length} daily marks · ${rows.filter((row) => row.tradesClosed === 0).length} flat`,
      tradesNote:
        closed.length === 0
          ? "no closed trades yet"
          : `${closed.length} closed trades — most recent ${Math.min(RECENT_TRADES, closed.length)}`,
      marks,
      recentTrades: closed.slice(0, RECENT_TRADES).map(toRecentTrade),
      parameters: flattenParameters(executor.parameters),
    };
  });

  const carriedToday = executors.filter(
    (executor) => executor.carriedMark && asOf !== null,
  );
  const carried: CarriedMarks = {
    count: carriedToday.length,
    titles: carriedToday.map((executor) => executor.title),
  };

  const withPnl = executors.filter((executor) => executor.cumulativePnl !== null);

  const reconciled = drift.filter((row) => row.unattributedDelta !== null);
  const latestDrift = reconciled.length === 0 ? null : reconciled[reconciled.length - 1]!;

  const series = buildSeries(platform);

  const summary: FleetSummary = {
    asOf,
    carried,
    executorCount: executors.length,
    allocated: executors.reduce(
      (sum, executor) => sum + (executor.allocated ?? 0),
      0,
    ),
    cumulativePnl:
      withPnl.length === 0
        ? null
        : withPnl.reduce((sum, executor) => sum + (executor.cumulativePnl as number), 0),
    closedTrades: executors.reduce((sum, executor) => sum + executor.closedTrades, 0),
    allTimeClosedTrades: closedTrades.length,
    allTimePnl: closedTrades.reduce<number | null>(
      (sum, trade) => (trade.pnl === null ? sum : (sum ?? 0) + trade.pnl),
      null,
    ),
    capitalWeightedReturn: endpoint(series.capitalWeighted),
    equalWeightedReturn: endpoint(series.equalWeighted),
    drift: latestDrift?.deltaExceedsThreshold === true,
    openPositions: executors.filter((executor) => executor.state === "open").length,
  };

  return { executors, summary, series };
}
