# 🧭 Arquitetura escolhida — Monólito modular com FastAPI + React/Bootstrap + PostgreSQL

Este documento reflete uma versão simplificada e prática da solução arquitetural, alinhada ao desafio (sem multi-tenant, sem necessidade de escalar para milhões de usuários) e ao seu stack atual (React, Bootstrap e FastAPI).

Objetivo: entregar analytics flexível, rápido e fácil de operar, aproveitando o PostgreSQL do desafio e mantendo baixo custo de deploy.

## Por que monólito modular?

- Tempo e simplicidade: um serviço de backend (FastAPI) e um frontend (React) são suficientes e mais rápidos de construir e manter.
- Evolução segura: módulos internos bem definidos (query, metadata, roles) permitem escalar/segregar futuramente se necessário.
- Custo baixo: menos peças para hospedar e observar.

## Componentes

1) Banco de Dados (PostgreSQL)
- Usa o schema fornecido pelo repositório.
- Views analíticas (fatos/dimensões) para padronizar joins e nomenclatura.
- Índices alvos para filtros mais comuns; materialized views opcionais para queries frequentes.

2) Backend API (FastAPI)
- Endpoints principais:
  - `GET /api/metadata` — catálogo de dimensões/medidas disponíveis por “cubo” (Vendas, Produtos, Delivery...).
  - `POST /api/query` — recebe uma Query JSON (medidas, dimensões, filtros, ordenação) e retorna dados agregados.
- Separação por função (sem autenticação complexa):
  - O cliente envia `role=marketing|gerencia|financeiro` (em query param ou header).
  - O backend aplica um “perfil de acesso leve”: filtra dimensões/medidas permitidas e/ou pré-aplica filtros (ex.: marketing não vê métricas financeiras sensíveis).
- Cache: in-memory (dicionário/TTL) no MVP; Redis opcional para reforço.
- Observabilidade: logs estruturados com latência por consulta; limites (statement_timeout) no Postgres.

3) Frontend (React + Bootstrap)
- SPA com Vite + Recharts.
- “Seleção de papel” (Marketing, Gerência, Financeiro) com dashboards dedicados.
- Melhorias recentes de UX:
  - Legendas dos gráficos de barras com espaçamento ampliado e posicionadas próximas ao rodapé dos cards.
  - Gráficos de pizza com legendas fixadas no bottom (sem sobreposição aos rótulos).
  - Sidebar (Explorer) com nomes amigáveis PT‑BR para medidas e dimensões e dropdown “Ordenar por” também amigável.
  - Tabela de resultados do Explorer com cabeçalhos e valores numéricos alinhados à direita, formatação monetária e CSV de exportação.

4) Deploy (free)
- Recomendado: Azure for Students (App Service para FastAPI + Static Web Apps para React + PostgreSQL flexível gratuito do plano).
- Alternativas:
  - Oracle Cloud Free Tier: VM grátis com Docker Compose rodando Postgres + FastAPI + React.
  - Render (free): bom para demo rápida (atenção ao banco gratuito temporal).

## Modelo analítico (simples e direto)

Views (exemplos conceituais):
- `vw_fact_sales` (1 por venda): chaves (store, channel, customer, created_at) e medidas (total_amount, value_paid, descontos, fees, produção/entrega).
- `vw_fact_product_sales` (itens vendidos): (sale_id, product_id, quantity, total_price, store, channel, created_at).
- Dimensões: `vw_dim_store`, `vw_dim_channel`, `vw_dim_product`, `vw_dim_time` (date, year, month, week, dow, hour).

Materialized views (opcionais, se precisar <1s constante):
- `mv_sales_daily_store_channel` (agregação diária por loja/canal: faturamento, pedidos, ticket médio, cancelamentos).
- `mv_product_sales_daily_product_store_channel` (top-N produtos diários por loja/canal).

Índices essenciais:
- `sales(created_at)`, `sales(store_id)`, `sales(channel_id)`, `sales(sale_status_desc)` e parcial para `COMPLETED`.
- `product_sales(product_id, sale_id)` e `product_sales(sale_id)`.
- `delivery_addresses(city)`, `(neighborhood)`, `(sale_id)`.
- `payments(sale_id)`, `(payment_type_id)`.

## Contrato de Query (JSON enxuto)

Exemplo do corpo em `POST /api/query`:

```json
{
  "role": "marketing",
  "cube": "sales",
  "measures": ["sales.total_amount", "sales.orders", "sales.ticket_medio"],
  "dimensions": ["time.date", "store.name", "channel.name"],
  "filters": [
    {"dimension": "time.date", "op": "between", "values": ["2025-05-01", "2025-05-31"]},
    {"dimension": "sales.status", "op": "equals", "values": ["COMPLETED"]}
  ],
  "granularity": "day",
  "order": [{"by": "sales.total_amount", "dir": "desc"}],
  "limit": 100
}
```

Medidas padrão (exemplos):
- `sales.total_amount = SUM(total_amount)`
- `sales.orders = COUNT(*)`
- `sales.ticket_medio = SUM(total_amount) / NULLIF(COUNT(*),0)`
- `sales.cancelamentos = COUNT(*) WHERE status='CANCELLED'`
- `delivery.p90 = PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY delivery_seconds)`

Roteamento da consulta:
- Se a granularidade e filtros “batem” com uma materialized view → usa MV.
- Caso contrário, usa as views base com índices (limite padrão e paginação).

## Estratégia de performance

- Alvo: <1s p95 para consultas típicas (mês atual, top-N, comparações de 2 lojas/canais).
- Índices e where seletivos (especialmente para COMPLETED e intervalos de data).
- Limites de proteção: `limit` padrão, paginação, `statement_timeout` no Postgres.
- Cache de resultados no backend (TTL 60–300s) por chave da Query.
- MVs apenas quando necessário para consultas de overview muito acessadas.

## Segurança e papéis (sem auth complexa)

- Sem login: a seleção de papel é explícita e o backend aplica whitelist de medidas/dimensões por papel.
- Isso evita expor métricas indevidas e mantém a experiência simples para o desafio.
- CORS habilitado apenas para o domínio do frontend.

## Estrutura de diretórios (projeto atual)

```
.
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py                  # FastAPI bootstrap e CORS
│       ├── api/
│       │   ├── query.py             # POST /api/query
│       │   ├── distinct.py          # POST /api/distinct
│       │   ├── metadata.py          # GET /api/metadata
│       │   └── quick.py             # rotas utilitárias de debug/saúde
│       ├── core/
│       │   ├── cache.py             # cache in-memory com TTL
│       │   └── config.py            # env/DATABASE_URL/statement_timeout
│       ├── db/
│       │   ├── indexes.sql          # índices recomendados
│       │   └── views.sql            # views analíticas (opcional)
│       └── domain/
│           ├── model.yaml           # cat. de cubos/medidas/dimensões e papéis
│           └── translator.py        # Query JSON → SQL (validação de role)
├── frontend/
│   ├── Dockerfile
│   ├── index.html
│   └── src/
│       ├── api.js                   # wrapper de chamadas ao backend
│       ├── App.jsx, main.jsx
│       ├── components/              # Explorer, Sidebar etc.
│       └── views/                   # Marketing.jsx, Gerencia.jsx, Financeiro.jsx
├── docker-compose.yml               # Postgres + Backend + Frontend + ferramentas
├── Dockerfile                       # data-generator (gera 500k vendas)
├── generate_data.py                 # script de geração de dados
├── requisitos-desafio/
│   ├── database-schema.sql          # schema SQL inicial (migrado da raiz)
│   ├── requirements.txt             # deps do data-generator (migrado da raiz)
│   ├── PROBLEMA.md
│   └── AVALIACAO.md
├── ARQUITETURA.md                   # este documento
└── README.md
```

Observação: os arquivos `database-schema.sql` e `requirements.txt` foram movidos para `requisitos-desafio/` e as referências no `docker-compose.yml` e no `Dockerfile` do gerador de dados foram atualizadas para refletir o novo caminho.

## Roadmap pragmático

MVP (8–12h)
- Criar views analíticas básicas e índices.
- Backend FastAPI: `/api/metadata` (estático) e `/api/query` (sales e products).
- Frontend React + Bootstrap: seleção de papel e 2 dashboards iniciais (overview e top produtos).

Iteração 2 (12–24h)
- Cache in-memory + export CSV.
- Comparação de períodos e drill-down simples (dia → hora).
- Mais um cubo (delivery ou pagamentos) e um card por papel.

Iteração 3 (24–36h)
- MVs para overviews mais acessadas e ranking de produtos.
- Export PNG dos gráficos e melhorias de UX.
- Testes de integração e benchmark de 8–10 queries comuns.

## Como rodar (local)

1. Siga o `QUICKSTART.md` para gerar os dados no Postgres (Docker necessário).
2. Inicie o backend FastAPI (uvicorn) apontando para o Postgres local.
3. Inicie o frontend (Vite/CRA) e configure `API_BASE_URL` para o backend.

Durante o desenvolvimento, você pode pular Redis; o cache in-memory já ajuda.

## Deploy sem custo

- Azure for Students (recomendado):
  - Backend: Azure App Service (container ou Python).
  - Frontend: Azure Static Web Apps.
  - Banco: Azure Database for PostgreSQL (aproveitando cota do plano estudantil).

- Oracle Cloud Free Tier:
  - VM ARM free com Docker Compose: Postgres + FastAPI + React.
  - DNS grátis (opcional) e certificados via Caddy/Traefik (opcional).

- Render (free):
  - Backend como Web Service, frontend como Static Site.
  - Banco: atenção ao Postgres gratuito temporal (bom para demo curta).

---

Essa arquitetura prioriza rapidez de entrega, baixo custo e ótima UX para a Maria: visões por papel, respostas rápidas e um fluxo simples para explorar dados sem escrever SQL.
