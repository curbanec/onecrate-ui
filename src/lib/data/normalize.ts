/**
 * Driver value → domain value.
 *
 * The one place raw column values are converted. Everything downstream receives
 * `number | null`, `string | null` or `boolean` — never a driver artifact.
 *
 * Deliberately NOT marked `server-only`: these are pure functions over plain
 * values, with no I/O, no secrets and no `process.env`. That keeps them unit
 * testable outside Next, which matters because they are the layer most likely
 * to be quietly wrong. `server-only` belongs on the modules that actually hold
 * a connection or read a session.
 *
 * Why these throw rather than returning null on bad input: a value that *should*
 * be numeric but isn't is a schema or driver mismatch — a bug. Coercing it to
 * null would render an em dash, which in this UI is a factual claim that the
 * platform had no value. Better a loud failure than a quiet lie (§6.7).
 */

/** Values SQL Server can hand back for a column that is absent. */
type Nullish = null | undefined;

function isNullish(value: unknown): value is Nullish {
  return value === null || value === undefined;
}

/**
 * A whole-number string, e.g. what tedious returns for a BIGINT column.
 * Anything with a decimal point or exponent is excluded so the safe-integer
 * check below doesn't reject legitimately rounded decimals.
 */
const INTEGRAL = /^-?\d+$/;

/**
 * Numeric column → `number | null`.
 *
 * Handles the two shapes this driver actually produces (verified against the
 * live views, not assumed):
 *
 *   - DECIMAL/NUMERIC/MONEY/FLOAT/INT → already a JS number
 *   - BIGINT                          → a STRING, e.g. "21461201"
 *
 * The BIGINT case is the one that bites. `holding_period_ms` and the six
 * `*_latency_ms` columns are BIGINT, so they arrive as strings and would flow
 * into a `number`-typed prop unnoticed by TypeScript.
 *
 * Note the ordering: nullish is checked FIRST, because `Number(null)` is 0 and
 * that single coercion would turn "no position that day" into "zero dollars".
 */
export function toNumberOrNull(value: unknown): number | null {
  if (isNullish(value)) return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Expected a finite number, got ${value}.`);
    }
    return value;
  }

  if (typeof value === "bigint") {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new TypeError(`BigInt ${value} exceeds safe integer precision.`);
    }
    return Number(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    // Number("") is 0 and Number("  ") is 0. Both are empty, neither is zero.
    if (trimmed === "") {
      throw new TypeError("Expected a numeric string, got an empty string.");
    }

    const parsed = Number(trimmed);

    if (!Number.isFinite(parsed)) {
      throw new TypeError(`Expected a numeric string, got ${JSON.stringify(value)}.`);
    }

    // A BIGINT beyond 2^53 parses to a *finite* but silently wrong number.
    // Only applied to integral strings: "-12.3400" is legitimately imprecise
    // and must not be rejected for it.
    if (INTEGRAL.test(trimmed) && !Number.isSafeInteger(parsed)) {
      throw new TypeError(
        `Integer string ${JSON.stringify(value)} exceeds safe integer precision.`,
      );
    }

    return parsed;
  }

  throw new TypeError(`Cannot convert ${typeof value} to a number.`);
}

/**
 * Non-null numeric column → `number`.
 *
 * For columns the schema declares NOT NULL. A null here means the view changed
 * or the query is wrong, so it throws rather than widening the domain type.
 */
export function toNumber(value: unknown): number {
  const parsed = toNumberOrNull(value);
  if (parsed === null) {
    throw new TypeError("Expected a number, got null.");
  }
  return parsed;
}

/**
 * DATE column → `YYYY-MM-DD`.
 *
 * UTC getters, not local ones. tedious returns a `date` column as a Date at
 * UTC midnight; reading it with `getFullYear()` in any negative-offset zone
 * (i.e. all of the US) yields the *previous* day. Every snapshot_date in the
 * app would be off by one, everywhere, and consistently enough to look correct.
 */
export function toDateOnly(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError("Expected a valid Date, got an invalid one.");
    }
    const year = value.getUTCFullYear().toString().padStart(4, "0");
    const month = (value.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = value.getUTCDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Already in the target shape — pass through rather than round-tripping
  // through Date, which would reintroduce a timezone.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  throw new TypeError(`Cannot convert ${JSON.stringify(value)} to a date.`);
}

/** Nullable DATE column → `YYYY-MM-DD | null`. */
export function toDateOnlyOrNull(value: unknown): string | null {
  return isNullish(value) ? null : toDateOnly(value);
}

/** DATETIME2 column → ISO 8601 string. */
export function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError("Expected a valid Date, got an invalid one.");
    }
    return value.toISOString();
  }

  throw new TypeError(`Cannot convert ${JSON.stringify(value)} to a timestamp.`);
}

/** Nullable DATETIME2 column → ISO 8601 string, or null. */
export function toIsoStringOrNull(value: unknown): string | null {
  return isNullish(value) ? null : toIsoString(value);
}

/**
 * BIT column → `boolean`.
 *
 * tedious already returns a JS boolean for BIT, so this is mostly a guard
 * against a view changing shape underneath us. 0/1 is accepted because an
 * aggregate or a CASE expression can widen a BIT to INT.
 */
export function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1) return true;
  if (value === 0) return false;

  throw new TypeError(`Cannot convert ${JSON.stringify(value)} to a boolean.`);
}

/** Nullable BIT column → `boolean | null`. */
export function toBooleanOrNull(value: unknown): boolean | null {
  return isNullish(value) ? null : toBoolean(value);
}

/**
 * VARCHAR column → `string | null`.
 *
 * An empty string becomes null: for the columns this is used on (`mark_source`,
 * `exit_reason`) an empty string carries no more information than an absent
 * one, and collapsing them here means components have a single missing case.
 */
export function toStringOrNull(value: unknown): string | null {
  if (isNullish(value)) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  throw new TypeError(`Cannot convert ${typeof value} to a string.`);
}

/** Non-null VARCHAR column → `string`. */
export function toRequiredString(value: unknown): string {
  const parsed = toStringOrNull(value);
  if (parsed === null) {
    throw new TypeError("Expected a string, got null or empty.");
  }
  return parsed;
}
