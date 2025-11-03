# Deploy Totalmente FREE no Azure (Conta Estudantil)

> ✅ Deploy usando **apenas serviços Always Free** que não consomem crédito estudantil

## 💰 Análise de Custos

| Serviço | Tier | Custo/mês | Status |
|---------|------|-----------|--------|
| **App Service** | Free F1 | **$0** | ✅ Always Free |
| **Static Web Apps** | Free | **$0** | ✅ Always Free |
| **PostgreSQL Flexible** | Seu free tier | **$0** | ✅ 750h/mês até Nov 2026 |
| **Container Registry** | Basic | **~$5** | ⚠️ ÚNICO CUSTO |
| **TOTAL** | | **~$5/mês** | Ou $0 com Docker Hub |

### Alternativa 100% Gratuita
Para custo $0, use **Docker Hub** (público) no lugar do ACR:
- Crie conta em hub.docker.com
- Repositórios públicos são gratuitos
- Modifique workflows para fazer push ao Docker Hub

---

## 📋 Pré-requisitos

✅ Banco `challenge_db` criado  
✅ Schema carregado (database-schema.sql)  
✅ Firewall configurado (Azure services + seu IP)  
✅ Azure CLI instalado e logado  
✅ Connection string PostgreSQL

---

## 🚀 Passo 1: Preparar o Banco de Dados

### 1.1 Carregar Schema

Conecte ao banco e carregue o schema:

```bash
# Conectar ao challenge_db
psql "postgresql://postgre-adm:SUA_SENHA@challenge-nola-server.postgres.database.azure.com:5432/challenge_db?sslmode=require"

# Dentro do psql
\i database-schema.sql

# Verificar tabelas criadas
\dt

# Sair
\q
```

Ou em uma linha (fora do psql):

```bash
psql "postgresql://postgre-adm:SUA_SENHA@challenge-nola-server.postgres.database.azure.com:5432/challenge_db?sslmode=require" < database-schema.sql
```

### 1.2 (Opcional) Gerar Dados de Teste

```bash
export DATABASE_URL="postgresql://postgre-adm:SUA_SENHA@challenge-nola-server.postgres.database.azure.com:5432/challenge_db?sslmode=require"
python generate_data.py
```

---

## 🏗️ Passo 2: Provisionar Infraestrutura Azure

### 2.1 Criar Resource Group

```bash
az group create \
  --name nola-rg \
  --location eastus
```

### 2.2 Deploy via Bicep (Free Tier)

```bash
# Salvar connection string em variável
DATABASE_URL="postgresql://postgre-adm:SUA_SENHA@challenge-nola-server.postgres.database.azure.com:5432/challenge_db?sslmode=require"

# Deploy usando main-free.bicep (App Service Free F1)
az deployment group create \
  --resource-group nola-rg \
  --template-file infra/main-free.bicep \
  --parameters projectName=nola \
               environment=dev \
               databaseUrl="$DATABASE_URL" \
               allowOrigins="*"
```

### 2.3 Capturar Outputs

```bash
# Após deploy bem-sucedido, salvar outputs
ACR_NAME=$(az deployment group show -g nola-rg -n main-free --query properties.outputs.acrName.value -o tsv)
ACR_LOGIN_SERVER=$(az deployment group show -g nola-rg -n main-free --query properties.outputs.acrLoginServer.value -o tsv)
BACKEND_URL=$(az deployment group show -g nola-rg -n main-free --query properties.outputs.backendUrl.value -o tsv)
FRONTEND_URL=$(az deployment group show -g nola-rg -n main-free --query properties.outputs.frontendUrl.value -o tsv)
SWA_TOKEN=$(az deployment group show -g nola-rg -n main-free --query properties.outputs.deploymentToken.value -o tsv)

echo "ACR_NAME=$ACR_NAME"
echo "ACR_LOGIN_SERVER=$ACR_LOGIN_SERVER"
echo "BACKEND_URL=$BACKEND_URL"
echo "FRONTEND_URL=$FRONTEND_URL"
echo "SWA_TOKEN=$SWA_TOKEN"
```

---

## 🐳 Passo 3: Build e Push da Imagem Backend

### 3.1 Login no ACR

```bash
az acr login --name $ACR_NAME
```

### 3.2 Build e Push

```bash
cd backend

# Build
docker build -t ${ACR_LOGIN_SERVER}/nola-backend:latest .

# Push
docker push ${ACR_LOGIN_SERVER}/nola-backend:latest
```

### 3.3 Configurar App Service para Usar a Imagem

```bash
az webapp config container set \
  --name nola-dev-backend \
  --resource-group nola-rg \
  --docker-custom-image-name ${ACR_LOGIN_SERVER}/nola-backend:latest \
  --docker-registry-server-url https://${ACR_LOGIN_SERVER}
```

### 3.4 Reiniciar App Service

```bash
az webapp restart --name nola-dev-backend --resource-group nola-rg
```

---

## 🎨 Passo 4: Deploy do Frontend

### 4.1 Configurar GitHub Secrets

No seu repositório GitHub, adicione os secrets:

```
Navegue: Settings → Secrets and variables → Actions → New repository secret
```

Adicione:
- `DATABASE_URL`: Connection string do PostgreSQL
- `ACR_LOGIN_SERVER`: Valor de $ACR_LOGIN_SERVER
- `ACR_NAME`: Valor de $ACR_NAME
- `VITE_API_BASE_URL`: Valor de $BACKEND_URL
- `AZURE_STATIC_WEB_APPS_API_TOKEN`: Valor de $SWA_TOKEN

### 4.2 Criar Workflow de Deploy (Backend)

Crie `.github/workflows/backend-deploy.yml`:

```yaml
name: Backend Deploy

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
      
      - name: Login to ACR
        uses: azure/docker-login@v1
        with:
          login-server: ${{ secrets.ACR_LOGIN_SERVER }}
          username: ${{ secrets.ACR_NAME }}
          password: ${{ secrets.ACR_PASSWORD }}
      
      - name: Build and Push
        run: |
          cd backend
          docker build -t ${{ secrets.ACR_LOGIN_SERVER }}/nola-backend:latest .
          docker push ${{ secrets.ACR_LOGIN_SERVER }}/nola-backend:latest
      
      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Restart App Service
        run: |
          az webapp restart --name nola-dev-backend --resource-group nola-rg
```

### 4.3 Criar Workflow de Deploy (Frontend)

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

### 4.4 Obter Credenciais ACR

```bash
# Password do ACR (para GitHub secret ACR_PASSWORD)
az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv
```

### 4.5 Criar Service Principal para GitHub Actions

```bash
# Criar service principal
az ad sp create-for-rbac \
  --name "github-actions-nola" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/nola-rg \
  --sdk-auth

# Copiar o JSON completo e adicionar como secret AZURE_CREDENTIALS no GitHub
```

---

## 🔧 Passo 5: Configurar CORS

Após o deploy do frontend, atualize o CORS do backend:

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

## ✅ Passo 6: Verificar Deploy

### 6.1 Verificar Backend

```bash
curl $BACKEND_URL/health
# Deve retornar: {"status":"healthy"}
```

### 6.2 Verificar Frontend

Abra no navegador:
```
echo $FRONTEND_URL
```

### 6.3 Verificar Logs do App Service

```bash
# Stream logs do backend
az webapp log tail --name nola-dev-backend --resource-group nola-rg
```

---

## ⚠️ Limitações do Free Tier

### App Service Free F1:
- ✅ **Always Free** (não consome crédito)
- ⚠️ **60 minutos CPU/dia** - adequado para demo/MVP
- ⚠️ **Sem Always On** - app "hiberna" após inatividade
- ⚠️ **1 GB RAM** - FastAPI leve funciona bem
- ⚠️ **Compartilhado** - performance variável

### Static Web Apps Free:
- ✅ **Always Free** (não consome crédito)
- ✅ **100 GB bandwidth/mês** - suficiente para MVP
- ✅ **0.5 GB storage** - mais que suficiente para React SPA

### Se Precisar de Mais Performance:
Considere upgrade para:
- **App Service B1 Basic**: ~$13/mês, 1.75 GB RAM, Always On
- **Container Apps Consumption**: pay-per-use, scale to zero

---

## 🐛 Troubleshooting

### Backend não inicia:
```bash
# Verificar logs
az webapp log tail --name nola-dev-backend --resource-group nola-rg

# Verificar configuração
az webapp config appsettings list --name nola-dev-backend --resource-group nola-rg
```

### Frontend não conecta ao backend:
- Verificar `VITE_API_BASE_URL` no build do frontend
- Verificar CORS no backend (`ALLOW_ORIGINS`)
- Testar backend diretamente: `curl $BACKEND_URL/health`

### App Service "hibernando":
- É esperado no Free tier após ~20 min de inatividade
- Primeira requisição após hibernação demora ~10-30s
- Para Always On: upgrade para Basic B1

---

## 📊 Monitoramento de Uso

### Verificar cota de CPU do App Service:
```bash
az monitor metrics list \
  --resource /subscriptions/$(az account show --query id -o tsv)/resourceGroups/nola-rg/providers/Microsoft.Web/sites/nola-dev-backend \
  --metric "CpuTime" \
  --interval PT1H
```

### Verificar bandwidth do Static Web App:
- Acesse Portal Azure → Static Web Apps → nola-dev-frontend → Monitoring

---

## 🎯 Próximos Passos

1. ✅ Carregar schema no banco
2. ✅ Deploy da infraestrutura (Bicep)
3. ✅ Build e push da imagem backend
4. ✅ Configurar GitHub Actions
5. ✅ Deploy do frontend
6. ✅ Configurar CORS
7. ✅ Testar aplicação completa

---

## 💡 Dica: Economizar Ainda Mais

Para **$0/mês total**, use Docker Hub no lugar do ACR:

```bash
# Login no Docker Hub
docker login

# Build e push
docker build -t SEU_USUARIO/nola-backend:latest backend/
docker push SEU_USUARIO/nola-backend:latest

# Configurar App Service para usar Docker Hub
az webapp config container set \
  --name nola-dev-backend \
  --resource-group nola-rg \
  --docker-custom-image-name SEU_USUARIO/nola-backend:latest \
  --docker-registry-server-url https://index.docker.io
```

Com Docker Hub: **CUSTO TOTAL = $0/mês** 🎉
