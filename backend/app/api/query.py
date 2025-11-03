"""
Rotas de consulta analítica.

POST /api/query
- Recebe uma Query JSON (cubo, medidas, dimensões, filtros,
    granularidade, ordenação, limite).
- Converte a Query em SQL via translator.build_sql, valida papéis
    (role) e whitelist.
- Executa no PostgreSQL com RealDictCursor e aplica statement_timeout
    para evitar travas.
- Cacheia o resultado por 120s usando uma chave derivada do corpo JSON.

Dicas:
- O campo "order" só pode ordenar por colunas selecionadas
    (validado no translator).
- O "limit" é clamped no translator para proteger o banco (máx. 10.000).
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import json

import psycopg2
from psycopg2.extras import RealDictCursor

from app.core.config import settings
from app.core.cache import ttl_cache
from app.domain.translator import build_sql


router = APIRouter()


class Filter(BaseModel):
    dimension: str
    op: Literal["equals", "in", "between"]
    values: List[str]


class OrderSpec(BaseModel):
    by: str
    dir: Literal["asc", "desc"] = "desc"


class QueryRequest(BaseModel):
    role: Optional[str] = Field(
        default=None,
        description="roles: marketing|gerencia|financeiro",
    )
    cube: Literal["sales", "products", "payments"]
    measures: List[str]
    dimensions: List[str] = []
    filters: List[Filter] = []
    granularity: Optional[Literal["hour", "day", "month"]] = None
    order: List[OrderSpec] = []
    limit: int = 100

    def validate_security(self):
        # Limites para evitar abusos
        if len(self.measures) > 20:
            raise ValueError("Excesso de medidas (máx. 20)")
        if len(self.dimensions) > 10:
            raise ValueError("Excesso de dimensões (máx. 10)")
        if len(self.filters) > 20:
            raise ValueError("Excesso de filtros (máx. 20)")
        for f in self.filters:
            # Limitar quantidade e tamanho dos valores
            # em filtros 'in'/'equals'/'between'
            if f.op == "in" and len(f.values) > 200:
                raise ValueError("Filtro 'in' com valores demais (máx. 200)")
            for v in f.values:
                if isinstance(v, str) and len(v) > 200:
                    raise ValueError(
                        "Valor de filtro muito longo (máx. 200 caracteres)"
                    )


def fetch_all(sql: str, params: list):
    conn = psycopg2.connect(settings.DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Proteção contra consultas longas
            cur.execute(
                "SET statement_timeout TO %s",
                (settings.STATEMENT_TIMEOUT,),
            )
            cur.execute(sql, params)
            return cur.fetchall()
    finally:
        conn.close()


@router.post("/query")
def run_query(req: QueryRequest):
    # Regras de segurança adicionais
    try:
        req.validate_security()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # cache key
    key = json.dumps(req.model_dump(), sort_keys=True)
    cached = ttl_cache.get(key)
    if cached is not None:
        return {
            "cached": True,
            "rows": cached["rows"],
            "columns": cached["columns"],
        }

    try:
        sql, params, columns = build_sql(
            cube=req.cube,
            role=req.role,
            measures=req.measures,
            dimensions=req.dimensions,
            filters=[f.model_dump() for f in req.filters],
            granularity=req.granularity,
            order=[o.model_dump() for o in req.order],
            limit=req.limit,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    rows = fetch_all(sql, params)
    ttl_cache.set(key, {"rows": rows, "columns": columns}, ttl_seconds=120)
    return {"cached": False, "rows": rows, "columns": columns}
