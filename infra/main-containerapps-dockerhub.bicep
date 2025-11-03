// Main Bicep - Deploy usando Container Apps Free Tier + Docker Hub
// CUSTO: $0/mês (dentro do free tier de 180k vCPU-sec + 360k GiB-sec)

targetScope = 'resourceGroup'

@description('Nome do projeto (prefixo para recursos)')
param projectName string = 'nola'

@description('Localização dos recursos')
param location string = resourceGroup().location

@description('Ambiente (dev, staging, prod)')
@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string = 'dev'

@description('Connection string completa do PostgreSQL existente')
@secure()
param databaseUrl string

@description('Seu username do Docker Hub')
param dockerHubUsername string

@description('Nome da imagem no Docker Hub (ex: nola-backend)')
param dockerImageName string = 'nola-backend'

@description('Origens permitidas para CORS (separadas por vírgula)')
param allowOrigins string = '*'

// Tags comuns para todos os recursos
var commonTags = {
  project: projectName
  environment: environment
  managedBy: 'bicep'
  costProfile: 'free-tier'
}

var containerAppEnvName = '${projectName}-${environment}-env'
var containerAppName = '${projectName}-${environment}-backend'

// ========== Log Analytics Workspace (necessário para Container Apps) ==========
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${projectName}-${environment}-logs'
  location: location
  tags: commonTags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// ========== Container Apps Environment ==========
resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppEnvName
  location: location
  tags: commonTags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ========== Container App (Backend FastAPI via Docker Hub) ==========
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  tags: commonTags
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: []  // Docker Hub público não precisa de credenciais
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: '${dockerHubUsername}/${dockerImageName}:latest'
          resources: {
            cpu: json('0.25')  // Free tier: até 180k vCPU-sec/mês
            memory: '0.5Gi'    // Free tier: até 360k GiB-sec/mês
          }
          env: [
            {
              name: 'DATABASE_URL'
              value: databaseUrl
            }
            {
              name: 'ALLOW_ORIGINS'
              value: allowOrigins
            }
            {
              name: 'STATEMENT_TIMEOUT'
              value: '15s'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0  // Scale to zero quando não usado (economiza free tier)
        maxReplicas: 1
      }
    }
  }
}

// ========== Static Web App Free (Frontend React) ==========
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: '${projectName}-${environment}-frontend'
  location: location
  tags: commonTags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    // repositoryUrl será configurado via GitHub Actions
    buildProperties: {
      appLocation: '/frontend'
      apiLocation: ''
      outputLocation: 'dist'
    }
  }
}

// ========== Outputs ==========
output backendUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output backendName string = containerApp.name
output frontendUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output frontendName string = staticWebApp.name
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey

// ========== Análise de Custo Free Tier ==========
// Container Apps Free Tier:
// - 180,000 vCPU-sec/mês
// - 360,000 GiB-sec/mês
// - 2 milhões requests/mês
//
// Com 0.25 vCPU e 0.5 GB:
// - vCPU: 180k sec ÷ 0.25 = 720k segundos = 200 horas/mês
// - Memory: 360k GiB-sec ÷ 0.5 = 720k segundos = 200 horas/mês
// - Com scale-to-zero: suficiente para testes e demos!
//
// Static Web Apps: $0 (Always Free)
// PostgreSQL: $0 (seu free tier)
// Log Analytics: ~$2.30/GB (primeiros 5GB/mês grátis)
//
// CUSTO ESTIMADO: $0-2/mês (dependendo dos logs)
