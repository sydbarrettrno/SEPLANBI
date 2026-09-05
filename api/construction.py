from __future__ import annotations

from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler
import json
from pathlib import Path
import sys
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.admin_store import AdminStoreError, validate_admin_session
from backend.construction_private import export_private_csv, install_private_csv, private_data_response, private_status

ADMIN_COOKIE = "seplan_admin_session"
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
UPLOAD_TYPES = {"text/csv", "application/csv", "application/vnd.ms-excel", "application/octet-stream"}


def _flatten(query_string: str) -> dict[str, str]:
    parsed = parse_qs(query_string, keep_blank_values=False)
    return {key: values[-1] for key, values in parsed.items() if values}


class handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, private")
        self.send_header("Pragma", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _csv(self, body_text: str) -> None:
        body = body_text.encode("utf-8-sig")
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", 'attachment; filename="alvaras-itapoa-base-completa.csv"')
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, private")
        self.send_header("Pragma", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'none'; sandbox")
        self.end_headers()
        self.wfile.write(body)

    def _admin_token(self) -> str | None:
        raw = self.headers.get("Cookie", "")
        if not raw:
            return None
        cookie = SimpleCookie()
        try:
            cookie.load(raw)
        except Exception:
            return None
        morsel = cookie.get(ADMIN_COOKIE)
        return morsel.value if morsel else None

    def _require_admin(self) -> bool:
        if validate_admin_session(self._admin_token()):
            return True
        self._json(403, {"ok": False, "error": "Acesso restrito. Informe a senha administrativa."})
        return False

    def _same_origin(self) -> bool:
        origin = self.headers.get("Origin", "").strip().lower()
        if not origin:
            return True
        host = self.headers.get("Host", "").strip().lower()
        return bool(host) and origin in {f"https://{host}", f"http://{host}"}

    def do_GET(self):
        try:
            if not self._require_admin():
                return
            parsed = urlparse(self.path)
            params = _flatten(parsed.query)
            action = params.pop("action", "data")
            if action == "status":
                self._json(200, private_status())
                return
            if action == "data":
                self._json(200, private_data_response(params))
                return
            if action == "export":
                self._csv(export_private_csv(params))
                return
            self._json(400, {"ok": False, "error": "Ação inválida."})
        except AdminStoreError as exc:
            self._json(exc.status, {"ok": False, "error": exc.public_message})
        except RuntimeError as exc:
            self._json(503, {"ok": False, "error": str(exc)})
        except Exception:
            self._json(500, {"ok": False, "error": "Falha interna ao processar a base de alvarás."})

    def do_POST(self):
        try:
            if not self._same_origin():
                self._json(403, {"ok": False, "error": "Origem não autorizada."})
                return
            if not self._require_admin():
                return
            parsed = urlparse(self.path)
            params = _flatten(parsed.query)
            if params.get("action") != "upload":
                self._json(400, {"ok": False, "error": "Ação inválida."})
                return
            content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
            if content_type not in UPLOAD_TYPES:
                self._json(415, {"ok": False, "error": "Selecione a base CSV preparada para o SEPLANBI."})
                return
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_UPLOAD_BYTES:
                self._json(413, {"ok": False, "error": "A base é vazia ou excede o limite de 8 MB."})
                return
            body = self.rfile.read(length)
            source_name = unquote(self.headers.get("X-SEPLAN-Source-Name", ""))
            self._json(200, install_private_csv(body, source_name=source_name))
        except AdminStoreError as exc:
            self._json(exc.status, {"ok": False, "error": exc.public_message})
        except ValueError as exc:
            self._json(400, {"ok": False, "error": str(exc)})
        except RuntimeError as exc:
            self._json(503, {"ok": False, "error": str(exc)})
        except Exception:
            self._json(500, {"ok": False, "error": "Falha interna ao atualizar a base de alvarás."})

    def log_message(self, format, *args):
        return
