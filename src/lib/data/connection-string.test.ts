import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { parseConnectionString } from "./connection-string";

/**
 * The shape the platform actually stores, with the password replaced. Real
 * values are never committed — this is a template, not a credential.
 */
const PLATFORM_SHAPE =
  "Server=tcp:trading-sql.database.windows.net,1433;Initial Catalog=trading-dev;" +
  "Persist Security Info=False;User ID=onecrate_app;Password=placeholder;" +
  "MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;" +
  "Connection Timeout=30;";

describe("parseConnectionString", () => {
  test("parses the platform's connection string shape", () => {
    const parts = parseConnectionString(PLATFORM_SHAPE);

    assert.equal(parts.server, "trading-sql.database.windows.net");
    assert.equal(parts.port, 1433);
    assert.equal(parts.database, "trading-dev");
    assert.equal(parts.userName, "onecrate_app");
    assert.equal(parts.password, "placeholder");
    assert.equal(parts.encrypt, true);
    assert.equal(parts.trustServerCertificate, false);
  });

  test("strips the tcp: prefix and splits the port", () => {
    const parts = parseConnectionString(
      "Server=tcp:example.database.windows.net,1433;Database=d;UID=u;PWD=p;",
    );
    assert.equal(parts.server, "example.database.windows.net");
    assert.equal(parts.port, 1433);
  });

  test("defaults the port when the server carries none", () => {
    const parts = parseConnectionString("Server=example.net;Database=d;UID=u;PWD=p;");
    assert.equal(parts.port, 1433);
  });

  test("accepts the documented synonyms", () => {
    const parts = parseConnectionString(
      "Data Source=example.net;Initial Catalog=trading-dev;User ID=u;Password=p;",
    );
    assert.equal(parts.server, "example.net");
    assert.equal(parts.database, "trading-dev");
    assert.equal(parts.userName, "u");
  });

  test("keys are case-insensitive", () => {
    const parts = parseConnectionString("SERVER=e.net;DATABASE=d;user id=u;PASSWORD=p;");
    assert.equal(parts.database, "d");
    assert.equal(parts.userName, "u");
  });

  test("a password containing '=' survives intact", () => {
    // Splitting on every '=' rather than the first would truncate this, and the
    // failure would look like a wrong password rather than a parsing bug.
    const parts = parseConnectionString("Server=e.net;Database=d;UID=u;PWD=a=b==c;");
    assert.equal(parts.password, "a=b==c");
  });

  test("a password containing ';' cannot be represented — documents the limit", () => {
    // ADO.NET requires such a value to be quoted. Nothing in this app's
    // credentials needs it, but the parser splits on ';' and would truncate.
    const parts = parseConnectionString("Server=e.net;Database=d;UID=u;PWD=a;b;");
    assert.equal(parts.password, "a");
  });

  test("TLS defaults to on and verified when the string omits both flags", () => {
    const parts = parseConnectionString("Server=e.net;Database=d;UID=u;PWD=p;");
    assert.equal(parts.encrypt, true);
    assert.equal(parts.trustServerCertificate, false);
  });

  test("explicit TLS flags are honoured, case-insensitively", () => {
    const parts = parseConnectionString(
      "Server=e.net;Database=d;UID=u;PWD=p;Encrypt=false;TrustServerCertificate=TRUE;",
    );
    assert.equal(parts.encrypt, false);
    assert.equal(parts.trustServerCertificate, true);
  });

  test("names every missing key, and never echoes a value", () => {
    assert.throws(
      () => parseConnectionString("Server=e.net;"),
      (error: Error) => {
        assert.match(error.message, /Initial Catalog/);
        assert.match(error.message, /User ID/);
        assert.match(error.message, /Password/);
        return true;
      },
    );
  });

  test("an empty string throws rather than producing a half-built config", () => {
    assert.throws(() => parseConnectionString(""), /missing/);
  });

  test("a non-numeric port throws", () => {
    assert.throws(
      () => parseConnectionString("Server=e.net,abc;Database=d;UID=u;PWD=p;"),
      /invalid port/,
    );
  });
});
