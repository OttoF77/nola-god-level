// Main Bicep - Orquestra todos os módulos para provisionar a infraestrutura Azure
// Serviços: Container Apps (backend), Static Web App (frontend), PostgreSQL Flexible, ACR

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

@description('Admin do PostgreSQL')
@secure()
param postgresAdminPassword string

// Tags comuns para todos os recursos
var commonTags = {
  project: projectName
  environment: environment
  managedBy: 'bicep'
}

// ========== Container Registry ==========
module acr 'modules/acr.bicep' = {
  name: 'acr-deployment'
  params: {
    location: location
    projectName: projectName
    environment: environment
    tags: commonTags
  }
}

// ========== PostgreSQL Flexible Server ==========
module postgres 'modules/postgres.bicep' = {
  name: 'postgres-deployment'
  params: {
    location: location
    projectName: projectName
    environment: environment
    adminPassword: postgresAdminPassword
    tags: commonTags
  }
}

// ========== Container Apps Environment + Backend ==========
module containerApps 'modules/container-apps.bicep' = {
  name: 'container-apps-deployment'
  params: {
    location: location
    projectName: projectName
    environment: environment
    acrLoginServer: acr.outputs.loginServer
    postgresHost: postgres.outputs.fqdn
    postgresUser: postgres.outputs.adminUser
    postgresPassword: postgresAdminPassword
    postgresDatabase: postgres.outputs.databaseName
    tags: commonTags
  }
}

// ========== Static Web App (Frontend) ==========
module staticWebApp 'modules/static-web-app.bicep' = {
  name: 'static-web-app-deployment'
  params: {
    location: location
    projectName: projectName
    environment: environment
    backendUrl: containerApps.outputs.backendFqdn
    tags: commonTags
  }
}

// ========== Outputs ==========
output acrLoginServer string = acr.outputs.loginServer
output postgresHost string = postgres.outputs.fqdn
output backendUrl string = containerApps.outputs.backendFqdn
output frontendUrl string = staticWebApp.outputs.defaultHostname
