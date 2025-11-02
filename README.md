# Nola — Analytics de Varejo (FastAPI + React + PostgreSQL)

Este projeto implementa um monólito modular com backend FastAPI e frontend React (Vite) para explorar dados de vendas, produtos e pagamentos de uma rede de restaurantes. Ele foi desenvolvido para atender ao desafio descrito em `requisitos-desafio/PROBLEMA.md` e avaliado segundo `requisitos-desafio/AVALIACAO.md`.

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

## Deploy (Azure ou Oracle Cloud)

Opção A — Azure (mais simples):
- Banco: Azure Database for PostgreSQL (ou Postgres em Container Apps com volume persistente).
- Backend: Azure App Service (container) expondo porta 8000.
- Frontend: Azure Static Web Apps ou App Service (container) servindo build estático.
- Configurações:
  - BACKEND: `DATABASE_URL`, `ALLOW_ORIGINS` (domínio do frontend), `STATEMENT_TIMEOUT`.
  - FRONTEND: `VITE_API_BASE_URL` apontando para o backend.

Opção B — Oracle Cloud (Free Tier):
- Subir uma VM com Docker e rodar `docker compose up -d` (como em dev).
- Abrir portas 8000 (backend) e 5173 (frontend) no security list.
- Recomenda-se um proxy (Caddy/Traefik) para TLS e domínios.

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
