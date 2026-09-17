/**
 * The two environment vocabularies, and the single mapping between them.
 *
 * This is the most dangerous concept in the application. Getting it wrong shows
 * paper-trading results as live money, or hides live money behind a toggle that
 * looks like it is working. So the mapping lives here, once, and every caller
 * goes through it.
 *
 *   UI toggle / manifest blob : 'prod' | 'dev'    (DeploymentEnv)
 *   SQL `environment` column  : 'live' | 'paper'  (TradingEnv)
 *
 * Pure module — no I/O, no `process.env` — so it stays unit testable outside
 * Next. See the note in normalize.ts about why that matters.
 *
 * Mirrors `getEnvironment()` and `deployedBlobName()` in the alpaca-trading
 * platform repo, with one deliberate difference: that version returns 'paper'
 * for *any* input that isn't 'prod', so a typo silently reads paper data. These
 * are exhaustive over a union instead, so a typo is a type error.
 */

/** How the UI toggle, the deploy pipelines and the manifest blobs name it. */
export type DeploymentEnv = "prod" | "dev";

/** How the `environment` column in the trading database names it. */
export type TradingEnv = "live" | "paper";

export const DEPLOYMENT_ENVS: readonly DeploymentEnv[] = ["prod", "dev"] as const;

/** The default view. Live money is what an operator opens this app to check. */
export const DEFAULT_DEPLOYMENT_ENV: DeploymentEnv = "prod";

/** `'prod' → 'live'`, `'dev' → 'paper'`. The only place this is written. */
export function toTradingEnv(environment: DeploymentEnv): TradingEnv {
  return environment === "prod" ? "live" : "paper";
}

/** `'live' → 'prod'`, `'paper' → 'dev'`. */
export function toDeploymentEnv(environment: TradingEnv): DeploymentEnv {
  return environment === "live" ? "prod" : "dev";
}

/** Narrowing guard for untrusted input — a search param, a cookie, an env var. */
export function isDeploymentEnv(value: unknown): value is DeploymentEnv {
  return value === "prod" || value === "dev";
}

/**
 * Untrusted input → a valid environment, falling back rather than throwing.
 *
 * A mistyped URL should show production data, not a 500. The fallback is the
 * safe direction: showing live figures when dev was meant is visibly wrong to
 * an operator, whereas showing paper figures labelled as live is not.
 */
export function parseDeploymentEnv(
  value: unknown,
  fallback: DeploymentEnv = DEFAULT_DEPLOYMENT_ENV,
): DeploymentEnv {
  return isDeploymentEnv(value) ? value : fallback;
}

/**
 * Manifest blob name for an environment.
 *
 * The environment is carried by the blob *path*, never by the file's contents —
 * the platform repo rejects a manifest containing an `environment` field for
 * exactly this reason. Both blobs live in the same container, verified against
 * live storage.
 */
export function deployedBlobName(environment: DeploymentEnv): string {
  return `deployed.${environment}.json`;
}

/** Blob container holding both manifests. */
export const DEPLOYED_CONTAINER = "deployments";

/**
 * Kill-switch key in `platform_controls.control_key`.
 *
 * Uses the DEPLOYMENT vocabulary, not the SQL one: the platform's kill-switch
 * builds `trading_halted_${ENVIRONMENT}` where ENVIRONMENT is 'dev' | 'prod'.
 * The only row that exists today is `trading_halted_prod`. A key built from the
 * SQL vocabulary — `trading_halted_live` — matches nothing and would report
 * every environment as running, including a halted one.
 *
 * Absence of a row means "not halted": the platform only writes the row when
 * the switch is first thrown.
 */
export function haltControlKey(environment: DeploymentEnv): string {
  return `trading_halted_${environment}`;
}

/** Value of `platform_controls.value` that means trading is stopped. */
export const HALTED_VALUE = "true";
