# Nola — Analytics de Varejo (FastAPI + React + PostgreSQL)

> Plataforma analítica para varejo/restaurantes com foco em métricas de faturamento, canais, produtos e métodos de pagamento. Monólito modular (FastAPI + React) pronto para evoluir em direção a serviços.

## 📚 Índice
1. [Visão Geral](#visão-geral)
2. [Quick Start (Azure)](#-quick-start-azure-deploy)
3. [Arquitetura](#arquitetura)
4. [Tecnologias](#tecnologias)
5. [Screenshots e Fluxo de Uso](#-screenshots-e-fluxo-de-uso)
   - [Página Inicial / Navegação](#1-página-inicial)
   - [Aba Marketing](#2-marketing)
   - [Aba Gerência](#3-gerência)
   - [Aba Financeiro](#4-financeiro)
6. [Como Rodar Localmente](#como-rodar-local)
7. [O Desafio](#o-que-foi-pedido-no-desafio-e-como-atendemos)
8. [Decisões de Projeto](#decisões-de-projeto)
9. [Deploy Azure e Custos](#deploy-azure)
10. [Segurança](#segurança)
11. [Testes Rápidos](#testes-rápidos)
12. [Troubleshooting](#troubleshooting)## Visão Geral

Este projeto implementa um monólito modular com backend FastAPI e frontend React (Vite) para explorar dados de vendas, produtos e pagamentos de uma rede de restaurantes. Ele foi desenvolvido para atender ao desafio descrito em `requisitos-desafio/PROBLEMA.md` e avaliado segundo `requisitos-desafio/AVALIACAO.md`.

## 🚀 Quick Start (Azure Deploy)

Para deployar na Azure:

```bash
# 1. Executar script de setup (cria infraestrutura e exibe secrets)
./scripts/azure-setup.sh

# 2. Adicionar secrets no GitHub (ver output do script)
# Settings → Secrets and variables → Actions

# 3. Deploy via GitHub Actions
# Actions → Backend Deploy → Run workflow (dev)
# Actions → Frontend Deploy → Run workflow (dev)
```

**Guia completo de deploy**: veja `DEPLOY.md` para instruções detalhadas passo a passo.

### Resumo Funcional

- **Backend**: Endpoints `/api/metadata`, `/api/query`, `/api/distinct`, `/api/data-range`, healthcheck e otimizações (cache, clamps, timeout).
- **Frontend**: 3 visões orientadas a papéis + Explorer de análise ad-hoc (query builder visual).
- **Banco**: PostgreSQL com schema analítico e dados sintéticos gerados (volume configurável).
- **Infra**: Docker Compose local; preparado para Azure (Container Apps + Static Web Apps + Postgres Flexible Server).

## Tecnologias

- Python 3.11, FastAPI, psycopg2
- React 18 + Vite, Recharts, Bootstrap
- PostgreSQL 15
- Docker/Docker Compose

## Arquitetura

A arquitetura é detalhada em `ARQUITETURA.md`. Destaques:
- Query JSON → SQL com validação por papel (whitelists) em `backend/app/domain/translator.py`.
- Modelo analítico declarativo em `backend/app/domain/model.yaml`.
- Cache in-memory com TTL (`backend/app/core/cache.py`).
- Frontend organizado por views de papel, com componentes reutilizáveis (Explorer e Sidebar/ExplorerControls).

## 📸 Screenshots e Fluxo de Uso

As imagens abaixo ilustram a experiência do usuário e os componentes principais. As capturas estão em `imagens/`.

### 1. Página Inicial
![Página inicial](imagens/ngl01.png)
**Destaques:** Navegação clara entre abas (Marketing, Gerência, Financeiro), seletor de período sincronizado via `localStorage`, layout responsivo preparado para mobile, componentes com carregamento incremental e mensagens de estado (loading/erro).

### 2. Marketing
![Marketing — flags e gráficos](imagens/ngl02.png)
**Foco:** Faturamento diário por canal (gráfico de linha empilhando cada canal), KPIs agregados (faturamento total, pedidos, ticket médio) e Top 10 produtos (barras). O seletor de período redefine todas as visões. As "flags" representam filtros/período selecionado persistidos, garantindo consistência quando o usuário alterna abas. Em telas pequenas o gráfico de barras alterna para layout horizontal (melhora leitura de nomes de produtos extensos).

**Interações chave:**
- Filtros de período (Hoje / Mês atual / Personalizado).
- Tooltip com formatação monetária e abreviação de milhares/milhões.
- Explorer acoplado para análises adicionais sem sair da aba.

### 3. Gerência
![Gerência — visão consolidada](imagens/ngl03.png)
**Foco:** Top 10 lojas por faturamento (barras), faturamento por canal (pizza para proporção relativa) e evolução mensal (linha) dos últimos 6 meses. Combina granularidade temporal agregada (MONTH) com detalhamento categorical. Em mobile as barras podem alternar para horizontal para rótulos extensos de lojas.

**Detalhes:**
- Cálculo de intervalo de últimos 6 meses derivado do período atual.
- Validação de status `COMPLETED` para métricas confiáveis.
- Uso de whitelists por papel para restringir dimensões/medidas.

### 4. Financeiro
![Financeiro — receitas e mix de pagamentos](imagens/ngl04.png)
**Foco:** Mix por status (pizza), receita por canal (barras/horizontal em mobile) e mix de métodos de pagamento (pizza). Destaca distribuição de fluxo financeiro e conversão de pedidos. Escala horizontal automática em mobile reduz atrito de leitura.

**Pontos técnicos:**
- Conversão de valores para BRL com locale `pt-BR`.
- Condições adaptativas (viewport < 576px) para trocar eixo e margens.
- Agrupamento por tipos de pagamento para composição de share.

### Padrões de UX aplicados
- Adaptação de rótulos para legibilidade (ângulo, truncamento potencial, layout horizontal).
- Margens dinâmicas em gráficos para evitar overlap em telas menores.
- Feedback imediato de carregamento/erro com estados distintos.
- Seletor de período compartilhado entre abas (eventos customizados + localStorage).

## Como rodar (local)

### Pré-requisitos

- Docker e Docker Compose instalados
- (Opcional) Python 3.11+ e Node.js 20+ para desenvolvimento fora do Docker

### 1. Configurar variáveis de ambiente

⚠️ **Importante**: Por segurança, as credenciais não estão mais hardcoded no `docker-compose.yml`.

```bash
# Copie o template de variáveis de ambiente
cp .env.example .env

# Edite .env e altere as senhas padrão
# Use senhas fortes para POSTGRES_PASSWORD e PGADMIN_DEFAULT_PASSWORD
nano .env  # ou seu editor preferido
```

Exemplo de `.env` com senhas seguras:
```bash
POSTGRES_DB=challenge_db
POSTGRES_USER=challenge
POSTGRES_PASSWORD=SuaSenhaForteAqui123!

DATABASE_URL=postgresql://challenge:SuaSenhaForteAqui123!@postgres:5432/challenge_db

PGADMIN_DEFAULT_EMAIL=admin@example.com
PGADMIN_DEFAULT_PASSWORD=OutraSenhaForte456!
```

### 2. Suba o Postgres e gere dados (opcional):

```bash
# Iniciar Postgres
docker compose up -d postgres

# Gerar dados (perfil tools)
docker compose --profile tools run --rm data-generator
```

### 3. Backend em dev (fora do Docker):

```bash
cd backend
pip install -r requirements.txt

# Configure DATABASE_URL no terminal ou em backend/.env
export DATABASE_URL="postgresql://challenge:SuaSenhaForteAqui123!@localhost:5432/challenge_db"

uvicorn app.main:app --reload
```

### 4. Frontend em dev:

```bash
cd frontend
npm install

# Configure VITE_API_BASE_URL em frontend/.env.local se necessário
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local

npm run dev
```

### 5. End-to-end com Docker Compose:

```bash
# Certifique-se de ter configurado o .env primeiro!
docker compose up -d backend frontend
```

Acesse:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- PgAdmin (opcional): http://localhost:5050 (se executar `docker compose --profile tools up -d pgadmin`)

**Nota de Segurança**: Veja `SECURITY.md` para mais detalhes sobre gerenciamento seguro de credenciais.

## O que foi pedido no desafio (e como atendemos)

Veja `requisitos-desafio/PROBLEMA.md` e `requisitos-desafio/AVALIACAO.md`. Em resumo, o app entrega:
- Dashboard por papel (Marketing, Gerência, Financeiro) com métricas chave: faturamento, pedidos, ticket médio, top produtos, canais e métodos de pagamento.
- Explorer (análise livre) com seleção de medidas/dimensões, filtros, granularidade e exportação CSV.
- Performance prática: índices no banco, limites de consulta, timeout e cache simples.
- UX cuidada: legendas reposicionadas para melhor leitura, nomes amigáveis PT‑BR e tabela formatada.

## Estrutura de diretórios

```
backend/           # FastAPI, domínio e SQL de apoio
frontend/          # React (Vite), componentes e views
requisitos-desafio/
  ├─ database-schema.sql
  ├─ requirements.txt       # deps do data-generator
  ├─ PROBLEMA.md
  └─ AVALIACAO.md
Dockerfile         # data-generator
docker-compose.yml # Postgres + Backend + Frontend (+ tools)
```

Nota: `database-schema.sql` e `requirements.txt` foram movidos para `requisitos-desafio/` e as referências no Compose/Dockerfile foram atualizadas.

## Decisões de projeto

- Monólito modular: simplicidade e velocidade para MVP; fácil de particionar no futuro.
- Whitelist por papel: reduz acoplamento e risco sem exigir autenticação sofisticada.
- Cache em memória: suficiente para o escopo; Redis é caminho natural para escalar.
- Recharts: produtividade e boa integração com dados agregados.

## Deploy (Azure)

Este projeto está preparado para deploy na **Azure**, priorizando **serviços gratuitos e de baixo custo** para otimizar OPEX do cliente.

### Arquitetura Azure escolhida

- **PostgreSQL**: Azure Database for PostgreSQL – Flexible Server (tier **Burstable B1ms**, 1 vCPU, 2 GiB RAM, 32 GiB storage). Estimativa: ~$12–15/mês.
- **Backend**: Azure Container Apps (consumo, escala 0→N). Free tier: primeiros 180k vCPU-s e 360k GiB-s/mês gratuitos. Estimativa para MVP: ~$0–5/mês.
- **Frontend**: Azure Static Web Apps (tier Free). Banda e hospedagem: **$0/mês**.
- **Container Registry**: Azure Container Registry (tier Basic, $5/mês) para armazenar imagens Docker do backend.

**Custo mensal estimado**: $17–25/mês (ambiente de pequeno porte/MVP).

### Serviços Azure e configuração

#### 1. PostgreSQL Flexible Server
- Tier: **Burstable B1ms** (1 vCPU, 2 GiB RAM).
- Storage: 32 GiB (suficiente para ~1M de vendas).
- High Availability: desabilitado (reduz custo).
- Backup: retenção de 7 dias (padrão gratuito).
- Rede: acesso público com firewall (liberar IPs do Container Apps) ou VNet integration.

#### 2. Azure Container Apps (backend)
- Escala: min 0, max 3 réplicas (reduz custo em idle).
- CPU/Memória: 0.25 vCPU, 0.5 GiB (suficiente para FastAPI).
- Ingress: habilitado, porta 8000, HTTPS automático.
- Variáveis de ambiente:
  - `DATABASE_URL`: `postgresql://usuario:senha@SERVIDOR.postgres.database.azure.com:5432/challenge_db?sslmode=require`
  - `ALLOW_ORIGINS`: `https://SEU_FRONTEND.azurestaticapps.net`
  - `STATEMENT_TIMEOUT`: `15s` (opcional)

#### 3. Azure Static Web Apps (frontend)
- Tier: **Free** (100 GB bandwidth/mês, suficiente para MVP).
- Build: Vite (`npm run build` → `dist/`).
- Variável de ambiente (build-time):
  - `VITE_API_BASE_URL`: `https://SEU_BACKEND.REGIAO.azurecontainerapps.io`

#### 4. Azure Container Registry (ACR)
- Tier: **Basic** ($5/mês, 10 GiB storage).
- Armazena imagem Docker do backend para deploy no Container Apps.

### Provisionamento (IaC com Bicep)

Criaremos arquivos Bicep para provisionar toda a infraestrutura de forma reproduzível:
- `infra/main.bicep`: orquestra módulos.
- `infra/modules/postgres.bicep`: PostgreSQL Flexible Server.
- `infra/modules/container-apps.bicep`: Container Apps Environment + backend app.
- `infra/modules/acr.bicep`: Container Registry.
- `infra/modules/static-web-app.bicep`: Static Web App (frontend).

### CI/CD (GitHub Actions)

Workflow automatizado para build, push e deploy:
1. **Backend**: build da imagem Docker → push para ACR → deploy no Container Apps.
2. **Frontend**: build estático com Vite → deploy no Static Web Apps.
3. **Secrets necessários** (GitHub):
   - `AZURE_CREDENTIALS`: service principal com permissões de contributor.
   - `ACR_USERNAME` e `ACR_PASSWORD`: credenciais do Container Registry.
   - `POSTGRES_CONNECTION_STRING`: connection string do banco (ou construída via secrets individuais).

### Custos e otimização

| Serviço | Tier/Config | Custo mensal (USD) |
|---------|-------------|---------------------|
| PostgreSQL Flexible | Burstable B1ms | $12–15 |
| Container Apps | 0.25 vCPU, min 0 | $0–5 (free tier) |
| Static Web Apps | Free | $0 |
| Container Registry | Basic | $5 |
| **Total** | | **$17–25/mês** |

Nota de custos ao cliente: valores estimados — variam por região, tráfego real, volume de dados (storage/IOPS) e logs. Para MVP de baixo tráfego, o intervalo de $17–25/mês é típico.

**Otimizações aplicadas**:
- Container Apps escala para 0 quando ocioso (idle).
- PostgreSQL em tier Burstable (mais barato).
- Static Web Apps tier Free (sem custos de banda até 100 GB).
- Sem Application Insights ou Log Analytics em tier pago (usar built-in logs gratuitos).

## Segurança

### 🔒 Gerenciamento de Credenciais

Este projeto implementa boas práticas de segurança para proteção de credenciais:

- ✅ **Variáveis de ambiente**: Todas as senhas estão em arquivos `.env` (não versionados)
- ✅ **Template `.env.example`**: Fornece estrutura sem expor credenciais reais
- ✅ **Validação obrigatória**: Docker Compose falha se variáveis críticas não estiverem definidas
- ✅ **Documentação**: `SECURITY.md` detalha práticas recomendadas

### Checklist rápido

Antes de rodar o projeto:
1. ✓ Copie `.env.example` para `.env`
2. ✓ Altere TODAS as senhas padrão
3. ✓ Nunca commite o arquivo `.env`
4. ✓ Em produção, use Azure Key Vault ou equivalente

**Leia mais**: Consulte `SECURITY.md` para guia completo de segurança, incluindo configuração de Azure Key Vault e GitHub Secrets.

**Vulnerabilidade corrigida (2025-11-15)**: Credenciais hardcoded foram removidas do `docker-compose.yml` e substituídas por variáveis de ambiente.

## Testes rápidos

- Healthcheck: `GET http://localhost:8000/health`.
- Metadata: `GET http://localhost:8000/api/metadata`.
- Consulta exemplo (sales por dia): POST `/api/query` com corpo em `ARQUITETURA.md`.

## Troubleshooting

- Erros CORS: verifique `ALLOW_ORIGINS` no backend e `VITE_API_BASE_URL` no frontend.
- Tempo de consulta: ajustar `STATEMENT_TIMEOUT` e revisar índices/intervalo de datas.
- Dados vazios: confirme que rodou o `data-generator` e o período selecionado tem dados.

---

Contribuições e melhorias são bem-vindas. Explore os arquivos com comentários em PT‑BR para acelerar a leitura do código.
