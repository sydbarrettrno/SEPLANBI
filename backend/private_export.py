from __future__ import annotations

from io import BytesIO
from typing import Iterable

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from backend import core
from backend.final_entry import load_rows
from backend.private_data import load_private_rows


PUBLIC_COLUMNS = [
    "ProtocoloID",
    "NumeroAnoOriginal",
    "ProtocoloAno",
    "DataAbertura",
    "UltimoTramiteDataHora",
    "DataEncerramento",
    "DataSaida",
    "TipoSaida",
    "Macroprocesso",
    "Categoria",
    "StatusOperacional",
    "SetorAtual",
    "GargaloOperacional",
    "DiasSemMovimento",
]
PRIVATE_COLUMNS = [
    "SubassuntoOriginal",
    "ObservacaoAbertura",
    "ObservacaoUltimoTramite",
    "NomeRequerente",
    "ResponsavelTecnico",
    "ResponsavelInterno",
    "PessoaResponsavelExterna",
    "TipoPessoaResponsavel",
    "UsuarioAtualNome",
    "SetorAtualFonte",
    "SituacaoOriginal",
]


def _safe(value):
    if value is None:
        return ""
    return value


def _iter_export_rows() -> Iterable[list]:
    private = load_private_rows()
    for public_row in load_rows():
        protocol_id = str(public_row.get("ProtocoloID") or "").strip()
        private_row = private.get(protocol_id, {})
        yield [
            *[_safe(public_row.get(column)) for column in PUBLIC_COLUMNS],
            *[_safe(private_row.get(column)) for column in PRIVATE_COLUMNS],
        ]


def build_private_xlsx() -> tuple[bytes, str]:
    rows = list(_iter_export_rows())
    if not rows:
        raise RuntimeError("Base privada sem registros para exportação.")

    workbook = Workbook(write_only=False)
    sheet = workbook.active
    sheet.title = "BASE_COMPLETA"
    headers = [*PUBLIC_COLUMNS, *PRIVATE_COLUMNS]
    sheet.append(headers)

    header_fill = PatternFill("solid", fgColor="173E60")
    header_font = Font(color="FFFFFF", bold=True)
    for cell in sheet[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(vertical="center", wrap_text=True)

    for row in rows:
        sheet.append(row)

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions

    widths = {
        "ProtocoloID": 18,
        "NumeroAnoOriginal": 18,
        "ProtocoloAno": 12,
        "DataAbertura": 14,
        "UltimoTramiteDataHora": 22,
        "DataEncerramento": 18,
        "DataSaida": 14,
        "TipoSaida": 16,
        "Macroprocesso": 28,
        "Categoria": 30,
        "StatusOperacional": 30,
        "SetorAtual": 32,
        "GargaloOperacional": 26,
        "DiasSemMovimento": 18,
        "SubassuntoOriginal": 28,
        "ObservacaoAbertura": 55,
        "ObservacaoUltimoTramite": 55,
        "NomeRequerente": 34,
        "ResponsavelTecnico": 34,
        "ResponsavelInterno": 30,
        "PessoaResponsavelExterna": 34,
        "TipoPessoaResponsavel": 24,
        "UsuarioAtualNome": 28,
        "SetorAtualFonte": 32,
        "SituacaoOriginal": 22,
    }
    for index, header in enumerate(headers, start=1):
        sheet.column_dimensions[get_column_letter(index)].width = widths.get(header, 18)

    for row in sheet.iter_rows(min_row=2):
        row[headers.index("ObservacaoAbertura")].alignment = Alignment(vertical="top", wrap_text=True)
        row[headers.index("ObservacaoUltimoTramite")].alignment = Alignment(vertical="top", wrap_text=True)

    metadata_sheet = workbook.create_sheet("CONTROLE")
    meta = core.metadata()
    metadata_sheet.append(["Campo", "Valor"])
    metadata_sheet.append(["Data de referência", meta.get("source_updated_at", "")])
    metadata_sheet.append(["Protocolos exportados", len(rows)])
    metadata_sheet.append(["Taxonomia", meta.get("taxonomy_version", "V07")])
    metadata_sheet.append(["Classificação", "BASE PRIVADA — USO INTERNO"])
    metadata_sheet.append(["Conteúdo", "Inclui nomes, responsáveis e observações. Não publicar em GitHub/Vercel como arquivo estático."])
    for cell in metadata_sheet[1]:
        cell.fill = header_fill
        cell.font = header_font
    metadata_sheet.column_dimensions["A"].width = 24
    metadata_sheet.column_dimensions["B"].width = 80
    metadata_sheet["B6"].alignment = Alignment(wrap_text=True)

    output = BytesIO()
    workbook.save(output)
    source_date = str(meta.get("source_updated_at") or "atual").replace("-", "")
    filename = f"SEPLAN_BASE_COMPLETA_PRIVADA_{source_date}.xlsx"
    return output.getvalue(), filename
