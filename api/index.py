from http.server import BaseHTTPRequestHandler
from http.cookies import SimpleCookie
import json
from pathlib import Path
import sys
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.final_entry import dashboard, health, query_from_params
from backend.analytics import analytics_response, export_public_csv, query_from_params as analytics_query_from_params
from backend.extended_indicators import extended_indicator_response
from backend.admin_store import (
    AdminStoreError,
    SESSION_TTL_SECONDS,
    create_admin_session,
    load_copy,
    save_copy,
    load_descriptions,
    save_descriptions,
    validate_admin_session,
)


ADMIN_COOKIE = "seplan_admin_session"


def _flatten(query_string: str) -> dict[str, str]:
    parsed = parse_qs(query_string, keep_blank_values=False)
    return {key: values[-1] for key, values in parsed.items() if values}


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
        self.send_header("Content-Disposition", 'attachment; filename="seplanbi-drilldown-publico.csv"')
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
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
            if action == "admin-session":
                self._json(200, {"ok": True, "authorized": validate_admin_session(self._admin_token())})
                return
            if action == "dashboard-copy":
                self._json(200, load_copy())
                return
            if action == "card-descriptions":
                self._json(200, load_descriptions())
                return
            if action == "analytics":
                self._json(200, analytics_response(analytics_query_from_params(params)))
                return
            if action == "analytics-export":
                self._csv(200, export_public_csv(analytics_query_from_params(params)))
                return
            if action == "indicator-bi":
                self._json(200, extended_indicator_response(params))
                return
            if action != "dashboard":
                self._json(400, {"ok": False, "error": "Ação inválida."})
                return
            self._json(200, dashboard(query_from_params(params)))
        except AdminStoreError as exc:
            self._json(exc.status, {"ok": False, "error": exc.public_message})
        except Exception as exc:
            self._json(500, {"ok": False, "error": str(exc)})

    def do_POST(self):
        try:
            parsed = urlparse(self.path)
            params = _flatten(parsed.query)
            action = params.get("action", "")
            if action not in {"admin-auth", "admin-logout", "dashboard-copy", "card-descriptions"}:
                self._json(400, {"ok": False, "error": "Ação inválida."})
                return

            if action == "admin-logout":
                self._json(200, {"ok": True}, {"Set-Cookie": self._clear_session_cookie()})
                return

            max_body = 4_096 if action == "admin-auth" else 96_000
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > max_body:
                self._json(400, {"ok": False, "error": "Corpo da requisição inválido."})
                return
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            client_ip = self._client_ip()

            if action == "admin-auth":
                token = create_admin_session(payload.get("password", ""), client_ip)
                self._json(
                    200,
                    {"ok": True, "authorized": True, "expires_in": SESSION_TTL_SECONDS},
                    {"Set-Cookie": self._session_cookie(token)},
                )
                return

            session_token = self._admin_token()
            if action == "dashboard-copy":
                result = save_copy(
                    payload.get("copy"),
                    payload.get("password", ""),
                    client_ip,
                    session_token=session_token,
                )
            else:
                result = save_descriptions(
                    payload.get("descriptions"),
                    payload.get("password", ""),
                    client_ip,
                    session_token=session_token,
                )
            self._json(200, result)
        except AdminStoreError as exc:
            self._json(exc.status, {"ok": False, "error": exc.public_message})
        except (ValueError, json.JSONDecodeError):
            self._json(400, {"ok": False, "error": "JSON inválido."})
        except Exception:
            self._json(500, {"ok": False, "error": "Falha interna ao gravar a configuração."})

    def log_message(self, format, *args):
        return
