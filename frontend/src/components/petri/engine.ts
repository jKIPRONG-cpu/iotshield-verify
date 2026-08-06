/**
 * Coloured Petri Net — firing engine.
 *
 * A small, deterministic interpreter over the model in `model.ts`.
 *
 * One `step()` computes the set of enabled transitions under the current
 * marking, selects a binding for each, and fires them simultaneously. Tokens
 * are individually identified so the view can animate a specific token along a
 * specific arc rather than merely re-rendering counts.
 *
 * Simultaneous firing is a deliberate simplification of true CPN semantics
 * (which interleave). It makes the animation legible at presentation speed
 * while preserving the property the module exists to show: that Analyse
 * Behaviour and Detect Malware compete for the same tokens, so isolation is
 * reachable without being inevitable.
 */

import {
  PLACES,
  TRANSITIONS,
  type TokenColour,
  type TransitionSpec,
} from './model'

/* ==========================================================================
   State
   ========================================================================== */

export interface Token {
  id: string
  colour: TokenColour
  /** Place the token currently occupies. */
  place: string
  /** Ticks the token has spent in its current place — drives the "stuck" cue. */
  age: number
}

/** One token movement, emitted so the view can animate it. */
export interface Firing {
  tokenId: string
  transition: string
  from: string
  to: string
  colourBefore: TokenColour
  colourAfter: TokenColour
}

export interface NetState {
  tokens: Token[]
  /** Monotonic step counter. */
  step: number
  /** Movements produced by the most recent step. */
  lastFirings: Firing[]
  /** Transitions that were enabled at the most recent step. */
  enabled: string[]
  /** Running tally, shown in the statistics strip. */
  stats: {
    fired: number
    detections: number
    isolations: number
    recoveries: number
    /** Times a token left Malware Execution back to Suspicious rather than
        progressing to Detection — the containment counterexample, counted. */
    containmentDeferrals: number
  }
}

/* ==========================================================================
   Deterministic PRNG
   --------------------------------------------------------------------------
   The net makes weighted choices. Seeding them keeps a demonstration
   repeatable: the same Reset then Play produces the same trace every time.
   ========================================================================== */

function createRng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

/* ==========================================================================
   Initial marking
   ========================================================================== */

export function initialState(): NetState {
  const tokens: Token[] = []
  let n = 0
  for (const place of PLACES) {
    for (const spec of place.initial) {
      for (let i = 0; i < spec.count; i++) {
        tokens.push({
          id: `tok-${++n}`,
          colour: spec.colour,
          place: place.id,
          age: 0,
        })
      }
    }
  }

  return {
    tokens,
    step: 0,
    lastFirings: [],
    enabled: enabledTransitions(tokens).map((t) => t.id),
    stats: {
      fired: 0,
      detections: 0,
      isolations: 0,
      recoveries: 0,
      containmentDeferrals: 0,
    },
  }
}

/* ==========================================================================
   Enabling
   ========================================================================== */

/** A transition is enabled when at least one of its input places holds a token. */
export function enabledTransitions(tokens: Token[]): TransitionSpec[] {
  const occupied = new Set(tokens.map((t) => t.place))
  return TRANSITIONS.filter((t) => t.input.some((p) => occupied.has(p)))
}

/** Pick the outcome arc for a token colour, honouring the declared weights. */
function selectOutcome(
  transition: TransitionSpec,
  colour: TokenColour,
  rand: () => number,
) {
  const candidates = transition.outcomes.filter(
    (o) => o.when.length === 0 || o.when.includes(colour),
  )
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  const total = candidates.reduce((sum, c) => sum + (c.weight ?? 1), 0)
  let roll = rand() * total
  for (const candidate of candidates) {
    roll -= candidate.weight ?? 1
    if (roll <= 0) return candidate
  }
  return candidates[candidates.length - 1]
}

/* ==========================================================================
   Stepping
   ========================================================================== */

/**
 * Advance the net by one step.
 *
 * Each enabled transition consumes exactly one token from one of its input
 * places. A place is claimed by at most one transition per step, so two
 * transitions competing for the same token resolve in declaration order —
 * which is why Analyse Behaviour, declared before Detect Malware, is the one
 * that wins the contested binding and defers containment.
 */
export function step(state: NetState, seed = 0): NetState {
  const rand = createRng(seed + state.step * 7919 + 1)

  const enabled = enabledTransitions(state.tokens)
  const claimed = new Set<string>()
  const firings: Firing[] = []
  const moved = new Map<string, { place: string; colour: TokenColour }>()

  const stats = { ...state.stats }

  for (const transition of enabled) {
    // First unclaimed token in any input place.
    const candidate = state.tokens.find(
      (tok) => transition.input.includes(tok.place) && !claimed.has(tok.id),
    )
    if (!candidate) continue

    const outcome = selectOutcome(transition, candidate.colour, rand)
    if (!outcome) continue

    claimed.add(candidate.id)
    moved.set(candidate.id, { place: outcome.to, colour: outcome.colour })

    firings.push({
      tokenId: candidate.id,
      transition: transition.id,
      from: candidate.place,
      to: outcome.to,
      colourBefore: candidate.colour,
      colourAfter: outcome.colour,
    })

    stats.fired++
    if (outcome.to === 'detect') stats.detections++
    if (outcome.to === 'isolate') stats.isolations++
    if (outcome.to === 'recover') stats.recoveries++
    // The containment counterexample, observed directly: a token leaves the
    // hazardous place without progressing toward isolation.
    if (candidate.place === 'malware' && outcome.to === 'suspicious') {
      stats.containmentDeferrals++
    }
  }

  const tokens = state.tokens.map((tok) => {
    const move = moved.get(tok.id)
    if (!move) return { ...tok, age: tok.age + 1 }
    return { ...tok, place: move.place, colour: move.colour, age: 0 }
  })

  return {
    tokens,
    step: state.step + 1,
    lastFirings: firings,
    enabled: enabled.map((t) => t.id),
    stats,
  }
}

/* ==========================================================================
   Queries used by the view
   ========================================================================== */

/** Token counts per place, split by colour — drives the place badges. */
export function markingOf(tokens: Token[]): Map<string, Map<TokenColour, number>> {
  const marking = new Map<string, Map<TokenColour, number>>()
  for (const token of tokens) {
    let byColour = marking.get(token.place)
    if (!byColour) {
      byColour = new Map()
      marking.set(token.place, byColour)
    }
    byColour.set(token.colour, (byColour.get(token.colour) ?? 0) + 1)
  }
  return marking
}

/** Total tokens in a place. */
export function countIn(tokens: Token[], place: string): number {
  return tokens.reduce((n, t) => (t.place === place ? n + 1 : n), 0)
}

/**
 * Inject a token directly into a place.
 *
 * Used by the attack simulation to drive the net from the scenario script, so
 * the Petri view and the run log advance together instead of independently.
 */
export function inject(
  state: NetState,
  place: string,
  colour: TokenColour,
): NetState {
  const id = `tok-inj-${state.tokens.length + 1}-${state.step}`
  return {
    ...state,
    tokens: [...state.tokens, { id, colour, place, age: 0 }],
  }
}
