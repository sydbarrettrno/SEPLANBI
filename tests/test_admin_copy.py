import os
import unittest
from unittest.mock import patch

from backend.admin_store import (
    AdminStoreError,
    DEFAULT_COPY,
    _validate_copy,
    create_admin_session,
    load_copy,
    validate_admin_session,
)


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

    def test_admin_session_is_signed_and_never_contains_password(self):
        secret = "segredo-apenas-no-ambiente-de-teste"
        env = {"SEPLAN_ADMIN_PASSWORD": secret}
        with patch.dict(os.environ, env, clear=False):
            os.environ.pop("BLOB_READ_WRITE_TOKEN", None)
            token = create_admin_session(secret, "127.0.0.1")
            self.assertTrue(validate_admin_session(token))
            self.assertNotIn(secret, token)
            tampered = token[:-1] + ("0" if token[-1] != "0" else "1")
            self.assertFalse(validate_admin_session(tampered))

    def test_admin_session_rejects_wrong_password(self):
        with patch.dict(os.environ, {"SEPLAN_ADMIN_PASSWORD": "correta"}, clear=False):
            os.environ.pop("BLOB_READ_WRITE_TOKEN", None)
            with self.assertRaises(AdminStoreError) as ctx:
                create_admin_session("errada", "127.0.0.1")
            self.assertEqual(ctx.exception.status, 401)


if __name__ == "__main__":
    unittest.main()
