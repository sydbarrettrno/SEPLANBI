from functools import lru_cache

from backend import core
from backend.final_data import load_rows as load_rows_base


@lru_cache(maxsize=1)
def load_rows():
    rows = load_rows_base()
    metadata = core.metadata()
    categories = {core._clean(r.get("Categoria")) for r in rows}
    expected_rows = int(metadata.get("source_rows", -1))
    expected_categories = int(metadata.get("semantic_memory", {}).get("category_count", -1))
    if len(rows) != expected_rows or len(categories) != expected_categories:
        raise RuntimeError("Carga bloqueada: taxonomia V07 não reconciliada.")
    return rows


# Injeta a fonte canônica já reconciliada antes de calcular as métricas.
core.load_rows = load_rows

from backend.delivery_v07 import dashboard, health, query_from_params  # noqa: E402,F401
