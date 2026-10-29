"""Valida o XLSX IPM com as mesmas regras do backend, preparando upload manual.

Uso:
    python scripts/preparar_upload_ipm.py "C:\\Users\\usuario\\Downloads\\Relatorio.xlsx"
    python scripts/preparar_upload_ipm.py "Relatorio.xlsx" --saida "C:\\Dados\\BASEIPM.xlsx"

Não envia dados para rede e não altera a base original ou o dashboard.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.ipm_update_store import IPMUpdateError, validate_ipm_xlsx


MAX_IPM_BYTES = 16 * 1024 * 1024


def preparar(origem: Path, destino: Path) -> dict:
    origem = origem.expanduser().resolve()
    destino = destino.expanduser().resolve()
    if not origem.is_file() or origem.suffix.casefold() != ".xlsx":
        raise ValueError("Informe um XLSX existente do relatório IPM.")
    if origem == destino:
        raise ValueError("O destino não pode substituir o relatório original.")
    if origem.stat().st_size > MAX_IPM_BYTES:
        raise ValueError("O arquivo excede 16 MB (limite atual da API IPM).")

    # Uma única regra de validação: a mesma usada por create_ipm_import.
    data = origem.read_bytes()
    try:
        metricas = validate_ipm_xlsx(data)
    except IPMUpdateError as exc:
        raise ValueError(exc.public_message) from exc

    destino.parent.mkdir(parents=True, exist_ok=True)
    if destino.exists():
        raise ValueError("O arquivo de destino já existe; nenhuma substituição foi feita.")
    # Grava em modo exclusivo para não sobrescrever um arquivo concorrente.
    with destino.open("xb") as output:
        output.write(data)
    return {
        "ok": True,
        "arquivo_para_upload": str(destino),
        "sha256": hashlib.sha256(data).hexdigest(),
        "metricas": metricas,
        "publicado": False,
        "observacao": "Pronto para upload manual na área administrativa; indicadores não foram alterados.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Pré-validação local da base XLSX IPM.")
    parser.add_argument("origem", type=Path, help="Arquivo XLSX exportado do IPM")
    parser.add_argument("--saida", type=Path, help="Destino da cópia validada")
    args = parser.parse_args()
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    destino = args.saida or (Path.home() / "Downloads" / f"BASEIPM_UPLOAD_{stamp}.xlsx")
    try:
        print(json.dumps(preparar(args.origem, destino), ensure_ascii=False, indent=2))
    except (OSError, ValueError) as exc:
        parser.exit(1, f"ERRO: {exc}\n")


if __name__ == "__main__":
    main()
