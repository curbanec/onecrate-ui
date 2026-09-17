/**
 * Deployment manifest parsing and validation.
 *
 * The manifest is the source of truth for WHICH executors exist and what
 * capital each is allocated. It is byte-for-byte the config JSON the platform
 * deployed, keyed by `name:version:instance`.
 *
 * Pure module — it validates a string it is handed and never touches blob
 * storage, so it is unit testable outside Next. `blob.ts` does the I/O.
 *
 * The governing rule, taken from the platform's own reader: a manifest that
 * fails validation yields NO executors, never a partial list. A silently
 * shortened manifest drops live executors out of the UI while everything still
 * looks plausible, which is the exact failure this file exists to prevent.
 */

import { parseExecutorKey, type ExecutorTriple } from "./executor";

/**
 * 'missing' is decided by the blob layer (the blob does not exist), not here —
 * parsing a string can only tell you ok, empty or invalid.
 */
export type ManifestStatus = "ok" | "empty" | "missing" | "invalid";

export interface ManifestEntry {
  /** Canonical `name:version:instance`. */
  key: string;
  triple: ExecutorTriple;
  /** Always at least one; `symbol` (singular) is normalized into this. */
  symbols: string[];
  /** Positive, finite. The provisional source for allocated capital. */
  allocatedCapital: number;
  /** Carried verbatim for the expanded card. Null when the entry has none. */
  parameters: Record<string, unknown> | null;
  /**
   * The raw `execution` block, carried through unvalidated beyond the fields
   * above. The UI reads `dataRequirements.timeframe` from it to tell an
   * intraday strategy from a multi-day one, which decides what the signal slot
   * is allowed to draw (§6.2). Passing the block through rather than lifting
   * one field keeps this reader from becoming the authority on a config format
   * the platform owns.
   */
  execution: Record<string, unknown>;
}

export interface ParsedManifest {
  status: Exclude<ManifestStatus, "missing">;
  /** Empty unless status is 'ok'. Never partial. */
  entries: ManifestEntry[];
  /** Why it is invalid, for the page-level state. Null when ok or empty. */
  error: string | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * `execution` carries either `symbols` (array) or `symbol` (single). Both forms
 * appear across deployed configs, so they are read through one place rather
 * than at each call site.
 */
export function manifestSymbols(execution: Record<string, unknown>): string[] {
  const { symbols, symbol } = execution;

  if (Array.isArray(symbols)) {
    const clean = symbols.filter((s): s is string => typeof s === "string" && s !== "");
    if (clean.length > 0) return clean;
  }
  if (typeof symbol === "string" && symbol !== "") return [symbol];

  return [];
}

function invalid(error: string): ParsedManifest {
  return { status: "invalid", entries: [], error };
}

/**
 * Parse and validate a manifest document.
 *
 * Validation covers only what this app depends on — identity, allocation,
 * symbols. Everything else is carried verbatim, because the UI is not the
 * authority on what a strategy's parameters mean.
 */
export function parseManifest(raw: string, source: string): ParsedManifest {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return invalid(`${source} is not valid JSON: ${(error as Error).message}`);
  }

  if (!isPlainObject(parsed)) {
    return invalid(`${source} must be a JSON object keyed by strategy key.`);
  }

  /**
   * The manifest describes *what* runs, never *where*. Environment is carried
   * by the blob path — `deployed.prod.json` — so an `environment` field means
   * the two naming schemes have been merged somewhere upstream. The platform
   * rejects this loudly and so does this.
   */
  if ("environment" in parsed) {
    return invalid(
      `${source} contains a top-level 'environment' field. Environment is carried by the blob path, not the file.`,
    );
  }

  const entries: ManifestEntry[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    const where = `${source} → '${key}'`;

    let triple: ExecutorTriple;
    try {
      triple = parseExecutorKey(key);
    } catch (error) {
      return invalid(`${where}: ${(error as Error).message}`);
    }

    if (!isPlainObject(value)) {
      return invalid(`${where} must be a strategy config object.`);
    }
    if ("environment" in value) {
      return invalid(
        `${where} contains an 'environment' field. Environment is carried by the blob path.`,
      );
    }

    const execution = value.execution;
    if (!isPlainObject(execution)) {
      return invalid(`${where} is missing its 'execution' block.`);
    }

    const allocatedCapital = execution.allocatedCapital;
    if (
      typeof allocatedCapital !== "number" ||
      !Number.isFinite(allocatedCapital) ||
      allocatedCapital <= 0
    ) {
      return invalid(
        `${where} needs a positive finite execution.allocatedCapital, got ${JSON.stringify(allocatedCapital)}.`,
      );
    }

    const symbols = manifestSymbols(execution);
    if (symbols.length === 0) {
      return invalid(`${where} needs execution.symbols (or execution.symbol).`);
    }

    entries.push({
      key,
      triple,
      symbols,
      allocatedCapital,
      parameters: isPlainObject(value.parameters) ? value.parameters : null,
      execution,
    });
  }

  /**
   * `{}` is a legitimate statement of fact: nothing is deployed to this
   * environment. It is NOT the same as the blob being absent, which means the
   * pipeline never uploaded — that is an alarm, and it is 'missing'.
   *
   * `deployed.dev.json` is exactly this today: three bytes, zero executors.
   */
  if (entries.length === 0) {
    return { status: "empty", entries: [], error: null };
  }

  return { status: "ok", entries, error: null };
}
