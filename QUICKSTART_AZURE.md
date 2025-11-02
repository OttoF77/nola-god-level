# 🚀 Deploy Rápido Azure — 5 Passos

## 1️⃣ Setup Inicial (local)

```bash
./scripts/azure-setup.sh
```

➡️ Copie todos os secrets exibidos no output.

## 2️⃣ Configurar GitHub Secrets

Acesse: https://github.com/lucasvieira94/nola-god-level/settings/secrets/actions

Adicione os 8 secrets exibidos pelo script anterior:
- `AZURE_CREDENTIALS`
- `POSTGRES_ADMIN_PASSWORD`
- `ACR_NAME`
- `ACR_LOGIN_SERVER`
- `DATABASE_URL`
- `ALLOW_ORIGINS` (atualizar após deploy frontend)
- `VITE_API_BASE_URL` (atualizar após deploy backend)
- `AZURE_STATIC_WEB_APPS_API_TOKEN`

## 3️⃣ Inicializar Banco

```bash
# Usar DATABASE_URL do script anterior
psql "postgresql://pgadmin:SENHA@HOST:5432/challenge_db?sslmode=require" \
  < requisitos-desafio/database-schema.sql

# Gerar dados de exemplo
export DATABASE_URL="postgresql://pgadmin:SENHA@HOST:5432/challenge_db?sslmode=require"
python generate_data.py
```

## 4️⃣ Deploy Backend + Frontend

**Via GitHub Actions** (recomendado):
1. Actions → Backend Deploy → Run workflow → `dev`
2. Actions → Frontend Deploy → Run workflow → `dev`

**Via terminal**:
```bash
# Backend
az acr login --name noladevacr
docker build -t noladevacr.azurecr.io/nola-backend:latest ./backend
docker push noladevacr.azurecr.io/nola-backend:latest

az containerapp update \
  --name nola-dev-backend \
  --resource-group nola-rg \
  --image noladevacr.azurecr.io/nola-backend:latest

# Frontend
cd frontend
npm ci && npm run build
# Deploy via Azure Portal ou Static Web Apps CLI
```

## 5️⃣ Atualizar CORS e Testar

```bash
# Atualizar ALLOW_ORIGINS com URL do frontend
az containerapp update \
  --name nola-dev-backend \
  --resource-group nola-rg \
  --set-env-vars ALLOW_ORIGINS="https://nola-dev-frontend.azurestaticapps.net"

# Testar
curl https://nola-dev-backend.REGIAO.azurecontainerapps.io/health
# Abrir browser: https://nola-dev-frontend.azurestaticapps.net
```

---

## 📊 Custos

- **Estimado**: $17–25/mês
- **Duração**: 8–12 meses com $200 USD

## 📚 Docs completas

- `AZURE_SETUP_SUMMARY.md`: resumo executivo
- `DEPLOY.md`: guia detalhado passo a passo
- `infra/README.md`: documentação da infraestrutura

## 🆘 Problemas?

Consulte seção Troubleshooting em `DEPLOY.md` ou `AZURE_SETUP_SUMMARY.md`.
