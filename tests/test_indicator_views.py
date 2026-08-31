import unittest

from backend.indicator_views import indicator_view_response


class IndicatorViewTests(unittest.TestCase):
    def test_kpi04_exposes_same_period_time_comparison(self):
        data = indicator_view_response({"kpi": "4"})
        comparison = data["comparison"]

        self.assertIsNotNone(comparison)
        self.assertEqual(comparison["current"]["from"], "2026-01-01")
        self.assertEqual(comparison["current"]["to"], "2026-08-29")
        self.assertEqual(comparison["previous"]["from"], "2025-01-01")
        self.assertEqual(comparison["previous"]["to"], "2025-08-29")
        self.assertEqual(comparison["current"]["eligible"], data["metrics"]["eligible"])
        self.assertEqual(comparison["current"]["median_days"], data["metrics"]["median_days"])
        self.assertTrue(comparison["monthly"])
        self.assertTrue(all(1 <= row["month"] <= 12 for row in comparison["monthly"]))

    def test_explicit_year_filter_does_not_invent_homologous_period(self):
        data = indicator_view_response({"kpi": "4", "year": "2026"})
        self.assertIsNone(data["comparison"])

    def test_kpi07_monthly_events_reconcile_with_partial_metric(self):
        data = indicator_view_response({"kpi": "7"})
        self.assertEqual(data["status"], "PARCIAL")
        self.assertEqual(
            sum(row["events"] for row in data["monthly"]),
            data["metrics"]["diligence_events"],
        )
        self.assertTrue(all(row["protocols"] <= row["events"] for row in data["monthly"]))

    def test_kpi09_existing_monthly_series_reconciles(self):
        data = indicator_view_response({"kpi": "9"})
        self.assertEqual(sum(row["received"] for row in data["monthly"]), data["metrics"]["received"])
        self.assertEqual(sum(row["responded"] for row in data["monthly"]), data["metrics"]["responded"])

    def test_other_kpis_keep_existing_contract(self):
        data = indicator_view_response({"kpi": "5", "threshold": "30"})
        self.assertEqual(data["status"], "DISPONÍVEL")
        self.assertEqual(data["metrics"]["internal_queue"], 1545)
        self.assertNotIn("comparison", data)


if __name__ == "__main__":
    unittest.main()
