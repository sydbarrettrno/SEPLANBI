import unittest

from backend.final_entry import dashboard, health, query_from_params
from backend.final_data import load_rows


class CoreTests(unittest.TestCase):
    def test_data_audit(self):
        h = health()
        self.assertEqual(h["status"], "ok")
        self.assertEqual(h["audit"]["rows"], 7064)
        self.assertEqual(h["audit"]["unique_protocols"], 7064)
        self.assertEqual(h["audit"]["stock"], 2159)
        self.assertEqual(h["audit"]["internal_queue"], 1545)
        self.assertEqual(h["audit"]["external_wait"], 583)
        self.assertEqual(h["audit"]["paralyzed"], 31)

    def test_default_metrics(self):
        d = dashboard(query_from_params({}))
        m = d["metrics"]
        self.assertEqual(m["received"], 2899)
        self.assertEqual(m["concluded"], 2293)
        self.assertEqual(m["concluded_formal"], 1920)
        self.assertEqual(m["stock"], 2159)
        self.assertEqual(m["internal_queue"], 1545)
        self.assertEqual(m["external_wait"], 583)
        self.assertEqual(m["paralyzed"], 31)
        self.assertEqual(m["stopped"]["count"], 1086)
        self.assertEqual(round(m["stopped"]["percent"], 1), 70.3)
        self.assertEqual(m["turnaround"]["median_days"], 54.0)
        self.assertEqual(m["turnaround"]["p90_days"], 227.6)

    def test_reconciliation(self):
        m = dashboard(query_from_params({}))["metrics"]
        self.assertEqual(m["stock"], m["internal_queue"] + m["external_wait"] + m["paralyzed"])
        self.assertEqual(m["stock"], 2159)

    def test_same_period_comparison(self):
        cmp = dashboard(query_from_params({}))["management"]["comparison"]
        self.assertEqual(cmp["current"]["received"], 2899)
        self.assertEqual(cmp["previous"]["received"], 2838)
        self.assertEqual(cmp["received_change_percent"], 2.1)
        self.assertEqual(cmp["current"]["cohort_concluded_formal"], 1344)
        self.assertEqual(cmp["previous"]["cohort_concluded_formal"], 1274)
        self.assertEqual(cmp["cohort_formal_change_percent"], 5.5)
        self.assertEqual(cmp["current"]["passive_absorbed"], 632)

    def test_period_does_not_reconstruct_stock(self):
        a = dashboard(query_from_params({"from": "2025-01-01", "to": "2025-12-31"}))["metrics"]
        b = dashboard(query_from_params({"from": "2026-01-01", "to": "2026-08-29"}))["metrics"]
        self.assertEqual(a["stock"], b["stock"])
        self.assertNotEqual(a["received"], b["received"])

    def test_category_filter(self):
        d = dashboard(query_from_params({"category": "Habite-se"}))
        self.assertGreater(d["meta"]["scope_rows"], 0)
        self.assertTrue(all(x["category"] == "Habite-se" for x in d["records"]["items"]))

    def test_pii_not_in_dataset_schema(self):
        forbidden = {"ResponsavelInterno", "NomeRequerente", "ResponsavelTecnico", "PessoaResponsavelExterna", "TipoPessoaResponsavel", "ObservacaoUltimoTramite", "RequerenteNomeRazao", "RequerenteCPFCNPJ", "ObservacaoAbertura", "UltimoTramiteObservacao", "ResponsavelGargalo", "Inscricao"}
        self.assertFalse(forbidden.intersection(load_rows()[0].keys()))

    def test_recordsets_and_thresholds(self):
        base = dashboard(query_from_params({"limit": "500"}))
        for name, expected in (("received", 2899), ("concluded", 2293), ("stock", 2159), ("stopped", 1086)):
            d = dashboard(query_from_params({"recordset": name, "limit": "500"}))
            self.assertEqual(d["records"]["recordset"], name)
            self.assertEqual(d["records"]["total"], expected)
        d60 = dashboard(query_from_params({"threshold": "60"}))
        self.assertLessEqual(d60["metrics"]["stopped"]["count"], base["metrics"]["stopped"]["count"])

    def test_search_and_pagination(self):
        rows = load_rows()
        target = rows[0]
        q = target["ProtocoloID"]
        d = dashboard(query_from_params({"q": q, "limit": "10"}))
        self.assertGreaterEqual(d["records"]["total"], 1)
        self.assertTrue(any(x["protocol_id"] == q for x in d["records"]["items"]))
        page = dashboard(query_from_params({"limit": "10", "offset": "10"}))
        self.assertEqual(page["records"]["offset"], 10)
        self.assertLessEqual(len(page["records"]["items"]), 10)

    def test_invalid_params_are_safely_normalized(self):
        q = query_from_params({"from": "2026-08-20", "to": "2026-01-01", "threshold": "x", "limit": "99999", "offset": "-8", "recordset": "bad"})
        self.assertLessEqual(q.start, q.end)
        self.assertEqual(q.threshold, 30)
        self.assertEqual(q.limit, 500)
        self.assertEqual(q.offset, 0)
        self.assertEqual(q.recordset, "all")

    def test_indicator_coverage_is_explicit(self):
        coverage = {x["id"]: x for x in dashboard(query_from_params({}))["indicator_coverage"]}
        for kpi in ("KPI06", "KPI07", "KPI10"):
            self.assertNotEqual(coverage[kpi]["status"], "DISPONÍVEL")
        self.assertEqual(coverage["KPI08"]["status"], "PARCIAL")
        self.assertEqual(coverage["KPI09"]["status"], "PARCIAL")
        self.assertEqual(coverage["KPI11"]["status"], "DISPONÍVEL")

    def test_owner_is_categorical(self):
        allowed = {"Interno", "Externo", "Paralisado", "Nenhum"}
        d = dashboard(query_from_params({}))
        self.assertTrue(set(d["options"]["owners"]).issubset(allowed))
        self.assertTrue(all("Inscricao" not in r and "ResponsavelGargalo" not in r for r in load_rows()))

    def test_operational_vs_formal_is_preserved(self):
        d = dashboard(query_from_params({}))
        self.assertEqual(d["management"]["data_quality"]["operational_closed_without_formal_date"], 839)
        self.assertGreater(d["metrics"]["concluded"], d["metrics"]["concluded_formal"])

    def test_exact_homologated_statuses(self):
        expected = {
            "Em Análise",
            "Finalização Interna",
            "Aguardando Responsável Externo",
            "Paralisado",
            "Concluído",
            "Encerrado",
        }
        d = dashboard(query_from_params({}))
        self.assertEqual(set(d["options"]["statuses"]), expected)

    def test_public_projects_use_v04_reference(self):
        d = dashboard(query_from_params({}))
        projects = d["management"]["public_projects"]
        self.assertEqual(projects["protocols_identified"], 20)
        self.assertEqual(projects["reference_date"], "2026-08-27")
        self.assertEqual(sum(item["value"] for item in d["charts"]["public_projects_status"]), 20)


if __name__ == "__main__":
    unittest.main()
