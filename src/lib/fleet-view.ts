/**
 * Data layer → Fleet component props.
 *
 * The prop boundary. Everything above this line speaks the database's language
 * (snake_case rows, fractions, nullable columns); everything below speaks the
 * components' (camelCase, percent units, em dashes). Keeping the translation in
 * one pure function means it can be tested without a database or a renderer,
 * and that the components never learn what a view is.
 *
 * Pure — no I/O, no `server-only`. See the note in `lib/data/normalize.ts`.
 */

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

/** Closed trades listed in the expanded card. */
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

/* ── Per-executor helpers ─────────────────────────────────────────────────── */

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

/**
 * Strategy character, from the manifest's own bar timeframe.
 *
 * Intraday bars mean the strategy opens and closes within a session, which is
 * what decides whether the signal slot may draw a continuous line (§6.2). Read
 * from deployed configuration rather than guessed from the identifier.
 */
function characterOf(executor: CurrentExecutor): {
  character: StrategyCharacter;
  timeframe: string | null;
} {
  const timeframe = readTimeframe(executor.execution);

  // With no declared timeframe there is nothing to infer from, so the cautious
  // reading wins: 'continuous' makes no claim about days without trades.
  if (timeframe === null) return { character: "continuous", timeframe: null };

  return {
    character: /min|hour/i.test(timeframe) ? "intraday" : "continuous",
    timeframe,
  };
}

/**
 * `execution.dataRequirements.timeframe` from the manifest, when present.
 * Not every deployed config carries it, so absence is expected rather than an
 * error.
 */
export function readTimeframe(execution: Record<string, unknown>): string | null {
  const requirements = execution.dataRequirements;
  if (requirements === null || typeof requirements !== "object") return null;

  const timeframe = (requirements as Record<string, unknown>).timeframe;
  return typeof timeframe === "string" && timeframe !== "" ? timeframe : null;
}

/** Flatten the manifest's nested parameter groups into display lines. */
export function flattenParameters(
  parameters: Record<string, unknown> | null,
): ParameterLine[] {
  if (parameters === null) return [];

  const lines: ParameterLine[] = [];

  const push = (label: string, value: unknown) => {
    if (value === null || value === undefined) {
      // A null parameter is a real setting — "no take-profit" — so it is shown
      // as an em dash rather than dropped.
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

/**
 * Win rate over closed trades, in percent units.
 *
 * Computed here because no view provides it — unlike daily_pnl or slippage,
 * which are read rather than recomputed. Trades with a null P&L are excluded
 * from both numerator and denominator: an unknown outcome is not a loss.
 *
 * Whether it is ever *displayed* is a separate question, answered by
 * withhold() against the evidence threshold.
 */
export function winRateOf(trades: TradeRow[]): number | null {
  const settled = trades.filter((trade) => trade.pnl !== null);
  if (settled.length === 0) return null;

  const wins = settled.filter((trade) => (trade.pnl as number) > 0).length;
  return (wins / settled.length) * 100;
}

/** Marks for one executor's signal slot, oldest first. */
function marksOf(rows: DailyPerformanceRow[]): Mark[] {
  return rows
    .filter((row) => row.cumulativePnl !== null)
    .map((row) => ({
      date: row.date,
      t: Date.parse(`${row.date}T00:00:00.000Z`),
      // The card's marks are cumulative P&L in dollars, not percent — the slot
      // shows shape, and the P&L column beside it carries the number.
      value: row.cumulativePnl as number,
      carried: isCarriedMark(row.markSource),
    }));
}

function stateOf(executor: CurrentExecutor, halted: boolean): ExecutorState {
  if (halted) return "halted";
  return executor.openTrades.length > 0 ? "open" : "idle";
}

/* ── Platform series ──────────────────────────────────────────────────────── */

/**
 * Compound a run of daily returns into a cumulative curve, in percent.
 *
 * The chart's axis is "cumulative return", but `getPlatformPerformance` returns
 * a per-DAY figure, and no view carries a platform-level cumulative return. So
 * the chaining happens here: (1+r₁)(1+r₂)… − 1, which is how returns actually
 * compose. Days the aggregate could not answer (null) contribute nothing rather
 * than being treated as 0% — a day with no allocation is not a flat day.
 *
 * This is the one figure on the page computed from more than one row, and it is
 * flagged in the Stage 4 report as a judgement call.
 */
function compound(rows: PlatformPerformanceRow[], pick: (row: PlatformPerformanceRow) => number | null): Mark[] {
  let factor = 1;

  return rows.map((row) => {
    const daily = pick(row);
    if (daily !== null) factor *= 1 + daily;

    return {
      date: row.date,
      t: Date.parse(`${row.date}T00:00:00.000Z`),
      value: (factor - 1) * 100,
      // The platform aggregate has no mark_source; carried marks are a
      // per-executor fact and are reported in the freshness strip instead.
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

/* ── The mapping ──────────────────────────────────────────────────────────── */

export function buildFleetView(input: FleetViewInput): FleetView {
  const { current, daily, platform, closedTrades, drift } = input;

  const dailyByExecutor = groupBy(daily, (row) => executorKey(row.triple));
  const closedByExecutor = groupBy(closedTrades, (row) =>
    row.triple === null ? null : executorKey(row.triple),
  );

  const halted = current.halt === "halted";

  // Latest snapshot date across the whole environment, for the freshness strip
  // and for deciding which rows count as "the latest day".
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
      // A real zero: no open position is a fact the data supports.
      deployed: executor.deployedCapital,
      // Null, not zero, until this executor has a snapshot row.
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

  // Carried marks on the LATEST day only — the freshness strip answers "is what
  // I am looking at right now live", not "has anything ever been carried".
  const carriedToday = executors.filter(
    (executor) => executor.carriedMark && asOf !== null,
  );
  const carried: CarriedMarks = {
    count: carriedToday.length,
    titles: carriedToday.map((executor) => executor.title),
  };

  const withPnl = executors.filter((executor) => executor.cumulativePnl !== null);

  // The newest row is always TODAY, and today can never be reconciled: its 16:00
  // close is only knowable as tomorrow's last_equity. Reading the newest row
  // outright would leave this permanently null and hide a real discrepancy on the
  // last settled day. Take the newest row that actually reconciled instead.
  const reconciled = drift.filter((row) => row.unattributedDelta !== null);
  const latestDrift = reconciled.length === 0 ? null : reconciled[reconciled.length - 1]!;
  const delta = latestDrift?.unattributedDelta ?? null;

  const series = buildSeries(platform);

  const summary: FleetSummary = {
    asOf,
    carried,
    executorCount: executors.length,
    allocated: executors.reduce(
      (sum, executor) => sum + (executor.allocated ?? 0),
      0,
    ),
    // Null rather than 0 when nothing has reported — summing an empty set to
    // zero would claim the book is flat.
    cumulativePnl:
      withPnl.length === 0
        ? null
        : withPnl.reduce((sum, executor) => sum + (executor.cumulativePnl as number), 0),
    closedTrades: executors.reduce((sum, executor) => sum + executor.closedTrades, 0),
    capitalWeightedReturn: endpoint(series.capitalWeighted),
    equalWeightedReturn: endpoint(series.equalWeighted),
    /**
     * Non-null AND non-zero. Nothing else.
     *
     * Null means nobody reconciled that day; zero means the books agree. Only
     * the third case is drift, and ANY amount of it is worth surfacing — the
     * platform's own $1.00 alarm threshold is tuned for paging someone at
     * night, which is a different question from whether an operator reading
     * the page should be told the books disagree.
     */
    drift: delta !== null && delta !== 0,
    openPositions: executors.filter((executor) => executor.state === "open").length,
  };

  return { executors, summary, series };
}
