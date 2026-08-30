import json
import os
import unittest
from dataclasses import replace
from pathlib import Path

from backend.analytics import (
    AGE_BANDS,
    HIERARCHIES,
    PRIVATE_DETAIL_FIELDS,
    AnalyticsQuery,
    PrivateAuthorization,
    analytics_response,
    canonical_rows,
    control_totals,
    drilldown_private,
    export_public_csv,
    group_rows,
    indicator_rows,
    monthly_flow,
    query_from_params,
)
from backend.private_data import ENV_PATH, load_private_rows


PRIVATE_V02 = Path(
    r"C:\Users\aniba\AppData\Local\SEPLANBI\private\BASE_PRIVADA_PROTOCOLOS_30082026_V02.json.gz"
)


class AnalyticsTests(unittest.TestCase):
    def setUp(self):
        self.default = query_from_params({})

    def test_received_equals_sum_of_displayed_categories(self):
        rows = indicator_rows(replace(self.default, indicator="received"))
        categories = group_rows(rows, ("category",), "received")
        self.assertEqual(len(rows), 2898)
        self.assertEqual(sum(item["value"] for item in categories), len(rows))

    def test_outputs_equal_concluded_plus_closed(self):
        totals = control_totals(self.default)
        self.assertEqual(totals["outputs"], 2293)
        self.assertEqual(totals["concluded"], 961)
        self.assertEqual(totals["closed"], 1332)
        self.assertEqual(totals["outputs"], totals["concluded"] + totals["closed"])
        self.assertTrue(totals["equations"]["outputs_equals_concluded_plus_closed"])

    def test_stock_equals_three_operational_responsibilities(self):
        totals = control_totals(self.default)
        self.assertEqual(totals["stock"], 2158)
        self.assertEqual(totals["internal"], 1544)
        self.assertEqual(totals["external"], 583)
        self.assertEqual(totals["paralyzed"], 31)
        self.assertEqual(totals["stock"], totals["internal"] + totals["external"] + totals["paralyzed"])

    def test_explicit_period_does_not_reconstruct_stock(self):
        explicit = replace(self.default, indicator="stock", period_explicit=True)
        self.assertEqual(len(indicator_rows(explicit)), 2158)

    def test_category_selection_returns_exact_protocol_set(self):
        all_received = indicator_rows(replace(self.default, indicator="received"))
        selected_category = min(
            {row["Categoria"] for row in all_received},
            key=lambda value: sum(1 for row in all_received if row["Categoria"] == value),
        )
        expected = {row["ProtocoloID"] for row in all_received if row["Categoria"] == selected_category}
        selected_query = replace(self.default, indicator="received", categories=(selected_category,))
        actual = {row["ProtocoloID"] for row in indicator_rows(selected_query)}
        groups = group_rows(indicator_rows(selected_query), ("category",), "received")
        self.assertEqual(actual, expected)
        self.assertEqual(sum(item["value"] for item in groups), len(expected))

    def test_same_period_comparison_is_not_full_previous_year(self):
        response = analytics_response(self.default)
        comparison = response["comparison"]
        self.assertEqual(comparison["current"]["value"], 2898)
        self.assertEqual(comparison["previous"]["from"], "2025-01-01")
        self.assertEqual(comparison["previous"]["to"], "2025-08-28")
        self.assertEqual(comparison["previous"]["value"], 2825)

    def test_outputs_comparison_and_monthly_flow_reconcile(self):
        output_query = replace(self.default, indicator="outputs")
        response = analytics_response(output_query)
        self.assertEqual(response["comparison"]["current"]["value"], 2293)
        self.assertEqual(sum(item["outputs"] for item in response["monthly_flow"]), 2293)
        self.assertEqual(sum(item["received"] for item in response["monthly_flow"]), 2898)
        self.assertEqual(sum(item["balance"] for item in response["monthly_flow"]), 605)

    def test_output_type_filter_does_not_filter_received_series(self):
        output_query = replace(self.default, indicator="outputs", output_types=("Concluído",))
        flow = monthly_flow(output_query)
        self.assertEqual(sum(item["received"] for item in flow), 2898)
        self.assertEqual(sum(item["outputs"] for item in flow), 961)

    def test_stock_category_status_drilldown_is_exact(self):
        internal_query = replace(
            self.default,
            indicator="stock",
            responsibilities=("Fila Interna SEPLAN",),
        )
        category = group_rows(indicator_rows(internal_query), ("category",), "stock")[0]["keys"]["category"]
        category_query = replace(internal_query, categories=(category,))
        status_groups = group_rows(indicator_rows(category_query), ("status",), "stock")
        self.assertEqual(sum(item["value"] for item in status_groups), len(indicator_rows(category_query)))
        selected_status = status_groups[0]["keys"]["status"]
        exact_query = replace(category_query, statuses=(selected_status,))
        expected = {
            row["ProtocoloID"]
            for row in indicator_rows(category_query)
            if row["StatusOperacional"] == selected_status
        }
        actual = {row["ProtocoloID"] for row in indicator_rows(exact_query)}
        self.assertEqual(actual, expected)

    def test_hierarchies_follow_approved_contract(self):
        self.assertEqual(HIERARCHIES["received"], ("year", "month", "macroprocess", "category", "protocol"))
        self.assertEqual(HIERARCHIES["outputs"], ("year", "month", "macroprocess", "category", "output_type", "protocol"))
        self.assertEqual(HIERARCHIES["stock"], ("responsibility", "macroprocess", "category", "status", "protocol"))

    def test_stock_age_bands_are_complete_and_exclusive(self):
        rows = indicator_rows(replace(self.default, indicator="stock"))
        grouped = group_rows(rows, ("age_band",), "stock")
        self.assertEqual(sum(item["value"] for item in grouped), 2158)
        self.assertEqual({item["keys"]["age_band"] for item in grouped}, {item[0] for item in AGE_BANDS})

    def test_sector_is_complete_for_stock_and_unavailable_is_explicit_elsewhere(self):
        stock = indicator_rows(replace(self.default, indicator="stock"))
        self.assertTrue(all(row["SetorAnalitico"] for row in stock))
        terminal = [row for row in canonical_rows() if row["StatusOperacional"] in {"Concluído", "Encerrado"}]
        self.assertTrue(all(row["SetorAnalitico"] == "Não informado na fonte" for row in terminal))

    def test_public_response_contains_no_private_detail_values(self):
        response = analytics_response(replace(self.default, include_records=True, limit=100))
        serialized = json.dumps(response, ensure_ascii=False)
        for field in PRIVATE_DETAIL_FIELDS:
            self.assertNotIn(f'"{field}"', serialized)
        self.assertFalse(response["permissions"]["private_detail"])
        self.assertFalse(response["permissions"]["private_export"])

    def test_public_export_contains_only_sanitized_allowlist(self):
        csv_text = export_public_csv(replace(self.default, indicator="received", categories=("Habite-se",)))
        header = csv_text.splitlines()[0]
        self.assertEqual(header.split(","), [
            "protocol", "protocol_id", "opened", "last_movement", "macroprocess",
            "category", "status", "days_without_movement", "sector",
        ])
        for field in PRIVATE_DETAIL_FIELDS:
            self.assertNotIn(field, csv_text)

    def test_private_drilldown_requires_explicit_authorization(self):
        with self.assertRaises(PermissionError):
            drilldown_private(
                replace(self.default, include_records=True, limit=1),
                PrivateAuthorization(authenticated=False, can_view_pii=False),
            )

    @unittest.skipUnless(PRIVATE_V02.is_file(), "Artefato privado V02 local não disponível")
    def test_private_drilldown_reconciles_only_inside_authorized_backend(self):
        previous = os.environ.get(ENV_PATH)
        os.environ[ENV_PATH] = str(PRIVATE_V02)
        load_private_rows.cache_clear()
        try:
            result = drilldown_private(
                replace(self.default, include_records=True, limit=5),
                PrivateAuthorization(authenticated=True, can_view_pii=True, can_export_pii=False),
            )
            self.assertEqual(len(result["items"]), 5)
            self.assertTrue(set(PRIVATE_DETAIL_FIELDS).issubset(result["items"][0]))
            self.assertFalse(result["export_allowed"])
        finally:
            load_private_rows.cache_clear()
            if previous is None:
                os.environ.pop(ENV_PATH, None)
            else:
                os.environ[ENV_PATH] = previous


if __name__ == "__main__":
    unittest.main()
