from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.final_entry import dashboard, health, query_from_params  # noqa: E402
from backend.admin_store import DEFAULT_DESCRIPTIONS, load_descriptions  # noqa: E402

EXPECTED = {
    "rows": 7063,
    "received_default": 2898,
    "concluded_operational": 2293,
    "concluded_formal": 1920,
    "stock": 2158,
    "internal_queue": 1544,
    "external_wait": 583,
    "paralyzed": 31,
    "stopped_30_internal": 1086,
    "turnaround_median": 54.0,
    "turnaround_p90": 227.6,
}

h = health()
assert h["status"] == "ok", h
assert h["audit"]["rows"] == EXPECTED["rows"], h
assert h["audit"]["unique_protocols"] == EXPECTED["rows"], h
assert h["audit"]["stock"] == EXPECTED["stock"], h
assert h["audit"]["internal_queue"] == EXPECTED["internal_queue"], h
assert h["audit"]["external_wait"] == EXPECTED["external_wait"], h
assert h["audit"]["paralyzed"] == EXPECTED["paralyzed"], h

d = dashboard(query_from_params({}))
m = d["metrics"]
assert m["received"] == EXPECTED["received_default"], m
assert m["concluded"] == EXPECTED["concluded_operational"], m
assert m["concluded_formal"] == EXPECTED["concluded_formal"], m
assert m["stock"] == EXPECTED["stock"], m
assert m["internal_queue"] == EXPECTED["internal_queue"], m
assert m["external_wait"] == EXPECTED["external_wait"], m
assert m["paralyzed"] == EXPECTED["paralyzed"], m
assert m["stopped"]["count"] == EXPECTED["stopped_30_internal"], m
assert round(m["stopped"]["percent"], 1) == 70.3, m
assert m["turnaround"]["median_days"] == EXPECTED["turnaround_median"], m
assert m["turnaround"]["p90_days"] == EXPECTED["turnaround_p90"], m
assert len(d["charts"]["flow"]) == 8, d["charts"]["flow"]
assert sum(item["value"] for item in d["charts"]["received_categories"]) == m["received"]
assert sum(item["value"] for item in d["charts"]["concluded_categories"]) == m["concluded"]
assert sum(item["value"] for item in d["charts"]["categories"]) == m["stock"]
assert sum(item["value"] for item in d["charts"]["internal_categories"]) == m["internal_queue"]
assert len(d["records"]["items"]) <= 200
assert any(x["id"] == "KPI06" and x["status"] != "DISPONÍVEL" for x in d["indicator_coverage"])

cmp = d["management"]["comparison"]
assert cmp["previous"]["received"] == 2825, cmp
assert cmp["current"]["cohort_concluded_formal"] == 1344, cmp
assert cmp["previous"]["cohort_concluded_formal"] == 1262, cmp
assert cmp["received_change_percent"] == 2.6, cmp
assert cmp["cohort_formal_change_percent"] == 6.5, cmp
assert d["management"]["data_quality"]["operational_closed_without_formal_date"] == 839
assert set(d["options"]["statuses"]) == {
    "Em Análise",
    "Finalização Interna",
    "Aguardando Responsável Externo",
    "Paralisado",
    "Concluído",
    "Encerrado",
}
assert d["management"]["public_projects"]["protocols_identified"] == 20
assert d["management"]["public_projects"]["reference_date"] == "2026-08-27"

admin = load_descriptions()
assert set(admin["descriptions"]) == set(DEFAULT_DESCRIPTIONS)

print(json.dumps({
    "status": "VALIDADO",
    "health": h,
    "default_metrics": m,
    "comparison": cmp,
}, ensure_ascii=False, indent=2))
