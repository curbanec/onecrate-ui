using '../ui.bicep'

param name = 'onecrate-ui-prod'
param location = 'eastus'

param containerAppEnvironmentName = 'trading-prod-env'

// www is canonical; the apex 308-redirects to it in src/proxy.ts. This is the
// single source of truth for the hostname — auth callbacks, cookie scope, and
// absolute URLs all derive from it. Changing it changes the cookie scope, which
// signs everyone out.
param appOrigin = 'https://www.onecrate.io'

// TODO: fill in once the auth database exists. See infrastructure/README.md §1.
param authDbServer = 'REPLACE-ME.database.windows.net'
param authDbName = 'onecrate-auth'
param authDbUser = 'onecrate_app'

param minReplicas = 1
param maxReplicas = 3

/**
 * EMPTY ON THE FIRST PROD DEPLOY.
 *
 * A managed certificate cannot be issued until DNS points at this app, and DNS
 * cannot point at it until it exists and has an FQDN. So: deploy once with this
 * empty, create the Wix records from the `fqdn` and `staticIp` outputs, then
 * uncomment and deploy again. Full sequence in infrastructure/README.md §2–5.
 *
 * Validation method differs by record shape — www is a CNAME so it validates by
 * CNAME; the apex is a pinned A record (Wix will not delegate nameservers, so no
 * flattening) which leaves TXT validation via the asuid record.
 */
param customDomains = []
// param customDomains = [
//   { hostname: 'www.onecrate.io', validation: 'CNAME' }
//   { hostname: 'onecrate.io', validation: 'TXT' }
// ]

// Supplied by the pipeline — declared here so the file type-checks against the
// template. Never put real secrets in this file; it is committed.
param containerImage = ''
param acrLoginServer = ''
param acrUsername = ''
param acrPassword = ''
param betterAuthSecret = ''
param authDbPassword = ''
