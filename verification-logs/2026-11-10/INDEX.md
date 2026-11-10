# Verification run: 10 November 2026 (Rodin, second run)

This run follows the run of 9 November (`../2026-11-09/`), which left 14
obligations open. Same Rodin installation, same provers and same auto-tactic
profile (*Default Auto Tactic with SMT*; `rodin/org.eventb.core.prefs` is
identical to the 9 November copy).

## What changed in the model

Only the typing of the three bounded counters, in `M1_Baseline` and
`M1_Hardened` (generator: `eventb/tools/generate_rodin_project.py`):

| 9 November | 10 November |
|---|---|
| `typ4  att ∈ DEV → 0‥MAXATT` | `typ4  att ∈ DEV → ℤ` and `bnd4  ∀x·x ∈ DEV ⇒ 0 ≤ att(x) ∧ att(x) ≤ MAXATT` |
| `typ5  obs ∈ DEV → 0‥STH` | `typ5  obs ∈ DEV → ℤ` and `bnd5  ∀x·x ∈ DEV ⇒ 0 ≤ obs(x) ∧ obs(x) ≤ STH` |
| `typ6  vol ∈ DEV → 0‥VMAX` | `typ6  vol ∈ DEV → ℤ` and `bnd6  ∀x·x ∈ DEV ⇒ 0 ≤ vol(x) ∧ vol(x) ≤ VMAX` |

The two forms are logically equivalent. No event, guard or other invariant
changed. After the change, `interpret_eventb.py` still reproduces the model
checker's state spaces exactly and `check_invariants.py` finds no invariant or
refinement break (1,679,616 baseline and 1,498,176 hardened pre-states).

The 20 new `bnd` obligations were all discharged automatically. The typing
obligations `typ4`–`typ6` stayed open on the same 13 events as before, which
showed that the provers' difficulty was the function-override typing goal, not
`min`. Those 13 were then proved interactively in the Proving perspective:
select the relevant hypotheses (lasso), then the Atelier B ML prover (log 22).

## Files

| File | What it is |
|---|---|
| `rodin/*.bps` | Rodin's proof-status files, copied unchanged from the workspace after the run |
| `rodin/org.eventb.core.prefs` | Tactic profiles used (unchanged from 9 November) |
| `21-rodin-proof-status.log` | Output of `eventb/tools/rodin_status.py` on those files |
| `22-rodin-manual-proofs.log` | The 13 obligations proved interactively, and how |
| `rodin-statistics-view.png` | Screenshot of Rodin's Statistics view after the run |

The model files in the Rodin workspace are byte-identical to
`eventb/IoTShieldEventB/` in this repository.

## Result

**618 proof obligations: 604 discharged automatically, 13 interactively, 1 open.**

| Component | POs | Automatic | Interactive | Not discharged |
|---|---|---|---|---|
| C1_Lifecycle | 1 | 1 | 0 | 0 |
| M0_Abstract | 16 | 16 | 0 | 0 |
| M1_Baseline | 299 | 291 | 7 | 1 |
| M1_Hardened | 302 | 296 | 6 | **0** |
| C0_Abstract, C2_Instance, M2_BaselineInstance, M2_HardenedInstance | 0 | — | — | — |

- **`M1_Hardened` is fully discharged.** VP-06 (data-leakage prevention) is
  therefore an invariant of the hardened machine for any number of devices,
  with no remaining condition.
- **The one open obligation is `M1_Baseline` `Exfiltrate/vp06/INV`.** It is
  false: in the baseline a device can exfiltrate before detection, which is the
  model checker's VP-06 counterexample (3,332 violating states). It cannot and
  should not be proved. An interactive attempt was made and saved unfinished.
- Every true obligation of the development is discharged.
