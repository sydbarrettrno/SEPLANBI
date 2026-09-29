from __future__ import annotations

import unittest
from unittest.mock import patch

from backend.ipm_supabase_store import IPMUpdateError, process_next_ipm_import


class IpmWorkerTests(unittest.TestCase):
    def test_no_pending_import_does_not_process(self):
        with patch("backend.ipm_supabase_store._edge", return_value={"result": None}) as edge:
            self.assertEqual(process_next_ipm_import(), {"ok": True, "processed": False})
            edge.assert_called_once_with("claim-next")

    def test_success_releases_lease_after_processing(self):
        calls = []

        def edge(action, **kwargs):
            calls.append((action, kwargs))
            if action == "claim-next":
                return {"result": {"run_id": "run-1", "lease_token": "token-1"}}
            return {"ok": True}

        with patch("backend.ipm_supabase_store._edge", side_effect=edge), patch(
            "backend.ipm_supabase_store.process_ipm_import",
            return_value={"run": {"db_status": "ready_for_review"}},
        ) as process:
            result = process_next_ipm_import()

        process.assert_called_once_with("run-1")
        self.assertEqual(result["status"], "ready_for_review")
        self.assertEqual(calls[-1], ("finish-worker", {
            "payload": {"run_id": "run-1", "lease_token": "token-1"},
        }))

    def test_failure_releases_lease_and_preserves_error(self):
        calls = []

        def edge(action, **kwargs):
            calls.append((action, kwargs))
            if action == "claim-next":
                return {"result": {"run_id": "run-1", "lease_token": "token-1"}}
            return {"ok": True}

        with patch("backend.ipm_supabase_store._edge", side_effect=edge), patch(
            "backend.ipm_supabase_store.process_ipm_import",
            side_effect=IPMUpdateError(503, "Falha transitória."),
        ):
            with self.assertRaises(IPMUpdateError):
                process_next_ipm_import()

        self.assertEqual(calls[-1][0], "finish-worker")
        self.assertEqual(calls[-1][1]["payload"]["error"], "Falha transitória.")


if __name__ == "__main__":
    unittest.main()
