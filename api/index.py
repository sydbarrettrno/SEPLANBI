from http.server import BaseHTTPRequestHandler
from http.cookies import SimpleCookie
import json
from pathlib import Path
import sys
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.final_entry import dashboard, health, query_from_params
from backend.analytics import analytics_response, export_public_csv, query_from_params as analytics_query_from_params
from backend.indicator_views import indicator_view_response
from backend.private_export import build_private_xlsx
from backend.private_data import load_private_rows
from backend.private_import import install_private_xlsx
from backend.admin_store import (
    AdminStoreError,
    SESSION_TTL_SECONDS,
    create_admin_session,
    load_copy,
    save_copy,
    validate_admin_session,
    verify_admin_password,
)


ADMIN_COOKIE = "seplan_admin_session"
ANALYTICS_INDICATORS = {
    "received",
    "recebidos",
    "outputs",
    "saidas",
    "saídas",
    "concluded",
    "stock",
    "estoque",
}
PUBLIC_ANALYTICS_META = {"indicator", "total", "grouped_sum", "grouping_reconciled"}
PUBLIC_ANALYTICS_RECORD_FIELDS = {
    "protocol",
    "opened",
    "last_movement",
    "category",
    "status",
    "days_without_movement",
    "sector",
}
PRIVATE_UPLOAD_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel.sheet.macroenabled.12",
    "application/octet-stream",
}
MAX_PRIVATE_UPLOAD_BYTES = 12 * 1024 * 1024


def _flatten(query_string: str) -> dict[str, str]:
    parsed = parse_qs(query_string, keep_blank_values=False)
    return {key: values[-1] for key, values in parsed.items() if values}


def _analytics_query(params: dict[str, str]):
    indicator = str(params.get("indicator", "")).strip().casefold()
    if indicator and indicator not in ANALYTICS_INDICATORS:
        raise ValueError("Indicador analítico inválido.")
    return analytics_query_from_params(params)


def _public_analytics_payload(payload: dict) -> dict:
    """Reduz o contrato público aos campos consumidos pela interface."""
    result = dict(payload)
    meta = result.get("meta")
    if isinstance(meta, dict):
        result["meta"] = {key: meta[key] for key in PUBLIC_ANALYTICS_META if key in meta}
    result["permissions"] = {
        "public_detail": True,
        "private_detail": False,
        "public_export": False,
        "private_export": False,
    }
    records = result.get("records")
    if isinstance(records, dict) and isinstance(records.get("items"), list):
        result["records"] = {
            **records,
            "items": [
                {key: value for key, value in item.items() if key in PUBLIC_ANALYTICS_RECORD_FIELDS}
                for item in records["items"]
                if isinstance(item, dict)
            ],
        }
    return result


class handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict, extra_headers: dict[str, str] | None = None) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        for key, value in (extra_headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _csv(self, status: int, body_text: str) -> None:
        body = body_text.encode("utf-8-sig")
        self.send_response(status)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", 'attachment; filename="seplanbi-drilldown.csv"')
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, private")
        self.send_header("Pragma", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'none'; sandbox")
        self.end_headers()
        self.wfile.write(body)

    def _binary(self, status: int, body: bytes, content_type: str, filename: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, private")
        self.send_header("Pragma", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'none'; sandbox")
        self.end_headers()
        self.wfile.write(body)

    def _client_ip(self) -> str:
        forwarded = self.headers.get("X-Forwarded-For", "")
        return forwarded.split(",", 1)[0].strip() or self.client_address[0]

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

    def _admin_authorized(self) -> bool:
        return validate_admin_session(self._admin_token())

    def _require_admin(self) -> bool:
        if self._admin_authorized():
            return True
        self._json(403, {"ok": False, "error": "Acesso não autorizado."})
        return False

    def _same_origin(self) -> bool:
        origin = self.headers.get("Origin", "").strip().lower()
        if not origin:
            return True
        host = self.headers.get("Host", "").strip().lower()
        return bool(host) and origin in {f"https://{host}", f"http://{host}"}

    def _session_cookie(self, token: str) -> str:
        return (
            f"{ADMIN_COOKIE}={token}; Path=/; HttpOnly; Secure; SameSite=Strict; "
            f"Max-Age={SESSION_TTL_SECONDS}"
        )

    def _clear_session_cookie(self) -> str:
        return f"{ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"

    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            params = _flatten(parsed.query)
            action = params.pop("action", "dashboard")
            if action == "health":
                self._json(200, health())
                return
            if action == "private-data-status":
                if not self._require_admin():
                    return
                try:
                    rows = load_private_rows()
                    self._json(200, {"ok": True, "configured": True, "rows": len(rows)})
                except RuntimeError:
                    self._json(503, {"ok": False, "configured": False, "rows": 0})
                return
            if action == "admin-session":
                self._json(200, {"ok": True, "authorized": self._admin_authorized()})
                return
            if action == "dashboard-copy":
                self._json(200, load_copy())
                return
            if action == "analytics":
                self._json(200, _public_analytics_payload(analytics_response(_analytics_query(params))))
                return
            if action == "analytics-export":
                if not self._require_admin():
                    return
                self._csv(200, export_public_csv(_analytics_query(params)))
                return
            if action == "indicator-bi":
                self._json(200, indicator_view_response(params))
                return
            if action != "dashboard":
                self._json(400, {"ok": False, "error": "Ação inválida."})
                return
            self._json(200, dashboard(query_from_params(params)))
        except AdminStoreError as exc:
            self._json(exc.status, {"ok": False, "error": exc.public_message})
        except (ValueError, json.JSONDecodeError):
            self._json(400, {"ok": False, "error": "Parâmetros inválidos."})
        except Exception:
            self._json(500, {"ok": False, "error": "Falha interna ao processar a solicitação."})

    def do_POST(self):
        try:
            parsed = urlparse(self.path)
            params = _flatten(parsed.query)
            action = params.get("action", "")
            allowed_actions = {"admin-auth", "admin-logout", "dashboard-copy", "private-export", "private-base-upload"}
            if action not in allowed_actions:
                self._json(400, {"ok": False, "error": "Ação inválida."})
                return
            if not self._same_origin():
                self._json(403, {"ok": False, "error": "Origem não autorizada."})
                return

            if action == "admin-logout":
                self._json(200, {"ok": True}, {"Set-Cookie": self._clear_session_cookie()})
                return

            client_ip = self._client_ip()
            content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()

            if action == "private-base-upload":
                if not self._require_admin():
                    return
                verify_admin_password(self.headers.get("X-SEPLAN-Admin-Password", ""), client_ip)
                if content_type not in PRIVATE_UPLOAD_TYPES:
                    self._json(415, {"ok": False, "error": "Selecione uma planilha XLSX ou XLSM."})
                    return
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > MAX_PRIVATE_UPLOAD_BYTES:
                    self._json(413, {"ok": False, "error": "A planilha é vazia ou excede o limite de 12 MB."})
                    return
                body = self.rfile.read(length)
                source_name = unquote(self.headers.get("X-SEPLAN-Source-Name", ""))
                try:
                    result = install_private_xlsx(body, source_name=source_name)
                except ValueError as exc:
                    self._json(400, {"ok": False, "error": str(exc)})
                    return
                except RuntimeError as exc:
                    self._json(503, {"ok": False, "error": str(exc)})
                    return
                self._json(200, result)
                return

            if content_type != "application/json":
                self._json(415, {"ok": False, "error": "Tipo de conteúdo não suportado."})
                return

            max_body = 4_096 if action in {"admin-auth", "private-export"} else 96_000
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > max_body:
                self._json(400, {"ok": False, "error": "Corpo da requisição inválido."})
                return
            payload = json.loads(self.rfile.read(length).decode("utf-8"))

            if action == "admin-auth":
                token = create_admin_session(payload.get("password", ""), client_ip)
                self._json(
                    200,
                    {"ok": True, "authorized": True, "expires_in": SESSION_TTL_SECONDS},
                    {"Set-Cookie": self._session_cookie(token)},
                )
                return

            if not self._require_admin():
                return

            if action == "private-export":
                verify_admin_password(payload.get("password", ""), client_ip)
                try:
                    body, filename = build_private_xlsx()
                except RuntimeError:
                    self._json(503, {"ok": False, "error": "Base privada temporariamente indisponível no servidor."})
                    return
                self._binary(
                    200,
                    body,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    filename,
                )
                return

            session_token = self._admin_token()
            result = save_copy(
                payload.get("copy"),
                "",
                client_ip,
                session_token=session_token,
            )
            self._json(200, result)
        except AdminStoreError as exc:
            self._json(exc.status, {"ok": False, "error": exc.public_message})
        except (ValueError, json.JSONDecodeError):
            self._json(400, {"ok": False, "error": "JSON ou parâmetros inválidos."})
        except Exception:
            self._json(500, {"ok": False, "error": "Falha interna ao processar a solicitação."})

    def log_message(self, format, *args):
        return
