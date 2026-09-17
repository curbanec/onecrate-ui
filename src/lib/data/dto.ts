/**
 * Data transfer objects — what the query layer returns, and the pure mappers
 * that produce them.
 *
 * Split from `queries.ts` so the mapping is testable without a database and
 * without `server-only`. The mappers are where "nulls stay null" is actually
 * enforced, so they are the part most worth testing.
 *
 * Field nullability mirrors the view's own declared nullability exactly. A
 * column the database declares NOT NULL is typed `number` and mapped with
 * `toNumber`, which throws if it ever arrives null — that is a view changing
 * shape underneath us, not a value to paper over. A nullable column is typed
 * `| null` and stays null all the way to the em dash.
 */

import {
  toBoolean,
  toBooleanOrNull,
  toDateOnly,
  toIsoString,
  toIsoStringOrNull,
  toNumber,
  toNumberOrNull,
  toRequiredString,
  toStringOrNull,
} from "./normalize";
import type { ExecutorTriple } from "./executor";
import type {
  AccountDailyReconciliation,
  ExecutorDailyPerformance,
  TradeExecutionQuality,
} from "./schema";

/* ── Query inputs ─────────────────────────────────────────────────────────── */

/** Inclusive date bounds, `YYYY-MM-DD`. Both optional. */
export interface DateRange {
  from?: string;
  to?: string;
}

/** `trades.status` values the platform actually writes. */
export type TradeStatus = "open" | "closed";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reject a malformed bound before it reaches SQL.
 *
 * Not an injection guard — every value is parameterized. It exists because a
 * malformed date silently matches nothing, and an empty Fleet page is a
 * plausible-looking answer to a broken question.
 */
export function assertDateOnly(value: string, label: string): void {
  if (!DATE_ONLY.test(value)) {
    throw new TypeError(`${label} must be YYYY-MM-DD, got ${JSON.stringify(value)}.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  // Catches 2026-02-31, which matches the pattern but is not a date.
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${label} is not a real date: ${JSON.stringify(value)}.`);
  }
}

/** Validate a range, including that it runs forwards. */
export function assertDateRange({ from, to }: DateRange): void {
  if (from !== undefined) assertDateOnly(from, "from");
  if (to !== undefined) assertDateOnly(to, "to");
  if (from !== undefined && to !== undefined && from > to) {
    // Lexicographic comparison is correct for zero-padded ISO dates.
    throw new TypeError(`from (${from}) is after to (${to}).`);
  }
}

/** Midnight UTC on the given day. */
export function dayStart(dateOnly: string): Date {
  assertDateOnly(dateOnly, "date");
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

/**
 * Midnight UTC on the following day — an EXCLUSIVE upper bound.
 *
 * Needed for `datetime2` columns such as `entry_date`. An inclusive `<= to`
 * resolves to midnight, so a trade entered at 14:30 on the final day of the
 * range would be silently excluded. Date-typed columns (`snapshot_date`) have
 * no time component and use a plain `<=` instead.
 */
export function dayAfter(dateOnly: string): Date {
  const start = dayStart(dateOnly);
  start.setUTCDate(start.getUTCDate() + 1);
  return start;
}

/* ── Executor daily performance ───────────────────────────────────────────── */

/** `mark_source` value meaning the mark was carried forward (§6.3). */
export const MARK_CARRIED = "carried";

/** Does this row's mark get the hollow-dot treatment? */
export function isCarriedMark(markSource: string | null): boolean {
  return markSource === MARK_CARRIED;
}

export interface DailyPerformanceRow {
  /** `YYYY-MM-DD`. */
  date: string;
  triple: ExecutorTriple;
  environment: string;
  allocatedCapital: number;
  deployedCapital: number;
  openPositions: number;
  realizedPnlDay: number;
  unrealizedPnl: number;
  tradesOpened: number;
  tradesClosed: number;
  /** 'alpaca' | 'cache' | 'carried', or null when the executor was flat. */
  markSource: string | null;
  /** False means the day is estimated rather than observed. */
  isComplete: boolean;
  dailyPnl: number | null;
  /**
   * Since inception, NOT since the start of any date filter. The view computes
   * it over the executor's whole history, so a filtered range still carries the
   * true running total. Never rebase it.
   */
  cumulativePnl: number | null;
  /** A FRACTION, not a percentage: 0.0072 means 0.72%. See the note on
   *  PlatformPerformanceRow. */
  dailyReturn: number | null;
}

export function toDailyPerformanceRow(
  row: ExecutorDailyPerformance,
): DailyPerformanceRow {
  return {
    date: toDateOnly(row.snapshot_date),
    triple: {
      strategyName: toRequiredString(row.strategy_name),
      strategyVersion: toRequiredString(row.strategy_version),
      instanceId: toRequiredString(row.instance_id),
    },
    environment: toRequiredString(row.environment),
    allocatedCapital: toNumber(row.allocated_capital),
    deployedCapital: toNumber(row.deployed_capital),
    openPositions: toNumber(row.open_positions),
    realizedPnlDay: toNumber(row.realized_pnl_day),
    unrealizedPnl: toNumber(row.unrealized_pnl),
    tradesOpened: toNumber(row.trades_opened),
    tradesClosed: toNumber(row.trades_closed),
    markSource: toStringOrNull(row.mark_source),
    isComplete: toBoolean(row.is_complete),
    dailyPnl: toNumberOrNull(row.daily_pnl),
    cumulativePnl: toNumberOrNull(row.cumulative_pnl),
    dailyReturn: toNumberOrNull(row.daily_return),
  };
}

/* ── Platform aggregate ───────────────────────────────────────────────────── */

/** The raw shape the GROUP BY produces, before normalization. */
export interface PlatformPerformanceRaw {
  snapshot_date: Date;
  capital_weighted_return: number | null;
  equal_weighted_return: number | null;
  executor_count: number;
  is_complete: number | null;
}

export interface PlatformPerformanceRow {
  /** `YYYY-MM-DD`. */
  date: string;
  /**
   * `SUM(daily_pnl) / NULLIF(SUM(allocated_capital), 0)`.
   *
   * A FRACTION: 0.001131 means 0.1131%. Null when nothing was allocated that
   * day — the NULLIF is there so a zero-allocation day reads as "no answer"
   * rather than a division error or a fabricated 0%.
   *
   * Note for whoever renders this: `<Figure format="percent">` expects percent
   * units (58 means 58%), so it needs a ×100 at the render boundary. That
   * conversion is deliberately NOT done here — the data layer returns what the
   * view computed, in the view's own units.
   */
  capitalWeightedReturn: number | null;
  /** `AVG(daily_return)`. Also a fraction. Null when every input was null. */
  equalWeightedReturn: number | null;
  /** Executors contributing to this day. */
  executorCount: number;
  /**
   * True only when EVERY executor's day was complete — `MIN(CAST(is_complete
   * AS int))`. One estimated executor makes the whole platform day estimated,
   * which is the honest reading.
   */
  isComplete: boolean | null;
}

export function toPlatformPerformanceRow(
  row: PlatformPerformanceRaw,
): PlatformPerformanceRow {
  const complete = toNumberOrNull(row.is_complete);

  return {
    date: toDateOnly(row.snapshot_date),
    capitalWeightedReturn: toNumberOrNull(row.capital_weighted_return),
    equalWeightedReturn: toNumberOrNull(row.equal_weighted_return),
    executorCount: toNumber(row.executor_count),
    isComplete: complete === null ? null : toBoolean(complete),
  };
}

/* ── Trades ───────────────────────────────────────────────────────────────── */

export interface TradeRow {
  tradeId: string;
  triple: ExecutorTriple | null;
  symbol: string | null;
  /** Direction lives here. `quantity` is unsigned. */
  side: string | null;
  environment: string | null;
  status: string;

  entryDate: string;
  entryPrice: number;
  quantity: number;
  costBasis: number;

  exitDate: string | null;
  exitPrice: number | null;
  exitReason: string | null;

  pnl: number | null;
  pnlPercent: number | null;
  holdingPeriodMs: number | null;

  // Enrichment — null on older rows, and that is information, not a gap to fill.
  decisionPrice: number | null;
  decisionTime: string | null;
  orderSubmittedTime: string | null;
  allocatedCapitalAtEntry: number | null;
  targetPositionValue: number | null;
  intendedQuantity: number | null;
  exitDecisionPrice: number | null;
  exitDecisionTime: string | null;
  exitOrderSubmittedTime: string | null;

  // Derived by the view.
  entrySlippageBps: number | null;
  exitSlippageBps: number | null;
  roundTripSlippageBps: number | null;
  hasBothDecisionPrices: boolean | null;
  entryEvalLatencyMs: number | null;
  entryBrokerLatencyMs: number | null;
  entryTotalLatencyMs: number | null;
  exitEvalLatencyMs: number | null;
  exitBrokerLatencyMs: number | null;
  exitTotalLatencyMs: number | null;
  deploymentRatio: number | null;
  quantityDeviation: number | null;
  normalizedReturn: number | null;

  entryOrderId: string | null;
  exitOrderId: string | null;
  entryCorrelationId: string | null;
  exitCorrelationId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The subset of trade columns this app selects — `*_context` excluded. */
export type TradeRowRaw = Omit<TradeExecutionQuality, "entry_context" | "exit_context">;

export function toTradeRow(row: TradeRowRaw): TradeRow {
  const strategyName = toStringOrNull(row.strategy_name);
  const strategyVersion = toStringOrNull(row.strategy_version);
  const instanceId = toStringOrNull(row.instance_id);

  return {
    tradeId: toRequiredString(row.trade_id),
    // The identity columns are individually nullable on this view, so the
    // triple is only assembled when all three are present. A partial triple
    // would address no executor at all.
    triple:
      strategyName && strategyVersion && instanceId
        ? { strategyName, strategyVersion, instanceId }
        : null,
    symbol: toStringOrNull(row.symbol),
    side: toStringOrNull(row.side),
    environment: toStringOrNull(row.environment),
    status: toRequiredString(row.status),

    entryDate: toIsoString(row.entry_date),
    entryPrice: toNumber(row.entry_price),
    quantity: toNumber(row.quantity),
    costBasis: toNumber(row.cost_basis),

    exitDate: toIsoStringOrNull(row.exit_date),
    exitPrice: toNumberOrNull(row.exit_price),
    exitReason: toStringOrNull(row.exit_reason),

    pnl: toNumberOrNull(row.pnl),
    pnlPercent: toNumberOrNull(row.pnl_percent),
    // BIGINT arrives as a string; toNumberOrNull is what makes it a number.
    holdingPeriodMs: toNumberOrNull(row.holding_period_ms),

    decisionPrice: toNumberOrNull(row.decision_price),
    decisionTime: toIsoStringOrNull(row.decision_time),
    orderSubmittedTime: toIsoStringOrNull(row.order_submitted_time),
    allocatedCapitalAtEntry: toNumberOrNull(row.allocated_capital_at_entry),
    targetPositionValue: toNumberOrNull(row.target_position_value),
    intendedQuantity: toNumberOrNull(row.intended_quantity),
    exitDecisionPrice: toNumberOrNull(row.exit_decision_price),
    exitDecisionTime: toIsoStringOrNull(row.exit_decision_time),
    exitOrderSubmittedTime: toIsoStringOrNull(row.exit_order_submitted_time),

    entrySlippageBps: toNumberOrNull(row.entry_slippage_bps),
    exitSlippageBps: toNumberOrNull(row.exit_slippage_bps),
    roundTripSlippageBps: toNumberOrNull(row.round_trip_slippage_bps),
    hasBothDecisionPrices: toBooleanOrNull(row.has_both_decision_prices),
    entryEvalLatencyMs: toNumberOrNull(row.entry_eval_latency_ms),
    entryBrokerLatencyMs: toNumberOrNull(row.entry_broker_latency_ms),
    entryTotalLatencyMs: toNumberOrNull(row.entry_total_latency_ms),
    exitEvalLatencyMs: toNumberOrNull(row.exit_eval_latency_ms),
    exitBrokerLatencyMs: toNumberOrNull(row.exit_broker_latency_ms),
    exitTotalLatencyMs: toNumberOrNull(row.exit_total_latency_ms),
    deploymentRatio: toNumberOrNull(row.deployment_ratio),
    quantityDeviation: toNumberOrNull(row.quantity_deviation),
    normalizedReturn: toNumberOrNull(row.normalized_return),

    entryOrderId: toStringOrNull(row.entry_order_id),
    exitOrderId: toStringOrNull(row.exit_order_id),
    entryCorrelationId: toStringOrNull(row.entry_correlation_id),
    exitCorrelationId: toStringOrNull(row.exit_correlation_id),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

/* ── Account reconciliation (drift) ───────────────────────────────────────── */

export interface DriftRow {
  /** `YYYY-MM-DD`. */
  date: string;
  environment: string;
  equity: number;
  lastEquity: number;
  cash: number;
  longMarketValue: number;
  shortMarketValue: number;
  accountEquityChange: number | null;
  executorDailyPnlSum: number | null;
  executorCount: number | null;
  totalAllocatedCapital: number | null;
  totalDeployedCapital: number | null;
  /** Note the name: this view has no `is_complete`. */
  allMarksComplete: boolean | null;
  /**
   * Broker equity change minus the executors' summed P&L. Non-zero means the
   * book and the ledger disagree (§6.5). Null is not zero.
   */
  unattributedDelta: number | null;
  unattributedFractionOfAllocated: number | null;
}

export function toDriftRow(row: AccountDailyReconciliation): DriftRow {
  return {
    date: toDateOnly(row.snapshot_date),
    environment: toRequiredString(row.environment),
    equity: toNumber(row.equity),
    lastEquity: toNumber(row.last_equity),
    cash: toNumber(row.cash),
    longMarketValue: toNumber(row.long_market_value),
    shortMarketValue: toNumber(row.short_market_value),
    accountEquityChange: toNumberOrNull(row.account_equity_change),
    executorDailyPnlSum: toNumberOrNull(row.executor_daily_pnl_sum),
    executorCount: toNumberOrNull(row.executor_count),
    totalAllocatedCapital: toNumberOrNull(row.total_allocated_capital),
    totalDeployedCapital: toNumberOrNull(row.total_deployed_capital),
    allMarksComplete: toBooleanOrNull(row.all_marks_complete),
    unattributedDelta: toNumberOrNull(row.unattributed_delta),
    unattributedFractionOfAllocated: toNumberOrNull(
      row.unattributed_fraction_of_allocated,
    ),
  };
}

/**
 * Threshold the platform itself alarms on, in dollars.
 *
 * Copied from the platform's own `UNATTRIBUTED_DELTA_THRESHOLD` rather than
 * invented here, so the banner fires on exactly what the platform considers
 * drift. Today's live delta is about $1.26, so this is not hypothetical.
 */
export const UNATTRIBUTED_DELTA_THRESHOLD = 1.0;
