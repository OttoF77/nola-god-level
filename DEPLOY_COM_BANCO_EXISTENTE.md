# Deploy com PostgreSQL Existente (Free Tier Azure)

Este guia mostra como fazer deploy usando o **PostgreSQL gratuito** que você já tem na Azure (750h/mês grátis até nov/2026).

## Custo final estimado

| Serviço | Tier/Config | Custo mensal (USD) |
|---------|-------------|---------------------|
| PostgreSQL Flexible | **GRATUITO** (já existe) | $0 |
| Container Apps | 0.25 vCPU, min 0 | $0–5 (free tier) |
| Static Web Apps | Free | $0 |
| Container Registry | Basic | $5 |
| **Total** | | **$5–10/mês** |

Economia de **$12-15/mês** usando banco existente! 🎉

## Passo 1: Obter connection string do PostgreSQL existente

### 1.1. Resetar senha (se necessário)

No Portal Azure:
1. Vá para seu **Azure Database for PostgreSQL flexible server**
2. **Settings** → **Reset password**
3. Defina uma senha forte (ex.: `MinhaSenh@2024!`)
4. Salve a senha em local seguro

### 1.2. Obter connection string

Portal Azure → seu PostgreSQL → **Settings** → **Connection strings** → copie a string ADO.NET ou construa manualmente:

```
postgresql://USUARIO:SENHA@SERVIDOR.postgres.database.azure.com:5432/NOME_DB?sslmode=require
```

Substitua:
- `USUARIO`: seu usuário admin (geralmente definido na criação)
- `SENHA`: a senha que você definiu/resetou
- `SERVIDOR`: nome do seu servidor PostgreSQL
- `NOME_DB`: nome do banco (crie um chamado `challenge_db` se não existir)

Exemplo real:
```
postgresql://myadmin:MinhaSenh@2024!@nola-postgres-free.postgres.database.azure.com:5432/challenge_db?sslmode=require
```

## Passo 2: Inicializar schema do banco

Conecte ao banco e rode o schema:

```bash
# Usando psql local
psql "postgresql://USUARIO:SENHA@SERVIDOR.postgres.database.azure.com:5432/challenge_db?sslmode=require" \
  < requisitos-desafio/database-schema.sql

# Ou via Azure Cloud Shell (já tem psql)
# Portal Azure → Cloud Shell (ícone >_ no topo)
```

Depois, gere dados de exemplo (opcional):

```bash
export DATABASE_URL="postgresql://USUARIO:SENHA@SERVIDOR.postgres.database.azure.com:5432/challenge_db?sslmode=require"
python generate_data.py
```

## Passo 3: Deploy via Azure CLI (simplificado)

Como você já tem o banco, vamos provisionar **apenas** ACR, Container Apps e Static Web App:

```bash
# Login
az login
az account set --subscription "NOME_DA_SUA_SUBSCRIPTION"

# Criar Resource Group
az group create \
  --name nola-rg \
  --location eastus

# Deploy Bicep (com banco existente)
az deployment group create \
  --resource-group nola-rg \
  --template-file infra/main.bicep \
  --parameters \
    projectName=nola \
    environment=dev \
    useExistingPostgres=true \
    existingDatabaseUrl='postgresql://USUARIO:SENHA@SERVIDOR.postgres.database.azure.com:5432/challenge_db?sslmode=require'
```

**Importante**: coloque sua connection string completa no parâmetro `existingDatabaseUrl`.

## Passo 4: Obter outputs e configurar GitHub Secrets

```bash
az deployment group show \
  --resource-group nola-rg \
  --name main \
  --query properties.outputs \
  --output json
```

Adicione esses secrets no GitHub (Settings → Secrets):

| Secret | Valor |
|--------|-------|
| `DATABASE_URL` | Sua connection string completa |
| `ACR_NAME` | Nome do ACR (output do deploy) |
| `ACR_LOGIN_SERVER` | URL do ACR (output do deploy) |
| `VITE_API_BASE_URL` | URL do backend (output do deploy) |
| `ALLOW_ORIGINS` | URL do frontend (output do deploy) |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Token do SWA (comando abaixo) |

Obter token do Static Web App:

```bash
az staticwebapp secrets list \
  --name nola-dev-frontend \
  --resource-group nola-rg \
  --query properties.apiKey \
  --output tsv
```

## Passo 5: Deploy Backend e Frontend

Via GitHub Actions:
1. **Actions** → **Backend Deploy** → **Run workflow** → `dev`
2. **Actions** → **Frontend Deploy** → **Run workflow** → `dev`

Ou manualmente:

```bash
# Backend
az acr login --name noladevacr
docker build -t noladevacr.azurecr.io/nola-backend:latest ./backend
docker push noladevacr.azurecr.io/nola-backend:latest

# Atualizar Container App
az containerapp update \
  --name nola-dev-backend \
  --resource-group nola-rg \
  --image noladevacr.azurecr.io/nola-backend:latest
```

## Passo 6: Atualizar CORS

Após deploy do frontend:

```bash
az containerapp update \
  --name nola-dev-backend \
  --resource-group nola-rg \
  --set-env-vars ALLOW_ORIGINS="https://nola-dev-frontend.azurestaticapps.net"
```

## Verificar aplicação

- Backend health: `curl https://nola-dev-backend.REGIAO.azurecontainerapps.io/health`
- Frontend: `https://nola-dev-frontend.azurestaticapps.net`

---

**Vantagens de usar banco existente:**
- ✅ $0/mês no banco (free tier até nov/2026)
- ✅ Custo total: $5-10/mês (vs $17-25/mês com banco novo)
- ✅ Mesma performance e segurança
