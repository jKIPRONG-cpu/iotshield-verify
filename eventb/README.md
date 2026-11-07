# Event-B model of the IoTShield net

This folder contains a Rodin project, `IoTShieldEventB/`, that formalises the
same coloured Petri net as `frontend/src/components/petri/formal/` in Event-B.
`IoTShield_EventB_listing.txt` is a plain-text listing of every context and
machine, for reading, for the thesis appendix, or for entering the model by hand
if the import fails.

**Status: the model has not yet been run in Rodin.** It was written and checked
outside Rodin (see "How the model was checked before Rodin" below). The proof
statistics and ProB results must come from running it, and only those figures
should be reported.

## What is in the project

| Component | Role |
|---|---|
| `C0_Abstract` | Devices (`DEV`), abstract status (`ok`, `compromised`, `contained`), exposed and critical devices |
| `C1_Lifecycle` | The 11 places, trust and threat colours, device class, zone, hardening, the class-pair `strength` relation, zone adjacency, and the model parameters (`MAXATT = 3`, `STH = 2`, `VTH = 2`, `VMAX = 2`) |
| `C2_Instance` | The exact three-device configuration the model checker verifies (GW-1, TH-1, PLC-1) |
| `M0_Abstract` | Abstract lifecycle: compromise (external or lateral), contain, release. Proves that critical assets are never compromised |
| `M1_Baseline` | The baseline net as an Event-B refinement of `M0`, for **any number of devices** |
| `M1_Hardened` | The hardened net as an Event-B refinement of `M0`, for **any number of devices** |
| `M2_BaselineInstance`, `M2_HardenedInstance` | `M1_*` restricted to the three-device instance, for ProB model checking. They add nothing else |

### CPN transition → Event-B event

| CPN | Event-B | Refines (in `M0`) |
|---|---|---|
| t-receive | `Receive` | — (skip) |
| t-auth | `Authenticate` | — |
| t-analyse (normal) | `AnalyseNormal` | — |
| t-analyse (suspicious) | `AnalyseSuspicious` | `compromise_external` |
| t-reobserve | `ReObserve` | — |
| t-execute | `ExecutePayload` | — |
| t-defer | `DeferContainment` | — |
| t-exfil | `Exfiltrate` | — |
| t-resume | `ResumeExecution` | — |
| t-detect | `DetectMalware` | — |
| t-verify | `VerifyProperties` | — |
| t-isolate | `IsolateDevice` | `contain` |
| t-recover | `RecoverDevice` | — |
| t-restore | `RestoreNormal`, `RestoreRecovered` | —, `release` |
| t-infect | `LateralInfect` | `compromise_lateral` |

### Verification properties → Event-B

| Property | In Event-B | Kind |
|---|---|---|
| VP-01 Authentication Integrity | `vp01` (theorem) | proved for any number of devices |
| VP-03 Deadlock Freedom | `dlf` (theorem: every device always has an enabled event) | proved for any number of devices |
| VP-04 Isolation Successful | `vp04` (theorem) | proved for any number of devices |
| VP-06 Data Leakage Prevention | `vp06` (invariant) | proved in `M1_Hardened`; **expected to be unprovable in `M1_Baseline`** |
| VP-07 Critical Asset Safety | `M0.inv2_vp07`, `M1.vp07` | proved for any number of devices, given axiom `axm12` (no device class can overcome a critical asset's hardening) |
| VP-02, VP-05, VP-08 | not invariants | VP-02 and VP-05 are liveness or reachability properties; VP-08 is specific to the configuration. Check them with ProB on `M2_*` (optional) |

The general machines (`M1_*`) are the main gain over the model checker. The
model checker verifies three devices; these invariants, once proved, hold for
**any** finite number of devices.

## How to run it

1. **Install Rodin** (latest 3.x release from the Event-B website), then add the
   **ProB**, **Atelier B provers** and **SMT solvers** plug-ins through
   *Help → Install New Software…* and the Rodin update site.
2. **Import the project.** *File → Import → General → Existing Projects into
   Workspace*, choose the `eventb/IoTShieldEventB` folder, then *Finish*. Rodin
   builds the project and runs the automatic provers.
   - If Rodin refuses the files (for example because of a file-format version),
     create a new Event-B project and enter the contexts and machines from
     `IoTShield_EventB_listing.txt`.
3. **Prove.** Open the *Event-B Explorer* and expand each machine's proof
   obligations. For any obligation still marked undischarged, right-click it and
   choose *Retry Auto Provers*, then try the SMT and ML provers in the Proving
   perspective. The deadlock-freedom theorem `dlf` and the gluing obligations
   (`glue1`–`glue3`) are the most likely to need a manual step, usually a case
   split on whether `x = d`.
   - **Do not try to prove `M1_Baseline` / `Exfiltrate/vp06/INV`.** It is false.
     In the baseline, a device can exfiltrate before detection, which is exactly
     the VP-06 counterexample. An undischarged obligation there is the
     proof-level counterpart of the model checker's failure.
4. **Record the statistics.** Open the *Statistics* view (*Window → Show View →
   Event-B → Statistics*), select each machine, and copy the figures into the
   table below. Take screenshots for the thesis.
5. **Model-check the instance with ProB.** Right-click `M2_HardenedInstance` →
   *ProB* → *Start Animation / Model Checking*, then run *Model Check* with
   invariant and deadlock checking on. Repeat for `M2_BaselineInstance`. For the
   baseline, ProB will stop at the VP-06 violation and show a trace; to count the
   whole state space, run it again with invariant checking off.

### Expected results (from the checks described below)

| | Baseline | Hardened |
|---|---|---|
| Distinct states (ProB, excluding its own set-up states) | 15,876 | 5,184 |
| Transitions | 70,400 | 19,888 |
| VP-06 | violated (3,332 states) | holds |
| Deadlocks | none | none |

ProB adds a root state and constant set-up steps, so its raw totals will be
slightly higher. If the counts differ by more than that, something is wrong;
report it rather than adjusting the model.

### Results to fill in (from Rodin; do not estimate)

| Machine | Total POs | Auto | Manual | Undischarged |
|---|---|---|---|---|
| M0_Abstract | | | | |
| M1_Baseline | | | | (expect ≥ 1: `Exfiltrate/vp06/INV`) |
| M1_Hardened | | | | |
| M2_BaselineInstance | | | | |
| M2_HardenedInstance | | | | |

## How the model was checked before Rodin

Rodin was not available where the model was written, so it was checked in two
ways (the scripts are in `eventb/tools/`):

1. **The invariants are inductive.** Every pair of device states that satisfies
   the invariants was enumerated (about 1.5 million pre-states per variant,
   across every combination of exposure and hardening). Every event was applied
   to every one of them, and no event broke any invariant. Every step also
   mapped to the correct abstract event of `M0`. This is the same thing Rodin's
   proof obligations establish, checked by brute force for two devices.
2. **The transcription is faithful.** The Event-B events were interpreted
   directly on the three-device instance and explored. They produced exactly
   the model checker's state spaces: 15,876 states and 70,400 transitions
   (baseline), 5,184 and 19,888 (hardened), with VP-06 violated in exactly
   3,332 baseline states.

These checks make it likely, but do not guarantee, that every obligation
discharges. Only Rodin's own statistics should be reported as proof results.
