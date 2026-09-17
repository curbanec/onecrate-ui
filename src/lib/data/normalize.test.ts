import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  toBoolean,
  toBooleanOrNull,
  toDateOnly,
  toDateOnlyOrNull,
  toIsoString,
  toNumber,
  toNumberOrNull,
  toRequiredString,
  toStringOrNull,
} from "./normalize";

/**
 * These run under TZ=America/New_York (see the `test` script in package.json).
 * That is deliberate: the date tests below are the ones that would pass in UTC
 * and fail for every real user, so pinning a negative-offset zone is what makes
 * them worth running.
 */

describe("toNumberOrNull", () => {
  test("null and undefined become null, never zero", () => {
    // The single most important case in this file. Number(null) === 0, so a
    // missing allocation would silently render as $0 — a figure the platform
    // never reported.
    assert.equal(toNumberOrNull(null), null);
    assert.equal(toNumberOrNull(undefined), null);
  });

  test("zero survives as zero", () => {
    // The mirror of the case above: a real zero must not become null either.
    assert.equal(toNumberOrNull(0), 0);
    assert.equal(toNumberOrNull("0"), 0);
    assert.equal(toNumberOrNull(-0), -0);
  });

  test("numeric strings parse, including trailing-zero decimals", () => {
    assert.equal(toNumberOrNull("-12.3400"), -12.34);
    assert.equal(toNumberOrNull("123.45"), 123.45);
    assert.equal(toNumberOrNull("  42  "), 42);
  });

  test("BIGINT strings parse — the shape tedious actually returns", () => {
    // Verified against the live view: holding_period_ms comes back as a string.
    assert.equal(toNumberOrNull("21461201"), 21461201);
    assert.equal(toNumberOrNull("267"), 267);
  });

  test("numbers pass through", () => {
    assert.equal(toNumberOrNull(123.45), 123.45);
    assert.equal(toNumberOrNull(-11.119), -11.119);
  });

  test("bigint values convert within safe range", () => {
    // Written as a call rather than the `21461201n` literal, which requires an
    // ES2020 target; this project compiles to ES2017.
    assert.equal(toNumberOrNull(BigInt("21461201")), 21461201);
  });

  test("non-numeric strings throw", () => {
    assert.throws(() => toNumberOrNull("abc"), TypeError);
    assert.throws(() => toNumberOrNull("12abc"), TypeError);
  });

  test("empty and whitespace strings throw rather than becoming zero", () => {
    // Number("") === 0 and Number("   ") === 0. Both are empty, neither is zero.
    assert.throws(() => toNumberOrNull(""), TypeError);
    assert.throws(() => toNumberOrNull("   "), TypeError);
  });

  test("non-finite numbers throw", () => {
    assert.throws(() => toNumberOrNull(NaN), TypeError);
    assert.throws(() => toNumberOrNull(Infinity), TypeError);
    assert.throws(() => toNumberOrNull(-Infinity), TypeError);
  });

  test("integers beyond 2^53 throw instead of silently losing precision", () => {
    // Number("9007199254740993") is finite but wrong. A BIGINT column can
    // legitimately hold this, so it must fail loudly.
    assert.throws(() => toNumberOrNull("9007199254740993"), TypeError);
  });

  test("booleans and objects throw — a bit is not a number", () => {
    assert.throws(() => toNumberOrNull(true), TypeError);
    assert.throws(() => toNumberOrNull({}), TypeError);
    assert.throws(() => toNumberOrNull([]), TypeError);
  });
});

describe("toNumber", () => {
  test("passes through a value", () => {
    assert.equal(toNumber("200"), 200);
    assert.equal(toNumber(0), 0);
  });

  test("throws on null, because the column was declared NOT NULL", () => {
    assert.throws(() => toNumber(null), TypeError);
    assert.throws(() => toNumber(undefined), TypeError);
  });
});

describe("toDateOnly", () => {
  test("a UTC-midnight Date keeps its calendar day", () => {
    // tedious returns a DATE column as midnight UTC. Reading it with local
    // getters in any negative-offset zone yields the PREVIOUS day, which would
    // shift every snapshot_date in the app by one — consistently enough to look
    // correct. This test fails if the implementation stops using UTC getters.
    assert.equal(toDateOnly(new Date("2026-09-14T00:00:00.000Z")), "2026-09-14");
    assert.equal(toDateOnly(new Date("2026-07-20T00:00:00.000Z")), "2026-07-20");
  });

  test("pads single-digit months and days", () => {
    assert.equal(toDateOnly(new Date("2026-01-05T00:00:00.000Z")), "2026-01-05");
  });

  test("an already-formatted string passes through untouched", () => {
    assert.equal(toDateOnly("2026-09-14"), "2026-09-14");
  });

  test("invalid input throws", () => {
    assert.throws(() => toDateOnly(new Date("nonsense")), TypeError);
    assert.throws(() => toDateOnly("14/09/2026"), TypeError);
    assert.throws(() => toDateOnly(null), TypeError);
  });

  test("the nullable variant preserves null", () => {
    assert.equal(toDateOnlyOrNull(null), null);
    assert.equal(toDateOnlyOrNull(undefined), null);
    assert.equal(toDateOnlyOrNull(new Date("2026-09-14T00:00:00.000Z")), "2026-09-14");
  });
});

describe("toIsoString", () => {
  test("converts a Date to ISO 8601", () => {
    assert.equal(
      toIsoString(new Date("2026-09-15T10:11:12.000Z")),
      "2026-09-15T10:11:12.000Z",
    );
  });

  test("invalid input throws", () => {
    assert.throws(() => toIsoString("2026-09-15"), TypeError);
    assert.throws(() => toIsoString(null), TypeError);
  });
});

describe("toBoolean", () => {
  test("passes booleans through", () => {
    assert.equal(toBoolean(true), true);
    assert.equal(toBoolean(false), false);
  });

  test("accepts 0 and 1, which a widened BIT can produce", () => {
    assert.equal(toBoolean(1), true);
    assert.equal(toBoolean(0), false);
  });

  test("rejects anything else", () => {
    assert.throws(() => toBoolean("true"), TypeError);
    assert.throws(() => toBoolean(null), TypeError);
    assert.throws(() => toBoolean(2), TypeError);
  });

  test("the nullable variant preserves null", () => {
    assert.equal(toBooleanOrNull(null), null);
    assert.equal(toBooleanOrNull(undefined), null);
    assert.equal(toBooleanOrNull(true), true);
    assert.equal(toBooleanOrNull(false), false);
  });
});

describe("toStringOrNull", () => {
  test("preserves null", () => {
    assert.equal(toStringOrNull(null), null);
    assert.equal(toStringOrNull(undefined), null);
  });

  test("trims, and collapses empty to null", () => {
    assert.equal(toStringOrNull("  alpaca  "), "alpaca");
    assert.equal(toStringOrNull(""), null);
    assert.equal(toStringOrNull("   "), null);
  });

  test("carries the mark_source values the view actually produces", () => {
    assert.equal(toStringOrNull("alpaca"), "alpaca");
    assert.equal(toStringOrNull("carried"), "carried");
    assert.equal(toStringOrNull("cache"), "cache");
  });

  test("rejects non-strings", () => {
    assert.throws(() => toStringOrNull(42), TypeError);
  });

  test("toRequiredString throws where the nullable variant would return null", () => {
    assert.equal(toRequiredString("live"), "live");
    assert.throws(() => toRequiredString(null), TypeError);
    assert.throws(() => toRequiredString(""), TypeError);
  });
});
