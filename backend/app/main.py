"""
IoTShield Verify — FastAPI service.

Serves the demonstration dataset out of SQLite and runs the scripted attack
simulations. Every endpoint returns realistic JSON matching the TypeScript
interfaces in ``frontend/src/types.ts``.

CORS is wide open because the frontend is expected to run from a different
origin (Vite on :5173, or a static host, or a file path via HashRouter). That is
appropriate for a demonstration tool serving synthetic data and would not be for
a real deployment.

``db.init_db()`` runs both at import time and in the startup handler so the app
is usable under uvicorn *and* under ``TestClient``, which never fires lifespan
events in some configurations.
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import db, reporting, schemas, simulation as sim

# Seed at import so both uvicorn and TestClient find a ready database.
db.init_db()

# The most recent simulation run, held in memory only. A restart clears it,
# which is the correct behaviour for a demonstration tool.
_last_simulation: dict[str, Any] | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Ensure the schema exists before the first request is served."""
    db.init_db()
    yield


app = FastAPI(
    title="IoTShield Verify API",
    version="1.0.0",
    description=(
        "Backend for the IoTShield Verify demonstration console — "
        "*A Formal Verification Approach to IoT Malware Analysis, Detection, and Resilience.*\n\n"
        "**All data served by this API is synthetic.** No real device is queried, no live "
        "network traffic is captured, and every quantitative figure is illustrative rather "
        "than an experimental result."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================================================
# Health
# ==========================================================================


@app.get("/health", response_model=schemas.Health, tags=["System"])
def health() -> dict[str, str]:
    """Liveness probe. The frontend uses this to choose live versus demo data."""
    return {"status": "ok", "service": "iotshield-verify", "version": "1.0.0"}


@app.get("/", include_in_schema=False)
def root() -> dict[str, Any]:
    return {
        "service": "IoTShield Verify API",
        "version": "1.0.0",
        "docs": "/docs",
        "notice": "Demonstration service — all data is synthetic.",
        "endpoints": [
            "/health",
            "/summary",
            "/devices",
            "/devices/{id}",
            "/events",
            "/alerts",
            "/malware",
            "/verification",
            "/resilience",
            "/analytics",
            "/scenarios",
            "/simulation/start",
            "/simulation/reset",
            "/reports",
            "/reports/pdf",
        ],
    }


# ==========================================================================
# Dashboard
# ==========================================================================


@app.get("/summary", response_model=schemas.Summary, tags=["Dashboard"])
def get_summary() -> Any:
    """Headline KPIs and the trend series behind the Executive Dashboard."""
    summary = db.get_document("summary")
    if summary is None:
        raise HTTPException(status_code=503, detail="Dataset not initialised")
    return summary


@app.get("/analytics", response_model=schemas.Analytics, tags=["Dashboard"])
def get_analytics() -> Any:
    """Aggregations backing the Analytics module."""
    analytics = db.get_document("analytics")
    if analytics is None:
        raise HTTPException(status_code=503, detail="Dataset not initialised")
    return analytics


# ==========================================================================
# Assets
# ==========================================================================


@app.get("/devices", response_model=list[schemas.Device], tags=["Assets"])
def get_devices(
    status: str | None = Query(
        None, description="Filter by device status, e.g. 'Compromised'."
    ),
    q: str | None = Query(
        None, description="Free-text search across name, address, vendor and location."
    ),
) -> Any:
    """The managed device inventory."""
    return db.get_devices(status=status, q=q)


@app.get("/devices/{device_id}", response_model=schemas.Device, tags=["Assets"])
def get_device(device_id: str) -> Any:
    """A single device record."""
    device = db.get_device(device_id)
    if device is None:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    return device


# ==========================================================================
# Telemetry & detections
# ==========================================================================


@app.get("/events", response_model=list[schemas.NetworkEvent], tags=["Telemetry"])
def get_events(
    limit: int = Query(500, ge=1, le=500, description="Maximum events to return."),
    verdict: str | None = Query(
        None, description="Filter by verdict: Benign, Suspicious or Malicious."
    ),
) -> Any:
    """Network events, newest first."""
    return db.get_events(limit=limit, verdict=verdict)


@app.get("/alerts", response_model=list[schemas.Alert], tags=["Detections"])
def get_alerts(
    severity: str | None = Query(None, description="Filter by severity."),
    q: str | None = Query(None, description="Free-text search across the alert corpus."),
    sort: Literal["timestamp", "severity", "confidence", "device"] = Query(
        "timestamp", description="Ordering applied to the result set."
    ),
) -> Any:
    """
    The triage queue.

    Alerts raised by a simulation are prepended so a run is visible here
    immediately, without waiting for the underlying corpus to change.
    """
    stored = db.get_alerts(severity=severity, q=q, sort=sort)

    if _last_simulation:
        injected = _last_simulation.get("alerts", [])
        if severity and severity.lower() != "all":
            injected = [a for a in injected if a["severity"] == severity]
        if q:
            needle = q.lower()
            injected = [
                a
                for a in injected
                if needle in a["threat"].lower()
                or needle in a["deviceName"].lower()
                or needle in a["description"].lower()
            ]
        return injected + stored

    return stored


@app.get("/malware", response_model=list[schemas.MalwareFamily], tags=["Detections"])
def get_malware() -> Any:
    """The malware intelligence library."""
    return db.get_malware()


# ==========================================================================
# Formal methods & resilience
# ==========================================================================


@app.get("/verification", response_model=schemas.VerificationRun, tags=["Formal Methods"])
def get_verification() -> Any:
    """
    Model-checking results.

    Reflects the most recent simulation when one has been run, and the baseline
    property set otherwise.
    """
    run = db.get_document("verification")
    if run is None:
        raise HTTPException(status_code=503, detail="Dataset not initialised")

    if _last_simulation:
        properties = _last_simulation["verification"]
        passed = sum(1 for p in properties if p["status"] == "Verified")
        run = {
            **run,
            "properties": properties,
            "passed": passed,
            "failed": len(properties) - passed,
            "successRate": round(passed / len(properties) * 1000) / 10,
        }

    return run


@app.get("/resilience", response_model=schemas.ResilienceState, tags=["Response"])
def get_resilience() -> Any:
    """Containment, recovery workflow and stability posture."""
    if _last_simulation:
        return _last_simulation["resilience"]

    state = db.get_document("resilience")
    if state is None:
        raise HTTPException(status_code=503, detail="Dataset not initialised")
    return state


@app.get("/scenarios", tags=["Simulation"])
def get_scenarios() -> Any:
    """The scripted scenarios available to /simulation/start."""
    return db.get_document("scenarios")


# ==========================================================================
# Simulation
# ==========================================================================


@app.post(
    "/simulation/start",
    response_model=schemas.SimulationResult,
    tags=["Simulation"],
)
def start_simulation(request: schemas.SimulationRequest) -> Any:
    """
    Execute one scripted scenario.

    Nothing is actually run, probed, or captured — the result is a
    deterministic script. It is retained in memory so `/verification`,
    `/resilience`, `/alerts` and `/reports` reflect the run until it is reset.
    """
    global _last_simulation

    scenario = request.scenario
    if scenario not in sim.SCRIPTS:
        raise HTTPException(status_code=422, detail=f"Unknown scenario '{scenario}'")

    devices = db.get_devices()
    baseline = db.get_document("verification")
    malware = db.get_malware()

    if baseline is None:
        raise HTTPException(status_code=503, detail="Dataset not initialised")

    result = sim.build_simulation(
        scenario=scenario,
        devices=devices,
        baseline_properties=baseline["properties"],
        malware=malware,
        started_at_ms=time.time() * 1000,
    )

    _last_simulation = result
    return result


@app.post(
    "/simulation/reset", response_model=schemas.ResetResponse, tags=["Simulation"]
)
def reset_simulation() -> dict[str, str]:
    """Discard the in-memory run and return every module to the baseline."""
    global _last_simulation
    _last_simulation = None
    return {
        "status": "ok",
        "message": "Simulation state cleared; modules restored to baseline.",
    }


# ==========================================================================
# Reports
# ==========================================================================


def _report_payload() -> dict[str, Any]:
    """Assemble the report from current state — shared by the JSON and PDF routes."""
    devices = db.get_devices()
    alerts = db.get_alerts(sort="timestamp")
    summary = db.get_document("summary")
    verification_run = db.get_document("verification")
    resilience = db.get_document("resilience")

    if not all((summary, verification_run, resilience)):
        raise HTTPException(status_code=503, detail="Dataset not initialised")

    verification = verification_run["properties"]
    if _last_simulation:
        verification = _last_simulation["verification"]
        resilience = _last_simulation["resilience"]
        alerts = _last_simulation["alerts"] + alerts

    return reporting.build_report_payload(
        devices=devices,
        alerts=alerts,
        verification=verification,
        resilience=resilience,
        summary=summary,
        simulation=_last_simulation,
    )


@app.get("/reports", response_model=schemas.ReportPayload, tags=["Reports"])
def get_report() -> Any:
    """The incident assessment as JSON."""
    return _report_payload()


@app.get(
    "/reports/pdf",
    tags=["Reports"],
    response_class=Response,
    responses={
        200: {
            "content": {"application/pdf": {}},
            "description": "A ReportLab-rendered incident assessment.",
        }
    },
)
def get_report_pdf() -> Response:
    """The same assessment rendered as a branded PDF."""
    payload = _report_payload()
    pdf = reporting.build_report_pdf(payload)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="iotshield-verify-{payload["id"]}.pdf"'
            ),
            "Content-Length": str(len(pdf)),
        },
    )


# ==========================================================================
# Error handling
# ==========================================================================


@app.exception_handler(500)
def internal_error(_, exc: Exception) -> JSONResponse:  # noqa: ANN001
    """Keep the frontend's fallback path predictable on an unexpected fault."""
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal error", "error": str(exc)},
    )
