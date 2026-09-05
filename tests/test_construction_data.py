from __future__ import annotations

from backend.construction_data import (
    PUBLIC_FIELDS,
    construction_data_response,
    export_construction_csv,
    load_construction_rows,
)


def test_construction_public_base_preserves_source_semantics_and_allowlist():
    meta, rows = load_construction_rows()

    assert meta["source"] == "Sistema IPM"
    assert meta["extracted_at"] == "2026-09-04"
    assert len(rows) == 9_912
    assert all(set(row) == set(PUBLIC_FIELDS) for row in rows)
    assert sum(row["use"] == "Residencial — não especificado" for row in rows) == 6_133
    assert all(row["use"] != "Residencial unifamiliar" for row in rows)


def test_construction_filters_and_csv_use_the_same_public_label():
    response = construction_data_response({"use": "Residencial — não especificado", "limit": "10"})

    assert response["ok"] is True
    assert response["records"]["filtered"] == 6_133
    assert len(response["records"]["items"]) == 10
    assert all(item["use"] == "Residencial — não especificado" for item in response["records"]["items"])

    csv_text = export_construction_csv({"year": "2026", "use": "Residencial — não especificado"})
    header, *records = csv_text.splitlines()
    assert header == "Alvará;Data de emissão;Ano;Tipo de alvará;Área autorizada (m²);Uso;Tipo de construção"
    assert records
    assert all("Residencial — não especificado" in record for record in records)
    assert "Titular" not in csv_text
    assert "CPF" not in csv_text
    assert "Endereço" not in csv_text
