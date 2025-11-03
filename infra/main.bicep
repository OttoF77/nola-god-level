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

@description('Usar banco PostgreSQL existente? Se false, provisiona um novo')
param useExistingPostgres bool = true

@description('Connection string completa do PostgreSQL existente (obrigatória se useExistingPostgres=true)')
@secure()
param existingDatabaseUrl string = ''

@description('Admin do PostgreSQL (usado apenas se useExistingPostgres=false)')
@secure()
param postgresAdminPassword string = ''

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

// ========== PostgreSQL Flexible Server (OPCIONAL - só se useExistingPostgres=false) ==========
module postgres 'modules/postgres.bicep' = if (!useExistingPostgres) {
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
    databaseUrl: useExistingPostgres ? existingDatabaseUrl : 'postgresql://${postgres.outputs.adminUser}:${postgresAdminPassword}@${postgres.outputs.fqdn}:5432/${postgres.outputs.databaseName}?sslmode=require'
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
