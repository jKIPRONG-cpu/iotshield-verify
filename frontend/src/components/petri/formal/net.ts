/**
 * Coloured Petri Net — executable net (formal model).
 *
 * The net is given here as an *operational semantics*: a marking plus a set of
 * transition rules that map a marking to its successors. This is what the
 * model checker explores. It is deliberately separate from `../engine.ts`,
 * which drives the on-screen animation using simultaneous firing for
 * legibility; the checker uses proper interleaving semantics, since a
 * concurrency defect is only observable when transitions interleave.
 *
 * Two variants are defined over the same structure:
 *
 *   BASELINE — the system as originally modelled. Its weaknesses are
 *              preserved deliberately so the checker can produce genuine
 *              counterexamples. Nothing here is softened to make a property
 *              pass.
 *
 *   HARDENED — the same net plus three security controls derived from those
 *              counterexamples: a bounded analysis retry, a dual-indicator
 *              detector, and an egress hold pending inspection.
 *
 * Both variants share every place, every transition and every device
 * configuration. They differ only in guards, which is what makes the
 * before/after comparison a controlled experiment rather than two unrelated
 * models.
 */

import {
  bounded,
  infectionStrength,
  zoneReachable,
  type DeviceColour,
  type Hardening,
  type ModelParameters,
  type DeviceClass,
  type Threat,
  type Trust,
  type Zone,
} from './colour'

/* ==========================================================================
   Places
   ========================================================================== */

export const PLACE_IDS = [
  'idle',
  'packet',
  'auth',
  'normal',
  'suspicious',
  'malware',
  'exfil',
  'detect',
  'verify',
  'isolate',
  'recover',
] as const

export type PlaceId = (typeof PLACE_IDS)[number]

export const PLACE_LABEL: Record<PlaceId, string> = {
  idle: 'Idle',
  packet: 'Packet Received',
  auth: 'Authentication',
  normal: 'Normal Behaviour',
  suspicious: 'Suspicious Behaviour',
  malware: 'Malware Execution',
  exfil: 'Data Exfiltration',
  detect: 'Threat Detection',
  verify: 'Formal Verification',
  isolate: 'Isolation',
  recover: 'Recovery',
}

/** Markings in these places are considered safe / absorbing-with-progress. */
export const SAFE_PLACES: PlaceId[] = ['idle', 'normal', 'isolate', 'recover']

/* ==========================================================================
   Marking
   ========================================================================== */

/** The mutable state of one device token. */
export interface DeviceState {
  place: PlaceId
  trust: Trust
  threat: Threat
  /** Behavioural-analysis attempts since the device last returned to Idle. */
  att: number
  /** Suspicious observations recorded. */
  obs: number
  /** Cumulative egress volume bucket. */
  vol: number
  /** Set once the detector has ruled on this device. Never cleared mid-cycle. */
  detFired: boolean
}

/**
 * A marking is one state per device, in a fixed device order.
 *
 * Devices are distinguishable (they carry distinct ids and classes), so the
 * marking is a vector rather than a multiset — no symmetry reduction is
 * applied, which keeps counterexample traces readable at the cost of a larger
 * graph.
 */
export type Marking = DeviceState[]

/** The immutable part of each device, indexed in the same order as a Marking. */
export interface DeviceProfile {
  id: string
  cls: DeviceClass
  zone: Zone
  hard: Hardening
  /**
   * Whether the device is directly reachable by an external attacker.
   *
   * Without this distinction every device can compromise itself out of thin
   * air, which makes any class-specific or blast-radius property false by
   * construction: the critical asset simply self-infects. Modelling exposure
   * explicitly means an internal device becomes compromised only through the
   * lateral-infection transition — which is exactly what makes the
   * heterogeneous-interaction guard the thing under test.
   */
  exposed: boolean
}

export interface NetConfig {
  devices: DeviceProfile[]
  params: ModelParameters
  variant: Variant
}

export type Variant = 'baseline' | 'hardened'

/* ==========================================================================
   State encoding
   ========================================================================== */

const PLACE_INDEX: Record<PlaceId, number> = Object.fromEntries(
  PLACE_IDS.map((p, i) => [p, i]),
) as Record<PlaceId, number>

const TRUST_INDEX: Record<Trust, number> = { unknown: 0, authenticated: 1, quarantined: 2 }
const THREAT_INDEX: Record<Threat, number> = { none: 0, suspected: 1, confirmed: 2 }

/**
 * Canonical key for a marking.
 *
 * Compact on purpose: the checker holds one of these per reachable state, so
 * the encoding directly bounds how large a state space fits in memory.
 */
export function markingKey(marking: Marking): string {
  let key = ''
  for (const d of marking) {
    key += `${PLACE_INDEX[d.place]},${TRUST_INDEX[d.trust]},${THREAT_INDEX[d.threat]},${d.att},${d.obs},${d.vol},${d.detFired ? 1 : 0};`
  }
  return key
}

/** Rehydrate a full device colour for guard evaluation and reporting. */
export function colourOf(profile: DeviceProfile, state: DeviceState): DeviceColour {
  return {
    id: profile.id,
    cls: profile.cls,
    zone: profile.zone,
    hard: profile.hard,
    trust: state.trust,
    threat: state.threat,
    att: state.att,
    obs: state.obs,
    vol: state.vol,
  }
}

/* ==========================================================================
   Transitions
   ========================================================================== */

/**
 * Every transition id, in a fixed order.
 *
 * The index into this table is what gets packed into an edge integer, so the
 * reachability graph can hold ~2M edges as numbers rather than as objects
 * carrying label strings.
 */
export const TRANSITION_IDS = [
  't-receive',
  't-auth',
  't-analyse',
  't-reobserve',
  't-defer',
  't-execute',
  't-exfil',
  't-resume',
  't-detect',
  't-verify',
  't-isolate',
  't-recover',
  't-restore',
  't-infect',
] as const

export type TransitionId = (typeof TRANSITION_IDS)[number]

/** One fired transition, retained so counterexamples read as firing sequences. */
export interface Firing {
  /** Transition id, e.g. 't-analyse'. */
  transition: string
  /** Human-readable inscription including the binding. */
  label: string
  /** Index of the primary device bound. */
  device: number
  /** Index of the second device, for the lateral-infection binding. */
  partner?: number
}

export interface Successor {
  firing: Firing
  marking: Marking
}

const clone = (m: Marking): Marking => m.map((d) => ({ ...d }))

/**
 * Reset the per-cycle counters when a device returns to Idle.
 *
 * This is what keeps the state space finite in practice: without it, counters
 * accumulate across cycles and every loop produces fresh states.
 */
function resetCycle(d: DeviceState): void {
  d.att = 0
  d.obs = 0
  d.vol = 0
  d.detFired = false
  d.trust = 'unknown'
  d.threat = 'none'
}

/**
 * Compute every successor marking, under interleaving semantics.
 *
 * Exactly one transition fires per step, bound to one device (or a pair, for
 * lateral infection). Every enabled binding produces its own successor, which
 * is what allows the checker to see the schedules a simultaneous-firing engine
 * would hide.
 */
export function successors(marking: Marking, config: NetConfig): Successor[] {
  const { devices, params, variant } = config
  const hardened = variant === 'hardened'
  const out: Successor[] = []

  const emit = (firing: Firing, mutate: (m: Marking) => void) => {
    const next = clone(marking)
    mutate(next)
    out.push({ firing, marking: next })
  }

  for (let i = 0; i < marking.length; i++) {
    const d = marking[i]
    const profile = devices[i]
    const who = profile.id

    /* ---- t-receive : Idle -> Packet Received ------------------------- */
    if (d.place === 'idle') {
      emit(
        { transition: 't-receive', label: `Receive(${who})`, device: i },
        (m) => {
          m[i].place = 'packet'
        },
      )
    }

    /* ---- t-auth : Packet Received -> Authentication -------------------
       Guard [trust <> quarantined] is what makes Isolation absorbing. */
    if (d.place === 'packet' && d.trust !== 'quarantined') {
      emit(
        { transition: 't-auth', label: `Authenticate(${who})`, device: i },
        (m) => {
          m[i].place = 'auth'
          m[i].trust = 'authenticated'
        },
      )
    }

    /* ---- t-analyse : Authentication -> Normal | Suspicious ------------
       Both outcomes are genuinely available; the checker explores each. */
    if (d.place === 'auth') {
      emit(
        { transition: 't-analyse', label: `AnalyseBehaviour(${who}) -> normal`, device: i },
        (m) => {
          m[i].place = 'normal'
        },
      )
      // Only an externally reachable device can be compromised without a
      // lateral binding. Internal devices reach Suspicious via t-infect alone.
      if (profile.exposed)
      emit(
        { transition: 't-analyse', label: `AnalyseBehaviour(${who}) -> suspicious`, device: i },
        (m) => {
          m[i].place = 'suspicious'
          m[i].threat = 'suspected'
          m[i].obs = bounded(m[i].obs + 1, params.suspicionThreshold)
          m[i].vol = bounded(m[i].vol + 1, params.volumeBuckets - 1)
        },
      )
    }

    /* ---- t-reobserve : Suspicious -> Suspicious -----------------------
       A distinct binding element from t-analyse and t-defer. They consume
       from different places, so sharing one fairness key would let a firing
       of one discharge the obligation owed to another — and a starved
       detector would be misjudged as fairly scheduled.
       ---------------------------------------------------------------------
       Re-observation. In the hardened variant the retry is bounded, which is
       the control that converts containment from reachable to inevitable. */
    if (d.place === 'suspicious' && (!hardened || d.att < params.maxAnalysisAttempts)) {
      emit(
        { transition: 't-reobserve', label: `ReObserve(${who})`, device: i },
        (m) => {
          m[i].obs = bounded(m[i].obs + 1, params.suspicionThreshold)
          m[i].att = bounded(m[i].att + 1, params.maxAnalysisAttempts)
        },
      )
    }

    /* ---- t-execute : Suspicious -> Malware Execution ------------------ */
    if (d.place === 'suspicious') {
      emit(
        { transition: 't-execute', label: `ExecutePayload(${who})`, device: i },
        (m) => {
          m[i].place = 'malware'
          m[i].threat = 'confirmed'
        },
      )
    }

    /* ---- t-defer : Malware Execution -> Suspicious --------------------
       THE CONTAINMENT DEFECT. Analyse Behaviour also consumes from the
       hazardous place, so a scheduler may return the token to analysis
       instead of progressing to detection — indefinitely, in the baseline.
       The hardened variant bounds it with the retry counter. */
    if (d.place === 'malware' && (!hardened || d.att < params.maxAnalysisAttempts)) {
      emit(
        { transition: 't-defer', label: `DeferContainment(${who})`, device: i },
        (m) => {
          m[i].place = 'suspicious'
          m[i].att = bounded(m[i].att + 1, params.maxAnalysisAttempts)
        },
      )
    }

    /* ---- t-exfil : Malware Execution -> Data Exfiltration -------------
       Baseline: unguarded, so a transfer can complete before the detector
       has ruled.
       Hardened: EGRESS HOLD PENDING INSPECTION. A device carrying an open
       suspicion indicator cannot transfer until detection has ruled on it.
       The transition is retained, not deleted — it remains reachable once
       detection has fired, and legitimate transfers (obs = 0) are untouched. */
    const egressPermitted = !hardened || d.detFired || d.obs === 0
    if (d.place === 'malware' && d.trust !== 'quarantined' && egressPermitted) {
      emit(
        { transition: 't-exfil', label: `Exfiltrate(${who})`, device: i },
        (m) => {
          m[i].place = 'exfil'
          m[i].vol = bounded(m[i].vol + 1, params.volumeBuckets - 1)
        },
      )
    }

    /* ---- t-resume : Data Exfiltration -> Malware Execution ------------ */
    if (d.place === 'exfil') {
      emit(
        { transition: 't-resume', label: `ResumeExecution(${who})`, device: i },
        (m) => {
          m[i].place = 'malware'
        },
      )
    }

    /* ---- t-detect : Suspicious | Malware | Exfil -> Threat Detection --
       Baseline guard  : [obs >= suspicionThreshold]
       Hardened guard  : [obs >= suspicionThreshold
                          OR att >= maxAnalysisAttempts
                          OR vol >= volumeThreshold]
       The two extra disjuncts are the bounded-retry and abnormal-volume
       indicators. */
    const detectable =
      d.place === 'suspicious' || d.place === 'malware' || d.place === 'exfil'
    const baselineTrigger = d.obs >= params.suspicionThreshold
    const hardenedTrigger =
      baselineTrigger ||
      d.att >= params.maxAnalysisAttempts ||
      d.vol >= params.volumeThreshold
    if (detectable && (hardened ? hardenedTrigger : baselineTrigger)) {
      emit(
        { transition: 't-detect', label: `DetectMalware(${who})`, device: i },
        (m) => {
          m[i].place = 'detect'
          m[i].threat = 'confirmed'
          m[i].detFired = true
        },
      )
    }

    /* ---- t-verify : Threat Detection -> Formal Verification ----------- */
    if (d.place === 'detect') {
      emit(
        { transition: 't-verify', label: `VerifyProperties(${who})`, device: i },
        (m) => {
          m[i].place = 'verify'
        },
      )
    }

    /* ---- t-isolate : Formal Verification -> Isolation ----------------- */
    if (d.place === 'verify') {
      emit(
        { transition: 't-isolate', label: `IsolateDevice(${who})`, device: i },
        (m) => {
          m[i].place = 'isolate'
          m[i].trust = 'quarantined'
        },
      )
    }

    /* ---- t-recover : Isolation -> Recovery ---------------------------- */
    if (d.place === 'isolate') {
      emit(
        { transition: 't-recover', label: `RecoverDevice(${who})`, device: i },
        (m) => {
          m[i].place = 'recover'
        },
      )
    }

    /* ---- t-restore : Recovery | Normal -> Idle ------------------------ */
    if (d.place === 'recover' || d.place === 'normal') {
      emit(
        { transition: 't-restore', label: `Restore(${who})`, device: i },
        (m) => {
          m[i].place = 'idle'
          resetCycle(m[i])
        },
      )
    }

    /* ==================================================================
       t-infect : LATERAL INFECTION — the two-token binding
       ------------------------------------------------------------------
       This is the transition that represents interaction between
       heterogeneous devices. It consumes a binding of TWO device tokens and
       its guard relates their classes, zones, trust and threat state:

         guard [ #id d1 <> #id d2
               ∧ #threat d1 = confirmed
               ∧ #trust  d1 <> quarantined      (* isolated cannot propagate *)
               ∧ #threat d2 <> confirmed
               ∧ #trust  d2 = authenticated     (* target is enrolled *)
               ∧ zoneReachable(#zone d1, #zone d2)
               ∧ infectionStrength(#cls d2, #cls d1) > #hard d2 ]

       Whether infection succeeds therefore depends on the characteristics of
       BOTH devices, not on the target alone.
       ================================================================== */
    if (d.threat === 'confirmed' && d.trust !== 'quarantined') {
      for (let j = 0; j < marking.length; j++) {
        if (i === j) continue
        const t = marking[j]
        const tProfile = devices[j]

        // Only a clean device can be newly infected. Re-firing against an
        // already-suspected target changes no counter once bounds saturate,
        // which would introduce a no-op self-loop and defeat any liveness
        // property by starvation rather than by a genuine defect.
        if (t.threat !== 'none') continue
        if (t.trust !== 'authenticated') continue
        if (!zoneReachable(profile.zone, tProfile.zone)) continue

        const strength = infectionStrength(tProfile.cls, profile.cls)
        if (strength <= tProfile.hard) continue

        emit(
          {
            transition: 't-infect',
            label: `LateralInfect(${who} -> ${tProfile.id})`,
            device: i,
            partner: j,
          },
          (m) => {
            m[j].place = 'suspicious'
            m[j].threat = 'suspected'
            m[j].obs = bounded(m[j].obs + 1, params.suspicionThreshold)
            m[j].vol = bounded(m[j].vol + 1, params.volumeBuckets - 1)
          },
        )
      }
    }
  }

  return out
}

/* ==========================================================================
   Initial marking
   ========================================================================== */

export function initialMarking(config: NetConfig): Marking {
  return config.devices.map(() => ({
    place: 'idle' as PlaceId,
    trust: 'unknown' as Trust,
    threat: 'none' as Threat,
    att: 0,
    obs: 0,
    vol: 0,
    detFired: false,
  }))
}

/** True when a device token can currently transmit on the network. */
export function canTransmit(d: DeviceState): boolean {
  return d.trust !== 'quarantined' && (d.place === 'malware' || d.place === 'exfil')
}
