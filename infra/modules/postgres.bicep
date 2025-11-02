// Módulo Bicep: Azure Database for PostgreSQL - Flexible Server
// Tier Burstable B1ms (1 vCPU, 2 GiB RAM) para reduzir custos

@description('Localização do recurso')
param location string

@description('Nome do projeto')
param projectName string

@description('Ambiente')
param environment string

@description('Senha do admin do PostgreSQL')
@secure()
param adminPassword string

@description('Tags do recurso')
param tags object

// Configurações do banco
var serverName = '${projectName}-${environment}-pg'
var adminUser = 'pgadmin'
var databaseName = 'challenge_db'

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms' // Burstable: 1 vCPU, 2 GiB RAM (~$12-15/mês)
    tier: 'Burstable'
  }
  properties: {
    version: '15' // PostgreSQL 15
    administratorLogin: adminUser
    administratorLoginPassword: adminPassword
    storage: {
      storageSizeGB: 32 // Suficiente para ~1M vendas
    }
    backup: {
      backupRetentionDays: 7 // Retenção padrão (gratuito)
      geoRedundantBackup: 'Disabled' // Reduz custo
    }
    highAvailability: {
      mode: 'Disabled' // Desabilita HA para reduzir custo
    }
    network: {
      publicNetworkAccess: 'Enabled' // Acesso público com firewall
    }
  }
}

// Firewall: permite conexões do Azure (Container Apps)
resource firewallRuleAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0' // Permite serviços internos do Azure
  }
}

// Banco de dados principal
resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  parent: postgresServer
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

output fqdn string = postgresServer.properties.fullyQualifiedDomainName
output adminUser string = adminUser
output databaseName string = databaseName
output serverName string = postgresServer.name
