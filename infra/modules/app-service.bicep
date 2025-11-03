// App Service com Free F1 tier (Always Free para contas estudantis)
// Ideal para backend FastAPI sem consumir crédito

targetScope = 'resourceGroup'

@description('Localização do recurso')
param location string

@description('Nome do projeto (prefixo)')
param projectName string

@description('Ambiente (dev, staging, prod)')
param environment string

@description('Login server do ACR')
param acrLoginServer string

@description('Connection string do PostgreSQL')
@secure()
param databaseUrl string

@description('Origens permitidas para CORS (separadas por vírgula)')
param allowOrigins string = '*'

@description('Tags comuns')
param tags object = {}

var appServicePlanName = '${projectName}-${environment}-plan'
var appServiceName = '${projectName}-${environment}-backend'

// ========== App Service Plan (FREE F1) ==========
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  tags: tags
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

// ========== App Service (Backend FastAPI) ==========
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appServiceName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrLoginServer}/${projectName}-backend:latest'
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
          value: 'https://${acrLoginServer}'
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

// ========== Assign AcrPull role to App Service ==========
// Permite que o App Service puxe imagens do ACR usando Managed Identity
resource acrPullRoleDefinition 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: '7f951dda-4ed3-4680-a7ca-43fe172d538d'  // AcrPull role ID
}

// Nota: O roleAssignment precisa ser feito no escopo do ACR
// Por isso, este será criado no módulo ACR ou manualmente após deploy

// ========== Outputs ==========
output appServiceName string = appService.name
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output appServicePrincipalId string = appService.identity.principalId
