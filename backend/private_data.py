from __future__ import annotations

import gzip
import json
import os
from functools import lru_cache
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = "SEPLANBI_PRIVATE_DATA_PATH"
PRIVATE_FIELDS = {
    "ProtocoloID",
    "ResponsavelInterno",
    "NomeRequerente",
    "ResponsavelTecnico",
    "PessoaResponsavelExterna",
    "TipoPessoaResponsavel",
    "ObservacaoUltimoTramite",
}


def configured_path() -> Path | None:
    raw = str(os.environ.get(ENV_PATH, "")).strip()
    if not raw:
        return None
    path = Path(raw).expanduser().resolve()
    try:
        path.relative_to(ROOT)
    except ValueError:
        return path
    raise RuntimeError("A camada privada deve permanecer fora do repositório SEPLANBI.")


@lru_cache(maxsize=1)
def load_private_rows() -> dict[str, dict[str, str]]:
    path = configured_path()
    if path is None:
        raise RuntimeError(f"Camada privada não configurada; defina {ENV_PATH} somente no backend autorizado.")
    if not path.is_file():
        raise RuntimeError("Artefato privado configurado não foi localizado.")
    try:
        payload = json.loads(gzip.decompress(path.read_bytes()).decode("utf-8"))
    except Exception as exc:
        raise RuntimeError("Artefato privado inválido.") from exc
    if payload.get("v") != 2 or set(payload.get("fields", [])) != PRIVATE_FIELDS:
        raise RuntimeError("Contrato da camada privada não reconhecido.")
    result = {}
    for record in payload.get("records", []):
        if set(record) != PRIVATE_FIELDS:
            raise RuntimeError("Registro privado fora do contrato autorizado.")
        protocol_id = str(record.get("ProtocoloID", "")).strip()
        if not protocol_id or protocol_id in result:
            raise RuntimeError("Protocolo vazio ou duplicado na camada privada.")
        result[protocol_id] = {key: str(value or "") for key, value in record.items()}
    if not result:
        raise RuntimeError("Camada privada vazia.")
    return result


def get_private_record(protocol_id: str) -> dict[str, str] | None:
    """Uso interno futuro; deliberadamente não conectado a nenhuma rota pública."""
    return load_private_rows().get(str(protocol_id or "").strip())
