from __future__ import annotations

import json
import mimetypes
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
sys.path.insert(0, str(ROOT))

from backend.final_entry import dashboard, health, query_from_params  # noqa: E402
from backend.analytics import analytics_response, export_public_csv, query_from_params as analytics_query_from_params  # noqa: E402
from backend.indicator_views import indicator_view_response  # noqa: E402
from backend.admin_store import AdminStoreError, load_copy, load_descriptions, save_descriptions  # noqa: E402
from backend.construction_data import construction_data_response, export_construction_csv  # noqa: E402


def _flatten(query_string: str) -> dict[str, str]:
    parsed = parse_qs(query_string, keep_blank_values=False)
    return {key: values[-1] for key, values in parsed.items() if values}


class DevHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def _send_json(self, status: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionError):
            return

    def _send_csv(self, status: int, body_text: str, filename: str = "seplanbi-drilldown-publico.csv"):
        body = body_text.encode("utf-8-sig")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionError):
            return

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api":
            try:
                params = _flatten(parsed.query)
                action = params.pop("action", "dashboard")
                if action == "health":
                    payload = health()
                elif action == "admin-session":
                    payload = {"ok": True, "authorized": False}
                elif action == "dashboard-copy":
                    payload = load_copy()
                elif action == "card-descriptions":
                    payload = load_descriptions()
                elif action == "analytics":
                    payload = analytics_response(analytics_query_from_params(params))
                elif action == "analytics-export":
                    self._send_csv(200, export_public_csv(analytics_query_from_params(params)))
                    return
                elif action == "indicator-bi":
                    payload = indicator_view_response(params)
                elif action == "construction-data":
                    payload = construction_data_response(params)
                elif action == "construction-export":
                    self._send_csv(200, export_construction_csv(params), "alvaras-itapoa-base-analitica.csv")
                    return
                elif action == "dashboard":
                    payload = dashboard(query_from_params(params))
                else:
                    self._send_json(400, {"ok": False, "error": "Ação inválida."})
                    return
                self._send_json(200, payload)
            except Exception as exc:
                self._send_json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/":
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api":
            self._send_json(404, {"ok": False, "error": "Rota não encontrada."})
            return
        try:
            params = _flatten(parsed.query)
            if params.get("action") != "card-descriptions":
                self._send_json(400, {"ok": False, "error": "Ação inválida."})
                return
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 16_384:
                self._send_json(400, {"ok": False, "error": "Corpo da requisição inválido."})
                return
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            result = save_descriptions(payload.get("descriptions"), payload.get("password", ""), "127.0.0.1")
            self._send_json(200, result)
        except AdminStoreError as exc:
            self._send_json(exc.status, {"ok": False, "error": exc.public_message})
        except Exception:
            self._send_json(400, {"ok": False, "error": "Requisição inválida."})

    def log_message(self, format, *args):
        sys.stdout.write("[dev] " + (format % args) + "\n")


if __name__ == "__main__":
    if not (DIST / "index.html").is_file():
        raise SystemExit("Build React ausente. Execute 'npm ci' e 'npm run build' antes de iniciar.")
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), DevHandler)
    print(f"SEPLAN Gestão à Vista: http://localhost:{port}")
    print(f"Health: http://localhost:{port}/api?action=health")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
