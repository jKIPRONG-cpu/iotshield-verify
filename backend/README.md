# IoTShield Verify — Backend

FastAPI · Pydantic 2 · SQLite (stdlib `sqlite3`) · ReportLab

```bash
pip install -r requirements.txt
python3 run.py                     # http://localhost:8000
```

| Flag | Effect |
|---|---|
| `--host HOST` | Interface to bind (default `127.0.0.1`) |
| `--port PORT` | Port to bind (default `8000`) |
| `--no-reload` | Disable auto-reload — recommended when presenting |
| `--reset` | Wipe and regenerate the database before starting |

`run.py` only wraps uvicorn; the direct equivalent is:

```bash
uvicorn app.main:app --reload
```

Interactive API documentation: **http://localhost:8000/docs**

> All data served by this API is synthetic. No real device is queried, no live
> network traffic is captured, and every quantitative figure is illustrative
> rather than an experimental result.

## Endpoints

| Method | Path | Query parameters | Returns |
|---|---|---|---|
| GET | `/health` | — | `{ status: "ok", service, version }` |
| GET | `/summary` | — | Dashboard KPIs, 14-day trend series |
| GET | `/analytics` | — | Cross-cutting aggregations |
| GET | `/devices` | `status`, `q` | The device inventory (40) |
| GET | `/devices/{id}` | — | One device; 404 when unknown |
| GET | `/events` | `limit`, `verdict` | Network events (500), newest first |
| GET | `/alerts` | `severity`, `q`, `sort` | The triage queue (150) |
| GET | `/malware` | — | Malware families (10) |
| GET | `/verification` | — | Model-checking run (6 properties) |
| GET | `/resilience` | — | Containment, workflow, stability |
| GET | `/scenarios` | — | The five scripted scenarios |
| POST | `/simulation/start` | body: `{ scenario }` | A complete scripted run |
| POST | `/simulation/reset` | — | Clears the run, restores the baseline |
| GET | `/reports` | — | The incident assessment as JSON |
| GET | `/reports/pdf` | — | The same assessment as a PDF |

`sort` accepts `timestamp` (default), `severity`, `confidence`, `device`.
`scenario` accepts `normal`, `mirai`, `botnet`, `credential`, `ransomware`.

### Simulation state

A run is held **in memory only** and is reflected by `/verification`,
`/resilience`, `/alerts` and `/reports` until `/simulation/reset` is called or
the process restarts. Nothing is executed, probed, or captured — the result is
a deterministic script.

## Modules

```
app/
├── data_gen.py    The synthetic dataset. A faithful port of the frontend's
│                  mock.ts: same LCG, same seed, same tables, same draw order.
├── db.py          SQLite schema, idempotent seeding, and the query layer.
├── schemas.py     Pydantic response models mirroring frontend/src/types.ts.
├── simulation.py  Server-side scenario scripts and result construction.
├── reporting.py   ReportLab PDF rendering + shared report assembly.
└── main.py        The FastAPI application.
```

### Database

SQLite, created and seeded automatically at `backend/iotshield.db`. Override the
location with the `IOTSHIELD_DB` environment variable.

`init_db()` is **idempotent** — it creates tables if absent and seeds only when
the device table is empty. It runs both at import time and from the lifespan
handler, so the app is ready under `uvicorn` *and* under `TestClient`, which does
not always fire lifespan events. Restarting never duplicates data.

List fields are stored as JSON text; SQLite has no array type and these payloads
are small enough that normalising them would add cost without buying anything.

Using a real relational store rather than slicing an in-memory list is
deliberate: it means the endpoints exercise genuine filtering, sorting and
lookup paths, so their behaviour is representative.

### Dataset parity

`data_gen.py` and `frontend/src/data/mock.ts` must stay in lockstep — the
frontend falls back to its bundled copy whenever the API is unreachable, and the
two would visibly disagree if they drifted. Keep the sequence of `rng` calls
identical when changing either, and run the parity check:

```bash
npm run verify:parity      # from the repository root
```

## Verification

```bash
python tools/verify_backend.py     # from the repository root
```

Exercises every endpoint against an in-process `TestClient` and checks status
codes, payload shapes, filter and sort behaviour, all five simulation scenarios,
state propagation and reset, `init_db()` idempotency, and that `/reports/pdf`
returns bytes beginning with `%PDF` and ending with a valid trailer. 86 checks.

## CORS

`allow_origins=["*"]`. The frontend is expected to run from a different origin
(Vite on :5173, a static host, or a file path via HashRouter). This is
appropriate for a demonstration tool serving synthetic data and would **not** be
appropriate for a real deployment.
