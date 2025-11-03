"""
Configurações de aplicação carregadas via variáveis de ambiente.

- DATABASE_URL: string de conexão do PostgreSQL.
- ALLOW_ORIGINS: lista de origens permitidas no CORS (separadas por vírgula).
- STATEMENT_TIMEOUT: timeout de execução por consulta no Postgres.

Nota: usamos field(default_factory=...) para evitar mutáveis como default
(boa prática).
"""
import os
from dataclasses import dataclass, field
from typing import List


def _default_allow_origins() -> List[str]:
    v = os.getenv("ALLOW_ORIGINS")
    if not v:
        return ["*"]
    return [o.strip() for o in v.split(",")]


@dataclass
class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        # Padrão: host local (quando backend roda na máquina do dev)
        "postgresql://challenge:challenge_2024@localhost:5432/challenge_db",
    )
    # CORS: lista separada por vírgulas ou "*"
    ALLOW_ORIGINS: List[str] = field(default_factory=_default_allow_origins)
    # Timeout padrão de execução no Postgres (ex.: "15s", "5min")
    STATEMENT_TIMEOUT: str = os.getenv("STATEMENT_TIMEOUT", "15s")


settings = Settings()
