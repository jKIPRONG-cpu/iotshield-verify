/**
 * Coloured Petri Net — model definition.
 *
 * The net is declared here as pure data (places, transitions, arcs, colour
 * set) and interpreted by the runtime in `engine.ts`. Keeping structure
 * separate from behaviour means the layout, the firing rules, and the
 * verification narrative all read from one description of the model.
 *
 * Colour set:
 *   DEVICE = record { id : STRING, trust : TRUST, threat : THREAT }
 *   TRUST  = { unknown | authenticated | quarantined }
 *   THREAT = { none | suspected | confirmed }
 *
 * A token carries a colour; transition guards test it. That is what makes the
 * net *coloured* rather than a plain place/transition net — the same structure
 * routes benign and malicious traffic differently based on token colour alone.
 */

/* ==========================================================================
   Colour set
   ========================================================================== */

export type TokenColour = 'benign' | 'suspect' | 'malicious' | 'verified' | 'contained'

export interface TokenColourSpec {
  id: TokenColour
  label: string
  /** Hex used for the token dot and its trail. */
  hex: string
  description: string
}

/**
 * Token colours are a categorical encoding, drawn from the validated
 * fixed-order palette. They are never reused as a status colour, and every
 * legend entry names its colour so identity never rests on hue alone.
 */
export const COLOURS: Record<TokenColour, TokenColourSpec> = {
  benign: {
    id: 'benign',
    label: 'Benign',
    hex: '#2E90FA',
    description: 'Traffic within the behavioural envelope; trust unknown or authenticated.',
  },
  suspect: {
    id: 'suspect',
    label: 'Suspect',
    hex: '#B58700',
    description: 'One anomalous observation recorded; threat marked as suspected.',
  },
  malicious: {
    id: 'malicious',
    label: 'Malicious',
    hex: '#E45855',
    description: 'Threat confirmed by the detector; the device is executing a payload.',
  },
  verified: {
    id: 'verified',
    label: 'Verified',
    hex: '#8878E6',
    description: 'Token has passed through model checking and carries a verdict.',
  },
  contained: {
    id: 'contained',
    label: 'Contained',
    hex: '#12A88F',
    description: 'Device quarantined or recovered; no transmission arc is enabled.',
  },
}

export const COLOUR_ORDER: TokenColour[] = [
  'benign',
  'suspect',
  'malicious',
  'verified',
  'contained',
]

/* ==========================================================================
   Places
   ========================================================================== */

export interface PlaceSpec {
  id: string
  label: string
  /** Canvas position; the layout is hand-placed for legibility. */
  x: number
  y: number
  /** Tokens present when the net is reset. */
  initial: { colour: TokenColour; count: number }[]
  description: string
  /** Marks the places that represent an unsafe marking. */
  hazard?: boolean
  /** Marks safe/absorbing states. */
  safe?: boolean
}

export const PLACES: PlaceSpec[] = [
  {
    id: 'idle',
    label: 'Idle',
    x: 40,
    y: 240,
    initial: [{ colour: 'benign', count: 3 }],
    description:
      'Device at rest. Every token begins here and every completed cycle returns here, which is what keeps the net free of terminal markings.',
    safe: true,
  },
  {
    id: 'packet',
    label: 'Packet Received',
    x: 230,
    y: 240,
    initial: [],
    description:
      'An inbound frame has arrived and awaits identity establishment. No trust decision has been made yet.',
  },
  {
    id: 'auth',
    label: 'Authentication',
    x: 420,
    y: 240,
    initial: [],
    description:
      'Credential or certificate presented. The Authenticate transition is a cut vertex here — no path reaches execution without crossing it.',
  },
  {
    id: 'normal',
    label: 'Normal Behaviour',
    x: 620,
    y: 120,
    initial: [],
    description:
      'Behaviour matches the device-class baseline. Tokens recycle from here back to Idle.',
    safe: true,
  },
  {
    id: 'suspicious',
    label: 'Suspicious Behaviour',
    x: 620,
    y: 360,
    initial: [],
    description:
      'One anomalous observation recorded. Detection requires a second — that gap is precisely what the data-leakage property fails on.',
  },
  {
    id: 'malware',
    label: 'Malware Execution',
    x: 820,
    y: 360,
    initial: [],
    description:
      'A payload is running on the device. This is the hazardous marking the containment property is written against.',
    hazard: true,
  },
  {
    id: 'detect',
    label: 'Threat Detection',
    x: 1010,
    y: 300,
    initial: [],
    description:
      'The detector has fired and confidence exceeds the response threshold.',
  },
  {
    id: 'verify',
    label: 'Formal Verification',
    x: 1010,
    y: 130,
    initial: [],
    description:
      'The current marking is checked against the CTL and LTL property set before any response action is committed.',
  },
  {
    id: 'isolate',
    label: 'Isolation',
    x: 800,
    y: 30,
    initial: [],
    description:
      'Device moved to the quarantine colour. No transmission transition has a guard matching this binding.',
    safe: true,
  },
  {
    id: 'recover',
    label: 'Recovery',
    x: 420,
    y: 30,
    initial: [],
    description:
      'Reflash and credential rotation complete. The token is recoloured benign and returned to Idle.',
    safe: true,
  },
]

/* ==========================================================================
   Transitions
   ========================================================================== */

export interface TransitionSpec {
  id: string
  label: string
  x: number
  y: number
  /** Places consumed from. */
  input: string[]
  /**
   * Where the token goes, and what colour it takes. Multiple outcomes mean the
   * transition is a branch point resolved by the token's current colour.
   */
  outcomes: {
    to: string
    colour: TokenColour
    /** Which incoming colours select this outcome; empty means "any". */
    when: TokenColour[]
    /** Relative weight when several outcomes match the same colour. */
    weight?: number
  }[]
  guard: string
  description: string
}

export const TRANSITIONS: TransitionSpec[] = [
  {
    id: 't-receive',
    label: 'Receive',
    x: 140,
    y: 249,
    input: ['idle'],
    outcomes: [{ to: 'packet', colour: 'benign', when: [] }],
    guard: '[true]',
    description:
      'Ingress. Any token in Idle may accept an inbound frame; no guard restricts this arc.',
  },
  {
    id: 't-auth',
    label: 'Authenticate',
    x: 330,
    y: 249,
    input: ['packet'],
    outcomes: [{ to: 'auth', colour: 'benign', when: [] }],
    guard: '[d.trust ≠ quarantined]',
    description:
      'Establishes identity. Quarantined devices are excluded by the guard, which is what makes Isolation an absorbing state for transmission.',
  },
  {
    id: 't-analyse',
    label: 'Analyse Behaviour',
    x: 530,
    y: 249,
    input: ['auth', 'malware'],
    outcomes: [
      { to: 'normal', colour: 'benign', when: ['benign'], weight: 62 },
      { to: 'suspicious', colour: 'suspect', when: ['benign'], weight: 38 },
      { to: 'suspicious', colour: 'suspect', when: ['suspect', 'malicious'] },
    ],
    guard: '[observe(d)]',
    description:
      'Compares behaviour against the device-class baseline. It also consumes from Malware Execution — that back-arc is the source of the containment violation: the analysis branch can be chosen indefinitely instead of detection.',
  },
  {
    id: 't-detect',
    label: 'Detect Malware',
    x: 820,
    y: 250,
    input: ['suspicious'],
    outcomes: [
      { to: 'malware', colour: 'malicious', when: ['suspect'], weight: 55 },
      { to: 'detect', colour: 'malicious', when: ['suspect'], weight: 45 },
      { to: 'detect', colour: 'malicious', when: ['malicious'] },
    ],
    guard: '[count(suspicious) ≥ 2]',
    description:
      'Fires only on a second consecutive suspicious observation. The one-observation window this leaves open is what the data-leakage property proves is exploitable.',
  },
  {
    id: 't-verify',
    label: 'Verify Properties',
    x: 1010,
    y: 215,
    input: ['detect'],
    outcomes: [{ to: 'verify', colour: 'verified', when: [] }],
    guard: '[modelCheck(M)]',
    description:
      'Re-checks the current marking against the property set. The verdict gates the response rather than merely recording it.',
  },
  {
    id: 't-isolate',
    label: 'Isolate Device',
    x: 915,
    y: 75,
    input: ['verify'],
    outcomes: [{ to: 'isolate', colour: 'contained', when: [] }],
    guard: '[verdict = unsafe]',
    description:
      'Recolours the device token to quarantined. No transmission transition has a guard matching that binding, which is the isolation invariant.',
  },
  {
    id: 't-recover',
    label: 'Recover Device',
    x: 615,
    y: 39,
    input: ['isolate'],
    outcomes: [{ to: 'recover', colour: 'contained', when: [] }],
    guard: '[reflashed(d) ∧ rotated(d)]',
    description:
      'Firmware reflash and credential rotation. Only once both hold does the guard admit the token.',
  },
  {
    id: 't-restore',
    label: 'Restore',
    x: 230,
    y: 39,
    input: ['recover', 'normal'],
    outcomes: [{ to: 'idle', colour: 'benign', when: [] }],
    guard: '[clean(d)]',
    description:
      'Returns the token to Idle recoloured benign. Removing this arc introduces terminal markings and the deadlock-freedom property fails immediately.',
  },
]

/* ==========================================================================
   Derived arc list — used to draw edges
   ========================================================================== */

export interface ArcSpec {
  id: string
  source: string
  target: string
  /** Inscription drawn on the arc. */
  label?: string
}

export const ARCS: ArcSpec[] = (() => {
  const arcs: ArcSpec[] = []
  for (const t of TRANSITIONS) {
    for (const inp of t.input) {
      arcs.push({ id: `${inp}->${t.id}`, source: inp, target: t.id, label: 'd' })
    }
    // De-duplicate outcome arcs that differ only by guard.
    const seen = new Set<string>()
    for (const out of t.outcomes) {
      const key = `${t.id}->${out.to}`
      if (seen.has(key)) continue
      seen.add(key)
      arcs.push({ id: key, source: t.id, target: out.to, label: "d'" })
    }
  }
  return arcs
})()

/** Lookup helpers used by the runtime and the inspector panel. */
export const placeById = new Map(PLACES.map((p) => [p.id, p]))
export const transitionById = new Map(TRANSITIONS.map((t) => [t.id, t]))

/** Canvas extent, used to fit the view. */
export const CANVAS = { width: 1180, height: 470 } as const
