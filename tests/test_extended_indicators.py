import json
import unittest

from backend.extended_indicators import extended_indicator_response


class ExtendedIndicatorTests(unittest.TestCase):
    def test_kpi04_time_is_reconciled_and_uses_median_as_primary_context(self):
        data = extended_indicator_response({"kpi": "4"})
        self.assertEqual(data["status"], "DISPONÍVEL")
        self.assertEqual(data["metrics"]["eligible"], 2293)
        self.assertEqual(data["metrics"]["median_days"], 54.0)
        self.assertEqual(data["metrics"]["p90_days"], 227.6)
        self.assertEqual(sum(item["value"] for item in data["bands"]), 2293)
        self.assertEqual(data["records"]["total"], 2293)

    def test_kpi05_only_uses_internal_queue(self):
        data = extended_indicator_response({"kpi": "5", "threshold": "30"})
        self.assertEqual(data["status"], "DISPONÍVEL")
        self.assertEqual(data["metrics"]["internal_queue"], 1545)
        self.assertEqual(data["metrics"]["stopped"], 1096)
        self.assertEqual(data["records"]["total"], 1096)
        for item in data["records"]["items"]:
            self.assertIn(item["status"], {"Em Análise", "Finalização Interna"})

    def test_kpi06_does_not_invent_sla(self):
        data = extended_indicator_response({"kpi": "6"})
        self.assertEqual(data["status"], "NÃO HOMOLOGADO")
        self.assertIsNone(data["metrics"])
        self.assertEqual(data["sla_rules"], [])

    def test_kpi07_is_explicitly_partial_and_reconciled(self):
        data = extended_indicator_response({"kpi": "7"})
        self.assertEqual(data["status"], "PARCIAL")
        self.assertLessEqual(data["metrics"]["diligence_events"], data["coverage"]["event_count_all_types"])
        self.assertEqual(
            sum(item["value"] for item in data["distribution"]),
            data["metrics"]["protocols_with_diligence"],
        )

    def test_kpi08_never_equates_protocols_to_realized_inspections(self):
        data = extended_indicator_response({"kpi": "8"})
        self.assertEqual(data["status"], "NÃO HOMOLOGADO")
        self.assertIsNone(data["metrics"])
        self.assertIn("related_protocols_received", data["context"])

    def test_kpi09_complaints_reconcile(self):
        data = extended_indicator_response({"kpi": "9"})
        self.assertEqual(data["status"], "DISPONÍVEL")
        self.assertGreaterEqual(data["metrics"]["received"], 0)
        self.assertGreaterEqual(data["metrics"]["responded"], 0)
        self.assertEqual(data["records"]["total"], data["metrics"]["current_stock"])

    def test_kpi10_uses_exact_public_project_portfolio(self):
        data = extended_indicator_response({"kpi": "10"})
        self.assertEqual(data["status"], "DISPONÍVEL")
        self.assertEqual(data["metrics"]["projects"], 20)
        self.assertEqual(data["metrics"]["reference_date"], "2026-08-27")
        self.assertEqual(sum(item["value"] for item in data["phases"]), 20)
        self.assertEqual(data["records"]["total"], 20)

    def test_kpi11_matrix_and_stock_reconcile(self):
        data = extended_indicator_response({"kpi": "11", "row_dimension": "category", "column_dimension": "status", "limit": "500"})
        self.assertEqual(data["status"], "DISPONÍVEL")
        self.assertEqual(data["metrics"]["stock"], 2159)
        self.assertEqual(sum(cell["value"] for cell in data["matrix"]["cells"]), 2159)
        self.assertEqual(data["records"]["total"], 2159)

    def test_public_extended_payload_contains_no_private_keys(self):
        forbidden = {
            "NomeRequerente",
            "ResponsavelTecnico",
            "PessoaResponsavelExterna",
            "TipoPessoaResponsavel",
            "ObservacaoUltimoTramite",
            "ResponsavelInterno",
        }
        for kpi in range(4, 12):
            serialized = json.dumps(extended_indicator_response({"kpi": str(kpi)}), ensure_ascii=False)
            for key in forbidden:
                self.assertNotIn(f'"{key}"', serialized)


if __name__ == "__main__":
    unittest.main()
