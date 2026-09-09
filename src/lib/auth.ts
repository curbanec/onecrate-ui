import "server-only";

import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

import { createMssqlDialect } from "./auth-db";
import { canonicalOrigin } from "./site";

/**
 * Auth server instance.
 *
 * Session model is Better Auth's, not a hand-rolled JWT: a `session` row is the
 * source of truth and the cookie carries a token. That buys revocation — "log
 * out every device" is impossible with a self-signed stateless token, since a
 * signed JWT stays valid until it expires no matter what the server thinks.
 *
 * `cookieCache` then signs a short-lived copy of the session into a second
 * cookie so Proxy can do the optimistic check on every request without a SQL
 * round-trip. Optimistic is all it is — the authoritative check lives in the
 * DAL, next to the data (see lib/dal.ts).
 */
export const auth = betterAuth({
  database: { dialect: createMssqlDialect(), type: "mssql" },

  /**
   * `secret` is intentionally not passed. Better Auth reads BETTER_AUTH_SECRET
   * from the environment at runtime; naming it here would evaluate at module
   * load and fail `next build`, which runs without runtime secrets.
   *
   * When it is missing Better Auth falls back to a DEFAULT secret rather than
   * failing, which would make every session forgeable — instrumentation.ts
   * refuses to start the server in that case.
   */

  /**
   * Pinned to the canonical origin rather than inferred from request headers.
   * Behind the Container Apps ingress the app sees http on an internal port, so
   * an inferred base URL would generate http callbacks and mixed-content
   * failures. This is the deterministic fix for the forwarded-protocol problem.
   */
  baseURL: canonicalOrigin(),
  trustedOrigins: [canonicalOrigin()],

  emailAndPassword: {
    enabled: true,
    /**
     * Fewer than ten operators, all provisioned deliberately. Open signup would
     * put account creation on a page showing live P&L.
     *
     * Accounts are created by scripts/seed-operator.ts, which builds its own
     * instance against the same database with this flag off.
     */
    disableSignUp: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh the expiry once a day of use
    cookieCache: {
      enabled: true,
      // Short, because a revoked session stays usable on a device until its
      // cached copy expires. 60s bounds that window.
      maxAge: 60,
    },
  },

  /**
   * Tenancy from the first row. One org today, but the session carries
   * activeOrganizationId and every Fleet query is scoped by it from day one —
   * retrofitting a tenant boundary across live trade and snapshot tables later
   * is the migration worth avoiding.
   */
  plugins: [organization(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
