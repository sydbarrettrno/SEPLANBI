from __future__ import annotations

import gzip
import json
import os
from functools import lru_cache
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = "SEPLANBI_PRIVATE_DATA_PATH"
BUNDLED_PATH = ROOT / "private" / "base_private.json.gz"

PRIVATE_FIELDS_V2 = {
    "ProtocoloID",
    "ResponsavelInterno",
    "NomeRequerente",
    "ResponsavelTecnico",
    "PessoaResponsavelExterna",
    "TipoPessoaResponsavel",
    "ObservacaoUltimoTramite",
}
PRIVATE_FIELDS_V3 = PRIVATE_FIELDS_V2 | {
    "ObservacaoAbertura",
    "SubassuntoOriginal",
    "UsuarioAtualNome",
    "SituacaoOriginal",
    "SetorAtualFonte",
}


def configured_path() -> Path | None:
    raw = str(os.environ.get(ENV_PATH, "")).strip()
    if raw:
        path = Path(raw).expanduser().resolve()
        try:
            path.relative_to(ROOT)
        except ValueError:
            return path
        raise RuntimeError("A camada privada configurada por ambiente deve permanecer fora do repositório SEPLANBI.")

    # Em produção, o deploy pode incluir um artefato privado somente dentro do bundle
    # serverless. A pasta /private permanece ignorada pelo Git e nunca vai para dist/.
    if BUNDLED_PATH.is_file():
        return BUNDLED_PATH
    return None


@lru_cache(maxsize=1)
def load_private_rows() -> dict[str, dict[str, str]]:
    path = configured_path()
    if path is None:
        raise RuntimeError(
            f"Camada privada não configurada; defina {ENV_PATH} no backend autorizado "
            "ou inclua o artefato privado somente no pacote serverless."
        )
    if not path.is_file():
        raise RuntimeError("Artefato privado configurado não foi localizado.")
    try:
        payload = json.loads(gzip.decompress(path.read_bytes()).decode("utf-8"))
    except Exception as exc:
        raise RuntimeError("Artefato privado inválido.") from exc

    version = int(payload.get("v") or 0)
    payload_fields = set(payload.get("fields", []))
    if version == 2:
        expected_fields = PRIVATE_FIELDS_V2
    elif version == 3:
        expected_fields = PRIVATE_FIELDS_V3
    else:
        raise RuntimeError("Contrato da camada privada não reconhecido.")
    if payload_fields != expected_fields:
        raise RuntimeError("Campos da camada privada divergem do contrato autorizado.")

    result: dict[str, dict[str, str]] = {}
    for record in payload.get("records", []):
        if set(record) != expected_fields:
            raise RuntimeError("Registro privado fora do contrato autorizado.")
        protocol_id = str(record.get("ProtocoloID", "")).strip()
        if not protocol_id or protocol_id in result:
            raise RuntimeError("Protocolo vazio ou duplicado na camada privada.")
        normalized = {key: str(record.get(key) or "") for key in PRIVATE_FIELDS_V3}
        normalized["ProtocoloID"] = protocol_id
        result[protocol_id] = normalized
    if not result:
        raise RuntimeError("Camada privada vazia.")
    return result


def get_private_record(protocol_id: str) -> dict[str, str] | None:
    return load_private_rows().get(str(protocol_id or "").strip())
