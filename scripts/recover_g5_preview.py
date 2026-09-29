from __future__ import annotations

import json
import os
import sys

RUN_ID = "44385f76-0630-4668-a211-f8de61b10f4d"
TARGET_BRANCH = "feat/ipm-worker-v01"


def main() -> int:
    if os.getenv("VERCEL_ENV") != "preview" or os.getenv("VERCEL_GIT_COMMIT_REF") != TARGET_BRANCH:
        print("G5_RECOVERY_SKIPPED")
        return 0
    try:
        from backend.ipm_supabase_store import process_ipm_import
        result = process_ipm_import(RUN_ID)
        run = result.get("run") or {}
        comparison = ((run.get("metrics") or {}).get("comparison") or {})
        print("G5_RECOVERY_RESULT=" + json.dumps({
            "db_status": run.get("db_status"),
            "phase": run.get("phase"),
            "new": comparison.get("new"),
            "changed": comparison.get("changed"),
            "unchanged": comparison.get("unchanged"),
            "removed": comparison.get("removed"),
            "message": run.get("message"),
        }, ensure_ascii=False, sort_keys=True))
    except Exception as exc:
        print("G5_RECOVERY_ERROR=" + repr(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
