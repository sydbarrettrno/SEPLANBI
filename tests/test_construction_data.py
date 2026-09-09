from __future__ import annotations

import unittest

from backend.construction_data import (
    PUBLIC_FIELDS,
    construction_data_response,
    export_construction_csv,
    load_construction_rows,
)

RAW_PUBLIC_FIELDS = {
    "permit",
    "date",
    "year",
    "type",
    "area",
    "use",
    "construction",
}
PRIVATE_LABELS = (
    "Titular",
    "CPF",
    "CNPJ",
    "Endereço",
    "Outorga",
)


class ConstructionDataTests(unittest.TestCase):
    def test_public_base_preserves_source_semantics(self):
        meta, rows = load_construction_rows()

        self.assertEqual(meta["source"], "Sistema IPM")
        self.assertEqual(meta["extracted_at"], "2026-09-04")
        self.assertEqual(len(rows), 9_912)
        self.assertTrue(all(set(row) == RAW_PUBLIC_FIELDS for row in rows))
        self.assertTrue(any(row["use"] == "Residencial unifamiliar" for row in rows))
        self.assertTrue(all(row["use"] != "Residencial — não especificado" for row in rows))

    def test_public_response_uses_final_allowlist_and_crossed_fields(self):
        response = construction_data_response({"limit": "10"})

        self.assertTrue(response["ok"])
        self.assertEqual(response["records"]["filtered"], 9_912)
        self.assertEqual(len(response["records"]["items"]), 10)
        self.assertTrue(
            all(set(item) == set(PUBLIC_FIELDS) for item in response["records"]["items"])
        )
        self.assertGreater(response["meta"]["ca_records"], 0)
        self.assertGreater(response["meta"]["lot_area_records"], 0)

        for item in response["records"]["items"]:
            self.assertTrue(
                item["coefficient"] is None or isinstance(item["coefficient"], float)
            )
            self.assertTrue(item["lot_area"] is None or isinstance(item["lot_area"], float))

    def test_filters_and_csv_follow_same_public_contract(self):
        response = construction_data_response(
            {"use": "Residencial unifamiliar", "limit": "10"}
        )

        self.assertTrue(response["ok"])
        self.assertGreater(response["records"]["filtered"], 0)
        self.assertTrue(
            all(
                item["use"] == "Residencial unifamiliar"
                for item in response["records"]["items"]
            )
        )

        csv_text = export_construction_csv(
            {"year": "2026", "use": "Residencial unifamiliar"}
        )
        header, *records = csv_text.splitlines()
        self.assertEqual(
            header,
            "Alvará;Data de emissão;Ano;Tipo de alvará;Área autorizada (m²);Área do imóvel (m²);Uso;Tipo de construção;CA",
        )
        self.assertTrue(records)
        self.assertTrue(all("Residencial unifamiliar" in record for record in records))
        for label in PRIVATE_LABELS:
            self.assertNotIn(label, csv_text)


if __name__ == "__main__":
    unittest.main()
