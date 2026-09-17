import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  executorHref,
  executorKey,
  parseExecutorKey,
  sameExecutor,
  type ExecutorTriple,
} from "./executor";

/** A real executor, taken from the live deployment manifest. */
const HOOD: ExecutorTriple = {
  strategyName: "gap-fade",
  strategyVersion: "v3",
  instanceId: "instance-hood",
};

describe("executorKey", () => {
  test("composes the manifest's key format", () => {
    // This exact string is a key in deployed.prod.json, which is how a database
    // row joins to its deployed configuration.
    assert.equal(executorKey(HOOD), "gap-fade:v3:instance-hood");
  });

  test("round-trips through parseExecutorKey", () => {
    assert.deepEqual(parseExecutorKey(executorKey(HOOD)), HOOD);
  });
});

describe("parseExecutorKey", () => {
  test("splits the three parts", () => {
    assert.deepEqual(parseExecutorKey("mean-reversion:v2:instance-nvda"), {
      strategyName: "mean-reversion",
      strategyVersion: "v2",
      instanceId: "instance-nvda",
    });
  });

  test("rejects a fourth segment instead of silently truncating it", () => {
    // The platform's own parser accepts this and drops the tail, which would
    // address a different executor than the key names.
    assert.throws(() => parseExecutorKey("a:b:c:d"), /Invalid executor key/);
  });

  test("rejects too few segments", () => {
    assert.throws(() => parseExecutorKey("gap-fade:v3"), /Invalid executor key/);
    assert.throws(() => parseExecutorKey("gap-fade"), /Invalid executor key/);
    assert.throws(() => parseExecutorKey(""), /Invalid executor key/);
  });

  test("rejects empty segments", () => {
    assert.throws(() => parseExecutorKey("gap-fade::instance-hood"), /Invalid executor key/);
    assert.throws(() => parseExecutorKey(":v3:instance-hood"), /Invalid executor key/);
  });
});

describe("sameExecutor", () => {
  test("compares by identity, not reference", () => {
    assert.equal(sameExecutor(HOOD, { ...HOOD }), true);
  });

  test("distinguishes instances of the same strategy version", () => {
    // gap-fade:v3 runs against both HOOD and SNOW. They are different
    // executors with separate allocations.
    assert.equal(sameExecutor(HOOD, { ...HOOD, instanceId: "instance-snow" }), false);
  });

  test("distinguishes versions", () => {
    assert.equal(sameExecutor(HOOD, { ...HOOD, strategyVersion: "v2" }), false);
  });
});

describe("executorHref (provisional)", () => {
  test("builds a single readable path segment", () => {
    assert.equal(executorHref(HOOD), "/executors/gap-fade:v3:instance-hood");
  });

  test("the key is recoverable from the href", () => {
    // Whatever the final URL shape, this property has to hold: the link must
    // identify exactly one executor, reversibly.
    const key = executorHref(HOOD).replace("/executors/", "");
    assert.deepEqual(parseExecutorKey(key), HOOD);
  });
});
