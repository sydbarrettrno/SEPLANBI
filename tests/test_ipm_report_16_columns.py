"""Contrato de compatibilidade com Relatorio(1).xlsx do IPM (layout 16 colunas).
Dados de teste sintéticos, sem dados pessoais.
"""
from io import BytesIO
import unittest

from openpyxl import Workbook
from backend.ipm_update_store import validate_ipm_xlsx, IPMUpdateError


HEADERS = [
    "Protocolo", "Requerente", "RequerenteCPFCNPJ", "DataAbertura",
    "ObsAbertura", "CCAbertura", "Situacao", "DataUltTramite",
    "DataEncerramento", "Assunto", "UltTramiteObs", "UltimaAtividade",
    "CCAtual", "Resp", "RespCPFCNPJ", "UsuarioAtual",
]


def fixture(rows):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Report"
    sheet.append(HEADERS)
    for row in rows:
        sheet.append(row)
    buffer = BytesIO()
    workbook.save(buffer)
    workbook.close()
    return buffer.getvalue()


def record(protocol="123/2026", moved="28/10/2026 17:38:14"):
    return [protocol, "EXEMPLO", "", 46323, "", "ENGENHARIA", "Aberto",
            moved, "", "HABITE-SE", "", "", "ENGENHARIA", "", "", ""]


class ReportContractTests(unittest.TestCase):
    def test_relatorio_16_colunas_valido(self):
        metrics = validate_ipm_xlsx(fixture([record()]))
        self.assertEqual(metrics["unique_protocols"], 1)
        self.assertEqual(metrics["source_sheet"], "Report")
        self.assertEqual(metrics["source_columns"], 16)

    def test_duplicacao_impede_importacao(self):
        with self.assertRaises(IPMUpdateError):
            validate_ipm_xlsx(fixture([record(), record()]))

    def test_data_invalida_impede_importacao(self):
        with self.assertRaises(IPMUpdateError):
            validate_ipm_xlsx(fixture([record(moved="01/01/2020 08:00:00")]))


if __name__ == "__main__":
    unittest.main()
