import { MssqlDialect } from "kysely";
import * as Tedious from "tedious";
import * as Tarn from "tarn";

/**
 * The Azure SQL connection for auth tables.
 *
 * Its own module rather than living in auth.ts so that provisioning scripts can
 * reuse the exact connection definition without importing the configured auth
 * instance — two definitions of the same connection is how a script ends up
 * writing to a different database than the app reads.
 *
 * Auth tables sit on the same server as trade data but are a separate concern
 * with separate credentials, so they get their own connection rather than
 * borrowing TRADE_TRACKER_DB_CONNECTION_STRING. Tedious takes discrete options
 * rather than a connection string, which also keeps each field a distinct
 * Container App secret.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

export function createMssqlDialect(): MssqlDialect {
  return new MssqlDialect({
    tarn: {
      ...Tarn,
      options: {
        min: 0,
        // Container Apps scales replicas horizontally; a small per-replica pool
        // keeps total connections under Azure SQL's limit as replicas multiply.
        max: 10,
      },
    },
    tedious: {
      ...Tedious,
      connectionFactory: () =>
        new Tedious.Connection({
          server: required("AUTH_DB_SERVER"),
          authentication: {
            type: "default",
            options: {
              userName: required("AUTH_DB_USER"),
              password: required("AUTH_DB_PASSWORD"),
            },
          },
          options: {
            database: required("AUTH_DB_NAME"),
            port: Number(process.env.AUTH_DB_PORT ?? 1433),
            // Azure SQL requires TLS. Never set trustServerCertificate here —
            // Better Auth's sample does, but that is for a local instance with
            // a self-signed cert and would disable verification against Azure.
            encrypt: true,
            trustServerCertificate: false,
          },
        }),
      TYPES: {
        ...Tedious.TYPES,
        // Kysely maps DateTime by default; DateTime2 has the range and
        // precision the session expiry columns need. This override belongs
        // inside the `tedious` object — Better Auth's published sample puts it
        // at the top level of the config, where kysely 0.28 rejects it.
        DateTime: Tedious.TYPES.DateTime2,
      },
    },
  });
}
