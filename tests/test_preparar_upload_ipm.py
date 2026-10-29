"""Testes isolados do preparador, sem dados pessoais e sem rede."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.preparar_upload_ipm import preparar


class PrepararUploadIPMTests(unittest.TestCase):
    def test_copia_validada_sem_alterar_original(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            origem = root / "Relatorio.xlsx"
            destino = root / "base_validada.xlsx"
            origem.write_bytes(b"amostra")
            with patch("scripts.preparar_upload_ipm.validate_ipm_xlsx", return_value={"unique_protocols": 3}) as validate:
                result = preparar(origem, destino)
            validate.assert_called_once_with(b"amostra")
            self.assertEqual(destino.read_bytes(), b"amostra")
            self.assertEqual(origem.read_bytes(), b"amostra")
            self.assertEqual(result["metricas"]["unique_protocols"], 3)
            self.assertFalse(result["publicado"])

    def test_nao_sobrescreve_destino(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            origem = root / "Relatorio.xlsx"
            destino = root / "base.xlsx"
            origem.write_bytes(b"amostra")
            destino.write_bytes(b"anterior")
            with patch("scripts.preparar_upload_ipm.validate_ipm_xlsx", return_value={"unique_protocols": 1}):
                with self.assertRaisesRegex(ValueError, "já existe"):
                    preparar(origem, destino)
            self.assertEqual(destino.read_bytes(), b"anterior")

    def test_arquivo_invalido_nao_cria_destino(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            origem = root / "Relatorio.xlsx"
            destino = root / "base.xlsx"
            origem.write_bytes(b"arquivo inválido")
            with self.assertRaises(ValueError):
                preparar(origem, destino)
            self.assertFalse(destino.exists())


if __name__ == "__main__":
    unittest.main()
