import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { manifestSymbols, parseManifest } from "./manifest";

/**
 * The manifest decides which executors exist at all, so a validation bug here
 * does not corrupt a figure — it removes a live executor from the page. Hence
 * the emphasis on "no partial list".
 */

/** Shaped like the real deployed.prod.json, trimmed. */
const VALID = JSON.stringify({
  "gap-fade:v3:instance-hood": {
    parameters: {
      universal: { positionSize: 0.9, stopLossPercent: 0.03 },
      category: { minGapPercent: 1.0 },
      strategy: { fadeDirection: "down" },
    },
    execution: { symbols: ["HOOD"], allocatedCapital: 200, checkIntervalMs: 60000 },
  },
  "mean-reversion:v2:instance-nvda": {
    parameters: { universal: { positionSize: 0.95 } },
    execution: { symbols: ["NVDA"], allocatedCapital: 200 },
  },
});

describe("parseManifest — the happy path", () => {
  test("parses the real manifest shape", () => {
    const result = parseManifest(VALID, "deployments/deployed.prod.json");

    assert.equal(result.status, "ok");
    assert.equal(result.error, null);
    assert.equal(result.entries.length, 2);

    const hood = result.entries[0]!;
    assert.equal(hood.key, "gap-fade:v3:instance-hood");
    assert.deepEqual(hood.triple, {
      strategyName: "gap-fade",
      strategyVersion: "v3",
      instanceId: "instance-hood",
    });
    assert.deepEqual(hood.symbols, ["HOOD"]);
    assert.equal(hood.allocatedCapital, 200);
  });

  test("parameters are carried verbatim", () => {
    const hood = parseManifest(VALID, "x").entries[0]!;
    assert.deepEqual(hood.parameters, {
      universal: { positionSize: 0.9, stopLossPercent: 0.03 },
      category: { minGapPercent: 1.0 },
      strategy: { fadeDirection: "down" },
    });
  });

  test("an entry without parameters yields null, not {}", () => {
    const raw = JSON.stringify({
      "a:v1:i1": { execution: { symbols: ["X"], allocatedCapital: 100 } },
    });
    assert.equal(parseManifest(raw, "x").entries[0]!.parameters, null);
  });

  test("the singular `symbol` form is normalized", () => {
    const raw = JSON.stringify({
      "a:v1:i1": { execution: { symbol: "TSLA", allocatedCapital: 100 } },
    });
    assert.deepEqual(parseManifest(raw, "x").entries[0]!.symbols, ["TSLA"]);
  });
});

describe("parseManifest — empty is not missing", () => {
  test("`{}` is 'empty', a legitimate statement of fact", () => {
    // deployed.dev.json is exactly this today: 3 bytes.
    const result = parseManifest("{}", "deployments/deployed.dev.json");
    assert.equal(result.status, "empty");
    assert.equal(result.entries.length, 0);
    assert.equal(result.error, null);
  });

  test("whitespace around an empty object still parses", () => {
    assert.equal(parseManifest("  {}\n", "x").status, "empty");
  });
});

describe("parseManifest — the environment field is rejected", () => {
  test("at the top level", () => {
    const raw = JSON.stringify({ environment: "prod", "a:v1:i1": {} });
    const result = parseManifest(raw, "x");
    assert.equal(result.status, "invalid");
    assert.match(result.error!, /top-level 'environment'/);
  });

  test("inside an entry", () => {
    const raw = JSON.stringify({
      "a:v1:i1": { environment: "prod", execution: { symbols: ["X"], allocatedCapital: 1 } },
    });
    const result = parseManifest(raw, "x");
    assert.equal(result.status, "invalid");
    assert.match(result.error!, /'environment' field/);
  });
});

describe("parseManifest — malformed documents", () => {
  test("not JSON", () => {
    const result = parseManifest("not json at all", "x");
    assert.equal(result.status, "invalid");
    assert.match(result.error!, /not valid JSON/);
  });

  test("an array is not a manifest", () => {
    assert.equal(parseManifest("[]", "x").status, "invalid");
  });

  test("null is not a manifest", () => {
    assert.equal(parseManifest("null", "x").status, "invalid");
  });

  test("a bare string is not a manifest", () => {
    assert.equal(parseManifest('"hello"', "x").status, "invalid");
  });
});

describe("parseManifest — entry validation", () => {
  const entry = (execution: unknown) =>
    JSON.stringify({ "a:v1:i1": { execution } });

  test("rejects a malformed key", () => {
    assert.equal(parseManifest(JSON.stringify({ "a:v1": {} }), "x").status, "invalid");
    assert.equal(parseManifest(JSON.stringify({ "a:v1:i1:extra": {} }), "x").status, "invalid");
  });

  test("rejects a missing execution block", () => {
    const result = parseManifest(JSON.stringify({ "a:v1:i1": {} }), "x");
    assert.equal(result.status, "invalid");
    assert.match(result.error!, /missing its 'execution' block/);
  });

  test("rejects a non-positive or non-numeric allocatedCapital", () => {
    for (const value of [0, -100, "200", null, undefined, Number.NaN]) {
      const result = parseManifest(entry({ symbols: ["X"], allocatedCapital: value }), "x");
      assert.equal(result.status, "invalid", `allocatedCapital=${JSON.stringify(value)}`);
    }
  });

  test("rejects an entry with no symbols", () => {
    assert.equal(parseManifest(entry({ allocatedCapital: 100 }), "x").status, "invalid");
    assert.equal(parseManifest(entry({ symbols: [], allocatedCapital: 100 }), "x").status, "invalid");
    assert.equal(parseManifest(entry({ symbol: "", allocatedCapital: 100 }), "x").status, "invalid");
  });
});

describe("parseManifest — never returns a partial list", () => {
  test("one bad entry invalidates the whole manifest", () => {
    // The dangerous alternative is skipping the bad entry: the page would then
    // render a plausible-looking Fleet that is silently missing an executor
    // trading real money.
    const raw = JSON.stringify({
      "gap-fade:v3:instance-hood": {
        execution: { symbols: ["HOOD"], allocatedCapital: 200 },
      },
      "broken:entry": { execution: { symbols: ["X"], allocatedCapital: 1 } },
    });

    const result = parseManifest(raw, "x");
    assert.equal(result.status, "invalid");
    assert.equal(result.entries.length, 0);
  });

  test("a later bad entry still discards the earlier good ones", () => {
    const raw = JSON.stringify({
      "a:v1:i1": { execution: { symbols: ["A"], allocatedCapital: 100 } },
      "b:v1:i1": { execution: { symbols: ["B"], allocatedCapital: 0 } },
    });
    assert.equal(parseManifest(raw, "x").entries.length, 0);
  });
});

describe("manifestSymbols", () => {
  test("prefers the array form", () => {
    assert.deepEqual(manifestSymbols({ symbols: ["A", "B"], symbol: "C" }), ["A", "B"]);
  });

  test("falls back to the singular form", () => {
    assert.deepEqual(manifestSymbols({ symbol: "C" }), ["C"]);
  });

  test("drops non-string entries", () => {
    assert.deepEqual(manifestSymbols({ symbols: ["A", 7, "", null] }), ["A"]);
  });

  test("returns empty when there is nothing usable", () => {
    assert.deepEqual(manifestSymbols({}), []);
    assert.deepEqual(manifestSymbols({ symbols: [] }), []);
  });
});
