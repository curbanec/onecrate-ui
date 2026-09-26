/**
 * Data layer barrel.
 *
 * Matches the export convention already used by `components/fleet`,
 * `components/primitives` and `components/shell`.
 *
 * Note that `trading-db`, `session` and `queries` are NOT re-exported here. All
 * three are `server-only`, and re-exporting them through a barrel that also
 * carries pure helpers means any Client Component importing a pure helper would
 * drag a server-only module into its graph and fail the build. Server code
 * imports those directly:
 *
 *     import { getDailyPerformance } from "@/lib/data/queries";
 *
 * The DTO *types* those functions return are exported here, because types are
 * erased at compile time and components need them to describe their props.
 */

export {
  toNumber,
  toNumberOrNull,
  toDateOnly,
  toDateOnlyOrNull,
  toIsoString,
  toIsoStringOrNull,
  toBoolean,
  toBooleanOrNull,
  toStringOrNull,
  toRequiredString,
} from "./normalize";

export {
  type DeploymentEnv,
  type TradingEnv,
  DEPLOYMENT_ENVS,
  DEFAULT_DEPLOYMENT_ENV,
  DEPLOYED_CONTAINER,
  HALTED_VALUE,
  toTradingEnv,
  toDeploymentEnv,
  isDeploymentEnv,
  parseDeploymentEnv,
  deployedBlobName,
  haltControlKey,
} from "./environment";

export {
  type ExecutorTriple,
  executorKey,
  parseExecutorKey,
  sameExecutor,
  executorHref,
} from "./executor";

export {
  type DateRange,
  type TradeStatus,
  type DailyPerformanceRow,
  type PlatformPerformanceRow,
  type PlatformPerformanceRaw,
  type TradeRow,
  type TradeRowRaw,
  type DriftRow,
  MARK_CARRIED,
  UNATTRIBUTED_DELTA_THRESHOLD,
  isCarriedMark,
  assertDateOnly,
  assertDateRange,
  assertTriples,
  dayStart,
  dayAfter,
  toDailyPerformanceRow,
  toPlatformPerformanceRow,
  toTradeRow,
  toDriftRow,
} from "./dto";

export {
  type ManifestStatus,
  type ManifestEntry,
  type ParsedManifest,
  manifestSymbols,
  parseManifest,
} from "./manifest";

/**
 * Types only from `current-state`. That module is `server-only`, but a type
 * import is erased at compile time, so components can describe their props
 * without pulling the module into a client graph.
 */
export type { CurrentState, CurrentExecutor, HaltState } from "./current-state";

export type {
  TradingDatabase,
  ExecutorDailyPerformance,
  TradeExecutionQuality,
  AccountDailyReconciliation,
  Trades,
  PlatformControls,
} from "./schema";
