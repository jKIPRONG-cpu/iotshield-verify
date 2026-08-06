"""
SQLite persistence.

The generated dataset is written into a small relational schema once, then read
back on every request. That is deliberately more machinery than a demo strictly
needs — it exists so the API exercises a real query path (filtering, sorting,
lookup by id) rather than slicing an in-memory list, which is what makes the
endpoint behaviour representative.

``init_db()`` is idempotent and safe to call repeatedly: it creates tables if
absent and seeds only when the device table is empty. That matters because it is
invoked both at import time (so ``TestClient`` works without a lifespan event)
and from the startup handler (so a reloading uvicorn worker is always ready).

List and object fields are stored as JSON text — SQLite has no array type, and
the payloads are small enough that normalising them would add cost without
buying anything.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from pathlib import Path
from typing import Any

from . import data_gen

# Override with IOTSHIELD_DB to relocate the file (tests use ":memory:"-like
# temp paths; a container deployment would point this at a volume).
DB_PATH = Path(
    os.environ.get("IOTSHIELD_DB", Path(__file__).resolve().parent.parent / "iotshield.db")
)

# SQLite connections are not safe to share across threads without care; uvicorn
# serves requests from a thread pool, so each call gets its own connection and
# writes are serialised behind this lock.
_write_lock = threading.Lock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS devices (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    category          TEXT NOT NULL,
    vendor            TEXT NOT NULL,
    ip                TEXT NOT NULL,
    mac               TEXT NOT NULL,
    firmware          TEXT NOT NULL,
    firmware_outdated INTEGER NOT NULL,
    status            TEXT NOT NULL,
    risk              TEXT NOT NULL,
    last_activity     TEXT NOT NULL,
    location          TEXT NOT NULL,
    health            INTEGER NOT NULL,
    protocol          TEXT NOT NULL,
    open_ports        TEXT NOT NULL,
    uptime_hours      INTEGER NOT NULL,
    infected_by       TEXT
);

CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_risk   ON devices(risk);

CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,
    timestamp   TEXT NOT NULL,
    device_id   TEXT NOT NULL,
    device_name TEXT NOT NULL,
    kind        TEXT NOT NULL,
    source_ip   TEXT NOT NULL,
    dest_ip     TEXT NOT NULL,
    dest_port   INTEGER NOT NULL,
    protocol    TEXT NOT NULL,
    bytes       INTEGER NOT NULL,
    verdict     TEXT NOT NULL,
    severity    TEXT NOT NULL,
    detail      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_verdict   ON events(verdict);

CREATE TABLE IF NOT EXISTS alerts (
    id              TEXT PRIMARY KEY,
    timestamp       TEXT NOT NULL,
    device_id       TEXT NOT NULL,
    device_name     TEXT NOT NULL,
    threat          TEXT NOT NULL,
    malware_family  TEXT,
    severity        TEXT NOT NULL,
    status          TEXT NOT NULL,
    action          TEXT NOT NULL,
    description     TEXT NOT NULL,
    mitre_tactic    TEXT NOT NULL,
    mitre_technique TEXT NOT NULL,
    confidence      INTEGER NOT NULL,
    source_ip       TEXT NOT NULL,
    severity_rank   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity  ON alerts(severity);

CREATE TABLE IF NOT EXISTS malware (
    id      TEXT PRIMARY KEY,
    payload TEXT NOT NULL
);

-- Single-row documents that have no useful relational shape.
CREATE TABLE IF NOT EXISTS documents (
    key     TEXT PRIMARY KEY,
    payload TEXT NOT NULL
);
"""

SEVERITY_RANK = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}


def connect() -> sqlite3.Connection:
    """Open a connection with row access by column name."""
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _seed(conn: sqlite3.Connection) -> None:
    """Populate every table from a freshly generated dataset."""
    data = data_gen.build_dataset()

    conn.executemany(
        """INSERT INTO devices VALUES
           (:id, :name, :category, :vendor, :ip, :mac, :firmware,
            :firmware_outdated, :status, :risk, :last_activity, :location,
            :health, :protocol, :open_ports, :uptime_hours, :infected_by)""",
        [
            {
                "id": d["id"],
                "name": d["name"],
                "category": d["category"],
                "vendor": d["vendor"],
                "ip": d["ip"],
                "mac": d["mac"],
                "firmware": d["firmware"],
                "firmware_outdated": int(d["firmwareOutdated"]),
                "status": d["status"],
                "risk": d["risk"],
                "last_activity": d["lastActivity"],
                "location": d["location"],
                "health": d["health"],
                "protocol": d["protocol"],
                "open_ports": json.dumps(d["openPorts"]),
                "uptime_hours": d["uptimeHours"],
                "infected_by": d["infectedBy"],
            }
            for d in data["devices"]
        ],
    )

    conn.executemany(
        """INSERT INTO events VALUES
           (:id, :timestamp, :device_id, :device_name, :kind, :source_ip,
            :dest_ip, :dest_port, :protocol, :bytes, :verdict, :severity, :detail)""",
        [
            {
                "id": e["id"],
                "timestamp": e["timestamp"],
                "device_id": e["deviceId"],
                "device_name": e["deviceName"],
                "kind": e["kind"],
                "source_ip": e["sourceIp"],
                "dest_ip": e["destIp"],
                "dest_port": e["destPort"],
                "protocol": e["protocol"],
                "bytes": e["bytes"],
                "verdict": e["verdict"],
                "severity": e["severity"],
                "detail": e["detail"],
            }
            for e in data["events"]
        ],
    )

    conn.executemany(
        """INSERT INTO alerts VALUES
           (:id, :timestamp, :device_id, :device_name, :threat, :malware_family,
            :severity, :status, :action, :description, :mitre_tactic,
            :mitre_technique, :confidence, :source_ip, :severity_rank)""",
        [
            {
                "id": a["id"],
                "timestamp": a["timestamp"],
                "device_id": a["deviceId"],
                "device_name": a["deviceName"],
                "threat": a["threat"],
                "malware_family": a["malwareFamily"],
                "severity": a["severity"],
                "status": a["status"],
                "action": a["action"],
                "description": a["description"],
                "mitre_tactic": a["mitreTactic"],
                "mitre_technique": a["mitreTechnique"],
                "confidence": a["confidence"],
                "source_ip": a["sourceIp"],
                "severity_rank": SEVERITY_RANK[a["severity"]],
            }
            for a in data["alerts"]
        ],
    )

    conn.executemany(
        "INSERT INTO malware VALUES (:id, :payload)",
        [{"id": m["id"], "payload": json.dumps(m)} for m in data["malware"]],
    )

    conn.executemany(
        "INSERT INTO documents VALUES (:key, :payload)",
        [
            {"key": key, "payload": json.dumps(data[key])}
            for key in ("verification", "resilience", "summary", "analytics", "scenarios")
        ],
    )

    conn.commit()


def init_db(force: bool = False) -> None:
    """
    Create the schema and seed it if empty.

    Safe to call any number of times — this is invoked both at import time and
    from the FastAPI startup handler.
    """
    with _write_lock:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = connect()
        try:
            conn.executescript(_SCHEMA)
            conn.commit()

            if force:
                for table in ("devices", "events", "alerts", "malware", "documents"):
                    conn.execute(f"DELETE FROM {table}")
                conn.commit()

            already = conn.execute("SELECT COUNT(*) AS n FROM devices").fetchone()["n"]
            if already == 0:
                _seed(conn)
        finally:
            conn.close()


def reseed() -> None:
    """Drop and regenerate everything. Backs the ``/simulation/reset`` endpoint."""
    init_db(force=True)


# ==========================================================================
# Row -> API shape
# ==========================================================================


def device_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "category": row["category"],
        "vendor": row["vendor"],
        "ip": row["ip"],
        "mac": row["mac"],
        "firmware": row["firmware"],
        "firmwareOutdated": bool(row["firmware_outdated"]),
        "status": row["status"],
        "risk": row["risk"],
        "lastActivity": row["last_activity"],
        "location": row["location"],
        "health": row["health"],
        "protocol": row["protocol"],
        "openPorts": json.loads(row["open_ports"]),
        "uptimeHours": row["uptime_hours"],
        "infectedBy": row["infected_by"],
    }


def event_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "timestamp": row["timestamp"],
        "deviceId": row["device_id"],
        "deviceName": row["device_name"],
        "kind": row["kind"],
        "sourceIp": row["source_ip"],
        "destIp": row["dest_ip"],
        "destPort": row["dest_port"],
        "protocol": row["protocol"],
        "bytes": row["bytes"],
        "verdict": row["verdict"],
        "severity": row["severity"],
        "detail": row["detail"],
    }


def alert_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "timestamp": row["timestamp"],
        "deviceId": row["device_id"],
        "deviceName": row["device_name"],
        "threat": row["threat"],
        "malwareFamily": row["malware_family"],
        "severity": row["severity"],
        "status": row["status"],
        "action": row["action"],
        "description": row["description"],
        "mitreTactic": row["mitre_tactic"],
        "mitreTechnique": row["mitre_technique"],
        "confidence": row["confidence"],
        "sourceIp": row["source_ip"],
    }


# ==========================================================================
# Queries
# ==========================================================================


def get_devices(status: str | None = None, q: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM devices"
    clauses: list[str] = []
    params: list[Any] = []

    if status and status.lower() != "all":
        clauses.append("status = ?")
        params.append(status)

    if q:
        needle = f"%{q.lower()}%"
        clauses.append(
            "(LOWER(name) LIKE ? OR LOWER(ip) LIKE ? OR LOWER(mac) LIKE ?"
            " OR LOWER(vendor) LIKE ? OR LOWER(category) LIKE ?"
            " OR LOWER(location) LIKE ? OR LOWER(firmware) LIKE ?)"
        )
        params.extend([needle] * 7)

    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY id"

    conn = connect()
    try:
        return [device_from_row(r) for r in conn.execute(sql, params)]
    finally:
        conn.close()


def get_device(device_id: str) -> dict[str, Any] | None:
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM devices WHERE id = ?", (device_id,)).fetchone()
        return device_from_row(row) if row else None
    finally:
        conn.close()


def get_events(limit: int = 500, verdict: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM events"
    params: list[Any] = []

    if verdict and verdict.lower() != "all":
        sql += " WHERE verdict = ?"
        params.append(verdict)

    sql += " ORDER BY timestamp DESC LIMIT ?"
    params.append(max(1, min(limit, 500)))

    conn = connect()
    try:
        return [event_from_row(r) for r in conn.execute(sql, params)]
    finally:
        conn.close()


def get_alerts(
    severity: str | None = None,
    q: str | None = None,
    sort: str = "timestamp",
) -> list[dict[str, Any]]:
    sql = "SELECT * FROM alerts"
    clauses: list[str] = []
    params: list[Any] = []

    if severity and severity.lower() != "all":
        clauses.append("severity = ?")
        params.append(severity)

    if q:
        needle = f"%{q.lower()}%"
        clauses.append(
            "(LOWER(threat) LIKE ? OR LOWER(device_name) LIKE ?"
            " OR LOWER(description) LIKE ? OR LOWER(mitre_tactic) LIKE ?"
            " OR LOWER(mitre_technique) LIKE ? OR LOWER(source_ip) LIKE ?)"
        )
        params.extend([needle] * 6)

    if clauses:
        sql += " WHERE " + " AND ".join(clauses)

    if sort == "severity":
        sql += " ORDER BY severity_rank DESC, timestamp DESC"
    elif sort == "confidence":
        sql += " ORDER BY confidence DESC"
    elif sort == "device":
        sql += " ORDER BY device_name ASC"
    else:
        sql += " ORDER BY timestamp DESC"

    conn = connect()
    try:
        return [alert_from_row(r) for r in conn.execute(sql, params)]
    finally:
        conn.close()


def get_malware() -> list[dict[str, Any]]:
    conn = connect()
    try:
        return [
            json.loads(r["payload"])
            for r in conn.execute("SELECT payload FROM malware ORDER BY id")
        ]
    finally:
        conn.close()


def get_document(key: str) -> Any:
    conn = connect()
    try:
        row = conn.execute(
            "SELECT payload FROM documents WHERE key = ?", (key,)
        ).fetchone()
        return json.loads(row["payload"]) if row else None
    finally:
        conn.close()


def set_document(key: str, payload: Any) -> None:
    with _write_lock:
        conn = connect()
        try:
            conn.execute(
                "INSERT INTO documents (key, payload) VALUES (?, ?)"
                " ON CONFLICT(key) DO UPDATE SET payload = excluded.payload",
                (key, json.dumps(payload)),
            )
            conn.commit()
        finally:
            conn.close()


# Seed at import time so ``TestClient`` and ``uvicorn`` both find a ready
# database, regardless of whether a startup event has run.
init_db()
