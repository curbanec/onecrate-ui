# Deploying onecrate.io

Azure Container Apps, deployed into the **same Container App Environment as the
trading executors** so the UI shares their internal DNS and Log Analytics
workspace. The executors have no ingress; this is the one component in the
environment reachable from the internet.

## One deployment, to production

There is no dev deployment of the UI. The PROD/DEV switch in the rail is a
**view toggle** over which dataset you are looking at, not a deployment
boundary — a second environment would be a second copy of the same app showing
the same two views.

The practical consequence: the container app's own `*.azurecontainerapps.io`
FQDN is the only way to inspect a deploy before DNS exists, so `src/proxy.ts`
serves that hostname directly instead of redirecting it to the canonical origin.

---

## The constraint that shapes everything

The domain is registered at **Wix**, which does not permit changing nameservers.
DNS must be managed in Wix's editor until the registration is transferred out,
which cannot happen until **60 days after purchase**. Editing registrant contact
details restarts that clock — leave them alone while waiting.

No nameserver delegation means no CNAME flattening, so the apex cannot follow
Azure's hostname and must be an **A record pointing at a fixed IP**.

### Therefore: `www.onecrate.io` is canonical

The apex is pinned to the Container App Environment's static inbound IP. If that
environment is ever rebuilt, the IP changes and the record goes stale. With `www`
canonical, **a stale apex breaks a redirect rather than the application**.

Everything that hardcodes a hostname — auth callbacks, cookie scope, absolute
links, CORS — uses `www.onecrate.io` only, and reads it from a single env var
(`APP_ORIGIN`). See `src/lib/site.ts`.

---

## Order of operations

Custom domains are chicken-and-egg: the managed certificate cannot be issued
until DNS points at the app, and DNS cannot point at the app until it exists and
has an FQDN. So the first deployment binds no domain.

### 1. Create the auth database

Auth tables are separate from trade data, with separate credentials. **The SQL
server is not in Bicep** — it predates this repo and reaches the executors as a
connection string, so find its name in the portal.

Create a database (`onecrate-auth`) and a user for the app, fill both into
`infrastructure/ui.bicepparam`, then from a machine whose IP is allowed through
the SQL firewall:

```bash
cp .env.example .env.local        # fill in AUTH_DB_* and BETTER_AUTH_SECRET
openssl rand -base64 32           # BETTER_AUTH_SECRET
npm run auth:migrate              # creates user/session/account/organization/member/invitation
npm run seed:operator             # SEED_EMAIL / SEED_PASSWORD in the environment
```

`auth:migrate` is Better Auth's CLI. Run `npm run auth:generate` first if you
want to inspect the SQL before it is applied.

**Also set "Allow Azure services and resources to access this server"** on the
SQL server firewall. Without it the container starts, passes its health probe,
and every sign-in fails — because `/api/health` deliberately does not touch SQL.

### 2. Add the secrets to the variable group

`trading-prod-variables` in Azure DevOps, supplying **`BETTER_AUTH_SECRET`** and
**`AUTH_DB_PASSWORD`** as *secret* variables. Everything non-secret lives in
`infrastructure/ui.bicepparam`.

The group is shared with the trading pipelines (`promote`, `function-deploy`).
Neither key collides with what those already supply, and this app reads only
those two from it.

Authorize the group for this pipeline specifically: Library -> the group ->
Pipeline permissions. Authorization is per-pipeline, so the trading pipelines
already having access does not cover this one — without it the YAML fails to
compile with "Variable group was not found or is not authorized for use",
before any step runs.

The deploy step fails fast if either is unset. That guard is not decoration: an
undefined `$(VAR)` macro survives into the script unsubstituted, and
single-quoted it reaches Bicep as the literal string `"$(VAR)"` with no error —
so a deploy can "succeed" with the session signing key set to a pipeline
template fragment.

### 3. First deployment — no custom domain

Run `build-deploy-pipeline.yml`. It validates, builds, pushes, deploys, and
smoke-tests `/api/health`, then prints the FQDN, the static IP, and the exact
DNS records to create.

`trigger: none`, so starting the pipeline is itself the deliberate act of
deploying to production; there is no separate approval gate.

To deploy by hand instead:

```bash
az deployment group create \
  --resource-group trading-prod \
  --template-file infrastructure/ui.bicep \
  --parameters infrastructure/ui.bicepparam \
  --parameters containerImage=tradingacrdev.azurecr.io/onecrate-ui:<tag> \
               acrLoginServer=tradingacrdev.azurecr.io \
               acrUsername=<user> acrPassword=<password> \
               betterAuthSecret=<secret> authDbPassword=<password>
```

At this point the app is live at `https://<fqdn>` with a valid Azure
certificate. You can browse the splash and `/login`; **signing in will not work
yet**, because Better Auth's `trustedOrigins` is pinned to `APP_ORIGIN`. Reaching
the FQDN proves the container runs, serves, and started without failing its
environment checks.

### 4. Get the validation tokens

In the portal, add `www.onecrate.io` as a custom domain on the container app and
copy the validation token. Repeat for the apex. The token is what the `asuid`
TXT records carry.

### 5. Create the DNS records in Wix

Delete any pre-existing A or CNAME records for the same hosts first — Wix's docs
are explicit that leftover records conflict.

| Type  | Host        | Value                                      |
| ----- | ----------- | ------------------------------------------ |
| CNAME | `www`       | the container app FQDN (output `fqdn`)     |
| TXT   | `asuid.www` | Azure domain validation token              |
| A     | `@`         | environment static inbound IP (`staticIp`) |
| TXT   | `asuid`     | Azure domain validation token for apex     |

Propagation is typically minutes.

### 6. Second deployment — bind the domains

Uncomment the populated `customDomains` block in `infrastructure/ui.bicepparam`
and re-run the pipeline. Validation method differs per record shape: `www` is a
CNAME so it validates by CNAME; the apex is a pinned A record so it validates by
TXT via the `asuid` record.

```bicep
param customDomains = [
  { hostname: 'www.onecrate.io', validation: 'CNAME' }
  { hostname: 'onecrate.io', validation: 'TXT' }
]
```

The container app takes an implicit dependency on the certificates, so ARM
creates and validates them before binding. If DNS is not yet resolving, the
certificate creation fails and the whole deployment rolls back — the app keeps
serving its previous revision.

### 7. Verify

```bash
curl -sI https://onecrate.io/fleet         # expect 308 -> https://www.onecrate.io/fleet
curl -sI https://www.onecrate.io/fleet     # expect 307 -> /login (unauthenticated)
curl -s  https://www.onecrate.io/api/health
```

The apex-to-www redirect is served by the app (`src/proxy.ts`), not by DNS or
ingress. Container Apps has no host-redirect primitive, so it has to land
somewhere — and it is in Proxy rather than `next.config.ts` because
`redirects()` is baked into the routes manifest at build time, while the image is
built once and configured per deployment.

---

## After the 60-day lock

Transfer the registration to Cloudflare or Porkbun. **Recreate every DNS record
at the new provider before the transfer completes** so there is no resolution
gap. Then convert the apex from a pinned A record to a flattened CNAME following
the Azure hostname, which removes the stale-IP failure mode entirely.

At that point the "www is canonical" decision could be revisited — but there is
no reason to; changing it later means changing the cookie scope, which logs
everyone out.

---

## What already exists vs. what is new

| Piece | Status |
| --- | --- |
| Container App Environment | exists — `trading-prod-env`, public (no `vnetConfiguration`), so external ingress works |
| ACR | exists — `tradingacrdev`, shared with the executors despite the name; the repo auto-creates on first push |
| Log Analytics | exists, wired to the environment |
| Azure SQL **server** | exists, outside Bicep |
| Auth **database** and user | new — §1 |
| SQL firewall rule | new — §1 |
| Variable group | new — §2 |
| Container App | new — created by `ui.bicep` |
| Custom domains and certs | new — §4–6. Managed certificates are free |

> **Unverified:** that `trading-prod-env` exists. Prod executor deploys go
> through `executor.bicep`, which does not create environments. Check with
> `az containerapp env list -g trading-prod -o table` before the first run — if
> it is missing, the `existing` lookup in `ui.bicep` fails.

---

## Environment variables

Set as Container App secrets by `ui.bicep`, never as a file in the image.

| Variable | Notes |
| --- | --- |
| `APP_ORIGIN` | Canonical origin. Must be https in production or the app refuses to start. |
| `BETTER_AUTH_SECRET` | **Not optional.** Better Auth falls back to a *default* secret when unset, which makes sessions forgeable. `src/instrumentation.ts` turns that into a startup failure. |
| `AUTH_DB_SERVER` | Azure SQL host |
| `AUTH_DB_NAME` | Auth database |
| `AUTH_DB_USER` | Auth database user |
| `AUTH_DB_PASSWORD` | Auth database password |
| `AUTH_DB_PORT` | Defaults to 1433 |
