from __future__ import annotations

import base64
import gzip
import json
import lzma
import os
from functools import lru_cache
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = "SEPLANBI_PRIVATE_DATA_PATH"
BUNDLED_PATH = ROOT / "private" / "base_private.json.gz"
BUNDLED_PARTS_DIR = ROOT / "private"
BUNDLED_PART_GLOB = "base_private.xz.b64.part*"

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
    if BUNDLED_PATH.is_file():
        return BUNDLED_PATH
    return None


def _read_payload_bytes() -> bytes:
    path = configured_path()
    if path is not None:
        if not path.is_file():
            raise RuntimeError("Artefato privado configurado não foi localizado.")
        try:
            raw = path.read_bytes()
            if path.suffix == ".xz":
                return lzma.decompress(raw)
            return gzip.decompress(raw)
        except Exception as exc:
            raise RuntimeError("Artefato privado inválido.") from exc

    # Para deploys manuais, a base privada pode ser enviada em partes Base64 de um
    # único XZ. As partes entram apenas no includeFiles da função Python; não são
    # copiadas para dist/ e a pasta /private é bloqueada pelo .gitignore.
    parts = sorted(BUNDLED_PARTS_DIR.glob(BUNDLED_PART_GLOB)) if BUNDLED_PARTS_DIR.is_dir() else []
    if not parts:
        raise RuntimeError(
            f"Camada privada não configurada; defina {ENV_PATH} no backend autorizado "
            "ou inclua o artefato privado somente no pacote serverless."
        )
    try:
        encoded = "".join(part.read_text(encoding="ascii").strip() for part in parts)
        return lzma.decompress(base64.b64decode(encoded, validate=True))
    except Exception as exc:
        raise RuntimeError("Partes do artefato privado são inválidas.") from exc


@lru_cache(maxsize=1)
def load_private_rows() -> dict[str, dict[str, str]]:
    try:
        payload = json.loads(_read_payload_bytes().decode("utf-8"))
    except Exception as exc:
        if isinstance(exc, RuntimeError):
            raise
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
