import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_FLEET_SCOPE,
  fleetHref,
  isFleetScope,
  parseFleetScope,
} from "./fleet";

/**
 * The Fleet page carries two facts in its URL: which environment's data is shown
 * (`?env=`) and which population (`?scope=`). Both exist in the URL rather than
 * in component state so a screenshot or a shared link records what it shows —
 * paper figures mistaken for live ones, or a survivorship-biased curve mistaken
 * for the full history, are the failures that design prevents.
 *
 * These are pure-function tests because the toggles themselves are Server
 * Components rendering plain links, and the only logic worth pinning is how the
 * query string is assembled.
 */

describe("parseFleetScope", () => {
  test("Current is the default, because live money is what an operator opens this for", () => {
    assert.equal(DEFAULT_FLEET_SCOPE, "current");
    assert.equal(parseFleetScope(undefined), "current");
  });

  test("both scopes round-trip", () => {
    assert.equal(parseFleetScope("si"), "si");
    assert.equal(parseFleetScope("current"), "current");
  });

  test("anything unrecognised falls back rather than throwing", () => {
    // A mistyped URL should render a page, not a 500 — the same rule
    // parseDeploymentEnv follows. A repeated key arrives as an array.
    assert.equal(parseFleetScope("SI"), "current");
    assert.equal(parseFleetScope(""), "current");
    assert.equal(parseFleetScope("inception"), "current");
    assert.equal(parseFleetScope(["si"]), "current");
    assert.equal(parseFleetScope(null), "current");
  });

  test("the guard narrows only the two real values", () => {
    assert.equal(isFleetScope("si"), true);
    assert.equal(isFleetScope("current"), true);
    assert.equal(isFleetScope("everything"), false);
  });

});

describe("fleetHref", () => {
  test("writes both params in a stable order", () => {
    assert.equal(fleetHref("/fleet", { env: "dev", scope: "si" }), "/fleet?env=dev&scope=si");
  });

  test("omits a param that is not set rather than emitting an empty value", () => {
    assert.equal(fleetHref("/fleet", { env: "prod" }), "/fleet?env=prod");
    assert.equal(fleetHref("/fleet", { scope: "si" }), "/fleet?scope=si");
    assert.equal(fleetHref("/fleet"), "/fleet");
  });

  test("switching environment preserves the scope", () => {
    // This is the regression the function exists to prevent. The env toggle used
    // to build `${basePath}?env=${target}` inline, so moving PROD→DEV while
    // viewing SI silently dropped the scope and reset the population to Current
    // — a different question answered without saying so.
    const viewingSi = { env: "prod", scope: "si" };
    assert.equal(
      fleetHref("/fleet", { ...viewingSi, env: "dev" }),
      "/fleet?env=dev&scope=si",
    );
  });

  test("switching scope preserves the environment", () => {
    assert.equal(
      fleetHref("/fleet", { env: "dev", scope: "current" }),
      "/fleet?env=dev&scope=current",
    );
  });

  test("values are encoded, so a hostile param cannot break out of the query", () => {
    assert.equal(
      fleetHref("/fleet", { env: "dev&scope=si" }),
      "/fleet?env=dev%26scope%3Dsi",
    );
  });
});
