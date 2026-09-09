# OneCrate — Authentication & Session Architecture

How auth works in this app, and why each decision was made. Written for whoever
touches it next, including future me.

Stack: **Better Auth 1.7.2** on **Azure SQL** (kysely `MssqlDialect` + tedious +
tarn), Next.js 16 App Router, deployed to Azure Container Apps.

---

## 1. The shape

```
browser
  │  session_token cookie (HttpOnly, Secure, SameSite=lax, host-only on www)
  │  session_data cookie  (signed 60s cache)
  ▼
src/proxy.ts ──────── optimistic check ── cookie presence only, no I/O
  │                                        redirects unauthenticated → /login
  ▼
page / server action
  │
  ▼
src/lib/dal.ts ────── authoritative check ── verifySession() hits the session table
  │
  ▼
data
```

Two tiers, deliberately. Proxy runs on **every** request including prefetches, so
a database round-trip there is paid on links the user never clicks. It only reads
the cookie. The real check lives next to the data.

---

## 2. Why Better Auth rather than a hand-rolled JWT

The original plan was the Next.js guide's stateless `jose` JWT. It was replaced
because of where this app is going: a handful of operators now, a SaaS platform
later.

The expensive thing to retrofit is **not** the auth mechanism — swapping a
password check is a day's work. It's **tenancy**: an `org_id` on every table and
every query. Retrofitting that across live trade and snapshot tables, with real
money flowing through them, is the migration worth avoiding.

Better Auth's `organization()` plugin ships that boundary as tables
(`organization`, `member`, `invitation`) and puts `activeOrganizationId` on the
session. So the tenant boundary exists from the first row, with one org today.

It also brought a session model that a self-signed JWT cannot match — see next.

---

## 3. Session model: database-backed, with a signed cookie cache

A `session` row is the source of truth; the cookie carries a token.

**Why not stateless JWT:** revocation. A signed JWT stays valid until it expires
no matter what the server thinks, so "log out every device" is impossible. With a
session row, deleting it ends the session immediately.

**The cookie cache** (`session.cookieCache`) signs a short-lived copy of the
session into a second cookie so Proxy's optimistic check costs no SQL.

**`maxAge: 60` is a security parameter, not a performance one.** A revoked
session stays usable on a device until its cached copy expires. Sixty seconds
bounds that window. Raising it trades revocation latency for query volume.

| Setting | Value | Note |
| --- | --- | --- |
| `expiresIn` | 7 days | |
| `updateAge` | 1 day | expiry refreshes once a day of use |
| `cookieCache.maxAge` | 60s | bounds the revocation gap |

---

## 4. Authorization: the DAL is the real boundary

`src/lib/dal.ts` exports `verifySession()` (redirects when absent) and
`optionalSession()` (returns null — for public pages that render differently when
signed in). Both wrapped in React's `cache()`, so several components in one
render pass cost one lookup.

**Auth checks do not go in layouts.** A layout cannot gate rendering: route
segments and parallel slots are rendered by the router regardless, and still
appear in the RSC payload. A layout that hides children does not stop them from
running. So every protected read calls `verifySession()` itself.

Server Actions and Route Handlers are public entry points and get the same
treatment — a UI that hides a button is not authorization.

---

## 5. Tenancy

The session carries `activeOrganizationId`. `verifySession()` returns it as
`orgId`, and every data query is meant to be scoped by it **from day one**, even
though exactly one organization exists.

Today that filter is a no-op. It's there so that onboarding a second tenant is a
data change, not a query-layer rewrite.

---

## 6. Canonical origin and cookie scope

`www.onecrate.io` is canonical; the apex 308-redirects to it. This is enforced in
`src/proxy.ts` and everything hostname-dependent reads `src/lib/site.ts`.

**Why it matters for auth specifically:** the session cookie is host-only. A
session set on `www.onecrate.io` is *not* sent to `onecrate.io`. If both hosts
served the app, the symptom would be a silent, unexplained logout — not an error.
The redirect is what prevents that.

`baseURL` and `trustedOrigins` are pinned to `APP_ORIGIN` rather than inferred
from request headers, because behind Container Apps ingress the app sees plain
http on an internal port.

---

## 7. Three gotchas, each of which cost real debugging

### Better Auth silently falls back to a default signing secret

When `BETTER_AUTH_SECRET` is unset it logs an error and **keeps running** using a
known default. Sessions work; they are just forgeable by anyone aware of the
default. This is the most dangerous failure mode here because it is invisible.

`src/instrumentation.ts` turns it into a hard startup failure. Do not soften that
check.

### `req.nextUrl` does not reflect forwarded headers

Even with `X-Forwarded-Proto: https` set, redirects built from `req.nextUrl`
emitted `http://127.0.0.1:3000/login` — the internal container address, over http
where the session cookie is `Secure`.

`redirectBase()` in `src/proxy.ts` builds from the canonical origin instead, and
falls back to the request origin only for hosts served directly: localhost, and
the app's own `*.azurecontainerapps.io` FQDN.

That FQDN allowance exists because there is only one deployment — it is the only
way to inspect the app before the onecrate.io records exist. Note that **signing
in there does not work**: `trustedOrigins` is pinned to `APP_ORIGIN`, so an auth
POST from the FQDN is rejected. It proves the container runs and serves; it is
not a second front door.

### Better Auth's published MSSQL sample does not typecheck

It puts `TYPES` at the top level of the dialect config. On kysely 0.28 it belongs
**inside** the `tedious` object. The `DateTime → DateTime2` override matters:
default `DateTime` lacks the precision the session expiry columns need.

---

## 8. Account provisioning

**Public signup is disabled** (`emailAndPassword.disableSignUp: true`). Open
signup would put account creation on a page showing live P&L.

Accounts are created by `scripts/seed-operator.ts`, which builds its **own**
Better Auth instance against the same database with signup enabled — same tables,
same password hashing, no reaching into internals that shift between versions.
The organization is created via `createOrganization` in system-action mode
(passing `userId` with no session), which is public API.

```bash
npm run auth:migrate    # create tables (Better Auth CLI)
npm run seed:operator   # SEED_EMAIL / SEED_PASSWORD from the environment
```

Credentials come from the environment, not argv, so the password never lands in
shell history or the process list.

**Login errors do not distinguish unknown-email from wrong-password.** That
difference tells an attacker which addresses are real accounts.

---

## 9. Files

| File | Role |
| --- | --- |
| `src/lib/auth.ts` | Better Auth instance. Session policy, plugins, disabled signup. |
| `src/lib/auth-db.ts` | Azure SQL dialect. Separate module so scripts reuse the exact connection rather than redefining it. |
| `src/lib/dal.ts` | `verifySession()` / `optionalSession()`. The authoritative boundary. |
| `src/lib/site.ts` | Canonical origin. The only place the hostname lives. |
| `src/proxy.ts` | Host canonicalization + optimistic auth pre-filter. |
| `src/instrumentation.ts` | Startup env validation. Refuses to boot when misconfigured. |
| `src/app/actions/auth.ts` | `login` / `logout` Server Actions. |
| `src/app/api/auth/[...all]/route.ts` | Better Auth handler mount. |
| `src/app/login/` | Login page + client form. |
| `scripts/seed-operator.ts` | Account and organization provisioning. |

---

## 10. Environment

| Variable | Notes |
| --- | --- |
| `APP_ORIGIN` | Canonical origin. Must be https in production or the app refuses to start. |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`. Never optional — see §7. |
| `AUTH_DB_SERVER` | Azure SQL host |
| `AUTH_DB_NAME` | Auth database |
| `AUTH_DB_USER` / `AUTH_DB_PASSWORD` | Auth database credentials |
| `AUTH_DB_PORT` | Defaults to 1433 |

Auth tables sit on the same Azure SQL server as trade data but use **separate
credentials** and their own connection, rather than borrowing
`TRADE_TRACKER_DB_CONNECTION_STRING`.

TLS is required: `encrypt: true`, `trustServerCertificate: false`. Better Auth's
sample sets `trustServerCertificate: true` — that is for a local instance with a
self-signed cert and would disable verification against Azure.

The Azure SQL firewall must allow the Container App's outbound IP, or every
sign-in fails.

---

## 11. Known gaps

- **No logout UI.** The `logout` action exists; nothing in the rail calls it yet.
- **No password reset or email verification.** Fine while accounts are
  hand-provisioned; both are required before this is a real SaaS.
- **No MFA.** Better Auth has a `two-factor` plugin when it's wanted.
- **Rate limiting on `/login` is Better Auth's default.** Not yet tuned or
  verified against a real attempt.
