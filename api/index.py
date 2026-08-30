from http.server import BaseHTTPRequestHandler
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
from backend.admin_store import AdminStoreError, load_descriptions, save_descriptions


def _flatten(query_string: str) -> dict[str, str]:
    parsed = parse_qs(query_string, keep_blank_values=False)
    return {key: values[-1] for key, values in parsed.items() if values}


class handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
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

    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            params = _flatten(parsed.query)
            action = params.pop("action", "dashboard")
            if action == "health":
                self._json(200, health())
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
            if action != "card-descriptions":
                self._json(400, {"ok": False, "error": "Ação inválida."})
                return
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 16_384:
                self._json(400, {"ok": False, "error": "Corpo da requisição inválido."})
                return
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            forwarded = self.headers.get("X-Forwarded-For", "")
            client_ip = forwarded.split(",", 1)[0].strip() or self.client_address[0]
            result = save_descriptions(payload.get("descriptions"), payload.get("password", ""), client_ip)
            self._json(200, result)
        except AdminStoreError as exc:
            self._json(exc.status, {"ok": False, "error": exc.public_message})
        except (ValueError, json.JSONDecodeError):
            self._json(400, {"ok": False, "error": "JSON inválido."})
        except Exception:
            self._json(500, {"ok": False, "error": "Falha interna ao gravar a configuração."})

    def log_message(self, format, *args):
        return
