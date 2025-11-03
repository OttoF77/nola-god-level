// Módulo Bicep: Azure Container Apps Environment + Backend App
// Escala 0→N para reduzir custos quando ocioso

@description('Localização do recurso')
param location string

@description('Nome do projeto')
param projectName string

@description('Ambiente')
param environment string

@description('Login server do ACR')
param acrLoginServer string

@description('Connection string completa do PostgreSQL (suporta banco existente ou novo)')
@secure()
param databaseUrl string

@description('Tags do recurso')
param tags object

// Nomes dos recursos
var envName = '${projectName}-${environment}-env'
var backendAppName = '${projectName}-${environment}-backend'

// ========== Container Apps Environment ==========
resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: envName
  location: location
  tags: tags
  properties: {
    // Sem Log Analytics para reduzir custos (usa built-in logs)
    appLogsConfiguration: {
      destination: 'azure-monitor'
    }
  }
}

// ========== Backend Container App ==========
resource backendApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: backendAppName
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      ingress: {
        external: true // Acesso público
        targetPort: 8000
        transport: 'auto' // HTTP/HTTPS automático
        allowInsecure: false // Força HTTPS
      }
      registries: [
        {
          server: acrLoginServer
          // Credenciais via ACR admin user (alternativa: managed identity)
          // Será configurado via GitHub Actions com secrets
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: '${acrLoginServer}/${projectName}-backend:latest' // Imagem placeholder
          resources: {
            cpu: json('0.25') // 0.25 vCPU (free tier)
            memory: '0.5Gi' // 0.5 GiB RAM
          }
          env: [
            {
              name: 'DATABASE_URL'
              value: databaseUrl
            }
            {
              name: 'ALLOW_ORIGINS'
              value: '*' // Será atualizado com domínio do frontend após deploy
            }
            {
              name: 'STATEMENT_TIMEOUT'
              value: '15s'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8000
              }
              initialDelaySeconds: 10
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0 // Escala para 0 quando ocioso (economia)
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
    }
  }
}

output backendFqdn string = backendApp.properties.configuration.ingress.fqdn
output backendAppName string = backendApp.name
