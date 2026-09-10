using 'ui.bicep'

param name = 'onecrate-ui'
param location = 'eastus'

// The UI is deployed once, to production. There is no dev deployment: the
// PROD/DEV switch in the rail is a *view* toggle over which dataset you are
// looking at, not a deployment boundary, so a second environment would be a
// second copy of the same app showing the same two views.
param containerAppEnvironmentName = 'trading-prod-env'

// www is canonical; the apex 308-redirects to it in src/proxy.ts. Single source
// of truth for the hostname — auth callbacks, cookie scope, and absolute URLs
// all derive from it. Changing it changes the cookie scope, which signs
// everyone out.
param appOrigin = 'https://www.onecrate.io'

// TODO: fill in once the auth database exists. The SQL server is not in Bicep —
// it predates this repo and is passed to the executors as a connection string,
// so find its name in the portal. See README.md §1.
param authDbServer = 'REPLACE-ME.database.windows.net'
param authDbName = 'onecrate-auth'
param authDbUser = 'onecrate_app'

param minReplicas = 1
param maxReplicas = 3

/**
 * Both hostnames are bound and serving. Keep this list matching what is
 * actually live: the ingress custom-domain list is built from it declaratively,
 * so emptying it or removing an entry UNBINDS that hostname on the next deploy.
 *
 * It was empty for the first deploy only, because of the chicken-and-egg: a
 * managed certificate cannot be issued until DNS points at this app, and DNS
 * cannot point at it until it exists and has an FQDN. Full sequence in
 * README.md §3–5.
 *
 * Validation method differs by record shape — www is a CNAME so it validates by
 * CNAME; the apex is a pinned A record (Wix will not delegate nameservers, so no
 * flattening at the apex) which leaves TXT validation via the asuid record.
 *
 * certificateName adopts the certificate that already exists for that subject.
 * An environment allows only one managed certificate per subject name, so
 * without this the deploy fails with DuplicateManagedCertificateInEnvironment.
 * The names carry a creation timestamp because the portal issued them; a
 * certificate this template creates is named after its hostname instead.
 */
param customDomains = [
  {
    hostname: 'www.onecrate.io'
    validation: 'CNAME'
    certificateName: 'www.onecrate.io-trading--260910171410'
  }
  {
    hostname: 'onecrate.io'
    validation: 'TXT'
    certificateName: 'onecrate.io-trading--260910202327'
  }
]

// Supplied by the pipeline — declared here so the file type-checks against the
// template. Never put real secrets in this file; it is committed.
param containerImage = ''
param acrLoginServer = ''
param acrUsername = ''
param acrPassword = ''
param betterAuthSecret = ''
param authDbPassword = ''
