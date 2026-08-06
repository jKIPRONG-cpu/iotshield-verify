#!/usr/bin/env python3
"""
Convenience launcher for the IoTShield Verify API.

Equivalent to:
    uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

but runnable as a plain `python3 run.py` from the backend directory, which is
one less thing to remember in front of an audience.

Options:
    --host HOST     interface to bind (default 127.0.0.1)
    --port PORT     port to bind (default 8000)
    --no-reload     disable auto-reload (use when presenting)
    --reset         wipe and regenerate the database before starting
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow `python3 run.py` from anywhere by making the package importable.
sys.path.insert(0, str(Path(__file__).resolve().parent))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Start the IoTShield Verify API (demonstration service).",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Interface to bind.")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind.")
    parser.add_argument(
        "--no-reload",
        action="store_true",
        help="Disable auto-reload. Recommended when presenting.",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Wipe and regenerate the database before starting.",
    )
    args = parser.parse_args()

    try:
        import uvicorn
    except ImportError:
        print(
            "uvicorn is not installed.\n\n"
            "    pip install -r requirements.txt\n",
            file=sys.stderr,
        )
        return 1

    if args.reset:
        from app import db

        db.reseed()
        print("Database reset and reseeded.")

    print(
        f"\n  IoTShield Verify API\n"
        f"  ────────────────────────────────────────────\n"
        f"  API   http://{args.host}:{args.port}\n"
        f"  Docs  http://{args.host}:{args.port}/docs\n"
        f"  ────────────────────────────────────────────\n"
        f"  Demonstration service — all data is synthetic.\n"
    )

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=not args.no_reload,
        log_level="info",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
