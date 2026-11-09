# Verification run: 9 November 2026 (Rodin)

This is the first run of the Event-B model in **Rodin**, on Windows
(`C:\rodin`, workspace `C:\rodin\workspace`).

## Environment

| Item | Version |
|---|---|
| Rodin platform | 3.9.0.202406100806 (Eclipse 4.30) |
| Java | Eclipse Temurin JRE 17.0.21 (`-vm` in `rodin.ini`, heap `-Xmx3072m`) |
| Atelier B provers | 2.4.1.r16756 (ML, P0, P1, PP) |
| SMT Solvers | 1.5.0 (CVC3, CVC4, veriT, Z3) |
| Relevance filter | 1.1.1 (installed, not in the profile used) |
| Auto-tactic profile | **Default Auto Tactic with SMT** (shipped with the SMT plug-in); post-tactic: Default Post Tactic Profile (`rodin/org.eventb.core.prefs`) |

The project was imported from `IoTShield_EventB_for_Rodin.zip`. All nine model
files (`.project`, three `.buc`, five `.bum`) are byte-identical to
`eventb/IoTShieldEventB/` in this repository. Rodin Problems view: **0 items**,
meaning the model type-checks.

## Files

| File | What it is |
|---|---|
| `rodin/*.bps` | Rodin's own proof-status files, copied unchanged from the workspace after the final run |
| `rodin/org.eventb.core.prefs` | Rodin's workspace setting recording the tactic profiles used |
| `21-rodin-proof-status.log` | Output of `eventb/tools/rodin_status.py` on those files, including every obligation not discharged |
| `22-rodin-provers-used.log` | Which provers appear in the saved proof trees |
| `rodin-statistics-view.png` | Screenshot of Rodin's Statistics view, 9 Nov 2026 21:25: 578 total, 564 auto, 0 manual, 0 reviewed, 14 undischarged. It matches log 21 |

## Result

**564 of 578 proof obligations discharged automatically; none manually; 14 open.**

| Component | POs | Discharged automatically | Manual | Not discharged |
|---|---|---|---|---|
| C1_Lifecycle | 1 | 1 | 0 | 0 |
| M0_Abstract | 16 | 16 | 0 | 0 |
| M1_Baseline | 279 | 271 | 0 | 8 |
| M1_Hardened | 282 | 276 | 0 | 6 |
| C0_Abstract, C2_Instance, M2_BaselineInstance, M2_HardenedInstance | 0 | — | — | — |

All well-definedness, guard-strengthening and theorem obligations are
discharged, as are the M0 invariants and all gluing invariants. The proofs
were closed mainly by the SMT solver CVC3, with CVC4, Z3 and Atelier B ML
(log 22).

### The 14 open obligations

1. **`M1_Baseline` `Exfiltrate/vp06/INV`.** This is the expected one: VP-06 (data
   leakage prevention) fails in the baseline model, and the model checker finds
   3,332 violating states. In `M1_Hardened` **all 16 VP-06 obligations are
   discharged** (initialisation and every event, Exfiltrate included). Rodin
   thereby establishes VP-06 as an invariant of the hardened machine for any
   number of devices, not only the three that were model-checked. One condition
   applies: each invariant proof may assume all invariants in the pre-state,
   including the 13 counter bounds below, so the argument is complete only once
   those 13 are closed as well.
2. **13 typing invariants on the bounded counters**: `typ4` (att ∈ DEV → 0‥MAXATT),
   `typ5` (obs ∈ DEV → 0‥STH) and `typ6` (vol ∈ DEV → 0‥VMAX). They are open on
   the events that increment a counter (AnalyseSuspicious, ReObserve,
   DeferContainment, LateralInfect, and Exfiltrate in the baseline), in both
   machines. Every such action has the form `x(d) ≔ min({x(d) + 1, BOUND})`.
   The result lies in 0‥BOUND whenever x(d) does, so these obligations are true;
   the automatic provers did not close the `min` of a set extension. They were
   not proved interactively. The inductiveness check (`check_invariants.py`,
   log 06 of 2026-11-07) found no violation of them.

## Chronology

- 12:05: first build with Rodin's built-in provers only (before Atelier B and SMT
  were installed).
- 14:41–19:47: a run with the Default Auto Tactic Profile (no SMT) and a 1 GB
  heap. It was interrupted by a rebuild at 15:28 and stopped by hand at about
  40%. At that point M1_Baseline stood at 61/279 and M1_Hardened at 59/282.
- 20:52–20:56: the run reported above, with the SMT profile and a 3 GB heap,
  completed (100%). Proofs saved by the earlier run were reused.
