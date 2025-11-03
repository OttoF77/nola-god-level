# Deploy 100% GRATUITO com Docker Hub 🐳

> ✅ **CUSTO TOTAL: $0/mês** - Usando apenas serviços Always Free + Docker Hub público

## 🎯 Visão Geral

- **Backend**: App Service Free F1 → Docker Hub (público)
- **Frontend**: Static Web Apps Free
- **Banco**: PostgreSQL free tier (750h/mês)
- **Registry**: Docker Hub (repositório público)

**💰 CUSTO: $0/mês**

---

## 📋 Pré-requisitos

- ✅ Conta Docker Hub (você já tem)
- ✅ Banco `challenge_db` criado
- ✅ Azure CLI instalado e logado
- ⚠️ Schema do banco (vamos carregar agora)

---

## 🚀 Passo 1: Carregar Schema no Banco

Execute o script que criei:

```bash
./load-schema.sh
```

Digite a senha do `postgre-adm` quando solicitado.

**OU manualmente:**

```bash
psql "postgresql://postgre-adm:SUA_SENHA@challenge-nola-server.postgres.database.azure.com:5432/challenge_db?sslmode=require" < database-schema.sql
```

---

## 🐳 Passo 2: Build e Push da Imagem para Docker Hub

### 2.1 Login no Docker Hub

```bash
docker login
# Digite seu username e password do Docker Hub
```

### 2.2 Build da Imagem

```bash
cd backend

# Substituir SEU_USERNAME pelo seu username do Docker Hub
docker build -t SEU_USERNAME/nola-backend:latest .

cd ..
```

**Exemplo:** Se seu username é `ottof77`:
```bash
docker build -t ottof77/nola-backend:latest backend/
```

### 2.3 Push para Docker Hub

```bash
docker push SEU_USERNAME/nola-backend:latest
```

### 2.4 Verificar no Docker Hub

Acesse: https://hub.docker.com/r/SEU_USERNAME/nola-backend

---

## 🏗️ Passo 3: Deploy da Infraestrutura Azure

### 3.1 Criar Resource Group

```bash
az group create --name nola-rg --location eastus
```

### 3.2 Preparar Variáveis

```bash
# Seu username do Docker Hub
export DOCKER_USERNAME="SEU_USERNAME"  # Ex: ottof77

# Senha do PostgreSQL
read -s POSTGRES_PASSWORD
export DATABASE_URL="postgresql://postgre-adm:${POSTGRES_PASSWORD}@challenge-nola-server.postgres.database.azure.com:5432/challenge_db?sslmode=require"
```

### 3.3 Deploy via Bicep

```bash
az deployment group create \
  --resource-group nola-rg \
  --template-file infra/main-dockerhub.bicep \
  --parameters projectName=nola \
               environment=dev \
               databaseUrl="$DATABASE_URL" \
               dockerHubUsername="$DOCKER_USERNAME" \
               dockerImageName="nola-backend" \
               allowOrigins="*"
```

### 3.4 Capturar Outputs

```bash
BACKEND_URL=$(az deployment group show -g nola-rg -n main-dockerhub --query properties.outputs.backendUrl.value -o tsv)
FRONTEND_URL=$(az deployment group show -g nola-rg -n main-dockerhub --query properties.outputs.frontendUrl.value -o tsv)
SWA_TOKEN=$(az deployment group show -g nola-rg -n main-dockerhub --query properties.outputs.deploymentToken.value -o tsv)

echo "✅ BACKEND_URL=$BACKEND_URL"
echo "✅ FRONTEND_URL=$FRONTEND_URL"
echo "✅ SWA_TOKEN=$SWA_TOKEN"
```

---

## 🔄 Passo 4: Reiniciar App Service

Após o deploy, forçar pull da imagem:

```bash
az webapp restart --name nola-dev-backend --resource-group nola-rg
```

---

## ✅ Passo 5: Testar Backend

```bash
# Testar health check
curl $BACKEND_URL/health

# Deve retornar:
# {"status":"healthy"}

# Testar metadata
curl $BACKEND_URL/api/metadata | jq
```

---

## 🎨 Passo 6: Deploy do Frontend

### 6.1 Configurar GitHub Secrets

No seu repositório: **Settings → Secrets and variables → Actions**

Adicione estes secrets:

| Nome | Valor |
|------|-------|
| `VITE_API_BASE_URL` | Valor de `$BACKEND_URL` |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Valor de `$SWA_TOKEN` |
| `DOCKER_USERNAME` | Seu username Docker Hub |
| `DOCKER_PASSWORD` | Sua senha Docker Hub |

### 6.2 Criar Workflow Backend

Crie `.github/workflows/backend-deploy.yml`:

```yaml
name: Backend Deploy (Docker Hub)

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and Push
        run: |
          cd backend
          docker build -t ${{ secrets.DOCKER_USERNAME }}/nola-backend:latest .
          docker push ${{ secrets.DOCKER_USERNAME }}/nola-backend:latest
      
      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Restart App Service
        run: |
          az webapp restart --name nola-dev-backend --resource-group nola-rg
```

### 6.3 Criar Workflow Frontend

Crie `.github/workflows/frontend-deploy.yml`:

```yaml
name: Frontend Deploy

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build and Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/frontend"
          output_location: "dist"
        env:
          VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
```

### 6.4 Criar Service Principal para GitHub Actions

```bash
az ad sp create-for-rbac \
  --name "github-actions-nola" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/nola-rg \
  --sdk-auth
```

Copie o **JSON completo** e adicione como secret `AZURE_CREDENTIALS` no GitHub.

---

## 🔧 Passo 7: Atualizar CORS

Após deploy do frontend, configure CORS correto:

```bash
# Obter URL do frontend
FRONTEND_URL=$(az staticwebapp show --name nola-dev-frontend --resource-group nola-rg --query "defaultHostname" -o tsv)

# Atualizar CORS
az webapp config appsettings set \
  --name nola-dev-backend \
  --resource-group nola-rg \
  --settings ALLOW_ORIGINS="https://$FRONTEND_URL"

# Reiniciar
az webapp restart --name nola-dev-backend --resource-group nola-rg
```

---

## 🎯 Passo 8: Testar Aplicação Completa

1. **Abrir frontend:** `echo https://$FRONTEND_URL`
2. **Verificar health:** `curl $BACKEND_URL/health`
3. **Testar query:**
   ```bash
   curl -X POST $BACKEND_URL/api/query \
     -H "Content-Type: application/json" \
     -d '{
       "role": "marketing",
       "cube": "sales",
       "measures": ["sales.total_amount"],
       "dimensions": ["time.date"],
       "granularity": "day",
       "limit": 10
     }'
   ```

---

## 🔄 Workflow de Desenvolvimento

### Atualizar Backend:

```bash
# 1. Fazer mudanças em backend/
# 2. Build local (opcional)
docker build -t $DOCKER_USERNAME/nola-backend:latest backend/

# 3. Push
docker push $DOCKER_USERNAME/nola-backend:latest

# 4. Reiniciar App Service
az webapp restart --name nola-dev-backend --resource-group nola-rg
```

**OU** apenas faça commit no GitHub - o workflow automático vai fazer tudo!

### Atualizar Frontend:

```bash
# 1. Fazer mudanças em frontend/
# 2. Commit e push no GitHub
git add frontend/
git commit -m "feat: nova funcionalidade"
git push
```

O workflow automático vai fazer deploy!

---

## 📊 Monitoramento

### Logs do Backend:

```bash
# Stream logs em tempo real
az webapp log tail --name nola-dev-backend --resource-group nola-rg

# Download logs
az webapp log download --name nola-dev-backend --resource-group nola-rg
```

### Métricas do App Service:

```bash
# CPU usage (últimas 24h)
az monitor metrics list \
  --resource /subscriptions/$(az account show --query id -o tsv)/resourceGroups/nola-rg/providers/Microsoft.Web/sites/nola-dev-backend \
  --metric "CpuTime" \
  --interval PT1H
```

### Portal Azure:

- Backend: https://portal.azure.com → App Services → nola-dev-backend
- Frontend: https://portal.azure.com → Static Web Apps → nola-dev-frontend
- Banco: https://portal.azure.com → PostgreSQL → challenge-nola-server

---

## ⚠️ Limitações do Free Tier

### App Service Free F1:
- ✅ **$0/mês** (Always Free)
- ⚠️ **60 minutos CPU/dia** 
- ⚠️ **App hiberna** após ~20 min inatividade
- ⚠️ **Cold start**: primeira requisição demora ~10-30s após hibernar
- ⚠️ **1 GB RAM**
- ✅ **Perfeito para demos e testes**

### Static Web Apps Free:
- ✅ **$0/mês** (Always Free)
- ✅ **100 GB bandwidth/mês**
- ✅ **0.5 GB storage**
- ✅ **Sem limitações práticas para MVP**

### PostgreSQL Free Tier:
- ✅ **$0/mês** até Nov 2026
- ✅ **750 horas/mês** (~31 dias contínuos)
- ⚠️ Após Nov 2026: ~$12-15/mês ou migrar para outro free tier

---

## 🐛 Troubleshooting

### Erro: "Container didn't respond to HTTP pings"

```bash
# Verificar se a porta está correta
az webapp config appsettings set \
  --name nola-dev-backend \
  --resource-group nola-rg \
  --settings WEBSITES_PORT=8000

az webapp restart --name nola-dev-backend --resource-group nola-rg
```

### Erro: "Failed to pull image from Docker Hub"

```bash
# Verificar se a imagem é pública
# Acesse: https://hub.docker.com/r/SEU_USERNAME/nola-backend
# Settings → Make public

# Ou configurar credenciais do Docker Hub (para imagens privadas):
az webapp config container set \
  --name nola-dev-backend \
  --resource-group nola-rg \
  --docker-custom-image-name $DOCKER_USERNAME/nola-backend:latest \
  --docker-registry-server-url https://index.docker.io \
  --docker-registry-server-user $DOCKER_USERNAME \
  --docker-registry-server-password "SUA_SENHA"
```

### App não acorda após hibernar:

```bash
# Fazer uma requisição para acordar
curl $BACKEND_URL/health
# Aguardar 10-30 segundos e tentar novamente
```

---

## 💡 Próximos Passos

Após este deploy funcionar:

1. **Adicionar dados de teste:**
   ```bash
   export DATABASE_URL="postgresql://postgre-adm:SENHA@challenge-nola-server.postgres.database.azure.com:5432/challenge_db?sslmode=require"
   python generate_data.py
   ```

2. **Configurar domínio customizado** (opcional):
   - Static Web Apps permite domínios customizados no free tier
   - App Service Free F1 também permite

3. **Adicionar CI/CD:**
   - Workflows já criados farão deploy automático
   - Basta fazer push para `main`

4. **Monitorar custos:**
   - Portal Azure → Cost Management
   - Deve mostrar $0/mês consistentemente

---

## 🎉 Resumo

Com Docker Hub público, você tem:
- ✅ **$0/mês de custo**
- ✅ **Infraestrutura completa no Azure**
- ✅ **CI/CD automático**
- ✅ **HTTPS nativo**
- ✅ **Perfeito para demos e testes**

**Pronto para começar? Execute os passos em ordem!** 🚀
