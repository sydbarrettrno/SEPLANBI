from __future__ import annotations

import argparse
import getpass
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


DEFAULT_URL = "https://seplanbi.vercel.app/api?action=private-base-upload"
MAX_BYTES = 12 * 1024 * 1024


def _password() -> str:
    value = str(os.getenv("SEPLAN_ADMIN_PASSWORD") or "").strip()
    if value:
        return value
    return getpass.getpass("Senha administrativa para sincronizar a base privada: ").strip()


def sync_private_source(path: Path, url: str = DEFAULT_URL) -> dict:
    if not path.is_file():
        raise RuntimeError(f"Planilha não encontrada: {path}")
    if path.suffix.lower() not in {".xlsx", ".xlsm"}:
        raise RuntimeError("A fonte deve ser XLSX ou XLSM.")
    size = path.stat().st_size
    if size <= 0 or size > MAX_BYTES:
        raise RuntimeError("A planilha é vazia ou excede o limite de 12 MB.")

    password = _password()
    if not password:
        raise RuntimeError("Senha administrativa não informada.")

    body = path.read_bytes()
    request = Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Accept": "application/json",
            "X-SEPLAN-Admin-Password": password,
            "X-SEPLAN-Source-Name": quote(path.name, safe=""),
            "Content-Length": str(len(body)),
        },
    )

    try:
        with urlopen(request, timeout=90) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
            message = str(payload.get("error") or f"HTTP {exc.code}")
        except Exception:
            message = f"HTTP {exc.code}"
        raise RuntimeError(f"Sincronização privada recusada: {message}") from exc
    except (URLError, TimeoutError) as exc:
        raise RuntimeError("Não foi possível conectar ao servidor do dashboard.") from exc
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError("Resposta inválida do servidor ao sincronizar a base privada.") from exc

    if not isinstance(payload, dict) or not payload.get("ok"):
        raise RuntimeError("O servidor não confirmou a sincronização privada.")
    if int(payload.get("missing_private_rows") or 0) != 0:
        raise RuntimeError(
            "A sincronização terminou com protocolos públicos sem complemento privado; publicação bloqueada."
        )
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Sincroniza no armazenamento privado do SEPLANBI a mesma fonte usada na atualização pública."
    )
    parser.add_argument("xlsx", type=Path, help="Relatório IPM/Base completa usado na atualização")
    parser.add_argument("--url", default=DEFAULT_URL, help="Endpoint administrativo de sincronização")
    args = parser.parse_args()

    try:
        result = sync_private_source(args.xlsx.expanduser().resolve(), args.url)
    except RuntimeError as exc:
        print(f"[ERRO] {exc}", file=sys.stderr)
        return 1

    print(
        "[OK] Base privada sincronizada: "
        f"{result.get('private_rows', 0)} registros da fonte; "
        f"cobertura pública {result.get('coverage_percent', 0)}%."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
