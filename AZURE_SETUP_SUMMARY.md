# Preparação para Deploy Azure — Resumo Executivo

## ✅ O que foi feito

### 1. Infraestrutura como Código (Bicep)

Criada estrutura completa de IaC para provisionar automaticamente:

- **Azure Container Registry** (Basic, $5/mês): armazena imagens Docker do backend
- **PostgreSQL Flexible Server** (B1ms, $12–15/mês): banco de dados otimizado para custos
- **Container Apps** (0.25 vCPU, escala 0→3, ~$0–5/mês): backend FastAPI com auto-scaling
- **Static Web App** (Free tier, $0/mês): frontend React com CDN global

**Custo total estimado**: $17–25/mês → **8–12 meses** de operação com crédito de $200.

Arquivos:
- `infra/main.bicep`: orquestrador principal
- `infra/modules/*.bicep`: módulos por serviço
- `infra/README.md`: documentação técnica da infraestrutura

### 2. CI/CD (GitHub Actions)

Workflows automatizados para deploy contínuo:

- **infra.yml**: provisiona/atualiza infraestrutura via Bicep
- **backend.yml**: build de imagem Docker → push para ACR → deploy no Container Apps
- **frontend.yml**: build Vite → deploy no Static Web Apps

Triggers:
- Manual (workflow_dispatch)
- Automático (push em `infra/`, `backend/` ou `frontend/`)

### 3. Automação de Setup

Script `scripts/azure-setup.sh` que:
- Faz login no Azure CLI
- Cria Service Principal para GitHub Actions
- Cria Resource Group
- Deploya infraestrutura via Bicep
- Exibe todos os secrets necessários para configurar no GitHub

### 4. Documentação Completa

- **DEPLOY.md**: guia passo a passo detalhado (8 fases, troubleshooting, estimativa de custos)
- **infra/README.md**: referência técnica da infraestrutura
- **README.md**: atualizado com Quick Start e remoção de Oracle Cloud

### 5. Otimizações de Custo

- Container Apps: escala para **0 réplicas** quando ocioso (free tier)
- PostgreSQL: tier **Burstable B1ms** (mais barato)
- Static Web Apps: tier **Free** (sem custos até 100 GB bandwidth)
- Sem Application Insights/Log Analytics pagos (usa logs built-in)

## 📋 Secrets necessários no GitHub

Após executar `./scripts/azure-setup.sh`, adicionar em **Settings → Secrets**:

| Secret | Descrição |
|--------|-----------|
| `AZURE_CREDENTIALS` | JSON do Service Principal |
| `POSTGRES_ADMIN_PASSWORD` | Senha do admin PostgreSQL |
| `ACR_NAME` | Nome do Container Registry |
| `ACR_LOGIN_SERVER` | URL do ACR (ex.: `noladevacr.azurecr.io`) |
| `DATABASE_URL` | Connection string completa do PostgreSQL |
| `ALLOW_ORIGINS` | URL do frontend (CORS) |
| `VITE_API_BASE_URL` | URL do backend |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Token do Static Web App |

## 🚀 Próximos passos (você)

### Passo 1: Executar setup inicial

```bash
# Tornar script executável (já feito)
chmod +x scripts/azure-setup.sh

# Executar setup
./scripts/azure-setup.sh
```

Isso criará toda a infraestrutura e exibirá os secrets.

### Passo 2: Configurar secrets no GitHub

1. Acessar: `https://github.com/lucasvieira94/nola-god-level/settings/secrets/actions`
2. Clicar em **New repository secret**
3. Adicionar cada secret exibido pelo script

### Passo 3: Inicializar banco de dados

```bash
# Connection string exibida pelo script
psql "postgresql://pgadmin:SENHA@HOST:5432/challenge_db?sslmode=require" \
  < requisitos-desafio/database-schema.sql
```

### Passo 4: Gerar dados (opcional)

```bash
export DATABASE_URL="postgresql://pgadmin:SENHA@HOST:5432/challenge_db?sslmode=require"
python generate_data.py
```

Ou rode localmente com Docker apontando para o banco Azure.

### Passo 5: Deploy via GitHub Actions

1. **Backend**:
   - Ir em **Actions → Backend Deploy**
   - Clicar em **Run workflow**
   - Selecionar `dev`

2. **Frontend**:
   - Ir em **Actions → Frontend Deploy**
   - Clicar em **Run workflow**
   - Selecionar `dev`

### Passo 6: Atualizar CORS

Após deploy do frontend, atualizar o backend:

```bash
az containerapp update \
  --name nola-dev-backend \
  --resource-group nola-rg \
  --set-env-vars ALLOW_ORIGINS="https://nola-dev-frontend.azurestaticapps.net"
```

### Passo 7: Testar aplicação

- Frontend: `https://nola-dev-frontend.azurestaticapps.net`
- Backend health: `https://nola-dev-backend.REGIAO.azurecontainerapps.io/health`

## 📊 Monitoramento de custos

### Via Azure CLI

```bash
az consumption usage list \
  --start-date 2024-11-01 \
  --end-date 2024-11-30 \
  --output table
```

### Via Portal Azure

1. Acessar: Cost Management + Billing
2. Criar **Budget Alert** para $20/mês
3. Configurar notificação por email ao atingir 80% do budget

## 🛠️ Troubleshooting comum

### "ACR credentials not found"

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

### "PostgreSQL connection refused"

Verificar firewall:

```bash
az postgres flexible-server firewall-rule list \
  --resource-group nola-rg \
  --name nola-dev-pg
```

### "CORS policy blocked"

Verificar `ALLOW_ORIGINS` no Container App:

```bash
az containerapp show \
  --name nola-dev-backend \
  --resource-group nola-rg \
  --query properties.template.containers[0].env
```

## 📚 Referências

- **Guia completo**: `DEPLOY.md`
- **Infraestrutura**: `infra/README.md`
- **Arquitetura**: `ARQUITETURA.md`
- **Challenge**: `requisitos-desafio/PROBLEMA.md` e `requisitos-desafio/AVALIACAO.md`

## 🎯 Checklist final

- [x] Infraestrutura como código (Bicep) criada
- [x] Workflows GitHub Actions configurados
- [x] Script de setup automatizado
- [x] Documentação completa (DEPLOY.md)
- [x] README atualizado com Quick Start
- [x] Custos otimizados ($17–25/mês)
- [x] Commit realizado
- [ ] Executar `./scripts/azure-setup.sh`
- [ ] Configurar secrets no GitHub
- [ ] Inicializar banco de dados
- [ ] Deploy backend via GitHub Actions
- [ ] Deploy frontend via GitHub Actions
- [ ] Atualizar CORS no backend
- [ ] Testar aplicação end-to-end

---

**Status**: ✅ Pronto para deploy. Execute `./scripts/azure-setup.sh` para começar.
