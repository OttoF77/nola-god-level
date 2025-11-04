#!/bin/bash
# Script para atualizar DATABASE_URL no Azure Container App
# Uso: ./scripts/update-database-url.sh "postgresql://user:pass@host:5432/db?sslmode=require"

set -e

if [ -z "$1" ]; then
  echo "Erro: DATABASE_URL não fornecido"
  echo "Uso: $0 \"postgresql://user:pass@host:5432/db?sslmode=require\""
  exit 1
fi

DATABASE_URL="$1"
APP_NAME="nola-dev-backend"
RG="nola-rg"

echo "======================================"
echo "Atualizando DATABASE_URL no Container App"
echo "======================================"
echo "App: $APP_NAME"
echo "Resource Group: $RG"
echo "DATABASE_URL length: ${#DATABASE_URL}"
echo ""

# Verificar revisão atual
echo "Revisão atual:"
az containerapp show --name "$APP_NAME" --resource-group "$RG" \
  --query '{revision: properties.latestRevisionName, state: properties.provisioningState}' \
  -o json

echo ""
echo "Executando update..."

# Atualizar apenas DATABASE_URL
az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --set-env-vars "DATABASE_URL=$DATABASE_URL"

echo ""
echo "✓ Update concluído!"
echo ""
echo "Aguardando nova revisão ficar ativa..."
sleep 15

echo "Nova revisão:"
az containerapp show --name "$APP_NAME" --resource-group "$RG" \
  --query '{revision: properties.latestRevisionName, state: properties.provisioningState}' \
  -o json

echo ""
echo "======================================"
echo "✓ DATABASE_URL atualizado com sucesso!"
echo "======================================"
echo ""
echo "Testando endpoint:"
curl -s "https://nola-dev-backend.niceocean-7209230a.eastus2.azurecontainerapps.io/api/data-range?cube=sales"
