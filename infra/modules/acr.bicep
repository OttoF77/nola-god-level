// Módulo Bicep: Azure Container Registry (ACR)
// Tier Basic ($5/mês) para armazenar imagens Docker do backend

@description('Localização do recurso')
param location string

@description('Nome do projeto')
param projectName string

@description('Ambiente')
param environment string

@description('Tags do recurso')
param tags object

// Nome único do ACR (apenas alfanumérico)
var acrName = toLower('${projectName}${environment}acr')

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Basic' // $5/mês, 10 GiB storage
  }
  properties: {
    adminUserEnabled: true // Habilita credenciais básicas para push/pull
    publicNetworkAccess: 'Enabled'
  }
}

output loginServer string = containerRegistry.properties.loginServer
output acrName string = containerRegistry.name
output acrId string = containerRegistry.id
output adminUsername string = containerRegistry.listCredentials().username
output adminPassword string = containerRegistry.listCredentials().passwords[0].value
