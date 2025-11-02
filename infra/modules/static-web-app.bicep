// Módulo Bicep: Azure Static Web Apps (Frontend)
// Tier Free (100 GB bandwidth/mês, suficiente para MVP)

@description('Localização do recurso')
param location string

@description('Nome do projeto')
param projectName string

@description('Ambiente')
param environment string

@description('URL do backend (Container Apps)')
param backendUrl string

@description('Tags do recurso')
param tags object

// Nome do Static Web App
var swaName = '${projectName}-${environment}-frontend'

resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: swaName
  location: location
  tags: tags
  sku: {
    name: 'Free' // Tier gratuito
    tier: 'Free'
  }
  properties: {
    repositoryUrl: '' // Será configurado via GitHub Actions
    branch: '' // Será configurado via GitHub Actions
    buildProperties: {
      appLocation: 'frontend' // Pasta do código frontend
      apiLocation: '' // Sem Azure Functions
      outputLocation: 'dist' // Output do Vite
    }
    stagingEnvironmentPolicy: 'Enabled' // Permite preview branches
  }
}

// Configuração de ambiente (variável build-time)
resource swaConfig 'Microsoft.Web/staticSites/config@2023-01-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    VITE_API_BASE_URL: 'https://${backendUrl}' // URL do backend
  }
}

output defaultHostname string = staticWebApp.properties.defaultHostname
output swaName string = staticWebApp.name
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey
