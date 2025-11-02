"""
Endpoint para recuperar valores distintos de uma dimensão.

POST /api/distinct
- Recebe o nome de uma dimensão e filtros opcionais; responde com a lista de valores únicos.
- Usa o translator para garantir que a dimensão é permitida pelo papel (role) e aplicar filtros.
- Cacheia por 300s com chave derivada do corpo da requisição.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
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


class DistinctRequest(BaseModel):
    role: Optional[str] = None
    cube: Literal["sales", "products", "payments"]
    dimension: str
    filters: List[Filter] = []
    granularity: Optional[Literal["hour", "day", "month"]] = None
    limit: int = 100

    def validate_security(self):
        if len(self.filters) > 20:
            raise ValueError("Excesso de filtros (máx. 20)")
        for f in self.filters:
            if f.op == "in" and len(f.values) > 200:
                raise ValueError("Filtro 'in' com valores demais (máx. 200)")
            for v in f.values:
                if isinstance(v, str) and len(v) > 200:
                    raise ValueError("Valor de filtro muito longo (máx. 200 caracteres)")


def fetch_all(sql: str, params: list):
    conn = psycopg2.connect(settings.DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET statement_timeout TO %s", (settings.STATEMENT_TIMEOUT,))
            cur.execute(sql, params)
            return cur.fetchall()
    finally:
        conn.close()


@router.post("/distinct")
def get_distinct(req: DistinctRequest):
    try:
        req.validate_security()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Contruímos um SELECT apenas com a dimensão e um GROUP BY, limitando o resultado
    # Reutiliza o build_sql para respeitar whitelists por role e aplicar filtros com segurança.
    key = json.dumps(req.model_dump(), sort_keys=True)
    cached = ttl_cache.get(key)
    if cached is not None:
        return {"cached": True, "values": cached["values"]}

    try:
        sql, params, columns = build_sql(
            cube=req.cube,
            role=req.role,
            measures=[],
            dimensions=[req.dimension],
            filters=[f.model_dump() for f in req.filters],
            granularity=req.granularity,
            order=[{"by": req.dimension, "dir": "asc"}],
            limit=max(1, min(req.limit, 10000)),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    rows = fetch_all(sql, params)
    # extrair apenas a coluna da dimensão
    values = []
    col = req.dimension
    for r in rows:
        if col in r:
            values.append(r[col])
    ttl_cache.set(key, {"values": values}, ttl_seconds=300)
    return {"cached": False, "values": values}
