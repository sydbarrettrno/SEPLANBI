import unittest
from unittest.mock import patch

from api.index import _analytics_query


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


if __name__ == "__main__":
    unittest.main()
