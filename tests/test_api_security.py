import unittest
from unittest.mock import patch

from api.index import _analytics_query, _public_analytics_payload


class ApiSecurityTests(unittest.TestCase):
    def test_invalid_analytics_indicator_is_rejected(self):
        with self.assertRaises(ValueError):
            _analytics_query({"indicator": "invalid"})

    def test_known_analytics_indicator_is_forwarded(self):
        with patch("api.index.analytics_query_from_params", side_effect=lambda params: params):
            result = _analytics_query({"indicator": "received"})
        self.assertEqual(result["indicator"], "received")

    def test_missing_indicator_preserves_existing_default_contract(self):
        with patch("api.index.analytics_query_from_params", side_effect=lambda params: params):
            result = _analytics_query({})
        self.assertEqual(result, {})

    def test_public_analytics_payload_removes_internal_metadata_and_duplicate_identifier(self):
        payload = {
            "ok": True,
            "meta": {
                "dataset": "internal-name",
                "schema_version": 9,
                "source_updated_at": "2026-08-29",
                "indicator": "received",
                "total": 1,
                "grouped_sum": 1,
                "grouping_reconciled": True,
                "sector_coverage": {"internal": True},
            },
            "permissions": {"note": "internal implementation detail"},
            "records": {
                "total": 1,
                "offset": 0,
                "limit": 25,
                "items": [{
                    "protocol": "1/2026",
                    "protocol_id": "2026-1",
                    "opened": "2026-01-01",
                    "last_movement": "2026-01-02",
                    "macroprocess": "Internal grouping",
                    "category": "Alvará",
                    "status": "Em Análise",
                    "days_without_movement": 1,
                    "sector": "Engenharia",
                }],
            },
        }
        result = _public_analytics_payload(payload)
        self.assertEqual(set(result["meta"]), {"indicator", "total", "grouped_sum", "grouping_reconciled"})
        self.assertNotIn("note", result["permissions"])
        self.assertFalse(result["permissions"]["public_export"])
        self.assertNotIn("protocol_id", result["records"]["items"][0])
        self.assertNotIn("macroprocess", result["records"]["items"][0])
        self.assertEqual(result["records"]["items"][0]["protocol"], "1/2026")


if __name__ == "__main__":
    unittest.main()
