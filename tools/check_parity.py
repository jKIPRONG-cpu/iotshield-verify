"""
Cross-language parity check for the deterministic dataset.

The frontend (``frontend/src/data/mock.ts``) and the backend
(``backend/app/data_gen.py``) implement the same generator twice. This script
runs both and reports the first field where they disagree, so drift is caught
deliberately rather than discovered during a demonstration.

Usage:
    node tools/dump_mock.mjs > /tmp/ts_mock.json   # (bundle first — see README)
    python tools/check_parity.py /tmp/ts_mock.json

Timestamps are compared only for structure, not value: both sides anchor to the
top of the current hour, so a run that straddles an hour boundary would produce
a spurious mismatch.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.data_gen import build_dataset  # noqa: E402

# Fields whose values are time-derived and therefore compared for presence only.
TIME_FIELDS = {"timestamp", "lastActivity", "startedAt", "at", "t", "date"}


def compare(ts: Any, py: Any, path: str, errors: list[str]) -> None:
    if len(errors) >= 15:
        return

    if isinstance(ts, dict) and isinstance(py, dict):
        # `undefined` fields vanish from JSON; treat a missing key and an
        # explicit null as equivalent.
        keys = set(ts) | set(py)
        for key in sorted(keys):
            a, b = ts.get(key), py.get(key)
            if a is None and b is None:
                continue
            if key in TIME_FIELDS:
                if (a is None) != (b is None):
                    errors.append(f"{path}.{key}: presence differs")
                continue
            compare(a, b, f"{path}.{key}", errors)
        return

    if isinstance(ts, list) and isinstance(py, list):
        if len(ts) != len(py):
            errors.append(f"{path}: length {len(ts)} (ts) vs {len(py)} (py)")
            return
        for i, (a, b) in enumerate(zip(ts, py)):
            compare(a, b, f"{path}[{i}]", errors)
        return

    if isinstance(ts, float) or isinstance(py, float):
        if abs(float(ts) - float(py)) > 1e-9:
            errors.append(f"{path}: {ts!r} (ts) vs {py!r} (py)")
        return

    if ts != py:
        errors.append(f"{path}: {ts!r} (ts) vs {py!r} (py)")


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: check_parity.py <ts_mock.json>", file=sys.stderr)
        return 2

    ts_data = json.loads(Path(sys.argv[1]).read_text())
    py_data = build_dataset()

    errors: list[str] = []
    for section in (
        "devices",
        "malware",
        "events",
        "alerts",
        "verification",
        "resilience",
        "summary",
        "analytics",
    ):
        compare(ts_data.get(section), py_data.get(section), section, errors)

    if errors:
        print(f"PARITY FAILED — {len(errors)} difference(s), first 15:\n")
        for e in errors[:15]:
            print(f"  {e}")
        return 1

    print("PARITY OK — the TypeScript and Python datasets agree field-for-field.")
    print(
        f"  devices={len(py_data['devices'])} "
        f"events={len(py_data['events'])} "
        f"alerts={len(py_data['alerts'])} "
        f"malware={len(py_data['malware'])} "
        f"properties={len(py_data['verification']['properties'])}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
