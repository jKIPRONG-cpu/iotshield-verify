"""
End-to-end backend verification.

Exercises every documented endpoint against an in-process TestClient and checks
both the status code and enough of the payload shape to catch a contract break.
The PDF route is verified by magic bytes and trailer, not merely by status.

Run from the repository root:
    python tools/verify_backend.py
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

# Use a throwaway database so a verification run never disturbs a demo's state.
_tmp = Path(tempfile.mkdtemp(prefix="iotshield-verify-"))
os.environ["IOTSHIELD_DB"] = str(_tmp / "verify.db")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"

failures: list[str] = []
checks = 0


def check(name: str, condition: bool, detail: str = "") -> None:
    global checks
    checks += 1
    if condition:
        print(f"  {PASS}  {name}")
    else:
        print(f"  {FAIL}  {name}" + (f" — {detail}" if detail else ""))
        failures.append(name)


def section(title: str) -> None:
    print(f"\n\033[1m{title}\033[0m")


# ==========================================================================

section("System")

r = client.get("/health")
check("GET /health returns 200", r.status_code == 200, f"got {r.status_code}")
check("GET /health reports ok", r.json().get("status") == "ok")

r = client.get("/")
check("GET / returns 200", r.status_code == 200)

r = client.get("/docs")
check("GET /docs serves OpenAPI UI", r.status_code == 200)

# ==========================================================================

section("Dashboard")

r = client.get("/summary")
check("GET /summary returns 200", r.status_code == 200, r.text[:200])
summary = r.json() if r.status_code == 200 else {}
check("summary carries 14-point threat trend", len(summary.get("threatTrend", [])) == 14)
check("summary carries device health breakdown", len(summary.get("deviceHealth", [])) == 6)
check(
    "summary security score is within 0-100",
    0 <= summary.get("securityScore", -1) <= 100,
)

r = client.get("/analytics")
check("GET /analytics returns 200", r.status_code == 200, r.text[:200])
analytics = r.json() if r.status_code == 200 else {}
check(
    "analytics covers all ten device classes",
    len(analytics.get("severityByCategory", [])) == 10,
)

# ==========================================================================

section("Assets")

r = client.get("/devices")
check("GET /devices returns 200", r.status_code == 200, r.text[:200])
devices = r.json() if r.status_code == 200 else []
check("GET /devices returns 40 devices", len(devices) == 40, f"got {len(devices)}")
check(
    "device records carry every required field",
    all(
        k in devices[0]
        for k in (
            "id",
            "name",
            "ip",
            "mac",
            "firmware",
            "status",
            "risk",
            "lastActivity",
            "location",
            "health",
        )
    )
    if devices
    else False,
)

r = client.get("/devices", params={"status": "Compromised"})
check("GET /devices?status= filters", r.status_code == 200)
compromised = r.json()
check(
    "status filter returns only compromised devices",
    all(d["status"] == "Compromised" for d in compromised) and len(compromised) > 0,
)

r = client.get("/devices", params={"q": "cam"})
check("GET /devices?q= searches", r.status_code == 200 and len(r.json()) > 0)

if devices:
    r = client.get(f"/devices/{devices[0]['id']}")
    check("GET /devices/{id} returns 200", r.status_code == 200)
    check("GET /devices/{id} returns the right device", r.json()["id"] == devices[0]["id"])

r = client.get("/devices/DEV-999")
check("GET /devices/{unknown} returns 404", r.status_code == 404, f"got {r.status_code}")

# ==========================================================================

section("Telemetry & detections")

r = client.get("/events")
check("GET /events returns 200", r.status_code == 200, r.text[:200])
events = r.json() if r.status_code == 200 else []
check("GET /events returns 500 events", len(events) == 500, f"got {len(events)}")
check(
    "events are ordered newest first",
    all(
        events[i]["timestamp"] >= events[i + 1]["timestamp"]
        for i in range(min(len(events) - 1, 50))
    ),
)

r = client.get("/events", params={"limit": 25})
check("GET /events?limit= caps the result", len(r.json()) == 25)

r = client.get("/alerts")
check("GET /alerts returns 200", r.status_code == 200, r.text[:200])
alerts = r.json() if r.status_code == 200 else []
check("GET /alerts returns 150 alerts", len(alerts) == 150, f"got {len(alerts)}")

r = client.get("/alerts", params={"severity": "Critical"})
check(
    "GET /alerts?severity= filters",
    r.status_code == 200 and all(a["severity"] == "Critical" for a in r.json()),
)

r = client.get("/alerts", params={"sort": "severity"})
check("GET /alerts?sort=severity returns 200", r.status_code == 200)
sorted_alerts = r.json()
rank = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}
check(
    "severity sort is descending",
    all(
        rank[sorted_alerts[i]["severity"]] >= rank[sorted_alerts[i + 1]["severity"]]
        for i in range(len(sorted_alerts) - 1)
    ),
)

r = client.get("/alerts", params={"q": "beacon"})
check("GET /alerts?q= searches", r.status_code == 200)

r = client.get("/malware")
check("GET /malware returns 200", r.status_code == 200, r.text[:200])
malware = r.json() if r.status_code == 200 else []
check("GET /malware returns 10 families", len(malware) == 10, f"got {len(malware)}")
check(
    "malware records carry IOCs and mitigations",
    all(len(m["iocs"]) > 0 and len(m["mitigation"]) > 0 for m in malware),
)

# ==========================================================================

section("Formal methods & resilience")

r = client.get("/verification")
check("GET /verification returns 200", r.status_code == 200, r.text[:200])
verification = r.json() if r.status_code == 200 else {}
props = verification.get("properties", [])
check("verification returns 6 properties", len(props) == 6, f"got {len(props)}")
check(
    "baseline has 4 verified and 2 failed",
    sum(1 for p in props if p["status"] == "Verified") == 4
    and sum(1 for p in props if p["status"] == "Failed") == 2,
)
check(
    "failed properties carry a counterexample",
    all(p.get("counterexample") for p in props if p["status"] == "Failed"),
)

r = client.get("/resilience")
check("GET /resilience returns 200", r.status_code == 200, r.text[:200])
resilience = r.json() if r.status_code == 200 else {}
check("resilience carries a recovery workflow", len(resilience.get("workflow", [])) > 0)
check("resilience carries a stability timeline", len(resilience.get("timeline", [])) == 12)

r = client.get("/scenarios")
check("GET /scenarios returns 200", r.status_code == 200)
check("GET /scenarios returns 5 scenarios", len(r.json()) == 5)

# ==========================================================================

section("Simulation")

for scenario in ("normal", "mirai", "botnet", "credential", "ransomware"):
    r = client.post("/simulation/start", json={"scenario": scenario})
    ok = r.status_code == 200
    check(f"POST /simulation/start ({scenario}) returns 200", ok, r.text[:200])
    if not ok:
        continue
    result = r.json()
    check(f"  {scenario}: steps are ordered",
          all(result["steps"][i]["atOffsetMs"] <= result["steps"][i + 1]["atOffsetMs"]
              for i in range(len(result["steps"]) - 1)))
    check(f"  {scenario}: returns 6 verification verdicts", len(result["verification"]) == 6)
    check(
        f"  {scenario}: violated count matches the verdicts",
        result["metrics"]["propertiesViolated"]
        == sum(1 for p in result["verification"] if p["status"] == "Failed"),
    )
    check(
        f"  {scenario}: one alert per affected device",
        len(result["alerts"]) == len(result["affectedDeviceIds"]),
    )

# The last run (ransomware) should now be reflected downstream.
r = client.get("/verification")
after = r.json()["properties"]
check(
    "simulation state propagates to /verification",
    sum(1 for p in after if p["status"] == "Failed") == 1,
    f"expected 1 violated after ransomware, got {sum(1 for p in after if p['status'] == 'Failed')}",
)

r = client.get("/alerts")
check("simulation alerts are prepended to /alerts", len(r.json()) == 152, f"got {len(r.json())}")

r = client.post("/simulation/start", json={"scenario": "not-a-scenario"})
check("POST /simulation/start rejects an unknown scenario", r.status_code == 422)

r = client.post("/simulation/reset", json={})
check("POST /simulation/reset returns 200", r.status_code == 200, r.text[:200])
check("reset reports ok", r.json().get("status") == "ok")

r = client.get("/verification")
check(
    "reset restores the baseline verdicts",
    sum(1 for p in r.json()["properties"] if p["status"] == "Failed") == 2,
)

r = client.get("/alerts")
check("reset removes injected alerts", len(r.json()) == 150)

# ==========================================================================

section("Reports")

r = client.get("/reports")
check("GET /reports returns 200", r.status_code == 200, r.text[:300])
report = r.json() if r.status_code == 200 else {}
check("report carries an executive summary", len(report.get("executiveSummary", [])) >= 4)
check("report carries recommendations", len(report.get("recommendations", [])) >= 4)
check("report carries a timeline", len(report.get("timeline", [])) > 0)
check("report carries verification results", len(report.get("verification", [])) == 6)

r = client.get("/reports/pdf")
check("GET /reports/pdf returns 200", r.status_code == 200, r.text[:300])
pdf = r.content
check("PDF content-type is application/pdf", r.headers.get("content-type") == "application/pdf")
check("PDF begins with %PDF", pdf[:4] == b"%PDF", f"got {pdf[:8]!r}")
check("PDF ends with a valid trailer", b"%%EOF" in pdf[-1024:])
check("PDF is a plausible size", len(pdf) > 8000, f"got {len(pdf)} bytes")

# A PDF generated after a simulation must reflect that run.
client.post("/simulation/start", json={"scenario": "botnet"})
r = client.get("/reports/pdf")
check("PDF still renders after a simulation", r.status_code == 200 and r.content[:4] == b"%PDF")
r = client.get("/reports")
check(
    "report reflects the active simulation",
    "Botnet Infection" in r.json()["executiveSummary"][0],
    r.json()["executiveSummary"][0][:120],
)
client.post("/simulation/reset", json={})

# ==========================================================================

section("Idempotency")

from app import db as _db  # noqa: E402

before = len(client.get("/devices").json())
_db.init_db()
_db.init_db()
after_count = len(client.get("/devices").json())
check(
    "init_db() is idempotent — no duplicate seeding",
    before == after_count == 40,
    f"{before} -> {after_count}",
)

# ==========================================================================

print(f"\n\033[1m{checks - len(failures)}/{checks} checks passed\033[0m")

if failures:
    print(f"\n\033[31m{len(failures)} FAILURE(S):\033[0m")
    for f in failures:
        print(f"  · {f}")
    raise SystemExit(1)

print("\033[32mAll backend endpoints verified.\033[0m")
