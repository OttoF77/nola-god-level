from fastapi import APIRouter, HTTPException, Query
import psycopg2
from psycopg2.extras import RealDictCursor

from app.core.config import settings

router = APIRouter()


def _fetch_one(sql: str, params: tuple = ()):  
    conn = psycopg2.connect(settings.DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET statement_timeout TO %s", (settings.STATEMENT_TIMEOUT,))
            cur.execute(sql, params)
            return cur.fetchone() or {}
    finally:
        conn.close()


@router.get("/data-range")
def data_range(cube: str = Query(..., pattern="^(sales|products|payments)$")):
    """Retorna o intervalo [min_date, max_date] disponível por cube, baseado em DATE(created_at).
    Útil para a UI limitar filtros de período ao que existe no banco.
    """
    cube = cube.lower()
    if cube == "sales":
        row = _fetch_one("SELECT MIN(DATE(created_at)) AS min_date, MAX(DATE(created_at)) AS max_date FROM sales")
    elif cube == "products":
        row = _fetch_one(
            """
            SELECT MIN(DATE(s.created_at)) AS min_date, MAX(DATE(s.created_at)) AS max_date
            FROM sales s
            JOIN product_sales ps ON ps.sale_id = s.id
            """
        )
    elif cube == "payments":
        row = _fetch_one(
            """
            SELECT MIN(DATE(s.created_at)) AS min_date, MAX(DATE(s.created_at)) AS max_date
            FROM sales s
            JOIN payments pay ON pay.sale_id = s.id
            """
        )
    else:
        raise HTTPException(status_code=400, detail="Cube inválido")

    min_date = row.get("min_date")
    max_date = row.get("max_date")
    return {
        "cube": cube,
        "min_date": str(min_date) if min_date else None,
        "max_date": str(max_date) if max_date else None,
    }
