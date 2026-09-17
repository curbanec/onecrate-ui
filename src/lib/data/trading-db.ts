import "server-only";

import { Kysely, MssqlDialect } from "kysely";
import * as Tedious from "tedious";
import * as Tarn from "tarn";

import { parseConnectionString } from "./connection-string";
import type { TradingDatabase } from "./schema";

/**
 * Connection to the trading database.
 *
 * A SECOND pool, not a reuse of `lib/auth-db.ts`. They share a SQL *server*
 * (`trading-sql.database.windows.net`) but not a database: auth tables live in
 * `onecrate-auth`, trade data in `trading-dev`. A tedious connection is bound to
 * one database at connect time, so one pool cannot serve both.
 *
 * Note the database is named `trading-dev` even though it holds live trading
 * data. That is not a misconfiguration — the platform runs a single database
 * across both environments and separates them with the `environment` column.
 * See `lib/data/environment.ts`.
 *
 * This app is read-only here. Nothing in this module or below it writes.
 */

function createTradingDb(): Kysely<TradingDatabase> {
  const raw = process.env.TRADE_TRACKER_DB_CONNECTION_STRING;
  if (!raw) {
    throw new Error("TRADE_TRACKER_DB_CONNECTION_STRING is not set.");
  }

  const parts = parseConnectionString(raw);

  return new Kysely<TradingDatabase>({
    dialect: new MssqlDialect({
      tarn: {
        ...Tarn,
        options: {
          min: 0,
          // Matches lib/auth-db.ts. Container Apps scales replicas
          // horizontally, so a small per-replica pool keeps total connections
          // under Azure SQL's limit as replicas multiply.
          max: 10,
        },
      },
      tedious: {
        ...Tedious,
        connectionFactory: () =>
          new Tedious.Connection({
            server: parts.server,
            authentication: {
              type: "default",
              options: { userName: parts.userName, password: parts.password },
            },
            options: {
              database: parts.database,
              port: parts.port,
              encrypt: parts.encrypt,
              trustServerCertificate: parts.trustServerCertificate,
            },
          }),
        TYPES: {
          ...Tedious.TYPES,
          // Same override as lib/auth-db.ts: DateTime2 has the range and
          // precision these timestamp columns need.
          DateTime: Tedious.TYPES.DateTime2,
        },
      },
    }),
  });
}

/**
 * Hot-reload survival.
 *
 * `next dev` re-evaluates a module on every save. Without pinning, each reload
 * builds a fresh pool while the previous one still holds its sockets open, and
 * an afternoon of editing exhausts Azure SQL's connection limit. `globalThis`
 * outlives module re-evaluation, so the pool is created once per process.
 *
 * Not applied in production, where the module is evaluated once anyway and a
 * global would only obscure the lifetime.
 */
const globalForTradingDb = globalThis as typeof globalThis & {
  __tradingDb?: Kysely<TradingDatabase>;
};

/**
 * The pooled connection. Lazy on purpose.
 *
 * `next build` collects page data with NODE_ENV=production but WITHOUT runtime
 * secrets, so reading the connection string at module scope would fail the
 * build rather than catch a misconfiguration — the same trap `lib/site.ts`
 * documents for APP_ORIGIN. Creating on first call means the environment is
 * only required when a query actually runs.
 */
export function getTradingDb(): Kysely<TradingDatabase> {
  const existing = globalForTradingDb.__tradingDb;
  if (existing) return existing;

  const db = createTradingDb();

  if (process.env.NODE_ENV !== "production") {
    globalForTradingDb.__tradingDb = db;
  }

  return db;
}
