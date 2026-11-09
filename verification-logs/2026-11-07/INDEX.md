# Verification run — 7 November 2026

Raw, unedited output of every check run on this copy of the project
(`C:\Users\Cossy\Desktop\iotshield-verify-main`). Each log starts with the exact
command and ends with its duration and exit code. Some logs contain terminal
colour codes; `sed 's/\x1b\[[0-9;]*m//g' <file>` strips them.

Environment: WSL2 Linux 6.18 (x86_64), Node v22.22.0, npm 10.9.4, Python 3.10.12.
Java, Rodin and ProB are **not installed** on this machine (`00-environment.log`).

## Tools actually executed

| Tool | What it is |
|---|---|
| `tools/verify_model.mjs` (Node) | The project's TypeScript explicit-state CTL/LTL model checker |
| `tools/crosscheck_model.py` (Python) | Independent Python re-implementation of the net and the property checks |
| `eventb/tools/interpret_eventb.py` (Python) | Evaluates the Event-B guards and actions, as held in the generator script, on the three-device instance |
| `eventb/tools/check_invariants.py` (Python) | Brute-force inductiveness check of Python transcriptions of the M1 invariants, over two devices |
| `eventb/tools/generate_rodin_project.py` (Python) | Regenerated the Rodin files to compare with the shipped ones |
| `tools/dump_mock.mjs` + `tools/check_parity.py` | Dataset parity, TypeScript vs Python |
| `tsc`, `eslint`, `vite build` | Frontend typecheck, lint, production build |
| `tools/verify_frontend.mjs` (Playwright, headless Chromium) | Frontend end-to-end checks |
| `tools/verify_backend.py` | Backend checks — **failed to start** (see 09) |

**Not executed: Rodin, its provers (Atelier B, SMT), or ProB.** No Event-B proof
obligation has been generated or discharged. Nothing in this folder is a Rodin
result.

## Results

| Log | Check | Result | Matches documented expectation? |
|---|---|---|---|
| 01 | `npm install` (root, frontend) | exit 0; npm audit reports 16 vulnerabilities (11 moderate, 5 high) in frontend deps | — |
| 02 | backend venv + `pip install -r backend/requirements.txt` | 1st attempt failed (DNS outage); retry exit 0 | — |
| 03 | `npm run verify:model` | Baseline 15,876 states / 70,400 transitions, 6/8 (6/8 fair); Hardened 5,184 / 19,888, 7/8 (8/8 fair); VP-05 5,600 / 1,596 violating; VP-06 3,332 / 0; 6/6 scenarios agree | Yes, exactly |
| 04, 04b | `npm run verify:crosscheck` (+ `--json`) | Same counts and verdicts; **0 mismatches**; per-device VP-05 reading gives the same verdicts | Yes |
| 05 | `interpret_eventb.py` | M1_Baseline 15,876 / 70,400, VP-06 violating 3,332; M1_Hardened 5,184 / 19,888, VP-06 0 | Yes |
| 06 | `check_invariants.py` | Hardened: 1,498,176 pre-states, 0 invariant breaks, 0 refinement breaks. Baseline: 1,679,616 pre-states, 0 / 0 | Yes |
| 07 | Regenerate Rodin project, diff with shipped files | All 8 `.buc`/`.bum` files, `.project` and the listing are byte-identical | Yes |
| 08 | `npm run verify:parity` | PARITY OK (devices=40 events=500 alerts=150 malware=10 properties=8) | Yes |
| 09a | `npm run verify:backend` | **Not run** — import error: Starlette's TestClient requires package `httpx2`, which is not in `backend/requirements.txt`. Installing it was not approved in this session | No (expected 88/88) |
| 10 | `tsc -b --noEmit` | exit 0, no errors | Yes |
| 11 | `eslint .` | **13 errors** (6 react-hooks/set-state-in-effect, 2 react-hooks/refs, 1 react-hooks/purity, 3 react-refresh/only-export-components, 1 no-useless-assignment in `formal/check.ts:585`, a redundant initialiser that does not affect results) | Not documented |
| 12 | `vite build` | exit 0 | Yes |
| 13 | `verify:frontend`, backend not running | 80/81 — "Device inventory reports the live API" fails because no API was served | Expected without a backend |
| 14 | `verify:frontend`, backend running | 80/81 — "IoT Devices renders — heading not found" | Flaky, see 15 |
| 15 | `verify:frontend`, backend running, unchanged rerun | **81/81** | Yes |

## What the Event-B scripts do and do not establish

- `interpret_eventb.py` takes the events from `generate_rodin_project.py`'s data,
  not by parsing the `.bum` files. Log 07 shows those files are byte-identical
  to the generator output, so the result does apply to the shipped files.
  It shows the transcription has the same three-device state space as the model
  checker. It checks no invariant other than counting VP-06 violations.
- `check_invariants.py` steps the **Python CPN implementation**
  (`crosscheck_model.successors`), not the Event-B events, against invariants
  **re-typed in Python** (not read from the `.bum` files). Its scope is limited:
  - two devices, both of class `gateway`, hardening 0 or 2
  - the baseline run omits VP-06 by design, so "0 breaks" there says nothing about
    `M1_Baseline/vp06`, which `eventb/README.md` expects to be unprovable
  - the theorems `vp01`, `vp04`, `dlf` and the gluing invariants are not checked
    as such, though the status mapping and refinement steps are checked
  It is evidence that the invariants are inductive. It is not a proof for an
  arbitrary number of devices, and it is not a Rodin proof obligation.
- The "Results to fill in (from Rodin)" table in `eventb/README.md` remains
  empty. It can only be filled by running Rodin.
