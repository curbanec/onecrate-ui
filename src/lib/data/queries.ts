import "server-only";

import { sql } from "kysely";

import {
  assertDateRange,
  assertTriples,
  dayAfter,
  dayStart,
  toDailyPerformanceRow,
  toDriftRow,
  toPlatformPerformanceRow,
  toTradeRow,
  type DailyPerformanceRow,
  type DateRange,
  type DriftRow,
  type PlatformPerformanceRaw,
  type PlatformPerformanceRow,
  type TradeRow,
  type TradeStatus,
} from "./dto";
import { toTradingEnv, type DeploymentEnv } from "./environment";
import type { ExecutorTriple } from "./executor";
import { requireSession } from "./session";
import { getTradingDb } from "./trading-db";

/**
 * Query functions against the trading database.
 *
 * Every function here:
 *
 *   - calls `requireSession()` FIRST. Not because the page is untrusted, but
 *     because each function is its own entry point; a page-level check protects
 *     the page, not the function.
 *   - takes `environment` in the UI's vocabulary ('prod' | 'dev') and maps it
 *     to the SQL vocabulary ('live' | 'paper') internally. Callers never see
 *     the SQL vocabulary, so the two cannot be confused at a call site.
 *   - parameterizes every value. Kysely binds these; no SQL is built by
 *     concatenation.
 *   - returns normalized rows, with nulls intact.
 *   - returns `[]` for "nothing matched". An empty environment is a fact, not
 *     an error — and with an empty dev manifest it is the expected result for
 *     DEV today.
 *
 * ORDER BY lives here rather than in the views, because a view cannot carry a
 * guaranteed order.
 *
 * On tenancy: `requireSession()` returns `orgId`, and AUTH.md §5 asks every
 * query to be scoped by it. These tables carry no org column — they are written
 * by a separate platform that has no concept of tenants — so the filter cannot
 * be applied here yet. Recorded rather than silently skipped: partitioning this
 * data is a platform-side change, not a query-layer one.
 *
 * This app is read-only. Nothing below writes.
 */

/* ── Executor daily performance ───────────────────────────────────────────── */

export interface DailyPerformanceOptions extends DateRange {
  /** Restrict to a single executor. Omit for all of them. */
  triple?: ExecutorTriple;
}

/**
 * One row per executor, per day.
 *
 * `cumulative_pnl` is computed by the view across the executor's entire
 * history, so narrowing `from`/`to` narrows which rows come back WITHOUT
 * rebasing the running total. That is the intended behaviour, and it is
 * verified against live data rather than assumed.
 */
export async function getDailyPerformance(
  environment: DeploymentEnv,
  options: DailyPerformanceOptions = {},
): Promise<DailyPerformanceRow[]> {
  await requireSession();
  assertDateRange(options);

  let query = getTradingDb()
    .selectFrom("v_executor_daily_performance")
    .selectAll()
    .where("environment", "=", toTradingEnv(environment));

  // snapshot_date is a DATE column — no time component, so an inclusive upper
  // bound is correct here (unlike entry_date in getTrades).
  if (options.from !== undefined) {
    query = query.where("snapshot_date", ">=", dayStart(options.from));
  }
  if (options.to !== undefined) {
    query = query.where("snapshot_date", "<=", dayStart(options.to));
  }

  if (options.triple) {
    query = query
      .where("strategy_name", "=", options.triple.strategyName)
      .where("strategy_version", "=", options.triple.strategyVersion)
      .where("instance_id", "=", options.triple.instanceId);
  }

  const rows = await query
    .orderBy("strategy_name")
    .orderBy("strategy_version")
    .orderBy("instance_id")
    .orderBy("snapshot_date")
    .execute();

  return rows.map(toDailyPerformanceRow);
}

/* ── Platform aggregate ───────────────────────────────────────────────────── */

export interface PlatformPerformanceOptions extends DateRange {
  /**
   * Restrict the aggregate to this SET of executors. Omit for every executor
   * that ever reported in the environment.
   */
  triples?: ExecutorTriple[];
}

/**
 * One row per day, aggregated across the executors in scope.
 *
 * There is still no `triple` parameter, and the reasoning that ruled one out
 * has not changed: a "platform total" filtered to ONE executor is not a platform
 * total, it is that executor's own series, and `getDailyPerformance` already
 * returns exactly that. Keeping the singular form unrepresentable is what stops
 * a caller reaching for this function to answer a per-executor question.
 *
 * A SET is a different thing, and is permitted. Every row still aggregates
 * across a population, so each figure remains a platform total — of the
 * population named. That is what the Fleet page's Current scope needs: this same
 * GROUP BY restricted to the triples in the deployment manifest, so the curve
 * and the figures beside it describe one population instead of two.
 *
 * Numerator and denominator are filtered TOGETHER. `SUM(daily_pnl)` and
 * `SUM(allocated_capital)` both see only the scoped rows, so capital-weighted
 * return keeps meaning dollars earned over dollars allocated in either scope.
 * Conditional aggregation over the numerator alone would divide one population's
 * P&L by another's capital, which is not a return of anything.
 *
 * The filter is an OR of ANDs rather than a tuple `IN`: T-SQL has no row
 * constructor, and identity here is three columns. At a fleet of 3–8 that is the
 * right shape.
 *
 * An empty array is NOT an omitted key — see `assertTriples`.
 *
 * This is the one place a figure is computed rather than read from a view, and
 * it is a GROUP BY in SQL — not arithmetic in TypeScript.
 */
export async function getPlatformPerformance(
  environment: DeploymentEnv,
  options: PlatformPerformanceOptions = {},
): Promise<PlatformPerformanceRow[]> {
  await requireSession();
  assertDateRange(options);
  assertTriples(options.triples);

  let query = getTradingDb()
    .selectFrom("v_executor_daily_performance")
    .select(({ fn }) => [
      "snapshot_date",
      // NULLIF keeps a zero-allocation day as "no answer" rather than a
      // divide-by-zero or a fabricated 0%.
      //
      // The COUNT(*) = COUNT(col) guard is what stops a PARTIAL platform total.
      // daily_pnl is null for any executor whose previous trading day is missing,
      // and SUM silently skips nulls — which would report a platform figure that
      // quietly excludes one executor. A day nobody can total is no answer.
      sql<number | null>`CASE WHEN COUNT(*) = COUNT(daily_pnl)
            THEN SUM(daily_pnl) END / NULLIF(SUM(allocated_capital), 0)`.as(
        "capital_weighted_return",
      ),
      sql<number | null>`CASE WHEN COUNT(*) = COUNT(daily_return)
            THEN AVG(daily_return) END`.as("equal_weighted_return"),
      fn.countAll<number>().as("executor_count"),
      // MIN over 0/1: the platform day is complete only if every executor's is.
      sql<number | null>`MIN(CAST(is_complete AS int))`.as("is_complete"),
    ])
    .where("environment", "=", toTradingEnv(environment));

  if (options.from !== undefined) {
    query = query.where("snapshot_date", ">=", dayStart(options.from));
  }
  if (options.to !== undefined) {
    query = query.where("snapshot_date", "<=", dayStart(options.to));
  }

  const triples = options.triples;
  if (triples !== undefined) {
    query = query.where((eb) =>
      eb.or(
        triples.map((triple) =>
          eb.and([
            eb("strategy_name", "=", triple.strategyName),
            eb("strategy_version", "=", triple.strategyVersion),
            eb("instance_id", "=", triple.instanceId),
          ]),
        ),
      ),
    );
  }

  const rows = await query
    .groupBy("snapshot_date")
    .orderBy("snapshot_date")
    .execute();

  return (rows as PlatformPerformanceRaw[]).map(toPlatformPerformanceRow);
}

/* ── Trades ───────────────────────────────────────────────────────────────── */

export interface TradeOptions extends DateRange {
  triple?: ExecutorTriple;
  symbol?: string;
  status?: TradeStatus;
}

/**
 * Columns selected from the trade view.
 *
 * Listed explicitly rather than `selectAll()` so that `entry_context` and
 * `exit_context` are excluded: both are `nvarchar(max)` JSON blobs that nothing
 * in this app reads, and pulling them would move a large amount of data per
 * row for no benefit.
 */
const TRADE_COLUMNS = [
  "trade_id",
  "strategy_name",
  "strategy_version",
  "instance_id",
  "symbol",
  "side",
  "environment",
  "is_backtest",
  "backtest_id",
  "status",
  "entry_date",
  "entry_price",
  "quantity",
  "cost_basis",
  "decision_price",
  "decision_time",
  "order_submitted_time",
  "allocated_capital_at_entry",
  "target_position_value",
  "intended_quantity",
  "exit_date",
  "exit_price",
  "exit_reason",
  "exit_decision_price",
  "exit_decision_time",
  "exit_order_submitted_time",
  "pnl",
  "pnl_percent",
  "holding_period_ms",
  "entry_order_id",
  "exit_order_id",
  "entry_correlation_id",
  "exit_correlation_id",
  "created_at",
  "updated_at",
  "entry_slippage_bps",
  "exit_slippage_bps",
  "round_trip_slippage_bps",
  "has_both_decision_prices",
  "entry_eval_latency_ms",
  "entry_broker_latency_ms",
  "entry_total_latency_ms",
  "exit_eval_latency_ms",
  "exit_broker_latency_ms",
  "exit_total_latency_ms",
  "deployment_ratio",
  "quantity_deviation",
  "normalized_return",
] as const;

/**
 * One row per trade.
 *
 * Always excludes backtests. `is_backtest = 0` is not optional and is not a
 * parameter: a backtested trade mixed into live execution quality would
 * silently inflate the evidence behind every derived statistic.
 */
export async function getTrades(
  environment: DeploymentEnv,
  options: TradeOptions = {},
): Promise<TradeRow[]> {
  await requireSession();
  assertDateRange(options);

  let query = getTradingDb()
    .selectFrom("v_trade_execution_quality")
    .select(TRADE_COLUMNS)
    .where("environment", "=", toTradingEnv(environment))
    .where("is_backtest", "=", false);

  // entry_date is DATETIME2. An inclusive `<= to` resolves to midnight and
  // would drop every trade entered later on the final day, so the upper bound
  // is the start of the NEXT day, exclusive.
  if (options.from !== undefined) {
    query = query.where("entry_date", ">=", dayStart(options.from));
  }
  if (options.to !== undefined) {
    query = query.where("entry_date", "<", dayAfter(options.to));
  }

  if (options.triple) {
    query = query
      .where("strategy_name", "=", options.triple.strategyName)
      .where("strategy_version", "=", options.triple.strategyVersion)
      .where("instance_id", "=", options.triple.instanceId);
  }
  if (options.symbol !== undefined) {
    query = query.where("symbol", "=", options.symbol);
  }
  if (options.status !== undefined) {
    query = query.where("status", "=", options.status);
  }

  const rows = await query
    // Most recent first — the UI shows "most recent 5". trade_id breaks ties
    // so the order is deterministic when two trades share a timestamp.
    .orderBy("entry_date", "desc")
    .orderBy("trade_id")
    .execute();

  return rows.map(toTradeRow);
}

/* ── Account reconciliation (drift) ───────────────────────────────────────── */

/**
 * One row per day for the environment's brokerage account.
 *
 * Carries `unattributed_delta` — the gap between the broker's equity change and
 * the executors' summed P&L. Drives the banner in §6.5, which is invisible at
 * zero and impossible to ignore otherwise.
 */
export async function getDrift(
  environment: DeploymentEnv,
  options: DateRange = {},
): Promise<DriftRow[]> {
  await requireSession();
  assertDateRange(options);

  let query = getTradingDb()
    .selectFrom("v_account_daily_reconciliation")
    .selectAll()
    .where("environment", "=", toTradingEnv(environment));

  if (options.from !== undefined) {
    query = query.where("snapshot_date", ">=", dayStart(options.from));
  }
  if (options.to !== undefined) {
    query = query.where("snapshot_date", "<=", dayStart(options.to));
  }

  const rows = await query.orderBy("snapshot_date").execute();
  const result: DriftRow[] = [];

  for (const row of rows) {
    result.push(toDriftRow(row));
  }

  return result;
}
