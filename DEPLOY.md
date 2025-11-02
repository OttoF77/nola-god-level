# Guia de Deploy Azure — Passo a Passo

Este guia detalha como provisionar e deployar a aplicação Nola na Azure usando os créditos estudantis ($200 USD).

## Pré-requisitos

1. **Conta Azure for Students** ativa com $200 de crédito.
2. **Azure CLI** instalado localmente ([instalar](https://learn.microsoft.com/cli/azure/install-azure-cli)).
3. **GitHub** com repositório configurado.
4. **Docker** instalado (opcional, para testes locais).

## Fase 1: Configurar credenciais Azure

### 1.1. Login no Azure CLI

```bash
az login
```

Selecione a subscrição estudantil:

```bash
az account list --output table
az account set --subscription "Azure for Students"
```

### 1.2. Criar Service Principal para GitHub Actions

```bash
az ad sp create-for-rbac \
  --name "nola-github-actions" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv) \
  --sdk-auth
```

**Salve o JSON retornado** — ele será usado como secret `AZURE_CREDENTIALS` no GitHub.

Exemplo de output:
```json
{
  "clientId": "...",
  "clientSecret": "...",
  "subscriptionId": "...",
  "tenantId": "...",
  ...
}
```

## Fase 2: Configurar secrets no GitHub

Acesse **Settings → Secrets and variables → Actions** no repositório GitHub e adicione:

| Nome do Secret | Descrição | Como obter |
|----------------|-----------|------------|
| `AZURE_CREDENTIALS` | JSON do service principal | Output do comando acima (1.2) |
| `POSTGRES_ADMIN_PASSWORD` | Senha do admin do PostgreSQL | Escolha uma senha forte (ex.: `P@ssw0rd!2024`) |
| `ACR_NAME` | Nome do Azure Container Registry | Será criado pelo Bicep (ex.: `noladevacr`) |
| `ACR_LOGIN_SERVER` | Login server do ACR | Será exibido após deploy da infra (ex.: `noladevacr.azurecr.io`) |
| `DATABASE_URL` | Connection string do PostgreSQL | Será construída após deploy (ver seção 3.3) |
| `ALLOW_ORIGINS` | Domínio do frontend (CORS) | Será exibido após deploy do frontend |
| `VITE_API_BASE_URL` | URL do backend | Será exibido após deploy do backend |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Token do Static Web App | Será exibido após deploy da infra |

**Nota**: alguns secrets só podem ser preenchidos após o deploy inicial da infraestrutura.

## Fase 3: Provisionar infraestrutura (Bicep)

### 3.1. Deploy manual via Azure CLI (primeira vez)

Antes de usar GitHub Actions, faça o primeiro deploy localmente para obter outputs:

```bash
# Criar Resource Group
az group create \
  --name nola-rg \
  --location eastus \
  --tags project=nola environment=dev

# Deploy Bicep
az deployment group create \
  --resource-group nola-rg \
  --template-file infra/main.bicep \
  --parameters \
    projectName=nola \
    environment=dev \
    location=eastus \
    postgresAdminPassword='P@ssw0rd!2024'
```

### 3.2. Obter outputs da infraestrutura

Após o deploy, capture os outputs:

```bash
az deployment group show \
  --resource-group nola-rg \
  --name main \
  --query properties.outputs \
  --output json
```

Exemplo de output:
```json
{
  "acrLoginServer": {
    "value": "noladevacr.azurecr.io"
  },
  "postgresHost": {
    "value": "nola-dev-pg.postgres.database.azure.com"
  },
  "backendUrl": {
    "value": "nola-dev-backend.eastus.azurecontainerapps.io"
  },
  "frontendUrl": {
    "value": "nola-dev-frontend.azurestaticapps.net"
  }
}
```

### 3.3. Atualizar secrets do GitHub com os outputs

Com os outputs acima, atualize os secrets:

```bash
# ACR
ACR_NAME=noladevacr
ACR_LOGIN_SERVER=noladevacr.azurecr.io

# PostgreSQL
POSTGRES_HOST=nola-dev-pg.postgres.database.azure.com
DATABASE_URL="postgresql://pgadmin:P@ssw0rd!2024@${POSTGRES_HOST}:5432/challenge_db?sslmode=require"

# Backend
BACKEND_URL=https://nola-dev-backend.eastus.azurecontainerapps.io
VITE_API_BASE_URL=$BACKEND_URL

# Frontend
FRONTEND_URL=https://nola-dev-frontend.azurestaticapps.net
ALLOW_ORIGINS=$FRONTEND_URL
```

Adicione esses valores como secrets no GitHub (Settings → Secrets).

### 3.4. Obter token do Static Web App

```bash
az staticwebapp secrets list \
  --name nola-dev-frontend \
  --resource-group nola-rg \
  --query properties.apiKey \
  --output tsv
```

Adicione como secret `AZURE_STATIC_WEB_APPS_API_TOKEN`.

## Fase 4: Inicializar banco de dados

### 4.1. Conectar ao PostgreSQL

```bash
psql "postgresql://pgadmin:P@ssw0rd!2024@nola-dev-pg.postgres.database.azure.com:5432/challenge_db?sslmode=require"
```

### 4.2. Criar schema e popular dados

```sql
-- Copiar e colar conteúdo de requisitos-desafio/database-schema.sql
-- ou via script:
```

```bash
psql "postgresql://pgadmin:P@ssw0rd!2024@nola-dev-pg.postgres.database.azure.com:5432/challenge_db?sslmode=require" \
  < requisitos-desafio/database-schema.sql
```

### 4.3. Gerar dados de exemplo (opcional)

Rode o data-generator localmente apontando para o banco Azure:

```bash
export DATABASE_URL="postgresql://pgadmin:P@ssw0rd!2024@nola-dev-pg.postgres.database.azure.com:5432/challenge_db?sslmode=require"
python generate_data.py
```

Ou use Docker:

```bash
docker run --rm \
  -e DATABASE_URL="postgresql://pgadmin:P@ssw0rd!2024@nola-dev-pg.postgres.database.azure.com:5432/challenge_db?sslmode=require" \
  -v $(pwd)/generate_data.py:/app/generate_data.py \
  python:3.11-slim \
  bash -c "pip install -r /app/requisitos-desafio/requirements.txt && python /app/generate_data.py"
```

## Fase 5: Deploy Backend (Container Apps)

### 5.1. Build e push da imagem Docker

```bash
# Login no ACR
az acr login --name noladevacr

# Build
docker build -t noladevacr.azurecr.io/nola-backend:latest ./backend

# Push
docker push noladevacr.azurecr.io/nola-backend:latest
```

### 5.2. Deploy via GitHub Actions

Vá em **Actions → Backend Deploy → Run workflow** e selecione `dev`.

Ou faça push em `backend/`:

```bash
git add backend/
git commit -m "feat: atualizar backend"
git push origin main
```

### 5.3. Verificar health do backend

```bash
curl https://nola-dev-backend.eastus.azurecontainerapps.io/health
```

Resposta esperada:
```json
{"status": "ok"}
```

## Fase 6: Deploy Frontend (Static Web Apps)

### 6.1. Deploy via GitHub Actions

Vá em **Actions → Frontend Deploy → Run workflow** e selecione `dev`.

Ou faça push em `frontend/`:

```bash
git add frontend/
git commit -m "feat: atualizar frontend"
git push origin main
```

### 6.2. Acessar aplicação

Abra o navegador em:

```
https://nola-dev-frontend.azurestaticapps.net
```

## Fase 7: Atualizar CORS no backend

Após o deploy do frontend, atualize o `ALLOW_ORIGINS` no Container App:

```bash
az containerapp update \
  --name nola-dev-backend \
  --resource-group nola-rg \
  --set-env-vars ALLOW_ORIGINS="https://nola-dev-frontend.azurestaticapps.net"
```

## Fase 8: Monitoramento e logs

### 8.1. Logs do backend (Container Apps)

```bash
az containerapp logs show \
  --name nola-dev-backend \
  --resource-group nola-rg \
  --follow
```

### 8.2. Logs do frontend (Static Web Apps)

Acesse o portal Azure → Static Web Apps → nola-dev-frontend → Logs.

### 8.3. Monitorar custos

```bash
az consumption usage list \
  --start-date 2024-11-01 \
  --end-date 2024-11-30 \
  --output table
```

## Troubleshooting

### Erro: "ACR credentials not found"

Configure as credenciais do ACR no Container App:

```bash
ACR_USERNAME=$(az acr credential show --name noladevacr --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name noladevacr --query passwords[0].value -o tsv)

az containerapp registry set \
  --name nola-dev-backend \
  --resource-group nola-rg \
  --server noladevacr.azurecr.io \
  --username $ACR_USERNAME \
  --password $ACR_PASSWORD
```

### Erro: "PostgreSQL connection refused"

Verifique se o firewall do PostgreSQL permite conexões do Azure. Para produção, prefira VNet integration e desabilitar o acesso público:

```bash
az postgres flexible-server firewall-rule list \
  --resource-group nola-rg \
  --name nola-dev-pg
```

Adicione regra se necessário:

```bash
az postgres flexible-server firewall-rule create \
  --resource-group nola-rg \
  --name nola-dev-pg \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### Erro: "CORS policy blocked"

Certifique-se de que `ALLOW_ORIGINS` no backend inclui o domínio do frontend:

```bash
az containerapp show \
  --name nola-dev-backend \
  --resource-group nola-rg \
  --query properties.template.containers[0].env
```

## Estimativa de custos (recap)

| Serviço | Configuração | Custo/mês (USD) |
|---------|--------------|------------------|
| PostgreSQL Flexible | B1ms, 32 GB | $12–15 |
| Container Apps | 0.25 vCPU, 0→3 replicas | $0–5 (free tier) |
| Static Web Apps | Free tier | $0 |
| Container Registry | Basic, 10 GB | $5 |
| **Total** | | **$17–25/mês** |

**Duração do crédito**: ~8–12 meses com $200 USD.

## Próximos passos

- [ ] Configurar domínio customizado no Static Web App.
- [ ] Habilitar SSL/TLS customizado.
- [ ] Configurar Application Insights (se necessário).
- [ ] Configurar alertas de custo (Budget Alerts).
- [ ] Habilitar autenticação no Static Web App (opcional).
- [ ] Configurar CI/CD para ambientes staging/prod.

---

**Dúvidas?** Consulte a documentação oficial:
- [Azure Container Apps](https://learn.microsoft.com/azure/container-apps/)
- [Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/)
- [Azure Database for PostgreSQL](https://learn.microsoft.com/azure/postgresql/)
