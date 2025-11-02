"""
Endpoint de metadados analíticos.

GET /api/metadata
- Lê o arquivo domain/model.yaml com a declaração de cubos, dimensões, medidas e papéis.
- Retorna a estrutura para o frontend montar o Explorer e validar entradas.
"""
from fastapi import APIRouter
from pathlib import Path
import yaml

router = APIRouter()


def load_model() -> dict:
    """Carrega o modelo semântico (cubes, dimensões, medidas e papéis)."""
    model_path = Path(__file__).resolve().parent.parent / "domain" / "model.yaml"
    with model_path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


@router.get("/metadata")
def get_metadata():
    model = load_model()
    return {"cubes": model.get("cubes", {}), "roles": model.get("roles", {})}
