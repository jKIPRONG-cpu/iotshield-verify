/**
 * The verified property set, and the device configuration checked against.
 *
 * Each property is an executable predicate over a marking. The checker
 * evaluates it across the whole reachability graph; no verdict is written
 * here. VP-05 and VP-06 are the two the supervision queries concern.
 *
 * VP-07 and VP-08 are new, and exist because the record colour set makes them
 * statable: they quantify over device class and zone, which the previous flat
 * colour set could not express.
 */

import { canTransmit, type Marking, type NetConfig, type DeviceProfile } from './net'
import { DEFAULT_PARAMETERS, type ModelParameters } from './colour'
import type { PropertySpec } from './check'

/* ==========================================================================
   Device configuration under verification
   --------------------------------------------------------------------------
   Three devices, chosen to exercise the lateral-infection guard in all three
   of its outcomes:

     GW-1  gateway,   building zone, hardening 0 — the weak entry point
     TH-1  thermostat, building zone, hardening 1 — an actuator, same zone,
                                                   reachable from gateway (2>1)
     PLC-1 PLC,       plant zone,    hardening 2 — a critical asset the
                                                   gateway can route to but
                                                   not overcome (1 !> 2)

   This is the smallest configuration that makes every property non-trivial.
   Larger fleets multiply the state space without changing any verdict, since
   the guards are per-pair.
   ========================================================================== */

export const VERIFIED_DEVICES: DeviceProfile[] = [
  // Internet-facing, unpatched: the estate's entry point.
  { id: 'GW-1', cls: 'gateway', zone: 'building', hard: 0, exposed: true },
  // An actuator on the same segment. Gateway -> thermostat strength is 2,
  // hardening is 1, so 2 > 1 and the infection succeeds.
  { id: 'TH-1', cls: 'thermostat', zone: 'building', hard: 1, exposed: false },
  // The critical asset. Gateway -> PLC strength is 1 against hardening 2, so
  // 1 > 2 is false and the guard denies propagation. Routable, but not
  // overcome — which is the point the pair relation exists to make.
  { id: 'PLC-1', cls: 'plc', zone: 'plant', hard: 2, exposed: false },
]

export function makeConfig(
  variant: 'baseline' | 'hardened',
  params: ModelParameters = DEFAULT_PARAMETERS,
  devices: DeviceProfile[] = VERIFIED_DEVICES,
): NetConfig {
  return { devices, params, variant }
}

/* ==========================================================================
   Predicate helpers
   ========================================================================== */

const some = (m: Marking, f: (d: Marking[number], i: number) => boolean): boolean =>
  m.some(f)

const every = (m: Marking, f: (d: Marking[number], i: number) => boolean): boolean =>
  m.every(f)

/* ==========================================================================
   Property set
   ========================================================================== */

export function propertySpecs(devices: DeviceProfile[] = VERIFIED_DEVICES): PropertySpec[] {
  /** Index of the critical asset, used by VP-07. */
  const criticalIdx = devices.findIndex((d) => d.cls === 'plc')

  return [
    {
      id: 'VP-01',
      name: 'Authentication Integrity',
      formula: 'AG ¬(place(d) = MalwareExecution ∧ trust(d) = unknown)',
      logic: 'CTL',
      category: 'Security',
      kind: 'invariant',
      description:
        'No device may reach Malware Execution without having passed through the Authenticate transition. The transition is a cut vertex on every path into the hazardous place.',
      target: (m) =>
        every(m, (d) => !(d.place === 'malware' && d.trust === 'unknown')),
    },

    {
      id: 'VP-02',
      name: 'Safe State Reachability',
      formula: 'AG EF (∀d . place(d) ∈ {Idle, Normal, Isolation, Recovery})',
      logic: 'CTL',
      category: 'Reachability',
      kind: 'persistent-reachability',
      description:
        'From every reachable state the system retains a path back to a marking in which every device is safe. No compromise is terminal.',
      target: (m) =>
        every(m, (d) =>
          d.place === 'idle' ||
          d.place === 'normal' ||
          d.place === 'isolate' ||
          d.place === 'recover',
        ),
    },

    {
      id: 'VP-03',
      name: 'Deadlock Freedom',
      formula: 'AG (EX true)',
      logic: 'CTL',
      category: 'Liveness',
      kind: 'deadlock-freedom',
      description:
        'The net contains no dead marking: from every reachable state at least one transition remains enabled.',
      target: () => true,
    },

    {
      id: 'VP-04',
      name: 'Isolation Successful',
      formula: 'AG ¬(trust(d) = quarantined ∧ canTransmit(d))',
      logic: 'CTL',
      category: 'Safety',
      kind: 'invariant',
      description:
        'Once a device is quarantined, no transmitting transition is enabled for it — neither exfiltration nor lateral infection as a source.',
      target: (m) => every(m, (d) => !(d.trust === 'quarantined' && canTransmit(d))),
    },

    {
      id: 'VP-05',
      name: 'Malware Containment',
      formula: 'AG (∃d . place(d) = MalwareExecution → AF (place(d) = Isolation))',
      logic: 'CTL',
      category: 'Safety',
      kind: 'inevitability',
      description:
        'Every device that reaches Malware Execution must inevitably reach Isolation. Reachability is not enough — the eventuality has to hold on every path.',
      antecedent: (m) => some(m, (d) => d.place === 'malware'),
      target: (m) => some(m, (d) => d.place === 'isolate'),
    },

    {
      id: 'VP-06',
      name: 'Data Leakage Prevention',
      formula: 'G ¬(∃d . place(d) = Exfiltration ∧ ¬detected(d))',
      logic: 'LTL',
      category: 'Security',
      kind: 'invariant',
      description:
        'No execution contains a state in which data leaves a device before the detector has ruled on it. Checked as an invariant, which is sound for a safety formula over a finite structure.',
      target: (m) => every(m, (d) => !(d.place === 'exfil' && !d.detFired)),
    },

    /* ---- Properties enabled by the record colour set -------------------- */

    {
      id: 'VP-07',
      name: 'Critical Asset Safety',
      formula: 'AG ¬(cls(d) = plc ∧ threat(d) = confirmed)',
      logic: 'CTL',
      category: 'Security',
      kind: 'invariant',
      description:
        'The industrial controller never reaches a confirmed-threat state. This is a class-specific guarantee: it quantifies over the device class carried in the token colour, which a flat state-only colour set could not express.',
      target: (m) =>
        criticalIdx < 0 ||
        !(m[criticalIdx].threat === 'confirmed'),
    },

    {
      id: 'VP-08',
      name: 'Lateral Movement Bound',
      formula: 'AG (|{d : threat(d) = confirmed}| ≤ 2)',
      logic: 'CTL',
      category: 'Safety',
      kind: 'invariant',
      description:
        'At most two devices are ever simultaneously in a confirmed-threat state. Bounds the blast radius of lateral propagation across the modelled segment.',
      target: (m) => m.filter((d) => d.threat === 'confirmed').length <= 2,
    },
  ]
}
