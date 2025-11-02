#!/bin/bash
# Script auxiliar: Setup inicial Azure para deploy
# Cria Service Principal, Resource Group e faz primeiro deploy da infraestrutura

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Nola Analytics — Setup Azure for Students    ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""

# Configurações
PROJECT_NAME="nola"
ENVIRONMENT="dev"
RESOURCE_GROUP="${PROJECT_NAME}-rg"
LOCATION="eastus"

# Verificar Azure CLI
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI não encontrado. Instale em: https://learn.microsoft.com/cli/azure/install-azure-cli${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Verificando login no Azure...${NC}"
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}🔑 Faça login no Azure:${NC}"
    az login
fi

# Listar subscrições
echo ""
echo -e "${YELLOW}📋 Subscrições disponíveis:${NC}"
az account list --output table

# Selecionar subscrição estudantil
echo ""
read -p "Digite o ID da subscrição Azure for Students: " SUBSCRIPTION_ID
az account set --subscription "$SUBSCRIPTION_ID"

echo -e "${GREEN}✅ Subscrição configurada: $(az account show --query name -o tsv)${NC}"

# Solicitar senha do PostgreSQL
echo ""
read -sp "Digite a senha do admin do PostgreSQL (mínimo 8 caracteres): " POSTGRES_PASSWORD
echo ""

if [ ${#POSTGRES_PASSWORD} -lt 8 ]; then
    echo -e "${RED}❌ Senha muito curta. Mínimo 8 caracteres.${NC}"
    exit 1
fi

# Criar Service Principal
echo ""
echo -e "${YELLOW}🔐 Criando Service Principal para GitHub Actions...${NC}"
SP_OUTPUT=$(az ad sp create-for-rbac \
  --name "${PROJECT_NAME}-github-actions" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID \
  --sdk-auth)

echo ""
echo -e "${GREEN}✅ Service Principal criado!${NC}"
echo ""
echo -e "${YELLOW}📋 Copie o JSON abaixo e adicione como secret AZURE_CREDENTIALS no GitHub:${NC}"
echo ""
echo "$SP_OUTPUT"
echo ""
read -p "Pressione Enter para continuar..."

# Criar Resource Group
echo ""
echo -e "${YELLOW}📦 Criando Resource Group...${NC}"
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --tags project=$PROJECT_NAME environment=$ENVIRONMENT

echo -e "${GREEN}✅ Resource Group criado: $RESOURCE_GROUP${NC}"

# Deploy da infraestrutura via Bicep
echo ""
echo -e "${YELLOW}🚀 Deployando infraestrutura (Bicep)...${NC}"
echo -e "${YELLOW}⏳ Isso pode levar 5-10 minutos...${NC}"

DEPLOYMENT_OUTPUT=$(az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infra/main.bicep \
  --parameters \
    projectName=$PROJECT_NAME \
    environment=$ENVIRONMENT \
    location=$LOCATION \
    postgresAdminPassword="$POSTGRES_PASSWORD" \
  --query properties.outputs \
  --output json)

echo ""
echo -e "${GREEN}✅ Infraestrutura provisionada!${NC}"

# Extrair outputs
ACR_LOGIN_SERVER=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.acrLoginServer.value')
POSTGRES_HOST=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.postgresHost.value')
BACKEND_URL=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.backendUrl.value')
FRONTEND_URL=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.frontendUrl.value')

# Construir connection string
DATABASE_URL="postgresql://pgadmin:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/challenge_db?sslmode=require"

# Obter ACR credentials
ACR_NAME=$(echo "$ACR_LOGIN_SERVER" | cut -d'.' -f1)
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)

# Obter Static Web App token
SWA_NAME="${PROJECT_NAME}-${ENVIRONMENT}-frontend"
SWA_TOKEN=$(az staticwebapp secrets list \
  --name "$SWA_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.apiKey \
  --output tsv)

# Exibir resumo
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Setup concluído com sucesso!               ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📋 Recursos criados:${NC}"
echo "  🗂️  Resource Group: $RESOURCE_GROUP"
echo "  📦 ACR: $ACR_LOGIN_SERVER"
echo "  🐘 PostgreSQL: $POSTGRES_HOST"
echo "  🔧 Backend: https://$BACKEND_URL"
echo "  🎨 Frontend: https://$FRONTEND_URL"
echo ""
echo -e "${YELLOW}🔑 Adicione os seguintes secrets no GitHub:${NC}"
echo ""
echo "AZURE_CREDENTIALS:"
echo "$SP_OUTPUT"
echo ""
echo "POSTGRES_ADMIN_PASSWORD:"
echo "$POSTGRES_PASSWORD"
echo ""
echo "ACR_NAME:"
echo "$ACR_NAME"
echo ""
echo "ACR_LOGIN_SERVER:"
echo "$ACR_LOGIN_SERVER"
echo ""
echo "DATABASE_URL:"
echo "$DATABASE_URL"
echo ""
echo "ALLOW_ORIGINS:"
echo "https://$FRONTEND_URL"
echo ""
echo "VITE_API_BASE_URL:"
echo "https://$BACKEND_URL"
echo ""
echo "AZURE_STATIC_WEB_APPS_API_TOKEN:"
echo "$SWA_TOKEN"
echo ""
echo -e "${YELLOW}📖 Próximos passos:${NC}"
echo "  1. Adicionar secrets no GitHub (Settings → Secrets)"
echo "  2. Inicializar banco: psql \"$DATABASE_URL\" < requisitos-desafio/database-schema.sql"
echo "  3. Gerar dados: python generate_data.py (com DATABASE_URL configurado)"
echo "  4. Deploy backend: GitHub Actions → Backend Deploy"
echo "  5. Deploy frontend: GitHub Actions → Frontend Deploy"
echo ""
echo -e "${GREEN}🎉 Pronto para deploy!${NC}"
