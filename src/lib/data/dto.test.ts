import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  assertDateOnly,
  assertDateRange,
  dayAfter,
  dayStart,
  isCarriedMark,
  toDailyPerformanceRow,
  toDriftRow,
  toPlatformPerformanceRow,
  toTradeRow,
  type TradeRowRaw,
} from "./dto";
import type { AccountDailyReconciliation, ExecutorDailyPerformance } from "./schema";

/**
 * The mappers are where "nulls stay null" is enforced, so these tests are
 * mostly about absence: every nullable column is fed a null and must come back
 * null, never 0, never "", never a plausible-looking substitute.
 */

/** A flat day for gap-fade HOOD, shaped like a real row from the live view. */
const PERFORMANCE_ROW: ExecutorDailyPerformance = {
  snapshot_date: new Date("2026-09-14T00:00:00.000Z"),
  prev_trading_day: new Date("2026-09-11T00:00:00.000Z"),
  strategy_name: "gap-fade",
  strategy_version: "v3",
  instance_id: "instance-hood",
  environment: "live",
  allocated_capital: 200,
  deployed_capital: 0,
  open_positions: 0,
  realized_pnl_day: 0,
  unrealized_pnl: 0,
  trades_opened: 0,
  trades_closed: 0,
  mark_source: null,
  is_complete: true,
  daily_pnl: 0,
  cumulative_pnl: -11.119,
  daily_return: 0,
};

describe("toDailyPerformanceRow", () => {
  test("maps a real flat day", () => {
    const row = toDailyPerformanceRow(PERFORMANCE_ROW);

    assert.equal(row.date, "2026-09-14");
    assert.deepEqual(row.triple, {
      strategyName: "gap-fade",
      strategyVersion: "v3",
      instanceId: "instance-hood",
    });
    assert.equal(row.allocatedCapital, 200);
    assert.equal(row.cumulativePnl, -11.119);
    assert.equal(row.isComplete, true);
  });

  test("a flat day's null mark_source stays null", () => {
    // 111 of 120 live rows have a null mark_source, so this is the common case,
    // not an edge one.
    assert.equal(toDailyPerformanceRow(PERFORMANCE_ROW).markSource, null);
  });

  test("real zeros are preserved as zeros, not confused with absence", () => {
    const row = toDailyPerformanceRow(PERFORMANCE_ROW);
    assert.equal(row.deployedCapital, 0);
    assert.equal(row.dailyPnl, 0);
    assert.equal(row.openPositions, 0);
  });

  test("nullable figures stay null rather than becoming 0", () => {
    const row = toDailyPerformanceRow({
      ...PERFORMANCE_ROW,
      daily_pnl: null,
      cumulative_pnl: null,
      daily_return: null,
    });

    assert.equal(row.dailyPnl, null);
    assert.equal(row.cumulativePnl, null);
    assert.equal(row.dailyReturn, null);
    // Stated explicitly: these are the values that would render as $0.00 if a
    // single `?? 0` crept in anywhere upstream.
    assert.notEqual(row.dailyPnl, 0);
    assert.notEqual(row.cumulativePnl, 0);
  });

  test("an incomplete day is carried through as false", () => {
    assert.equal(
      toDailyPerformanceRow({ ...PERFORMANCE_ROW, is_complete: false }).isComplete,
      false,
    );
  });

  test("a carried mark is recognised", () => {
    const row = toDailyPerformanceRow({ ...PERFORMANCE_ROW, mark_source: "carried" });
    assert.equal(row.markSource, "carried");
    assert.equal(isCarriedMark(row.markSource), true);
    assert.equal(isCarriedMark("alpaca"), false);
    assert.equal(isCarriedMark(null), false);
  });
});

describe("toPlatformPerformanceRow", () => {
  test("maps an aggregate day", () => {
    const row = toPlatformPerformanceRow({
      snapshot_date: new Date("2026-09-14T00:00:00.000Z"),
      capital_weighted_return: 0.001131,
      equal_weighted_return: 0.001508,
      executor_count: 3,
      is_complete: 1,
    });

    assert.equal(row.date, "2026-09-14");
    assert.equal(row.capitalWeightedReturn, 0.001131);
    assert.equal(row.executorCount, 3);
    assert.equal(row.isComplete, true);
  });

  test("a zero-allocation day yields null, not 0%", () => {
    // This is what the NULLIF buys: no allocation means the question has no
    // answer, which must not render as a flat 0% return.
    const row = toPlatformPerformanceRow({
      snapshot_date: new Date("2026-09-14T00:00:00.000Z"),
      capital_weighted_return: null,
      equal_weighted_return: null,
      executor_count: 0,
      is_complete: null,
    });

    assert.equal(row.capitalWeightedReturn, null);
    assert.equal(row.equalWeightedReturn, null);
    assert.equal(row.isComplete, null);
    assert.equal(row.executorCount, 0);
  });

  test("MIN(CAST(is_complete AS int)) of 0 means the day is estimated", () => {
    const row = toPlatformPerformanceRow({
      snapshot_date: new Date("2026-09-14T00:00:00.000Z"),
      capital_weighted_return: 0,
      equal_weighted_return: 0,
      executor_count: 3,
      is_complete: 0,
    });

    assert.equal(row.isComplete, false);
    // A genuine 0% return is still 0%, not absence.
    assert.equal(row.capitalWeightedReturn, 0);
  });
});

/** A closed live trade, shaped like a real row. */
const TRADE_ROW: TradeRowRaw = {
  trade_id: "trade:gap-fade:v3:instance-hood:HOOD:6d7039eb",
  strategy_name: "gap-fade",
  strategy_version: "v3",
  instance_id: "instance-hood",
  symbol: "HOOD",
  side: "long",
  environment: "live",
  is_backtest: false,
  backtest_id: null,
  status: "closed",
  entry_date: new Date("2026-09-10T13:45:00.000Z"),
  entry_price: 108.9,
  quantity: 1.655,
  cost_basis: 180.2295,
  decision_price: null,
  decision_time: null,
  order_submitted_time: null,
  allocated_capital_at_entry: null,
  target_position_value: null,
  intended_quantity: null,
  exit_date: new Date("2026-09-10T19:43:41.000Z"),
  exit_price: 110.3,
  exit_reason: "take_profit",
  exit_decision_price: null,
  exit_decision_time: null,
  exit_order_submitted_time: null,
  pnl: 2.3435,
  pnl_percent: 1.3003,
  holding_period_ms: "21461201",
  entry_order_id: null,
  exit_order_id: null,
  entry_correlation_id: null,
  exit_correlation_id: null,
  created_at: new Date("2026-09-10T13:45:00.000Z"),
  updated_at: new Date("2026-09-10T19:43:41.000Z"),
  entry_slippage_bps: 11.031439602868174,
  exit_slippage_bps: null,
  round_trip_slippage_bps: null,
  has_both_decision_prices: false,
  entry_eval_latency_ms: null,
  entry_broker_latency_ms: null,
  entry_total_latency_ms: "267",
  exit_eval_latency_ms: null,
  exit_broker_latency_ms: null,
  exit_total_latency_ms: null,
  deployment_ratio: 1.001275,
  quantity_deviation: null,
  normalized_return: 0.0117175,
};

describe("toTradeRow", () => {
  test("BIGINT columns become numbers", () => {
    const row = toTradeRow(TRADE_ROW);
    assert.equal(row.holdingPeriodMs, 21461201);
    assert.equal(typeof row.holdingPeriodMs, "number");
    assert.equal(row.entryTotalLatencyMs, 267);
  });

  test("missing enrichment stays null — 35 of 45 live trades lack slippage", () => {
    const row = toTradeRow(TRADE_ROW);
    assert.equal(row.exitSlippageBps, null);
    assert.equal(row.decisionPrice, null);
    assert.equal(row.allocatedCapitalAtEntry, null);
    assert.equal(row.entryEvalLatencyMs, null);
    assert.notEqual(row.exitSlippageBps, 0);
  });

  test("an open trade keeps null exit fields", () => {
    const row = toTradeRow({
      ...TRADE_ROW,
      status: "open",
      exit_date: null,
      exit_price: null,
      exit_reason: null,
      pnl: null,
      pnl_percent: null,
      holding_period_ms: null,
    });

    assert.equal(row.exitDate, null);
    assert.equal(row.pnl, null);
    assert.equal(row.holdingPeriodMs, null);
    // An open trade has not lost money; it has no P&L yet. Those are different
    // claims and only one of them is true.
    assert.notEqual(row.pnl, 0);
  });

  test("timestamps become ISO strings", () => {
    const row = toTradeRow(TRADE_ROW);
    assert.equal(row.entryDate, "2026-09-10T13:45:00.000Z");
    assert.equal(row.exitDate, "2026-09-10T19:43:41.000Z");
  });

  test("the triple is assembled when present", () => {
    assert.deepEqual(toTradeRow(TRADE_ROW).triple, {
      strategyName: "gap-fade",
      strategyVersion: "v3",
      instanceId: "instance-hood",
    });
  });

  test("a partial identity yields no triple rather than a broken one", () => {
    const row = toTradeRow({ ...TRADE_ROW, instance_id: null });
    assert.equal(row.triple, null);
  });

  test("false is preserved on a nullable bit", () => {
    assert.equal(toTradeRow(TRADE_ROW).hasBothDecisionPrices, false);
    assert.equal(
      toTradeRow({ ...TRADE_ROW, has_both_decision_prices: null }).hasBothDecisionPrices,
      null,
    );
  });
});

const DRIFT_ROW: AccountDailyReconciliation = {
  snapshot_date: new Date("2026-09-14T00:00:00.000Z"),
  prev_trading_day: new Date("2026-09-11T00:00:00.000Z"),
  environment: "live",
  equity: 1000,
  last_equity: 998.5,
  cash: 810.37,
  long_market_value: 189.63,
  short_market_value: 0,
  account_equity_change: 2.16,
  executor_daily_pnl_sum: 0.9048,
  executor_count: 3,
  total_allocated_capital: 800,
  total_deployed_capital: 189.6282,
  all_marks_complete: true,
  unattributed_delta: 1.2552,
  unattributed_fraction_of_allocated: 0.001569,
};

describe("toDriftRow", () => {
  test("maps a real reconciliation day", () => {
    const row = toDriftRow(DRIFT_ROW);
    assert.equal(row.date, "2026-09-14");
    assert.equal(row.unattributedDelta, 1.2552);
    assert.equal(row.allMarksComplete, true);
  });

  test("a null delta is not zero drift", () => {
    // Zero drift means the books agree. Null means nobody checked. The banner
    // must not treat the second as the first.
    const row = toDriftRow({ ...DRIFT_ROW, unattributed_delta: null });
    assert.equal(row.unattributedDelta, null);
    assert.notEqual(row.unattributedDelta, 0);
  });

  test("zero drift is preserved as zero", () => {
    assert.equal(toDriftRow({ ...DRIFT_ROW, unattributed_delta: 0 }).unattributedDelta, 0);
  });
});

describe("date bounds", () => {
  test("accepts well-formed dates", () => {
    assert.doesNotThrow(() => assertDateOnly("2026-09-14", "from"));
  });

  test("rejects malformed and impossible dates", () => {
    assert.throws(() => assertDateOnly("2026-9-14", "from"), /YYYY-MM-DD/);
    assert.throws(() => assertDateOnly("14/09/2026", "from"), /YYYY-MM-DD/);
    assert.throws(() => assertDateOnly("", "from"), /YYYY-MM-DD/);
    // Matches the pattern but is not a date.
    assert.throws(() => assertDateOnly("2026-02-31", "from"), /not a real date/);
  });

  test("a backwards range is rejected", () => {
    assert.throws(
      () => assertDateRange({ from: "2026-09-14", to: "2026-08-01" }),
      /is after/,
    );
  });

  test("open-ended and absent ranges are fine", () => {
    assert.doesNotThrow(() => assertDateRange({}));
    assert.doesNotThrow(() => assertDateRange({ from: "2026-08-01" }));
    assert.doesNotThrow(() => assertDateRange({ to: "2026-09-14" }));
    assert.doesNotThrow(() => assertDateRange({ from: "2026-09-14", to: "2026-09-14" }));
  });

  test("dayStart is midnight UTC", () => {
    assert.equal(dayStart("2026-09-14").toISOString(), "2026-09-14T00:00:00.000Z");
  });

  test("dayAfter is the next midnight — the exclusive bound for datetime2", () => {
    // Without this, a trade entered at 14:30 on the last day of the range would
    // be silently excluded.
    assert.equal(dayAfter("2026-09-14").toISOString(), "2026-09-15T00:00:00.000Z");
  });

  test("dayAfter crosses month and year boundaries", () => {
    assert.equal(dayAfter("2026-08-31").toISOString(), "2026-09-01T00:00:00.000Z");
    assert.equal(dayAfter("2026-12-31").toISOString(), "2027-01-01T00:00:00.000Z");
    assert.equal(dayAfter("2028-02-28").toISOString(), "2028-02-29T00:00:00.000Z");
  });
});
