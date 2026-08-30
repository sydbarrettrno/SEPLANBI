from __future__ import annotations

import base64
import gzip
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.final_data import load_rows  # noqa: E402


FORBIDDEN_EXTENSIONS = {
    ".xls",
    ".xlsx",
    ".xlsm",
    ".csv",
    ".tsv",
    ".parquet",
    ".sqlite",
    ".db",
    ".zip",
    ".7z",
    ".rar",
    ".bak",
    ".log",
}
EXPECTED_PAYLOAD_COLUMNS = {"n", "y", "o", "m", "c", "z", "x", "g", "t", "u", "h", "f"}
EXPECTED_EVENT_COLUMNS = {"p", "a", "k", "s"}
EXPECTED_PROJECT_COLUMNS = {"i", "f", "s", "r"}
ALLOWED_ROW_FIELDS = {
    "ProtocoloID",
    "NumeroAnoOriginal",
    "ProtocoloAno",
    "DataAbertura",
    "UltimoTramiteDataHora",
    "DataEncerramento",
    "DataSaida",
    "TipoSaida",
    "Macroprocesso",
    "Categoria",
    "StatusOperacional",
    "SetorAtual",
    "GargaloOperacional",
    "DiasSemMovimento",
    "SourceFingerprint",
}
EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
LONG_DIGIT_PATTERN = re.compile(r"(?:\d[\s./-]*){11,14}")


def tracked_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    return [ROOT / item.decode("utf-8") for item in result.stdout.split(b"\0") if item]


def load_payload(metadata: dict) -> dict:
    artifact = metadata["artifact"]
    directory = ROOT / "data" / artifact["directory"]
    encoded = "".join((directory / part).read_text(encoding="ascii") for part in artifact["parts"])
    if len(encoded) != int(artifact["base64_chars"]):
        raise RuntimeError("Tamanho Base64 diverge do manifesto.")
    compressed = base64.b64decode(encoded, validate=True)
    return json.loads(gzip.decompress(compressed).decode("utf-8"))


metadata = json.loads((ROOT / "data" / "metadata.json").read_text(encoding="utf-8"))
tracked_forbidden = [
    str(path.relative_to(ROOT))
    for path in tracked_files()
    if path.suffix.lower() in FORBIDDEN_EXTENSIONS
]
assert not tracked_forbidden, f"Arquivos privados/auxiliares rastreados: {tracked_forbidden}"

assert metadata.get("privacy", {}).get("policy") == "allowlist", metadata.get("privacy")
assert metadata.get("artifact", {}).get("directory") == "final_chunks", metadata.get("artifact")
assert "delivery_artifact" not in metadata, "Há mais de um artefato declarado."

payload = load_payload(metadata)
assert payload.get("v") == 9, payload.get("v")
assert set(payload.get("c", {})) == EXPECTED_PAYLOAD_COLUMNS, payload.get("c", {}).keys()
event_columns = payload.get("e")
expected_dictionaries = {
    "Macroprocesso",
    "Categoria",
    "StatusOperacional",
    "TipoSaida",
    "SetorAtual",
    "ProjetoFase",
    "ProjetoStatus",
}
if event_columns is not None:
    expected_dictionaries.add("TipoEvento")
assert set(payload.get("d", {})) == expected_dictionaries
if event_columns is not None:
    assert set(event_columns) == EXPECTED_EVENT_COLUMNS, event_columns.keys()
    event_count = len(event_columns["p"])
    assert all(len(event_columns[key]) == event_count for key in EXPECTED_EVENT_COLUMNS)
    assert all(0 <= int(value) < int(metadata["source_rows"]) for value in event_columns["p"])
    assert all(0 <= int(value) < len(payload["d"]["TipoEvento"]) for value in event_columns["k"])
    assert all(0 <= int(value) < len(payload["d"]["StatusOperacional"]) for value in event_columns["s"])

project_columns = payload.get("pp")
assert project_columns is not None, "Carteira pública minimizada ausente."
assert set(project_columns) == EXPECTED_PROJECT_COLUMNS, project_columns.keys()
project_count = len(project_columns["i"])
assert all(len(project_columns[key]) == project_count for key in EXPECTED_PROJECT_COLUMNS)
assert len(set(map(str, project_columns["i"]))) == project_count
assert all(0 <= int(value) < len(payload["d"]["ProjetoFase"]) for value in project_columns["f"])
assert all(0 <= int(value) < len(payload["d"]["ProjetoStatus"]) for value in project_columns["s"])

serialized_payload = json.dumps(payload, ensure_ascii=False)
for forbidden_name in (
    "ResponsavelInterno",
    "NomeRequerente",
    "ResponsavelTecnico",
    "PessoaResponsavelExterna",
    "TipoPessoaResponsavel",
    "ObservacaoUltimoTramite",
):
    assert forbidden_name not in serialized_payload, f"Campo privado no payload: {forbidden_name}"

dictionary_values = [
    str(value)
    for values in payload["d"].values()
    for value in values
]
assert all(len(value) <= 120 for value in dictionary_values), "Rótulo semântico excessivamente longo."
assert not any(EMAIL_PATTERN.search(value) for value in dictionary_values), "E-mail detectado em dicionário público."
assert not any(LONG_DIGIT_PATTERN.search(value) for value in dictionary_values), "Possível CPF/CNPJ/telefone em dicionário público."

rows = load_rows()
assert rows, "Dataset público vazio."
assert set(rows[0]) == ALLOWED_ROW_FIELDS, sorted(set(rows[0]) - ALLOWED_ROW_FIELDS)
assert len(rows) == int(metadata["source_rows"])
assert len({row["ProtocoloID"] for row in rows}) == len(rows)

print(
    json.dumps(
        {
            "status": "PRIVACIDADE_E_MINIMIZACAO_APROVADAS",
            "tracked_forbidden_files": 0,
            "payload_columns": sorted(EXPECTED_PAYLOAD_COLUMNS),
            "event_columns": sorted(EXPECTED_EVENT_COLUMNS) if event_columns is not None else [],
            "published_events": len(event_columns["p"]) if event_columns is not None else 0,
            "published_public_projects": project_count,
            "published_rows": len(rows),
            "dictionary_values_checked": len(dictionary_values),
            "note": "Minimizado, mas não anonimizado: protocolo e datas permanecem identificadores indiretos.",
        },
        ensure_ascii=False,
        indent=2,
    )
)
