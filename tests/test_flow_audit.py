import unittest

from backend.final_entry import dashboard, query_from_params


class MonthlyFlowAuditTests(unittest.TestCase):
    def test_june_2026_output_composition(self):
        data = dashboard(query_from_params({"from": "2026-06-01", "to": "2026-06-30"}))
        june = data["charts"]["flow"][0]
        self.assertEqual(june["received"], 300)
        self.assertEqual(june["concluded"], 359)
        self.assertEqual(june["same_month_outputs"], 64)
        self.assertEqual(june["backlog_outputs"], 295)
        self.assertEqual(june["same_month_outputs"] + june["backlog_outputs"], june["concluded"])

    def test_all_months_reconcile(self):
        data = dashboard(query_from_params({}))
        for point in data["charts"]["flow"]:
            self.assertEqual(point["same_month_outputs"] + point["backlog_outputs"], point["concluded"])


if __name__ == "__main__":
    unittest.main()
