from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import admin_store  # noqa: E402


storage: dict[str, bytes] = {}


def fake_read(path: str) -> bytes | None:
    return storage.get(path)


def fake_write(path: str, body: bytes, *, overwrite: bool) -> None:
    if not overwrite and path in storage:
        raise AssertionError(f"Sobrescrita não autorizada: {path}")
    storage[path] = body


def fake_delete(path: str) -> None:
    storage.pop(path, None)


with (
    patch.dict(
        os.environ,
        {"SEPLAN_ADMIN_PASSWORD": "senha-teste", "BLOB_READ_WRITE_TOKEN": "token-teste"},
        clear=False,
    ),
    patch.object(admin_store, "_read_blob", side_effect=fake_read),
    patch.object(admin_store, "_write_blob", side_effect=fake_write),
    patch.object(admin_store, "_delete_blob", side_effect=fake_delete),
    patch.object(admin_store, "_prune_history", return_value=None),
):
    try:
        admin_store.save_descriptions(admin_store.DEFAULT_DESCRIPTIONS, "incorreta", "127.0.0.1")
        raise AssertionError("Senha incorreta deveria ser recusada.")
    except admin_store.AdminStoreError as exc:
        assert exc.status == 401

    attempt_path = admin_store._attempt_path("127.0.0.1")
    assert attempt_path in storage

    result = admin_store.save_descriptions(admin_store.DEFAULT_DESCRIPTIONS, "senha-teste", "127.0.0.1")
    assert result["persistent"] is True
    assert result["descriptions"] == admin_store.DEFAULT_DESCRIPTIONS
    assert attempt_path not in storage
    assert admin_store.CURRENT_PATH in storage
    assert len([path for path in storage if path.startswith(admin_store.HISTORY_PREFIX)]) == 1

    loaded = admin_store.load_descriptions()
    assert loaded["descriptions"] == admin_store.DEFAULT_DESCRIPTIONS
    assert loaded["updated_at"] == result["updated_at"]

print("ADMIN_STORE_VALIDADO")
