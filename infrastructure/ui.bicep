@description('Container App name, e.g. onecrate-ui-dev')
param name string

@description('Azure region')
param location string = resourceGroup().location

@description('Name of the EXISTING Container App Environment to deploy into, e.g. trading-dev-env. Sharing the executors\' environment gives the UI their internal DNS and the same Log Analytics workspace.')
param containerAppEnvironmentName string

@description('Container image, e.g. tradingacrdev.azurecr.io/onecrate-ui:1234')
param containerImage string

@description('ACR login server')
param acrLoginServer string

@description('ACR username')
param acrUsername string

@description('ACR password')
@secure()
param acrPassword string

@description('Canonical origin. Single source of truth for the hostname; must be https in production or the app refuses to start.')
param appOrigin string

@description('Better Auth signing secret. openssl rand -base64 32. When unset Better Auth silently falls back to a DEFAULT secret, so this is never optional.')
@secure()
param betterAuthSecret string

@description('Azure SQL server hosting the auth tables, e.g. onecrate-sql.database.windows.net')
param authDbServer string

@description('Auth database name')
param authDbName string

@description('Auth database user')
param authDbUser string

@description('Auth database password')
@secure()
param authDbPassword string

@description('Hostnames to bind, each as { hostname: string, validation: \'CNAME\' | \'TXT\' | \'HTTP\' }. Leave EMPTY on the first deployment — a managed certificate cannot be issued until DNS points at this app, and DNS cannot point at it until it exists and has an FQDN. See README.md.')
param customDomains array = []

@description('CPU cores per replica')
param cpu string = '0.5'

@description('Memory per replica')
param memory string = '1Gi'

@description('Minimum replicas. 1 rather than 0 because scale-to-zero makes the first visitor pay a cold start, and this is an instrument panel someone opens to check on live money.')
param minReplicas int = 1

@description('Maximum replicas')
param maxReplicas int = 3

var secretNames = {
  acr: 'acr-password'
  authSecret: 'better-auth-secret'
  dbPassword: 'auth-db-password'
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: containerAppEnvironmentName
}

/**
 * Managed certificates, one per hostname. Free, auto-renewing, issued by Azure
 * once domain ownership validates.
 *
 * Validation method is per-domain because the record shapes differ: www is a
 * CNAME at the container app FQDN, so CNAME validation works. The apex cannot be
 * a CNAME (Wix will not delegate nameservers, so no flattening) and is a pinned
 * A record, which leaves TXT validation via the asuid record.
 */
resource certificates 'Microsoft.App/managedEnvironments/managedCertificates@2024-03-01' = [
  for domain in customDomains: {
    name: replace(domain.hostname, '.', '-')
    parent: environment
    location: location
    properties: {
      subjectName: domain.hostname
      domainControlValidation: domain.validation
    }
  }
]

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      secrets: [
        {
          name: secretNames.acr
          value: acrPassword
        }
        {
          name: secretNames.authSecret
          value: betterAuthSecret
        }
        {
          name: secretNames.dbPassword
          value: authDbPassword
        }
      ]
      registries: [
        {
          server: acrLoginServer
          username: acrUsername
          passwordSecretRef: secretNames.acr
        }
      ]
      ingress: {
        // The executors are background workers with no ingress; this is the one
        // component in the environment reachable from the internet.
        external: true
        targetPort: 3000
        transport: 'auto'
        // Ingress terminates TLS and forwards plain http internally. The app does
        // not infer its origin from that — APP_ORIGIN is authoritative.
        allowInsecure: false
        customDomains: [
          for (domain, i) in customDomains: {
            name: domain.hostname
            certificateId: certificates[i].id
            bindingType: 'SniEnabled'
          }
        ]
      }
    }
    template: {
      containers: [
        {
          name: 'onecrate-ui'
          image: containerImage
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: [
            {
              name: 'APP_ORIGIN'
              value: appOrigin
            }
            {
              name: 'AUTH_DB_SERVER'
              value: authDbServer
            }
            {
              name: 'AUTH_DB_NAME'
              value: authDbName
            }
            {
              name: 'AUTH_DB_USER'
              value: authDbUser
            }
            {
              name: 'AUTH_DB_PORT'
              value: '1433'
            }
            {
              name: 'BETTER_AUTH_SECRET'
              secretRef: secretNames.authSecret
            }
            {
              name: 'AUTH_DB_PASSWORD'
              secretRef: secretNames.dbPassword
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 3000
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              // Deliberately does not touch SQL. A probe that fails when the
              // database blips makes the platform restart replicas, turning a
              // degraded read path into an outage.
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: 3000
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

@description('Point the www CNAME at this.')
output fqdn string = containerApp.properties.configuration.ingress.fqdn

@description('Point the apex A record at this. It belongs to the environment, so it survives app redeploys but NOT an environment rebuild.')
output staticIp string = environment.properties.staticIp

output name string = containerApp.name
