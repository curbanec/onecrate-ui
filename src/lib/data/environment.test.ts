import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DEPLOYMENT_ENV,
  DEPLOYMENT_ENVS,
  deployedBlobName,
  haltControlKey,
  isDeploymentEnv,
  parseDeploymentEnv,
  toDeploymentEnv,
  toTradingEnv,
  type DeploymentEnv,
} from "./environment";

/**
 * The mapping these cover is the one that, if wrong, shows paper results as
 * live money. Cheap tests, very expensive bug.
 */

describe("vocabulary mapping", () => {
  test("prod is live, dev is paper", () => {
    assert.equal(toTradingEnv("prod"), "live");
    assert.equal(toTradingEnv("dev"), "paper");
  });

  test("and back again", () => {
    assert.equal(toDeploymentEnv("live"), "prod");
    assert.equal(toDeploymentEnv("paper"), "dev");
  });

  test("round-trips for every environment", () => {
    for (const environment of DEPLOYMENT_ENVS) {
      assert.equal(toDeploymentEnv(toTradingEnv(environment)), environment);
    }
  });

  test("prod never maps to paper", () => {
    // Stated as its own case because it is the failure that matters: paper
    // figures displayed as live ones are not visibly wrong to an operator.
    assert.notEqual(toTradingEnv("prod"), "paper");
  });
});

describe("parsing untrusted input", () => {
  test("recognises valid values", () => {
    assert.equal(isDeploymentEnv("prod"), true);
    assert.equal(isDeploymentEnv("dev"), true);
  });

  test("rejects the SQL vocabulary — the two are not interchangeable", () => {
    assert.equal(isDeploymentEnv("live"), false);
    assert.equal(isDeploymentEnv("paper"), false);
  });

  test("rejects junk", () => {
    assert.equal(isDeploymentEnv(""), false);
    assert.equal(isDeploymentEnv(null), false);
    assert.equal(isDeploymentEnv(undefined), false);
    assert.equal(isDeploymentEnv("PROD"), false);
  });

  test("falls back to prod rather than throwing on a mistyped URL", () => {
    assert.equal(parseDeploymentEnv("nonsense"), "prod");
    assert.equal(parseDeploymentEnv(undefined), "prod");
    assert.equal(parseDeploymentEnv(null), "prod");
    assert.equal(DEFAULT_DEPLOYMENT_ENV, "prod");
  });

  test("a valid value is never overridden by the fallback", () => {
    assert.equal(parseDeploymentEnv("dev"), "dev");
    assert.equal(parseDeploymentEnv("dev", "prod"), "dev");
  });
});

describe("blob names", () => {
  test("match the blobs that exist in storage", () => {
    assert.equal(deployedBlobName("dev"), "deployed.dev.json");
    assert.equal(deployedBlobName("prod"), "deployed.prod.json");
  });
});

describe("halt control key", () => {
  test("uses the DEPLOYMENT vocabulary, matching the row that exists", () => {
    // The only row in platform_controls today is `trading_halted_prod`. The
    // platform's kill-switch builds the key from ENVIRONMENT ('dev' | 'prod'),
    // not from the SQL environment column.
    assert.equal(haltControlKey("prod"), "trading_halted_prod");
    assert.equal(haltControlKey("dev"), "trading_halted_dev");
  });

  test("never builds a key from the SQL vocabulary", () => {
    // `trading_halted_live` matches no row, so a halted platform would report
    // as running. This asserts the bug stays fixed.
    const keys = DEPLOYMENT_ENVS.map((environment: DeploymentEnv) =>
      haltControlKey(environment),
    );
    assert.equal(keys.includes("trading_halted_live"), false);
    assert.equal(keys.includes("trading_halted_paper"), false);
  });
});
