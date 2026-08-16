/**
 * Coloured Petri Net — colour set declarations (formal model).
 *
 * This is the colour set the model checker binds over. It replaces the flat
 * five-value enum used by the animation layer, which encoded only threat
 * status and therefore could not express interaction between heterogeneous
 * devices.
 *
 * In CPN-Tools/ML notation these declarations correspond to:
 *
 *   colset DEVCLASS = with camera | gateway | lock | sensor | bulb
 *                        | monitor | thermostat | weather | plc | speaker;
 *   colset ZONE     = with perimeter | building | clinical | plant;
 *   colset TRUST    = with unknown | authenticated | quarantined;
 *   colset THREAT   = with none | suspected | confirmed;
 *   colset DEVICE   = record id     : STRING
 *                          * cls    : DEVCLASS
 *                          * zone   : ZONE
 *                          * hard   : INT   (* susceptibility, 0..2 *)
 *                          * trust  : TRUST
 *                          * threat : THREAT
 *                          * att    : INT   (* analysis attempts *)
 *                          * obs    : INT   (* suspicious observations *)
 *                          * vol    : INT;  (* transfer volume bucket *)
 *
 * The hue rendered on screen is a PROJECTION of one field of this record —
 * `threat` by default, `cls` or `zone` on request. That is the answer to the
 * "high-level generalisation" review point: the generalisation was a
 * rendering choice, never a limit of the colour set.
 *
 * Every numeric field is bounded to a small ordinal range on purpose. An
 * unbounded counter makes the reachability graph infinite; bounding it keeps
 * exhaustive model checking decidable, which is what allows the verification
 * results to be computed rather than asserted.
 */

/* ==========================================================================
   Device classes
   --------------------------------------------------------------------------
   The ten classes present in the device inventory. This taxonomy is IoT-
   specific by design: an enterprise "workstation / server" taxonomy would
   contradict both the dataset and the research question.
   ========================================================================== */

export const DEVICE_CLASSES = [
  'camera',
  'gateway',
  'lock',
  'sensor',
  'bulb',
  'monitor',
  'thermostat',
  'weather',
  'plc',
  'speaker',
] as const

export type DeviceClass = (typeof DEVICE_CLASSES)[number]

/** Labels matching the inventory's category names. */
export const CLASS_LABEL: Record<DeviceClass, string> = {
  camera: 'Smart Camera',
  gateway: 'Gateway Router',
  lock: 'Smart Lock',
  sensor: 'Motion Sensor',
  bulb: 'Smart Bulb',
  monitor: 'Medical Monitor',
  thermostat: 'Smart Thermostat',
  weather: 'Weather Station',
  plc: 'Industrial PLC',
  speaker: 'Smart Speaker',
}

/** Devices that act on data they receive, rather than only reporting it. */
export const ACTUATOR_CLASSES: DeviceClass[] = ['thermostat', 'lock', 'bulb']

/* ==========================================================================
   Network zones
   ========================================================================== */

export const ZONES = ['perimeter', 'building', 'clinical', 'plant'] as const
export type Zone = (typeof ZONES)[number]

export const ZONE_LABEL: Record<Zone, string> = {
  perimeter: 'Perimeter',
  building: 'Building LAN',
  clinical: 'Clinical VLAN',
  plant: 'Plant / OT',
}

/**
 * Zones that permit routed traffic between them.
 *
 * Segmentation is modelled as an explicit relation rather than assumed. The
 * clinical and plant zones are mutually unreachable and meet only through the
 * building zone, which is what makes cross-zone containment non-trivial.
 */
const ZONE_ADJACENCY: Record<Zone, Zone[]> = {
  perimeter: ['perimeter', 'building'],
  building: ['building', 'perimeter', 'clinical', 'plant'],
  clinical: ['clinical', 'building'],
  plant: ['plant', 'building'],
}

/** True when traffic can flow from `from` to `to` under the segment policy. */
export function zoneReachable(from: Zone, to: Zone): boolean {
  return ZONE_ADJACENCY[from].includes(to)
}

/* ==========================================================================
   Trust and threat
   ========================================================================== */

export const TRUST_LEVELS = ['unknown', 'authenticated', 'quarantined'] as const
export type Trust = (typeof TRUST_LEVELS)[number]

export const THREAT_LEVELS = ['none', 'suspected', 'confirmed'] as const
export type Threat = (typeof THREAT_LEVELS)[number]

/* ==========================================================================
   Susceptibility
   --------------------------------------------------------------------------
   Two independent notions, kept separate because they answer different
   questions:
     1. `hard` on the token — "is THIS device patched and rotated?"
     2. INFECTION_MATRIX    — "is there a route from THAT class to this one?"
   Only the pair relation makes the model one of heterogeneous interaction. A
   scalar alone reduces every infection to "the target was weak", which does
   not represent an interaction at all.
   ========================================================================== */

/** Hardening level carried by a device token. Higher resists more. */
export type Hardening = 0 | 1 | 2

export const HARDENING_LABEL: Record<Hardening, string> = {
  0: 'Vulnerable — factory credentials, unpatched',
  1: 'Standard — patched, credentials rotated',
  2: 'Hardened — signed firmware, mutual TLS',
}

/**
 * INFECTION_MATRIX[target][source] — the attack strength a compromised
 * `source` class brings against a `target` class, on the same ordinal scale
 * as `Hardening`:
 *
 *   0 — no plausible route (the protocol stacks never meet)
 *   1 — a route exists (shared segment or broker)
 *   2 — a strong route (shared credential store, management plane, or an
 *       unvalidated publish/subscribe relationship)
 *
 * Infection succeeds when strength > target.hard. A hardened device resists a
 * weak route but not a strong one; a vulnerable device falls to any route.
 *
 * Values encode documented IoT tradecraft: gateways hold the management plane
 * and shared credentials, so they reach almost everything strongly; a bulb has
 * no route to a PLC; sensors reach actuators strongly because actuators
 * commonly consume sensor topics without validating the payload — precisely
 * the interaction raised in supervision.
 */
export const INFECTION_MATRIX: Record<DeviceClass, Record<DeviceClass, Hardening>> = {
  camera:     { camera: 1, gateway: 2, lock: 0, sensor: 0, bulb: 0, monitor: 0, thermostat: 0, weather: 0, plc: 0, speaker: 0 },
  gateway:    { camera: 1, gateway: 2, lock: 0, sensor: 0, bulb: 0, monitor: 0, thermostat: 0, weather: 0, plc: 1, speaker: 0 },
  lock:       { camera: 0, gateway: 2, lock: 0, sensor: 2, bulb: 0, monitor: 0, thermostat: 0, weather: 0, plc: 0, speaker: 0 },
  sensor:     { camera: 0, gateway: 2, lock: 0, sensor: 1, bulb: 0, monitor: 0, thermostat: 0, weather: 0, plc: 0, speaker: 0 },
  bulb:       { camera: 0, gateway: 2, lock: 0, sensor: 1, bulb: 1, monitor: 0, thermostat: 0, weather: 0, plc: 0, speaker: 0 },
  monitor:    { camera: 0, gateway: 1, lock: 0, sensor: 1, bulb: 0, monitor: 1, thermostat: 0, weather: 0, plc: 0, speaker: 0 },
  thermostat: { camera: 0, gateway: 2, lock: 0, sensor: 2, bulb: 0, monitor: 0, thermostat: 1, weather: 1, plc: 0, speaker: 0 },
  weather:    { camera: 0, gateway: 1, lock: 0, sensor: 1, bulb: 0, monitor: 0, thermostat: 0, weather: 1, plc: 0, speaker: 0 },
  plc:        { camera: 0, gateway: 1, lock: 0, sensor: 0, bulb: 0, monitor: 0, thermostat: 0, weather: 0, plc: 1, speaker: 0 },
  speaker:    { camera: 0, gateway: 2, lock: 0, sensor: 0, bulb: 0, monitor: 0, thermostat: 0, weather: 0, plc: 0, speaker: 1 },
}

/** Attack strength a compromised `source` class brings against `target`. */
export function infectionStrength(target: DeviceClass, source: DeviceClass): Hardening {
  return INFECTION_MATRIX[target][source]
}

/* ==========================================================================
   The device token
   ========================================================================== */

/**
 * One device token's colour.
 *
 * `id`, `cls`, `zone` and `hard` are fixed for the lifetime of a device — they
 * describe the asset. `trust`, `threat`, `att`, `obs` and `vol` are the
 * mutable part that transitions rebind.
 */
export interface DeviceColour {
  readonly id: string
  readonly cls: DeviceClass
  readonly zone: Zone
  readonly hard: Hardening
  readonly trust: Trust
  readonly threat: Threat
  /** Behavioural-analysis attempts. Bounded by maxAnalysisAttempts. */
  readonly att: number
  /** Suspicious observations recorded. Bounded by suspicionThreshold. */
  readonly obs: number
  /** Data-transfer volume bucket. Bounded by volumeBuckets - 1. */
  readonly vol: number
}

/** Which record field the renderer maps to hue. */
export type ColourProjection = 'threat' | 'cls' | 'zone' | 'trust'

/* ==========================================================================
   Bounds and thresholds
   --------------------------------------------------------------------------
   Configurable rather than scattered as magic numbers, and exported so the
   evidence document can state the exact parameters a run was verified under.
   ========================================================================== */

export interface ModelParameters {
  /** Analysis attempts after which detection is forced (hardened only). */
  maxAnalysisAttempts: number
  /** Suspicious observations required before detection fires. */
  suspicionThreshold: number
  /** Volume bucket at or above which transfer alone triggers detection. */
  volumeThreshold: number
  /** Number of distinct volume buckets, i.e. the ceiling on `vol`. */
  volumeBuckets: number
}

export const DEFAULT_PARAMETERS: ModelParameters = {
  maxAnalysisAttempts: 3,
  suspicionThreshold: 2,
  volumeThreshold: 2,
  volumeBuckets: 3,
}

/* ==========================================================================
   Helpers
   ========================================================================== */

/** Clamp a counter to its declared bound, keeping the state space finite. */
export const bounded = (value: number, ceiling: number): number =>
  value < 0 ? 0 : value > ceiling ? ceiling : value
