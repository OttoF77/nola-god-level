# Nola — Analytics de Varejo (FastAPI + React + PostgreSQL)

Este projeto implementa um monólito modular com backend FastAPI e frontend React (Vite) para explorar dados de vendas, produtos e pagamentos de uma rede de restaurantes. Ele foi desenvolvido para atender ao desafio descrito em `requisitos-desafio/PROBLEMA.md` e avaliado segundo `requisitos-desafio/AVALIACAO.md`.

## 🚀 Quick Start (Azure Deploy)

Para deployar na Azure usando créditos estudantis:

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

## Visão geral

- Backend: FastAPI com endpoints `/api/metadata`, `/api/query`, `/api/distinct` e `/api/data-range`.
- Frontend: SPA React com três visões por papel (Marketing, Gerência e Financeiro) e um Explorer para análise livre.
- Banco: PostgreSQL com schema do desafio, seed via `generate_data.py`.
- Docker Compose: orquestração de Postgres, Backend e Frontend.

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

## Como rodar (local)

1. Suba o Postgres e gere dados (opcional):

```bash
# Iniciar Postgres
docker compose up -d postgres
# Gerar dados (perfil tools)
docker compose --profile tools run --rm data-generator
```

2. Backend em dev (fora do Docker):

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

3. Frontend em dev:

```bash
cd frontend
npm install
# configure VITE_API_BASE_URL em frontend/.env.local se necessário
npm run dev
```

4. End-to-end com Docker Compose:

```bash
docker compose up -d backend frontend
```

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

## Deploy (Azure for Students)

Este projeto será deployado na **Azure usando créditos estudantis** ($200 USD), priorizando **serviços gratuitos e de baixo custo** para maximizar o uso do crédito durante o período de avaliação.

### Arquitetura Azure escolhida

- **PostgreSQL**: Azure Database for PostgreSQL – Flexible Server (tier **Burstable B1ms**, 1 vCPU, 2 GiB RAM, 32 GiB storage). Estimativa: ~$12–15/mês.
- **Backend**: Azure Container Apps (consumo, escala 0→N). Free tier: primeiros 180k vCPU-s e 360k GiB-s/mês gratuitos. Estimativa para MVP: ~$0–5/mês.
- **Frontend**: Azure Static Web Apps (tier Free). Banda e hospedagem: **$0/mês**.
- **Container Registry**: Azure Container Registry (tier Basic, $5/mês) para armazenar imagens Docker do backend.

**Custo mensal estimado**: $17–25/mês (~$75–100 durante os 3–4 meses do crédito estudantil).

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

**Duração do crédito**: ~8–12 meses com $200 USD (assumindo custo médio de $20/mês).

**Otimizações aplicadas**:
- Container Apps escala para 0 quando ocioso (idle).
- PostgreSQL em tier Burstable (mais barato).
- Static Web Apps tier Free (sem custos de banda até 100 GB).
- Sem Application Insights ou Log Analytics em tier pago (usar built-in logs gratuitos).

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
