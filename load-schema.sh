#!/bin/bash

# Script para carregar schema no PostgreSQL Azure
# Uso: ./load-schema.sh

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Carregando Schema no PostgreSQL Azure ===${NC}\n"

# Verificar se database-schema.sql existe
SCHEMA_FILE="requisitos-desafio/database-schema.sql"
if [ ! -f "$SCHEMA_FILE" ]; then
    echo -e "${RED}❌ Erro: $SCHEMA_FILE não encontrado!${NC}"
    exit 1
fi

# Solicitar senha
echo -e "${YELLOW}Digite a senha do usuário postgre_adm:${NC}"
read -s POSTGRES_PASSWORD
echo

# Connection string
DB_URL="postgresql://postgre_adm:${POSTGRES_PASSWORD}@challenge-nola-server.postgres.database.azure.com:5432/challenge_db?sslmode=require"

echo -e "${YELLOW}📊 Carregando schema...${NC}"

# Carregar schema
if psql "$DB_URL" < "$SCHEMA_FILE" 2>&1 | tee /tmp/schema-load.log; then
    echo -e "\n${GREEN}✅ Schema carregado com sucesso!${NC}\n"
else
    echo -e "\n${RED}❌ Erro ao carregar schema. Verifique o log acima.${NC}"
    exit 1
fi

# Verificar tabelas criadas
echo -e "${YELLOW}📋 Verificando tabelas criadas...${NC}"
psql "$DB_URL" -c "\dt" -t | sed 's/^/  /'

echo -e "\n${GREEN}✅ Pronto! Banco challenge_db está configurado.${NC}"
echo -e "${YELLOW}💡 Próximo passo: Execute o deploy da infraestrutura Azure${NC}"
