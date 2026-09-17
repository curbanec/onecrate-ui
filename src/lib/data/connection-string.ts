/**
 * ADO.NET connection string → discrete tedious options.
 *
 * The platform stores one connection string in
 * `TRADE_TRACKER_DB_CONNECTION_STRING` and hands it to the `mssql` package,
 * which parses it internally. Kysely's `MssqlDialect` drives tedious directly
 * and wants discrete fields, so the same secret is parsed here instead. Keeping
 * the variable name identical means the value copies verbatim out of the
 * existing Azure DevOps variable group, with no second credential to rotate.
 *
 * Pure module — it transforms a string it is handed and never reads the
 * environment itself, so it is unit testable outside Next. The module that
 * actually holds the secret and opens a socket is `trading-db.ts`, which is
 * `server-only`.
 */

export interface ConnectionParts {
  server: string;
  port: number;
  database: string;
  userName: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
}

/** Keys as they appear in an ADO.NET connection string, with their synonyms. */
const SYNONYMS: Record<string, string> = {
  server: "server",
  "data source": "server",
  addr: "server",
  address: "server",
  database: "database",
  "initial catalog": "database",
  "user id": "user",
  uid: "user",
  user: "user",
  password: "password",
  pwd: "password",
  encrypt: "encrypt",
  trustservercertificate: "trustservercertificate",
};

const DEFAULT_PORT = 1433;

export function parseConnectionString(raw: string): ConnectionParts {
  const values: Record<string, string> = {};

  for (const segment of raw.split(";")) {
    if (segment.trim() === "") continue;

    // Split on the FIRST '=' only: passwords frequently contain '='.
    const separator = segment.indexOf("=");
    if (separator === -1) continue;

    const key = segment.slice(0, separator).trim().toLowerCase();
    const value = segment.slice(separator + 1).trim();

    const canonical = SYNONYMS[key];
    if (canonical) values[canonical] = value;
  }

  // "tcp:host.database.windows.net,1433" → host + port.
  const rawServer = (values.server ?? "").replace(/^tcp:/i, "");
  const [host, portText] = rawServer.split(",");

  const missing: string[] = [];
  if (!host) missing.push("Server");
  if (!values.database) missing.push("Initial Catalog");
  if (!values.user) missing.push("User ID");
  if (!values.password) missing.push("Password");

  if (missing.length > 0) {
    // Names the missing keys, never the parsed values — this error can reach a
    // log, and the string it came from holds a password.
    throw new Error(`Connection string is missing: ${missing.join(", ")}.`);
  }

  const port = portText === undefined ? DEFAULT_PORT : Number(portText);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Connection string has an invalid port: ${JSON.stringify(portText)}.`);
  }

  return {
    server: host!,
    port,
    database: values.database!,
    userName: values.user!,
    password: values.password!,
    // Azure SQL requires TLS. The connection string's own values are honoured,
    // but the defaults are the secure ones — a string that omits them must not
    // silently downgrade to an unverified connection.
    encrypt: (values.encrypt ?? "true").toLowerCase() !== "false",
    trustServerCertificate:
      (values.trustservercertificate ?? "false").toLowerCase() === "true",
  };
}
