# IoTShield Verify

**A Formal Verification Approach to IoT Malware Analysis, Detection, and Resilience**

An enterprise-grade security console built to demonstrate the framework of the
above MSc research project during a thesis defence, conference talk, or client
presentation.

> ### Demonstration build
>
> **Every value this application displays is synthetic.** It models no real
> hardware, captures no live network traffic, and executes nothing. The device
> inventory, telemetry, alert corpus, model-checking statistics, and resilience
> metrics are produced by a seeded generator. Malware tradecraft descriptions
> are summarised from public reporting on real families; all quantitative
> figures are illustrative and **must not be cited as experimental results**.

---

## What it does

Twelve modules that behave as one system. Launching an attack scenario in
**Threat Detection** drives everything downstream: device status changes in the
inventory, alerts appear in the triage queue, coloured tokens are injected into
the **Petri Net**, the **Formal Verification** verdicts are recomputed against
the markings that run actually reached, and the **Resilience Center** rewrites
its posture — all from a single scripted result.

| Module | What it shows |
|---|---|
| Executive Dashboard | Fleet posture, security score, threat trend, detection accuracy |
| Analytics | Threat frequency, malware categories, device risk, recovery outcomes |
| IoT Devices | 40 managed endpoints with health, risk, firmware and attribution |
| Network Activity | Streaming event timeline with density strip and verdict filters |
| Malware Analysis | 10 IoT malware families — tradecraft, IOCs, mitigations |
| Threat Detection | 5 scripted scenarios with a phased, animated run log |
| Security Alerts | Triage queue with search, filtering, sorting, MITRE mapping |
| **Coloured Petri Nets** | Interactive executable model — play / pause / step / reset |
| Formal Verification | 6 CTL & LTL properties with counterexamples and recommendations |
| Resilience Center | Containment rings, recovery workflow, stability trace |
| Incident Reports | Full assessment with browser print **and** ReportLab PDF export |
| Settings | Detection tuning, interface options, API connection status |

Plus a floating **AI Security Assistant** whose scripted answers are assembled
from live application state, so what it says matches what is on screen.

### The finding the demo is built around

Four of the six formal properties hold. Two do not — **Malware Containment** and
**Data Leakage Prevention** — and those failures are the point, not a bug.

In every simulated run the *response works*: the threat is caught and the device
quarantined. What model checking establishes is subtler: because `Analyse
Behaviour` and `Detect Malware` are concurrently enabled on the same token, a
scheduler may keep choosing the analysis branch, so containment is **reachable
but not inevitable**. No amount of testing surfaces that — it is a property of
the state space, not of any single execution. Let the Petri net run and the
"containment deferred" counter climbs; each increment is a live witness to the
counterexample.

---

## Running it

**Prerequisites:** Node 18+ and Python 3.10+.

### Backend — http://localhost:8000

```bash
cd backend
pip install -r requirements.txt
python3 run.py
```

`run.py` is a thin launcher around uvicorn. It accepts `--host`, `--port`,
`--no-reload` (recommended when presenting, so a stray file save cannot restart
the API mid-demo) and `--reset` (wipe and regenerate the database). The
equivalent direct invocation is:

```bash
uvicorn app.main:app --reload
```

Interactive API documentation is served at **http://localhost:8000/docs**.
The SQLite database (`backend/iotshield.db`) is created and seeded automatically
on first run; seeding is idempotent, so restarting never duplicates data.

### Frontend — http://localhost:5173

```bash
cd frontend
npm install
npm run dev
```

To point the console at a backend on a different host or port, create
`frontend/.env` (copy `frontend/.env.example`):

```
VITE_API_BASE=http://localhost:8000
```

### Running it offline

**The frontend needs no backend.** Every page is wired through a `useResource`
hook that attempts the API and silently falls back to a bundled dataset on any
failure, reporting which one you got via a *Live API* / *Demo data* badge. Start
only the frontend and the whole console remains fully explorable — which is what
makes it safe to present on a machine with no network.

The only capability that requires the backend is the server-rendered ReportLab
PDF; the Incident Reports page offers **Print / Save as PDF** as an offline
equivalent, and says so when the backend is unreachable.

---

## Verifying the build

Three verification scripts ship with the project. All three pass on a clean
checkout.

```bash
npm install                 # root: installs the verification tooling

# 1. Backend — every endpoint, status codes, payload shapes, PDF magic bytes
npm run verify:backend      # 86 checks

# 2. Cross-language dataset parity (see below)
npm run verify:parity

# 3. Frontend — all 12 routes in headless Chromium, simulation propagation,
#    Petri-net controls, assistant, paint checks, responsive overflow
cd frontend && npm run build && npm run preview &   # serves :4173
npm run verify:frontend     # 56 checks
```

The frontend check needs a headless Chromium:
`npx playwright install --with-deps chromium`.

### Dataset parity

`frontend/src/data/mock.ts` and `backend/app/data_gen.py` implement the *same*
generator twice — the same linear-congruential PRNG, the same seed, the same
reference tables, and the same order of random draws. That is what lets the API
and the offline fallback agree field-for-field rather than merely looking
similar. `npm run verify:parity` diffs the two datasets and fails loudly on
drift:

```
PARITY OK — the TypeScript and Python datasets agree field-for-field.
  devices=40 events=500 alerts=150 malware=10 properties=6
```

---

## Repository layout

```
iotshield-verify/
├── frontend/                 React 19 · TypeScript · Vite · Tailwind v3
│   ├── src/
│   │   ├── api/              Typed client + connectivity context
│   │   ├── components/       UI kit, shell, charts, Petri-net model & engine
│   │   ├── context/          Global state + the attack simulation runtime
│   │   ├── data/mock.ts      The deterministic bundled dataset
│   │   ├── hooks/            useResource — fetch with automatic fallback
│   │   ├── lib/              Formatters, colour mappings, simulation scripts
│   │   ├── pages/            One file per module
│   │   └── types.ts          The shared domain model
│   └── README.md
├── backend/                  FastAPI · SQLite · ReportLab
│   ├── app/
│   │   ├── data_gen.py       Python port of the same generator
│   │   ├── db.py             Schema, idempotent seeding, queries
│   │   ├── reporting.py      ReportLab PDF + shared report assembly
│   │   ├── schemas.py        Pydantic models mirroring types.ts
│   │   ├── simulation.py     Server-side scenario scripts
│   │   └── main.py           The API
│   ├── run.py                Convenience launcher (wraps uvicorn)
│   └── README.md
└── tools/                    Verification scripts
```

## API surface

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{ status: "ok" }` — the frontend's live/demo probe |
| GET | `/summary` | Dashboard KPIs and trend series |
| GET | `/devices` | Inventory; supports `?status=` and `?q=` |
| GET | `/devices/{id}` | One device (404 when unknown) |
| GET | `/events` | Network events; supports `?limit=` and `?verdict=` |
| GET | `/alerts` | Triage queue; supports `?severity=`, `?q=`, `?sort=` |
| GET | `/malware` | The malware intelligence library |
| GET | `/verification` | Model-checking results |
| GET | `/resilience` | Containment, workflow and stability posture |
| GET | `/analytics` | Cross-cutting aggregations |
| GET | `/scenarios` | The scripted scenarios |
| POST | `/simulation/start` | Run a scenario — `{ "scenario": "mirai" }` |
| POST | `/simulation/reset` | Discard the run, restore the baseline |
| GET | `/reports` | The incident assessment as JSON |
| GET | `/reports/pdf` | The same assessment as a branded PDF |

---

## Design notes

**Visual language.** Dark navy plane, glassmorphic panels, electric-blue accents,
soft shadows, and motion that carries meaning rather than decorating. The
reference points are Microsoft Defender, CrowdStrike Falcon, IBM QRadar and
Splunk.

**Chart colour is computed, not chosen.** The categorical series palette was
validated against the chart surface (`#0F1A2F`): every slot sits inside the
OKLCH lightness band 0.48–0.67, clears a 0.1 chroma floor, holds ≥ 3:1 contrast,
and the worst *adjacent* pair separates at ΔE 12.9 under simulated protanopia
(≥ 8 target) and 18.3 under normal vision (≥ 15 floor). Slot order is the
colour-blind-safety mechanism — series are assigned by index and never cycled.

**Status colour is reserved.** Good / warning / serious / critical never double
as a chart series, and every badge pairs its colour with an icon *and* a text
label, so meaning never rests on hue alone.

**Accessibility.** Every chart carries a legend when it has more than one
series; `prefers-reduced-motion` disables animation; focus rings are visible
throughout; the layout holds with no horizontal overflow from 390 px upward.

**No browser storage.** Nothing is written to `localStorage` or
`sessionStorage`. Settings live for the session only, so a reload always returns
the console to a known state — which is what you want before a defence.

**Routing.** `HashRouter`, so the built bundle runs from any static host or a
bare file path with no server-side rewrite rules.

---

## Technology

React 19 · TypeScript · Vite 8 · Tailwind CSS v3 · Framer Motion ·
`@xyflow/react` (React Flow 12) · Recharts 3 · React Router 7 · Lucide ·
FastAPI · Pydantic 2 · SQLite · ReportLab

> **A note on the stack.** The build brief specified React 18 pinned against
> `reactflow` v11. This project instead uses **React 19 with `@xyflow/react` v12**
> — the alternative the brief explicitly sanctions, and the combination React
> Flow itself supports going forward. Everything else follows the brief:
> Tailwind v3 via PostCSS, `vite build` (not gated on `tsc`), HashRouter, and no
> browser storage. `npm run typecheck` runs the strict TypeScript check
> separately and is currently clean.
