"""
Tradutor de consultas: Query JSON → SQL seguro para PostgreSQL.

Responsabilidades principais:
- Validar papéis (roles) contra whitelists de medidas e dimensões (model.yaml).
- Mapear nomes qualificados (ex.: sales.total_amount) para expressões SQL.
- Aplicar granularidade de tempo (DATE_TRUNC) quando solicitado.
- Montar SELECT, FROM/JOIN, WHERE (filtros), GROUP BY e ORDER BY.
- Proteger com LIMIT máximo (10.000) e ordenar apenas por colunas selecionadas.

Como extender:
- Para adicionar um novo cube, declare em model.yaml e crie novos maps DIM_MAP_*/MEAS_MAP_*.
- Ajuste _from_and_joins para refletir as tabelas e joins necessários.
"""
from typing import List, Tuple, Dict, Any, Optional
from pathlib import Path
import yaml


def _load_model() -> dict:
    model_path = Path(__file__).resolve().parent / "model.yaml"
    with model_path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


MODEL = _load_model()


class QuerySpec:
    def __init__(
        self,
        cube: str,
        role: Optional[str],
        measures: List[str],
        dimensions: List[str],
        filters: List[Dict[str, Any]],
        granularity: Optional[str],
        order: List[Dict[str, str]],
        limit: int,
    ):
        self.cube = cube
        self.role = role
        self.measures = measures
        self.dimensions = dimensions
        self.filters = filters
        self.granularity = granularity
        self.order = order
        self.limit = max(1, min(limit, 10000))


DIM_MAP_SALES = {
    "time.date": ("DATE(s.created_at)", "date"),
    "store.name": ("st.name", "text"),
    "channel.name": ("ch.name", "text"),
    "sales.status": ("s.sale_status_desc", "text"),
}

MEAS_MAP_SALES = {
    "sales.total_amount": ("SUM(s.total_amount)", "numeric"),
    "sales.orders": ("COUNT(*)", "int"),
    "sales.ticket_medio": ("SUM(s.total_amount) / NULLIF(COUNT(*), 0)", "numeric"),
    "sales.discount": ("SUM(s.total_discount)", "numeric"),
    "sales.delivery_fee": ("SUM(s.delivery_fee)", "numeric"),
    "sales.service_fee": ("SUM(s.service_tax_fee)", "numeric"),
    "sales.increase": ("SUM(s.total_increase)", "numeric"),
}


DIM_MAP_PRODUCTS = {
    "time.date": ("DATE(s.created_at)", "date"),
    "store.name": ("st.name", "text"),
    "channel.name": ("ch.name", "text"),
    "product.name": ("p.name", "text"),
}

MEAS_MAP_PRODUCTS = {
    "products.quantity": ("SUM(ps.quantity)", "numeric"),
    "products.revenue": ("SUM(ps.total_price)", "numeric"),
}

# Payments cube
DIM_MAP_PAYMENTS = {
    "time.date": ("DATE(s.created_at)", "date"),
    "store.name": ("st.name", "text"),
    "channel.name": ("ch.name", "text"),
    "payment.type": ("COALESCE(pt.description, '(sem tipo)')", "text"),
    "payment.online": ("CASE WHEN pay.is_online THEN 'online' ELSE 'offline' END", "text"),
}

MEAS_MAP_PAYMENTS = {
    "payments.amount": ("SUM(pay.value)", "numeric"),
    "payments.count": ("COUNT(*)", "int"),
}


def _validate_role(spec: QuerySpec):
    if not spec.role:
        return
    roles = MODEL.get("roles", {})
    role_def = roles.get(spec.role)
    if not role_def:
        raise ValueError(f"Role desconhecida: {spec.role}")
    if spec.cube not in role_def.get("cubes", []):
        raise ValueError(f"Role {spec.role} não pode consultar o cube {spec.cube}")
    allowed_measures = set(role_def.get("allowed_measures", []))
    allowed_dims = set(role_def.get("allowed_dimensions", []))
    for m in spec.measures:
        if m not in allowed_measures:
            raise ValueError(f"Medida não permitida para {spec.role}: {m}")
    for d in spec.dimensions:
        if d not in allowed_dims:
            raise ValueError(f"Dimensão não permitida para {spec.role}: {d}")
    for f in spec.filters:
        if f.get("dimension") not in allowed_dims:
            raise ValueError(f"Filtro não permitido para {spec.role}: {f.get('dimension')}")


def _cube_maps(cube: str):
    if cube == "sales":
        return DIM_MAP_SALES, MEAS_MAP_SALES
    if cube == "products":
        return DIM_MAP_PRODUCTS, MEAS_MAP_PRODUCTS
    if cube == "payments":
        return DIM_MAP_PAYMENTS, MEAS_MAP_PAYMENTS
    raise ValueError(f"Cube desconhecido: {cube}")


def _from_and_joins(cube: str) -> Tuple[str, List[str]]:
    if cube == "sales":
        return (
            "FROM sales s \n"
            "JOIN stores st ON st.id = s.store_id \n"
            "JOIN channels ch ON ch.id = s.channel_id",
            [],
        )
    if cube == "products":
        return (
            "FROM product_sales ps \n"
            "JOIN sales s ON s.id = ps.sale_id \n"
            "JOIN products p ON p.id = ps.product_id \n"
            "JOIN stores st ON st.id = s.store_id \n"
            "JOIN channels ch ON ch.id = s.channel_id",
            [],
        )
    if cube == "payments":
        return (
            "FROM payments pay \n"
            "JOIN sales s ON s.id = pay.sale_id \n"
            "JOIN stores st ON st.id = s.store_id \n"
            "JOIN channels ch ON ch.id = s.channel_id \n"
            "LEFT JOIN payment_types pt ON pt.id = pay.payment_type_id",
            [],
        )
    raise ValueError("Cube inválido")


def _apply_granularity(dimensions: List[str], granularity: Optional[str]) -> List[str]:
    if not granularity:
        return dimensions
    # Só adaptamos time.date caso a granularidade peça mês/hora
    out = []
    for d in dimensions:
        if d == "time.date" and granularity == "month":
            out.append("DATE_TRUNC('month', s.created_at)")
        elif d == "time.date" and granularity == "hour":
            out.append("DATE_TRUNC('hour', s.created_at)")
        elif d == "time.date":
            out.append("DATE(s.created_at)")
        else:
            out.append(d)
    return out


def build_sql(
    cube: str,
    role: Optional[str],
    measures: List[str],
    dimensions: List[str],
    filters: List[Dict[str, Any]],
    granularity: Optional[str],
    order: List[Dict[str, str]],
    limit: int,
) -> Tuple[str, List[Any], List[str]]:
    spec = QuerySpec(cube, role, measures, dimensions, filters, granularity, order, limit)
    _validate_role(spec)

    dim_map, meas_map = _cube_maps(spec.cube)

    # Mapear select
    select_cols: List[str] = []
    group_cols: List[str] = []
    col_names: List[str] = []

    # aplicar granularidade na dimensão de tempo
    dims_with_gran = []
    for d in spec.dimensions:
        if d not in dim_map:
            raise ValueError(f"Dimensão desconhecida: {d}")
        dims_with_gran.append(d)

    # substituir time.date conforme granularity
    def dim_sql_token(name: str) -> str:
        if name == "time.date" and granularity == "month":
            return "DATE_TRUNC('month', s.created_at)"
        if name == "time.date" and granularity == "hour":
            return "DATE_TRUNC('hour', s.created_at)"
        if name == "time.date":
            return dim_map[name][0]
        return dim_map[name][0]

    for d in dims_with_gran:
        select_cols.append(f"{dim_sql_token(d)} AS \"{d}\"")
        group_cols.append(dim_sql_token(d))
        col_names.append(d)

    for m in spec.measures:
        if m not in meas_map:
            raise ValueError(f"Medida desconhecida: {m}")
        select_cols.append(f"{meas_map[m][0]} AS \"{m}\"")
        col_names.append(m)

    select_clause = ", \n       ".join(select_cols) if select_cols else "COUNT(*) AS \"rows\""

    from_clause, _ = _from_and_joins(spec.cube)

    # Filtros (somente whitelisted)
    where_parts: List[str] = []
    params: List[Any] = []
    for f in spec.filters:
        dim = f.get("dimension")
        op = f.get("op")
        values = f.get("values", [])
        if dim not in dim_map:
            raise ValueError(f"Filtro em dimensão desconhecida: {dim}")
        dim_sql = dim_map[dim][0]
        if dim == "time.date" and granularity in ("month", "hour"):
            dim_sql = dim_sql_token(dim)

        if op == "equals":
            where_parts.append(f"{dim_sql} = %s")
            params.append(values[0])
        elif op == "in":
            placeholders = ",".join(["%s"] * len(values))
            where_parts.append(f"{dim_sql} IN ({placeholders})")
            params.extend(values)
        elif op == "between":
            if len(values) != 2:
                raise ValueError("Filtro between requer 2 valores")
            where_parts.append(f"{dim_sql} BETWEEN %s AND %s")
            params.extend(values)
        else:
            raise ValueError(f"Operação de filtro inválida: {op}")

    where_clause = "WHERE " + " AND ".join(where_parts) if where_parts else ""

    group_clause = f"GROUP BY {', '.join(group_cols)}" if group_cols else ""

    # Ordenação segura (apenas por colunas selecionadas)
    order_clause = ""
    safe_cols = set(col_names)
    if order:
        order_parts = []
        for o in order:
            by = o.get("by")
            direction = o.get("dir", "desc").lower()
            if by not in safe_cols:
                # permitir ordenar por measure mesmo que não seja dimensão
                if by not in safe_cols:
                    raise ValueError(f"Ordenação por coluna não selecionada: {by}")
            if direction not in ("asc", "desc"):
                direction = "desc"
            order_parts.append(f'"{by}" {direction}')
        if order_parts:
            order_clause = "ORDER BY " + ", ".join(order_parts)

    limit_clause = f"LIMIT {int(spec.limit)}"

    sql = (
        "SELECT \n       "
        + select_clause
        + "\n"
        + from_clause
        + "\n"
        + where_clause
        + ("\n" + group_clause if group_clause else "")
        + ("\n" + order_clause if order_clause else "")
        + "\n"
        + limit_clause
    )

    return sql, params, col_names
