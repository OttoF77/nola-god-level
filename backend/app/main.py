"""
Aplicação FastAPI principal.

- Faz o bootstrap do app, configurando CORS e registrando as rotas.
- Rotas sob o prefixo /api: metadata, query, distinct e utilidades.
- O middleware de CORS lê origens permitidas de settings (env ALLOW_ORIGINS).
- Endpoint /health para healthcheck de container e load balancer.

Observações para iniciantes:
- Se o frontend estiver em outro domínio, ajuste ALLOW_ORIGINS (lista de URLs).
- Em produção, desative origens genéricas para evitar acessos indevidos.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.metadata import router as metadata_router
from app.api.query import router as query_router
from app.api.quick import router as quick_router
from app.api.distinct import router as distinct_router
from app.core.config import settings
from app.api import datarange as datarange_module

app = FastAPI(title="Restaurant Analytics API", version="0.1.0")

# CORS: ajuste origins conforme deploy do frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOW_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(metadata_router, prefix="/api")
app.include_router(query_router, prefix="/api")
app.include_router(quick_router, prefix="/api")
app.include_router(distinct_router, prefix="/api")
app.include_router(datarange_module.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
