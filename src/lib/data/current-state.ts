import "server-only";

import { readManifestBlob } from "./blob";
import { HALTED_VALUE, haltControlKey, type DeploymentEnv } from "./environment";
import { executorKey, type ExecutorTriple } from "./executor";
import { parseManifest, type ManifestStatus } from "./manifest";
import { toStringOrNull } from "./normalize";
import { getTrades } from "./queries";
import { requireSession } from "./session";
import { getTradingDb } from "./trading-db";
import type { TradeRow } from "./dto";

/**
 * What is deployed and running right now.
 *
 * Composes three independent sources — the deployment manifest (blob), open
 * trades (SQL), and the kill switch (SQL) — into the answer the Fleet page
 * needs before it can draw a single card.
 *
 * The executor list comes from the MANIFEST, never from trade or snapshot
 * rows. That is what lets a newly deployed executor with no history render as a
 * card of em dashes rather than not appearing at all, and it is also why a
 * decommissioned identity with historical trades does not reappear as a live
 * executor.
 */

/** Three states, not two. 'unknown' means we could not find out. */
export type HaltState = "halted" | "active" | "unknown";

export interface CurrentExecutor {
  key: string;
  triple: ExecutorTriple;
  symbols: string[];
  /**
   * From the manifest. PROVISIONAL — the snapshot view also carries
   * `allocated_capital`, and the two can disagree between a deploy and the next
   * nightly snapshot. See the Stage 3 report.
   */
  allocatedCapital: number;
  parameters: Record<string, unknown> | null;
  /** Raw manifest `execution` block — bar timeframe, intervals, and the rest. */
  execution: Record<string, unknown>;
  /** Open positions for this executor. Empty when flat. */
  openTrades: TradeRow[];
  /**
   * Sum of `cost_basis` across open trades. Genuinely 0 when flat — this is a
   * real zero, not a missing value, because "no open position" is a fact the
   * data supports.
   */
  deployedCapital: number;
}

export interface CurrentState {
  environment: DeploymentEnv;
  manifestStatus: ManifestStatus;
  /** Why the manifest is missing or invalid. Null when ok or empty. */
  manifestError: string | null;
  /** One entry per manifest key. Empty unless the manifest is 'ok'. */
  executors: CurrentExecutor[];
  halt: HaltState;
}

/**
 * Read the kill switch.
 *
 * Fails CLOSED to 'unknown'. The platform executor's own check treats a failed
 * read as "not halted" and keeps trading — a deliberate choice for a process
 * that must not stop on a transient database blip. This is a read-only console,
 * where the same choice would be a lie: reporting "active" when we do not know
 * is worse than admitting we do not know.
 *
 * Note the distinction between failure and absence. NO ROW is a definitive
 * answer, not a failure: the platform writes the row only when the switch is
 * first thrown, so absence means never halted. That is why `trading_halted_dev`
 * not existing reports 'active' rather than 'unknown'.
 */
async function readHaltState(environment: DeploymentEnv): Promise<HaltState> {
  try {
    const row = await getTradingDb()
      .selectFrom("platform_controls")
      .select(["value"])
      .where("control_key", "=", haltControlKey(environment))
      .executeTakeFirst();

    if (row === undefined) return "active";

    return toStringOrNull(row.value)?.toLowerCase() === HALTED_VALUE
      ? "halted"
      : "active";
  } catch {
    return "unknown";
  }
}

/** Manifest read + parse, reduced to a status. Never throws. */
async function readManifest(environment: DeploymentEnv): Promise<{
  status: ManifestStatus;
  error: string | null;
  entries: ReturnType<typeof parseManifest>["entries"];
}> {
  try {
    const { found, text, source } = await readManifestBlob(environment);

    if (!found) {
      return {
        status: "missing",
        error:
          `Deployment manifest ${source} not found. The deploy pipeline uploads it on ` +
          `every deploy, so an absent blob means that step did not run.`,
        entries: [],
      };
    }

    const parsed = parseManifest(text!, source);
    return { status: parsed.status, error: parsed.error, entries: parsed.entries };
  } catch (error) {
    // Could not reach storage at all. Reported as 'missing' because that is the
    // alarm state available, with the real cause carried in the message.
    return {
      status: "missing",
      error: `Could not read the deployment manifest: ${(error as Error).message}`,
      entries: [],
    };
  }
}

/**
 * Current deployed state for an environment.
 *
 * The three reads run in parallel: they share no inputs, and the manifest hits
 * blob storage while the other two hit SQL.
 */
export async function getCurrentState(
  environment: DeploymentEnv,
): Promise<CurrentState> {
  await requireSession();

  const [manifest, openTrades, halt] = await Promise.all([
    readManifest(environment),
    getTrades(environment, { status: "open" }),
    readHaltState(environment),
  ]);

  // Open trades keyed by executor. Trades whose identity is incomplete, or
  // which belong to an executor no longer in the manifest, are simply not
  // matched to a card — the manifest decides who exists.
  const openByExecutor = new Map<string, TradeRow[]>();
  for (const trade of openTrades) {
    if (trade.triple === null) continue;
    const key = executorKey(trade.triple);
    const existing = openByExecutor.get(key);
    if (existing) existing.push(trade);
    else openByExecutor.set(key, [trade]);
  }

  const executors: CurrentExecutor[] = manifest.entries.map((entry) => {
    const trades = openByExecutor.get(entry.key) ?? [];

    return {
      key: entry.key,
      triple: entry.triple,
      symbols: entry.symbols,
      allocatedCapital: entry.allocatedCapital,
      parameters: entry.parameters,
      execution: entry.execution,
      openTrades: trades,
      deployedCapital: trades.reduce((sum, trade) => sum + trade.costBasis, 0),
    };
  });

  return {
    environment,
    manifestStatus: manifest.status,
    manifestError: manifest.error,
    executors,
    halt,
  };
}
