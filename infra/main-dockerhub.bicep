// Main Bicep - Deploy 100% GRATUITO usando Docker Hub
// Serviços: App Service Free F1 (backend via Docker Hub), Static Web App Free (frontend), PostgreSQL existente
// CUSTO TOTAL: $0/mês

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
  costProfile: '100-percent-free'
}

var appServicePlanName = '${projectName}-${environment}-plan'
var appServiceName = '${projectName}-${environment}-backend'

// ========== App Service Plan (FREE F1) ==========
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  tags: commonTags
  sku: {
    name: 'F1'  // Free tier - Always Free!
    tier: 'Free'
    size: 'F1'
    family: 'F'
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true  // Linux
  }
}

// ========== App Service (Backend FastAPI via Docker Hub) ==========
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appServiceName
  location: location
  tags: commonTags
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${dockerHubUsername}/${dockerImageName}:latest'
      alwaysOn: false  // Não disponível no Free tier
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
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
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://index.docker.io'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'WEBSITES_PORT'
          value: '8000'
        }
      ]
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
    repositoryUrl: ''  // Será configurado via GitHub Actions
    branch: 'main'
    buildProperties: {
      appLocation: '/frontend'
      apiLocation: ''
      outputLocation: 'dist'
    }
  }
}

// ========== Outputs ==========
output backendUrl string = 'https://${appService.properties.defaultHostName}'
output backendName string = appService.name
output frontendUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output frontendName string = staticWebApp.name
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey

// ========== Resumo de Custos ==========
// App Service Free F1: $0 (Always Free)
// Static Web Apps Free: $0 (Always Free)
// PostgreSQL: $0 (seu free tier 750h/mês)
// Docker Hub: $0 (repositório público)
// 
// 🎉 CUSTO TOTAL: $0/mês
