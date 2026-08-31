import unittest

from backend.admin_store import AdminStoreError, DEFAULT_COPY, _validate_copy, load_copy


class AdminCopyTests(unittest.TestCase):
    def test_default_copy_is_complete_and_safe_without_storage(self):
        data = load_copy()
        self.assertTrue(data["ok"])
        self.assertIn("overview", data["copy"])
        self.assertIn("sidebar", data["copy"])
        self.assertIn("admin", data["copy"])
        self.assertEqual(set(data["copy"]["indicators"]["items"]), {f"KPI{i:02d}" for i in range(1, 12)})

    def test_copy_contract_rejects_missing_fields(self):
        broken = dict(DEFAULT_COPY)
        broken.pop("stock")
        with self.assertRaises(AdminStoreError):
            _validate_copy(broken)

    def test_copy_contract_rejects_extra_fields(self):
        broken = dict(DEFAULT_COPY)
        broken["businessRule"] = "não permitido"
        with self.assertRaises(AdminStoreError):
            _validate_copy(broken)

    def test_copy_contract_rejects_empty_text(self):
        broken = {**DEFAULT_COPY, "overview": {**DEFAULT_COPY["overview"], "title": ""}}
        with self.assertRaises(AdminStoreError):
            _validate_copy(broken)

    def test_copy_contract_accepts_editorial_change_without_touching_structure(self):
        changed = {**DEFAULT_COPY, "overview": {**DEFAULT_COPY["overview"], "title": "Nova leitura executiva"}}
        validated = _validate_copy(changed)
        self.assertEqual(validated["overview"]["title"], "Nova leitura executiva")
        self.assertEqual(validated["stock"], DEFAULT_COPY["stock"])


if __name__ == "__main__":
    unittest.main()
