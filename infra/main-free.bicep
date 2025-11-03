// Main Bicep - Deploy TOTALMENTE FREE (Always Free tier)
// Serviços: App Service Free F1 (backend), Static Web App Free (frontend), PostgreSQL existente

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

@description('Origens permitidas para CORS (separadas por vírgula)')
param allowOrigins string = '*'

// Tags comuns para todos os recursos
var commonTags = {
  project: projectName
  environment: environment
  managedBy: 'bicep'
  costProfile: 'always-free'
}

// ========== Container Registry (Necessário para armazenar imagens) ==========
// Nota: ACR Basic custa ~$5/mês - não tem free tier permanente
// Alternativa: usar Docker Hub (grátis para repos públicos)
module acr 'modules/acr.bicep' = {
  name: 'acr-deployment'
  params: {
    location: location
    projectName: projectName
    environment: environment
    tags: commonTags
  }
}

// ========== App Service Free F1 (Backend FastAPI) ==========
module appService 'modules/app-service.bicep' = {
  name: 'app-service-deployment'
  params: {
    location: location
    projectName: projectName
    environment: environment
    acrLoginServer: acr.outputs.loginServer
    databaseUrl: databaseUrl
    allowOrigins: allowOrigins
    tags: commonTags
  }
}

// ========== Static Web App Free (Frontend React) ==========
module staticWebApp 'modules/static-web-app.bicep' = {
  name: 'static-web-app-deployment'
  params: {
    location: location
    projectName: projectName
    environment: environment
    backendUrl: appService.outputs.appServiceUrl
    tags: commonTags
  }
}

// ========== Role Assignment: App Service → ACR ==========
// Permite que o App Service puxe imagens do ACR usando Managed Identity
resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.outputs.acrId, appService.outputs.appServicePrincipalId, 'AcrPull')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: appService.outputs.appServicePrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ========== Outputs ==========
output acrLoginServer string = acr.outputs.loginServer
output acrName string = acr.outputs.acrName
output backendUrl string = appService.outputs.appServiceUrl
output backendName string = appService.outputs.appServiceName
output frontendUrl string = staticWebApp.outputs.url
output frontendName string = staticWebApp.outputs.name
output deploymentToken string = staticWebApp.outputs.apiKey

// ========== Notas de Custo ==========
// App Service Free F1: $0 (Always Free)
// Static Web Apps Free: $0 (Always Free)
// PostgreSQL: $0 (usando seu free tier existente 750h/mês)
// ACR Basic: ~$5/mês (ÚNICO CUSTO - considere Docker Hub como alternativa gratuita)
// CUSTO TOTAL: ~$5/mês (ou $0 com Docker Hub)
