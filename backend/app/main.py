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
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.responses import Response
import logging

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

# Redireciona para HTTPS quando suportado pelo ambiente (no Azure, TLS é padrão)
app.add_middleware(HTTPSRedirectMiddleware)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Adiciona cabeçalhos de segurança nas respostas HTTP.

    - HSTS força HTTPS em navegadores (se servido por HTTPS)
    - X-Frame-Options bloqueia clickjacking
    - X-Content-Type-Options impede content sniffing
    - Referrer-Policy reduz vazamento de url de origem
    - Permissions-Policy desativa APIs não utilizadas
    """
    response: Response = await call_next(request)
    response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    return response

# Log de alerta se CORS estiver permissivo em produção
if settings.ALLOW_ORIGINS == ["*"]:
    logging.getLogger("uvicorn.error").warning(
        "CORS está liberado para todas as origens ('*'). Defina ALLOW_ORIGINS em produção."
    )

app.include_router(metadata_router, prefix="/api")
app.include_router(query_router, prefix="/api")
app.include_router(quick_router, prefix="/api")
app.include_router(distinct_router, prefix="/api")
app.include_router(datarange_module.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
