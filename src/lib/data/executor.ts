/**
 * Executor identity.
 *
 * An executor is a triple, not a string: `strategy_name`, `strategy_version`,
 * `instance_id`. The views expose those as three separate columns — there is no
 * `triple` column — so the composed key is built here rather than in SQL.
 *
 * Pure module, no I/O. See the note in normalize.ts.
 */

export interface ExecutorTriple {
  strategyName: string;
  strategyVersion: string;
  instanceId: string;
}

/** Separator between identifier parts in the key form, e.g. `gap-fade:v3:instance-hood`. */
const KEY_SEPARATOR = ":";

/**
 * Canonical string form: `name:version:instance`.
 *
 * This is the manifest's key format, so it is also what joins a database row to
 * its deployed configuration. Do not invent a second string form.
 */
export function executorKey(triple: ExecutorTriple): string {
  return [triple.strategyName, triple.strategyVersion, triple.instanceId].join(KEY_SEPARATOR);
}

/**
 * Parse the canonical form back into a triple.
 *
 * Stricter than the platform repo's `parseStrategyKey`, which accepts
 * `parts.length < 3` as the only failure and silently drops everything past the
 * third segment — so `a:b:c:d` parses as `a:b:c`. Here that is an error, because
 * the key round-trips through URLs and a silently truncated identity would
 * address the wrong executor.
 */
export function parseExecutorKey(key: string): ExecutorTriple {
  const parts = key.split(KEY_SEPARATOR);

  if (parts.length !== 3 || parts.some((part) => part === "")) {
    throw new Error(
      `Invalid executor key ${JSON.stringify(key)}. Expected exactly name:version:instance.`,
    );
  }

  const [strategyName, strategyVersion, instanceId] = parts as [string, string, string];
  return { strategyName, strategyVersion, instanceId };
}

/** True when both triples name the same executor. */
export function sameExecutor(a: ExecutorTriple, b: ExecutorTriple): boolean {
  return executorKey(a) === executorKey(b);
}

/**
 * Link to an executor's detail page.
 *
 * PROVISIONAL — the URL representation is not yet decided, which is why every
 * caller goes through this one function rather than building a path inline.
 *
 * The provisional shape keeps the key in a single path segment with its colons
 * intact: `/executors/gap-fade:v3:instance-hood`. Colons are legal in a path
 * segment (RFC 3986 `pchar`), so this needs no escaping, round-trips through
 * `parseExecutorKey` exactly, and stays readable in a copied URL — which matters
 * for an operator console where the URL is evidence of what was being looked at.
 *
 * The alternative worth considering is three segments
 * (`/executors/gap-fade/v3/instance-hood`), which maps to nested dynamic route
 * params and avoids colons entirely. Changing to it is a change to this function
 * and the route folder, nothing else.
 */
export function executorHref(triple: ExecutorTriple): string {
  return `/executors/${executorKey(triple)}`;
}
