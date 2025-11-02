# Infraestrutura como Código (IaC) — Azure Bicep

Esta pasta contém os arquivos Bicep para provisionar toda a infraestrutura Azure necessária para a aplicação Nola.

## Estrutura

```
infra/
├── main.bicep                    # Orquestrador principal
├── parameters.dev.json           # Parâmetros para ambiente dev
├── modules/
│   ├── acr.bicep                 # Azure Container Registry
│   ├── postgres.bicep            # PostgreSQL Flexible Server
│   ├── container-apps.bicep      # Container Apps Environment + Backend
│   └── static-web-app.bicep      # Static Web App (Frontend)
```

## Recursos provisionados

| Serviço | Descrição | Custo estimado |
|---------|-----------|----------------|
| **Azure Container Registry** | Armazena imagens Docker do backend | $5/mês (Basic) |
| **PostgreSQL Flexible Server** | Banco de dados (B1ms, 1 vCPU, 2 GiB) | $12–15/mês |
| **Container Apps** | Backend FastAPI (0.25 vCPU, escala 0→3) | $0–5/mês (free tier) |
| **Static Web App** | Frontend React (tier Free) | $0/mês |

**Total**: ~$17–25/mês (~8–12 meses com crédito estudantil de $200)

## Como usar

### 1. Via script automatizado (recomendado)

```bash
./scripts/azure-setup.sh
```

Este script irá:
- Criar Service Principal
- Criar Resource Group
- Deployar toda a infraestrutura
- Exibir secrets para configurar no GitHub

### 2. Via Azure CLI (manual)

```bash
# Login
az login
az account set --subscription "Azure for Students"

# Criar Resource Group
az group create \
  --name nola-rg \
  --location eastus

# Deploy
az deployment group create \
  --resource-group nola-rg \
  --template-file infra/main.bicep \
  --parameters \
    projectName=nola \
    environment=dev \
    postgresAdminPassword='SUA_SENHA_FORTE'
```

### 3. Via GitHub Actions

O workflow `.github/workflows/infra.yml` faz deploy automático quando há mudanças em `infra/`.

## Parâmetros

| Parâmetro | Descrição | Padrão |
|-----------|-----------|--------|
| `projectName` | Prefixo dos recursos | `nola` |
| `location` | Região Azure | `eastus` |
| `environment` | Ambiente (dev/staging/prod) | `dev` |
| `postgresAdminPassword` | Senha do admin PostgreSQL | (obrigatório) |

## Outputs

Após o deploy, os seguintes outputs são retornados:

- `acrLoginServer`: URL do Container Registry
- `postgresHost`: FQDN do PostgreSQL
- `backendUrl`: URL do backend (Container Apps)
- `frontendUrl`: URL do frontend (Static Web App)

Obter outputs:

```bash
az deployment group show \
  --resource-group nola-rg \
  --name main \
  --query properties.outputs
```

## Configurações de segurança

### PostgreSQL
- Admin user: `pgadmin`
- SSL: obrigatório (`sslmode=require`)
- Firewall: permite apenas serviços Azure (0.0.0.0)
- Backup: 7 dias de retenção

### Container Registry
- Admin user: habilitado (para GitHub Actions)
- Public network access: habilitado
- Credenciais disponíveis via `az acr credential show`

### Container Apps
- Ingress: HTTPS obrigatório
- Scale: min 0 (economia) → max 3 réplicas
- Health check: `/health` (HTTP GET)

## Modificações comuns

### Alterar região

Edite `main.bicep`:

```bicep
param location string = 'brazilsouth' // ou outra região
```

### Aumentar recursos do PostgreSQL

Edite `modules/postgres.bicep`:

```bicep
sku: {
  name: 'Standard_B2s' // 2 vCPU, 4 GiB RAM
  tier: 'Burstable'
}
```

### Desabilitar escala para 0 (backend sempre ativo)

Edite `modules/container-apps.bicep`:

```bicep
scale: {
  minReplicas: 1 // manter ao menos 1 instância
  maxReplicas: 3
}
```

## Limpeza de recursos

Para deletar toda a infraestrutura:

```bash
az group delete --name nola-rg --yes --no-wait
```

⚠️ **Atenção**: isso remove **permanentemente** todos os recursos, incluindo banco de dados.

## Troubleshooting

### Erro: "Location not available"

Algumas regiões não suportam todos os serviços. Use `eastus` ou `westus2`.

### Erro: "Quota exceeded"

Verifique quotas disponíveis:

```bash
az vm list-usage --location eastus --output table
```

### Erro: "Deployment failed"

Veja logs detalhados:

```bash
az deployment group show \
  --resource-group nola-rg \
  --name main \
  --query properties.error
```

## Referências

- [Azure Bicep](https://learn.microsoft.com/azure/azure-resource-manager/bicep/)
- [Container Apps](https://learn.microsoft.com/azure/container-apps/)
- [Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/)
- [PostgreSQL Flexible](https://learn.microsoft.com/azure/postgresql/flexible-server/)
