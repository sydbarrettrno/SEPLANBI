import unittest

from scripts.importar_excel import _encode, _reconcile


def raw(fingerprint="a" * 20):
    return {
        "number": 1,
        "year": 2026,
        "opened": 365,
        "moved": 366,
        "closed": -1,
        "source_fingerprint": fingerprint,
    }


def memory(fingerprint="a" * 20, status="EM ANÁLISE"):
    return {
        "category": "Habite-se",
        "macro": "Licenciamento de Obras",
        "status": status,
        "opened": 365,
        "moved": 366,
        "closed": -1,
        "source_fingerprint": fingerprint,
    }


class DataPipelineTests(unittest.TestCase):
    def test_unchanged_protocol_preserves_semantics(self):
        records, audit = _reconcile({"2026-1": raw()}, {"2026-1": memory()}, {})
        self.assertEqual(records[0]["category"], "Habite-se")
        self.assertEqual(records[0]["status"], "EM ANÁLISE")
        self.assertEqual(audit["semantic_gate"], "APROVADO")

    def test_new_protocol_without_audit_is_blocked(self):
        with self.assertRaisesRegex(RuntimeError, "new_without_semantic_audit"):
            _reconcile({"2026-1": raw()}, {}, {})

    def test_changed_protocol_without_audit_is_blocked(self):
        with self.assertRaisesRegex(RuntimeError, "changed_without_semantic_audit"):
            _reconcile({"2026-1": raw("b" * 20)}, {"2026-1": memory()}, {})

    def test_immutable_category_conflict_is_blocked(self):
        with self.assertRaisesRegex(RuntimeError, "immutable_category_conflicts"):
            _reconcile(
                {"2026-1": raw()},
                {"2026-1": memory()},
                {"2026-1": {"category": "Fiscalização", "status": "EM ANÁLISE"}},
            )

    def test_audited_operational_change_can_update_status(self):
        records, _ = _reconcile(
            {"2026-1": raw("b" * 20)},
            {"2026-1": memory()},
            {"2026-1": {"category": "Habite-se", "status": "ENCERRADO"}},
        )
        self.assertEqual(records[0]["category"], "Habite-se")
        self.assertEqual(records[0]["status"], "ENCERRADO")

    def test_encoding_is_deterministic(self):
        records, _ = _reconcile({"2026-1": raw()}, {"2026-1": memory()}, {})
        first = _encode(records)[0]
        second = _encode(records)[0]
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
