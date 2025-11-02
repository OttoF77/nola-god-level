"""
Rotas utilitárias/rápidas para facilitar validação e demos.

- /quick/overview: retorna um resumo do mês atual considerando status COMPLETED.
- Útil para health-check funcional e para validar a conexão com o banco.
"""
from fastapi import APIRouter
from datetime import date
import psycopg2
from psycopg2.extras import RealDictCursor

from app.core.config import settings

router = APIRouter()


def _conn():
    return psycopg2.connect(settings.DATABASE_URL)


@router.get("/quick/overview")
def quick_overview():
    """Resumo rápido do mês atual: faturamento, pedidos e ticket médio (COMPLETED)."""
    today = date.today()
    start = date(today.year, today.month, 1)
    # último dia do mês atual (uso: mês seguinte dia 1 menos 1)
    if today.month == 12:
        end = date(today.year + 1, 1, 1)
    else:
        end = date(today.year, today.month + 1, 1)

    sql = """
        SELECT 
          COALESCE(SUM(s.total_amount), 0) as total_amount,
          COUNT(*) FILTER (WHERE s.sale_status_desc = 'COMPLETED') as orders,
          CASE WHEN COUNT(*) FILTER (WHERE s.sale_status_desc = 'COMPLETED') = 0 THEN 0
               ELSE SUM(s.total_amount) / NULLIF(COUNT(*) FILTER (WHERE s.sale_status_desc = 'COMPLETED'), 0)
          END as ticket_medio
        FROM sales s
        WHERE s.sale_status_desc = 'COMPLETED'
          AND s.created_at >= %s AND s.created_at < %s
    """
    with _conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET statement_timeout TO %s", (settings.STATEMENT_TIMEOUT,))
            cur.execute(sql, (start, end))
            row = cur.fetchone()

    return {
        "period_start": str(start),
        "period_end": str(end),
        "faturamento": float(row["total_amount"] or 0),
        "pedidos": int(row["orders"] or 0),
        "ticket_medio": float(row["ticket_medio"] or 0),
    }
