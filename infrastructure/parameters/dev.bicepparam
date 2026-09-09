using '../ui.bicep'

param name = 'onecrate-ui-dev'
param location = 'eastus'

// Deploy into the executors' existing environment so the UI shares their
// internal DNS and Log Analytics workspace.
param containerAppEnvironmentName = 'trading-dev-env'

// TODO(first deploy): dev has no custom domain, so its canonical origin is the
// container app's own FQDN — which does not exist until after the first deploy.
// Run the pipeline once, take the `fqdn` output it prints, paste it here, and
// re-run. Until then the app will redirect dev traffic at whatever this says.
param appOrigin = 'https://REPLACE-ME.eastus.azurecontainerapps.io'

// TODO: fill in once the auth database exists. See infrastructure/README.md §1.
param authDbServer = 'REPLACE-ME.database.windows.net'
param authDbName = 'onecrate-auth-dev'
param authDbUser = 'onecrate_app'

// Dev is a single replica; no reason to pay for headroom on a paper-trading UI.
param minReplicas = 1
param maxReplicas = 1

// Empty on purpose. Dev is reached at the container app FQDN, which already has
// a certificate. Custom domains are a prod concern.
param customDomains = []

// Supplied by the pipeline — declared here so the file type-checks against the
// template. Never put real secrets in this file; it is committed.
param containerImage = ''
param acrLoginServer = ''
param acrUsername = ''
param acrPassword = ''
param betterAuthSecret = ''
param authDbPassword = ''
