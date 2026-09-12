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

// The one SQL server, shared with the executors. Not in Bicep — it predates this
// repo. Auth lives in its own database on it, apart from the trade data.
param authDbServer = 'trading-sql.database.windows.net'
param authDbName = 'onecrate-auth'
param authDbUser = 'onecrate_app'

param minReplicas = 1
param maxReplicas = 3

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
