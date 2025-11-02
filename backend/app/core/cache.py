"""
Cache simples em memória com TTL.

- Armazena pares (valor, expiração) por chave.
- Usado para respostas de /api/query (120s) e /api/distinct (300s).
- Em produção, considere trocar por Redis para instâncias múltiplas.
"""
import time
from typing import Any, Dict, Optional


class TTLCache:
    def __init__(self):
        self._store: Dict[str, Any] = {}

    def get(self, key: str) -> Optional[Any]:
        item = self._store.get(key)
        if not item:
            return None
        value, expires_at = item
        if time.time() > expires_at:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any, ttl_seconds: int = 120) -> None:
        self._store[key] = (value, time.time() + ttl_seconds)


ttl_cache = TTLCache()
