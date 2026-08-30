from __future__ import annotations

import gzip
import json
import unittest
from datetime import datetime

from scripts.atualizar_relatorio_ipm import (
    _canonicalize_row,
    _current_fingerprint,
    _encode,
    _preserve_historical_closures,
    _reconcile,
)


def raw(protocol_id="2026-1", fingerprint="b" * 20, closed=-1):
    year, number = (int(value) for value in protocol_id.split("-", 1))
    return {
        "protocol_id": protocol_id,
        "number": number,
        "year": year,
        "opened": 365,
        "moved": 366,
        "moved_at": datetime(2026, 1, 2, 10, 30),
        "closed": closed,
        "opened_datetime": datetime(2026, 1, 1),
        "closed_datetime": None,
        "legacy_fingerprint": fingerprint,
        "source_fingerprint": fingerprint,
        "source_fields": {
            "Situação": "Tramitando",
            "Categoria": "HABITE-SE",
            "CCAtual": "SEPLAN",
            "CCAtualClassificacao": "01.02",
            "Última Atividade": "Análise",
            "UltTramiteOBS": "Encaminhado para análise.",
        },
    }


def memory(fingerprint="a" * 20, status="Em Análise", closed=-1):
    return {
        "category": "Habite-se",
        "macro": "Licenciamento de Obras",
        "status": status,
        "opened": 365,
        "moved": 365,
        "closed": closed,
        "source_fingerprint": fingerprint,
    }


class IpmPipelineTests(unittest.TestCase):
    def test_elapsed_activity_label_is_not_an_operational_change(self):
        fields = raw()["source_fields"]
        first = _current_fingerprint(
            fields, datetime(2026, 1, 1), datetime(2026, 1, 2, 10, 30), None
        )
        later_fields = {**fields, "Última Atividade": "4 Dias"}
        second = _current_fingerprint(
            later_fields, datetime(2026, 1, 1), datetime(2026, 1, 2, 10, 30), None
        )
        self.assertEqual(first, second)

    def test_ipm_headers_are_mapped_explicitly(self):
        row = _canonicalize_row({
            "Número/Ano": "1/2026",
            "Abertura - Data": "01/01/2026",
            "Último Trâmite - Data/Hora": "02/01/2026 10:30:00",
            "Subassunto - Descrição": "HABITE-SE",
            "Centro de Custo Atual - Classificação": "01.02",
            "Centro de Custo Atual - Descrição": "SEPLAN",
        })
        self.assertEqual(row["DataAbertura"], "01/01/2026")
        self.assertEqual(row["UltTramiteData"], "02/01/2026 10:30:00")
        self.assertEqual(row["Categoria"], "HABITE-SE")
        self.assertEqual(row["CCAtual"], "SEPLAN")
        self.assertEqual(row["CCAtualClassificacao"], "01.02")

    def test_historical_close_is_not_erased_by_blank_report(self):
        item = raw(closed=-1)
        count = _preserve_historical_closures(
            {"2026-1": item},
            {"2026-1": memory(closed=400)},
        )
        self.assertEqual(count, 1)
        self.assertEqual(item["closed"], 400)

    def test_changed_protocol_preserves_category_and_records_event(self):
        records, events, audit = _reconcile(
            {"2026-1": raw()},
            {"2026-1": memory()},
            {"2026-1": {"category": "Habite-se", "status": "Aguardando RT", "event_type": "DILIGENCIA"}},
            [],
            2,
        )
        self.assertEqual(records[0]["category"], "Habite-se")
        self.assertEqual(records[0]["status"], "Aguardando RT")
        self.assertEqual(events[0]["event_type"], "DILIGENCIA")
        self.assertEqual(audit["events_added"], 1)

    def test_changed_protocol_without_event_type_is_blocked(self):
        with self.assertRaisesRegex(RuntimeError, "incomplete_changed_audit"):
            _reconcile(
                {"2026-1": raw()},
                {"2026-1": memory()},
                {"2026-1": {"category": "Habite-se", "status": "Aguardando RT", "event_type": ""}},
                [],
                2,
            )

    def test_new_protocol_requires_existing_category_mapping(self):
        records, events, audit = _reconcile(
            {
                "2026-1": raw("2026-1", "a" * 20),
                "2026-2": raw("2026-2"),
            },
            {"2026-1": memory()},
            {"2026-2": {"category": "Habite-se", "status": "Em Análise", "event_type": "INCLUSAO"}},
            [],
            2,
        )
        new_record = next(record for record in records if record["protocol_id"] == "2026-2")
        self.assertEqual(new_record["macro"], "Licenciamento de Obras")
        self.assertEqual(events[0]["event_type"], "INCLUSAO")
        self.assertEqual(audit["new_audited"], 1)

    def test_event_encoding_is_deterministic(self):
        records, events, _ = _reconcile(
            {"2026-1": raw()},
            {"2026-1": memory()},
            {"2026-1": {"category": "Habite-se", "status": "Aguardando RT", "event_type": "TRAMITACAO"}},
            [],
            2,
        )
        first = _encode(records, events)[0]
        second = _encode(records, events)[0]
        self.assertEqual(first, second)
        payload = json.loads(gzip.decompress(first).decode("utf-8"))
        self.assertEqual(set(payload["e"]), {"p", "a", "k", "s"})
        self.assertEqual(len(payload["e"]["p"]), 1)

    def test_event_encoding_is_stable_after_minute_precision_reload(self):
        first_raw = raw("2026-1", "b" * 20)
        second_raw = raw("2026-2", "c" * 20)
        first_raw["moved_at"] = datetime(2026, 1, 2, 10, 30, 50)
        second_raw["moved_at"] = datetime(2026, 1, 2, 10, 30, 10)
        records, events, _ = _reconcile(
            {"2026-1": first_raw, "2026-2": second_raw},
            {"2026-1": memory(), "2026-2": memory()},
            {
                "2026-1": {"category": "Habite-se", "status": "Em Análise", "event_type": "TRAMITACAO"},
                "2026-2": {"category": "Habite-se", "status": "Em Análise", "event_type": "TRAMITACAO"},
            },
            [],
            2,
        )
        first = _encode(records, events)[0]
        reloaded_events = [
            {**event, "event_at": event["event_at"].replace(second=0, microsecond=0)}
            for event in events
        ]
        second = _encode(records, reloaded_events)[0]
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
