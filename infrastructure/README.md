# Deploying onecrate.io

Azure Container Apps, deployed into the **same Container App Environment as the
trading executors** so the UI shares their internal DNS and Log Analytics
workspace. The executors have no ingress; this is the one component in the
environment reachable from the internet.

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

Auth tables are separate from trade data, with separate credentials. Create a
database on the existing Azure SQL server, then from a machine whose IP is
allowed through the SQL firewall:

```bash
cp .env.example .env.local        # fill in AUTH_DB_* and BETTER_AUTH_SECRET
openssl rand -base64 32           # BETTER_AUTH_SECRET
npm run auth:migrate              # creates user/session/account/organization/member/invitation
npm run seed:operator             # SEED_EMAIL / SEED_PASSWORD in the environment
```

`auth:migrate` is Better Auth's CLI. Run `npm run auth:generate` first if you
want to inspect the SQL before it is applied.

### 2. First deployment — no custom domain

Run `build-deploy-pipeline.yml` in Azure DevOps with `targetEnvironment: dev`
(or `prod`). It validates, builds, pushes, deploys, and smoke-tests
`/api/health`.

The pipeline needs a variable group per environment —
`onecrate-ui-dev-variables` / `onecrate-ui-prod-variables` — each supplying
**`BETTER_AUTH_SECRET`** and **`AUTH_DB_PASSWORD`** as *secret* variables.
Everything non-secret lives in `infrastructure/parameters/{dev,prod}.bicepparam`.

The deploy step fails fast if either secret is unset. That guard is not
decoration: an undefined `$(VAR)` macro survives into the script unsubstituted,
and single-quoted it reaches Bicep as the literal string `"$(VAR)"` with no
error — so a deploy can "succeed" with the session signing key set to a pipeline
template fragment.

To deploy by hand instead:

```bash
az deployment group create \
  --resource-group trading-dev \
  --template-file infrastructure/ui.bicep \
  --parameters infrastructure/parameters/dev.bicepparam \
  --parameters containerImage=<acr>.azurecr.io/onecrate-ui:<tag> \
               acrLoginServer=<acr>.azurecr.io \
               acrUsername=<user> acrPassword=<password> \
               betterAuthSecret=<secret> authDbPassword=<password>
```

The pipeline prints `fqdn` and `staticIp` at the end. Both are needed next.

#### The dev chicken-and-egg

`APP_ORIGIN` drives the apex→www redirect, the cookie scope, and auth callbacks.
Dev has no custom domain, so its canonical origin *is* the container app FQDN —
which does not exist until after the first deploy. So the first dev run
deliberately has a placeholder in `dev.bicepparam`: run it once, take the `fqdn`
the pipeline prints, paste it in, run again.

Until that is done the app is deployed but redirecting to a host it does not
answer on. The pipeline emits a **warning** rather than failing, because the same
mismatch is expected and temporary during the prod custom-domain rollout below.

### 3. Get the validation tokens

In the portal, add `www.onecrate.io` as a custom domain on the container app and
copy the validation token. Repeat for the apex. The token is what the `asuid`
TXT records carry.

### 4. Create the DNS records in Wix

Delete any pre-existing A or CNAME records for the same hosts first — Wix's docs
are explicit that leftover records conflict.

| Type  | Host        | Value                                    |
| ----- | ----------- | ---------------------------------------- |
| CNAME | `www`       | the container app FQDN (output `fqdn`)   |
| TXT   | `asuid.www` | Azure domain validation token            |
| A     | `@`         | environment static inbound IP (`staticIp`) |
| TXT   | `asuid`     | Azure domain validation token for apex   |

Propagation is typically minutes.

### 5. Second deployment — bind the domains

Uncomment the populated `customDomains` block in
`infrastructure/parameters/prod.bicepparam` and re-run the pipeline. Validation
method differs per record shape: `www` is a CNAME so it validates by CNAME; the
apex is a pinned A record so it validates by TXT via the `asuid` record.

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

Azure then issues free, auto-renewing managed certificates.

### 6. Verify

```bash
curl -sI https://onecrate.io/fleet         # expect 308 → https://www.onecrate.io/fleet
curl -sI https://www.onecrate.io/fleet     # expect 307 → /login (unauthenticated)
curl -s  https://www.onecrate.io/api/health
```

The apex→www redirect is served by the app (`src/proxy.ts`), not by DNS or
ingress. Container Apps has no host-redirect primitive, so it has to land
somewhere — and it is in Proxy rather than `next.config.ts` because
`redirects()` is baked into the routes manifest at build time, while the promote
pipeline ships one image tag to both dev and prod.

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

## Environment variables

Set as Container App secrets by `ui.bicep`, never as a file in the image.

| Variable             | Notes                                                            |
| -------------------- | ---------------------------------------------------------------- |
| `APP_ORIGIN`         | Canonical origin. Must be https in production or the app refuses to start. |
| `BETTER_AUTH_SECRET` | **Not optional.** Better Auth falls back to a *default* secret when unset, which makes sessions forgeable. `src/instrumentation.ts` turns that into a startup failure. |
| `AUTH_DB_SERVER`     | Azure SQL host                                                    |
| `AUTH_DB_NAME`       | Auth database                                                     |
| `AUTH_DB_USER`       | Auth database user                                                |
| `AUTH_DB_PASSWORD`   | Auth database password                                            |
| `AUTH_DB_PORT`       | Defaults to 1433                                                  |

The Azure SQL firewall must allow Azure services, or the Container App's
outbound IP, or the container cannot reach the auth database and every sign-in
fails.
