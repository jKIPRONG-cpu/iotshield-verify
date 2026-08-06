# IoTShield Verify — Frontend

React 19 · TypeScript · Vite 8 · Tailwind CSS v3 · Framer Motion · React Flow 12 ·
Recharts 3 · React Router 7 (HashRouter) · Lucide

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build (esbuild strips types — not gated on `tsc`) |
| `npm run typecheck` | Strict TypeScript check, run separately |
| `npm run preview` | Serve the built bundle on :4173 |
| `npm run lint` | ESLint |

## Configuration

Copy `.env.example` to `.env` to point at a different backend:

```
VITE_API_BASE=http://localhost:8000
```

Defaults to `http://localhost:8000` when unset.

## Architecture

```
src/
├── api/
│   ├── client.ts          Typed fetch client; every call bounded by an
│   │                      AbortController timeout so a hung backend degrades
│   │                      predictably instead of leaving a page spinning.
│   └── DataContext.tsx    Probes /health once; drives the Live API / Demo data
│                          badge in the top bar.
├── hooks/
│   └── useResource.ts     The single data-loading primitive. Tries the API,
│                          falls back to the bundled dataset on any failure,
│                          and reports which one you got.
├── context/
│   └── AppState.tsx       Owns the datasets more than one module needs
│                          (devices, alerts) and runs the attack simulation,
│                          publishing its effects as an overlay so `reset` is
│                          a single discard rather than a refetch.
├── components/
│   ├── ui.tsx             The shared kit — panels, badges, stat tiles, rings,
│   │                      controls, skeletons, empty states.
│   ├── charts.tsx         Themed Recharts wrappers. Axis, grid, tooltip and
│   │                      legend conventions are decided here, once.
│   ├── Shell.tsx          Sidebar, top bar, quick search, alerts bell,
│   │                      animated routing.
│   ├── AIAssistant.tsx    Scripted co-pilot drawer.
│   ├── ErrorBoundary.tsx  Route-level fault containment.
│   └── petri/
│       ├── model.ts       The net as data — places, transitions, arcs, colours.
│       ├── engine.ts      The firing interpreter.
│       └── nodes.tsx      Custom React Flow place and transition nodes.
├── data/mock.ts           The deterministic bundled dataset.
├── lib/
│   ├── utils.ts           Formatters, domain→colour maps, the chart palette.
│   └── simulation.ts      Scenario scripts and result construction.
├── pages/                 One file per module.
└── types.ts               The shared domain model.
```

## Conventions worth knowing

**The fallback is a feature.** No page has an empty state caused by a missing
backend. `useResource` substitutes bundled data silently and the `SourceBadge`
keeps that substitution visible rather than hidden — silent substitution would
be misleading in a demonstration.

**Colour is computed, not chosen.** The categorical series palette in
`lib/utils.ts` was validated against the chart surface (`#0F1A2F`) for lightness
band, chroma floor, contrast, and colour-blind separation. Assign series by
slot index in fixed order; never cycle past slot 8, and never repaint the
survivors when a filter changes the series count.

**Status colours are reserved.** `ok` / `warn` / `bad` never double as a chart
series, and every badge in `ui.tsx` pairs its colour with an icon and a text
label.

**No browser storage.** Settings live in `AppState` for the session only.

**`min-w-0` on chart containers.** A CSS grid item defaults to
`min-width: auto`, so a Recharts `ResponsiveContainer` will otherwise widen its
track and push the page into horizontal overflow on narrow viewports.
`ChartCard` handles this; replicate it if you add a chart outside that wrapper.

**Petri-net node data is fully initialised.** React Flow paints nodes once
before the marking effect runs, so partial `data` would fault on first render.
