/**
 * Kysely's view of the trading database.
 *
 * These types describe what the DRIVER hands back, not what components consume.
 * That distinction is the whole point: `holding_period_ms` is typed `string`
 * here because tedious really does return BIGINT as a string, and typing it
 * `number` would make the compiler agree with a lie. `lib/data/normalize.ts`
 * is the boundary where these become domain values.
 *
 * Column lists verified against `INFORMATION_SCHEMA.COLUMNS` on the live
 * database — not copied from documentation. Types map as:
 *
 *   decimal / numeric / money / float / int → number
 *   bigint                                  → string   ← the trap
 *   bit                                     → boolean
 *   date / datetime2                        → Date
 *   varchar / nvarchar                      → string
 *
 * This app is READ-ONLY against every table below. Nothing here is ever the
 * target of an insert, update or delete.
 */

/** Grain: one row per executor, per day, per environment. */
export interface ExecutorDailyPerformance {
  snapshot_date: Date;
  strategy_name: string;
  strategy_version: string;
  instance_id: string;
  environment: string;
  allocated_capital: number;
  deployed_capital: number;
  open_positions: number;
  realized_pnl_day: number;
  unrealized_pnl: number;
  trades_opened: number;
  trades_closed: number;
  /** 'alpaca' | 'cache' | 'carried'. Null when the executor was flat. */
  mark_source: string | null;
  /** 0 means the day is estimated rather than observed. */
  is_complete: boolean;
  daily_pnl: number | null;
  /** Since inception, regardless of any date filter. Never rebase it. */
  cumulative_pnl: number | null;
  daily_return: number | null;
}

/** Grain: one row per trade, with execution-quality columns derived. */
export interface TradeExecutionQuality {
  trade_id: string;
  strategy_name: string | null;
  strategy_version: string | null;
  instance_id: string | null;
  symbol: string | null;
  /** Direction lives here. `quantity` is unsigned. */
  side: string | null;
  environment: string | null;
  is_backtest: boolean;
  backtest_id: string | null;
  status: string;
  entry_date: Date;
  entry_price: number;
  quantity: number;
  cost_basis: number;

  // Enrichment — null on older rows. Keep those nulls.
  decision_price: number | null;
  decision_time: Date | null;
  order_submitted_time: Date | null;
  allocated_capital_at_entry: number | null;
  target_position_value: number | null;
  intended_quantity: number | null;

  exit_date: Date | null;
  exit_price: number | null;
  exit_reason: string | null;
  exit_decision_price: number | null;
  exit_decision_time: Date | null;
  exit_order_submitted_time: Date | null;

  pnl: number | null;
  pnl_percent: number | null;
  /** BIGINT → string. */
  holding_period_ms: string | null;

  entry_context: string | null;
  exit_context: string | null;
  entry_order_id: string | null;
  exit_order_id: string | null;
  entry_correlation_id: string | null;
  exit_correlation_id: string | null;
  created_at: Date;
  updated_at: Date;

  // Derived.
  entry_slippage_bps: number | null;
  exit_slippage_bps: number | null;
  round_trip_slippage_bps: number | null;
  has_both_decision_prices: boolean | null;
  /** All six latency columns are BIGINT → string. */
  entry_eval_latency_ms: string | null;
  entry_broker_latency_ms: string | null;
  entry_total_latency_ms: string | null;
  exit_eval_latency_ms: string | null;
  exit_broker_latency_ms: string | null;
  exit_total_latency_ms: string | null;
  deployment_ratio: number | null;
  quantity_deviation: number | null;
  normalized_return: number | null;
}

/** Grain: one row per environment per day. */
export interface AccountDailyReconciliation {
  snapshot_date: Date;
  environment: string;
  equity: number;
  last_equity: number;
  cash: number;
  long_market_value: number;
  short_market_value: number;
  account_equity_change: number | null;
  executor_daily_pnl_sum: number | null;
  executor_count: number | null;
  total_allocated_capital: number | null;
  total_deployed_capital: number | null;
  /** Note the name — this view has no `is_complete`. */
  all_marks_complete: boolean | null;
  unattributed_delta: number | null;
  unattributed_fraction_of_allocated: number | null;
}

/** Read directly for open positions (`status = 'open'`). */
export interface Trades {
  trade_id: string;
  strategy_name: string | null;
  strategy_version: string | null;
  instance_id: string | null;
  symbol: string | null;
  side: string | null;
  entry_date: Date;
  entry_price: number;
  quantity: number;
  cost_basis: number;
  exit_date: Date | null;
  exit_price: number | null;
  exit_reason: string | null;
  pnl: number | null;
  pnl_percent: number | null;
  holding_period_ms: string | null;
  status: string;
  entry_context: string | null;
  exit_context: string | null;
  environment: string | null;
  is_backtest: boolean;
  backtest_id: string | null;
  entry_order_id: string | null;
  exit_order_id: string | null;
  created_at: Date;
  updated_at: Date;
  entry_correlation_id: string | null;
  exit_correlation_id: string | null;
  decision_price: number | null;
  decision_time: Date | null;
  order_submitted_time: Date | null;
  allocated_capital_at_entry: number | null;
  target_position_value: number | null;
  intended_quantity: number | null;
  exit_decision_price: number | null;
  exit_decision_time: Date | null;
  exit_order_submitted_time: Date | null;
}

/** Kill-switch state. Keyed on `control_key` — not `key`. */
export interface PlatformControls {
  control_key: string;
  value: string;
  updated_at: Date;
  updated_by: string | null;
}

/**
 * Table and view names as Kysely addresses them. Keys are the SQL identifiers,
 * so `db.selectFrom('v_executor_daily_performance')` type-checks its columns.
 */
export interface TradingDatabase {
  v_executor_daily_performance: ExecutorDailyPerformance;
  v_trade_execution_quality: TradeExecutionQuality;
  v_account_daily_reconciliation: AccountDailyReconciliation;
  trades: Trades;
  platform_controls: PlatformControls;
}
