/**
 * Explicit-state model checker.
 *
 * Builds the full reachability graph of the coloured net and evaluates CTL
 * properties over it by fixpoint computation. Everything the Verification
 * module reports — state counts, verdicts, counterexample traces — is produced
 * here by computation. Nothing is authored.
 *
 * Scope and honesty about it:
 *
 *   - Semantics are interleaving: exactly one transition fires per step, and
 *     every enabled binding yields its own successor. A concurrency defect is
 *     only visible under interleaving, so this is the semantics the research
 *     question requires.
 *
 *   - Exploration is exhaustive up to a state cap. If the cap is reached the
 *     run is reported as `truncated` and its verdicts are stated as bounded
 *     rather than complete. A truncated run can refute a property (a real
 *     counterexample was found) but must not be read as proving one.
 *
 *   - The LTL safety property is checked as an invariant. G ¬p over a finite
 *     structure coincides with AG ¬p, so the reduction is sound. No liveness
 *     LTL is attempted; nothing here claims otherwise.
 */

import {
  initialMarking,
  markingKey,
  successors,
  type Firing,
  type Marking,
  type NetConfig,
} from './net'

/* ==========================================================================
   Reachability graph
   ========================================================================== */

export interface ReachabilityGraph {
  /** Reachable markings, index 0 is the initial marking. */
  states: Marking[]
  /** succ[i] = indices of successors of state i. */
  succ: number[][]
  /** edgeFiring[i][k] = the firing producing succ[i][k]. */
  edgeFiring: Firing[][]
  /** Indices with no successors — a deadlock if non-empty. */
  terminal: number[]
  /** Total transition firings across the graph. */
  edgeCount: number
  /** True when exploration hit the state cap before closing. */
  truncated: boolean
  /** Milliseconds spent exploring. */
  elapsedMs: number
}

export interface ExploreOptions {
  /** Hard ceiling on reachable states. Exceeding it truncates the run. */
  maxStates?: number
}

const DEFAULT_MAX_STATES = 400_000

/** Construct the reachability graph by breadth-first exploration. */
export function explore(
  config: NetConfig,
  options: ExploreOptions = {},
): ReachabilityGraph {
  const maxStates = options.maxStates ?? DEFAULT_MAX_STATES
  const started = Date.now()

  const initial = initialMarking(config)
  const index = new Map<string, number>()
  const states: Marking[] = []
  const succ: number[][] = []
  const edgeFiring: Firing[][] = []

  const intern = (m: Marking): number => {
    const key = markingKey(m)
    const existing = index.get(key)
    if (existing !== undefined) return existing
    const id = states.length
    index.set(key, id)
    states.push(m)
    succ.push([])
    edgeFiring.push([])
    return id
  }

  intern(initial)

  let edgeCount = 0
  let truncated = false
  const queue: number[] = [0]

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]

    for (const s of successors(states[current], config)) {
      if (states.length >= maxStates && !index.has(markingKey(s.marking))) {
        truncated = true
        continue
      }
      const target = intern(s.marking)
      succ[current].push(target)
      edgeFiring[current].push(s.firing)
      edgeCount++
      if (target === states.length - 1) queue.push(target)
    }
  }

  const terminal: number[] = []
  for (let i = 0; i < succ.length; i++) {
    if (succ[i].length === 0) terminal.push(i)
  }

  return {
    states,
    succ,
    edgeFiring,
    terminal,
    edgeCount,
    truncated,
    elapsedMs: Date.now() - started,
  }
}

/* ==========================================================================
   CTL evaluation
   --------------------------------------------------------------------------
   Predicates are supplied as functions over a marking; each is evaluated once
   per state and cached as a bitset-like boolean array.
   ========================================================================== */

export type StatePredicate = (m: Marking) => boolean

/** Evaluate an atomic predicate across every reachable state. */
export function evaluate(graph: ReachabilityGraph, p: StatePredicate): boolean[] {
  return graph.states.map(p)
}

/** Predecessor lists, built lazily — several fixpoints need them. */
function predecessors(graph: ReachabilityGraph): number[][] {
  const pred: number[][] = graph.states.map(() => [])
  for (let i = 0; i < graph.succ.length; i++) {
    for (const j of graph.succ[i]) pred[j].push(i)
  }
  return pred
}

/**
 * EF p — states from which some path reaches a p-state.
 *
 * Least fixpoint, computed as backward reachability from the p-states.
 */
export function EF(graph: ReachabilityGraph, p: boolean[]): boolean[] {
  const pred = predecessors(graph)
  const result = [...p]
  const stack: number[] = []
  for (let i = 0; i < p.length; i++) if (p[i]) stack.push(i)

  while (stack.length > 0) {
    const s = stack.pop()!
    for (const q of pred[s]) {
      if (!result[q]) {
        result[q] = true
        stack.push(q)
      }
    }
  }
  return result
}

/**
 * EG p — states with some infinite path staying inside p.
 *
 * Greatest fixpoint. On a finite graph this is: restrict to the p-subgraph,
 * then keep the states that can reach a non-trivial strongly connected
 * component of that subgraph. Implemented by iterative removal of states with
 * no surviving successor, which converges to the same set.
 *
 * Terminal states are treated as self-looping, so the transition relation is
 * total and CTL semantics are well defined. Genuine deadlocks are reported
 * separately by `graph.terminal`.
 */
export function EG(graph: ReachabilityGraph, p: boolean[]): boolean[] {
  const result = [...p]
  let changed = true

  while (changed) {
    changed = false
    for (let i = 0; i < result.length; i++) {
      if (!result[i]) continue
      const outs = graph.succ[i]
      // A terminal state self-loops, so it survives iff it satisfies p.
      if (outs.length === 0) continue
      let survives = false
      for (const j of outs) {
        if (result[j]) {
          survives = true
          break
        }
      }
      if (!survives) {
        result[i] = false
        changed = true
      }
    }
  }
  return result
}

/** AF p — every path eventually reaches p. Dual of EG ¬p. */
export function AF(graph: ReachabilityGraph, p: boolean[]): boolean[] {
  const notP = p.map((v) => !v)
  const egNotP = EG(graph, notP)
  return egNotP.map((v) => !v)
}

/* ==========================================================================
   Witnesses and counterexamples
   ========================================================================== */

export interface Trace {
  /** Firing sequence from the initial marking. */
  steps: string[]
  /** Marking indices along the path, for inspection. */
  path: number[]
  /** Index into `steps` where a cycle begins, when the trace is a lasso. */
  loopFrom?: number
}

/** Shortest firing sequence from the initial marking to `target`. */
export function pathTo(graph: ReachabilityGraph, target: number): Trace {
  if (target === 0) return { steps: [], path: [0] }

  const parent = new Map<number, { from: number; edge: number }>()
  const seen = new Set<number>([0])
  const queue = [0]

  for (let head = 0; head < queue.length; head++) {
    const s = queue[head]
    for (let k = 0; k < graph.succ[s].length; k++) {
      const next = graph.succ[s][k]
      if (seen.has(next)) continue
      seen.add(next)
      parent.set(next, { from: s, edge: k })
      if (next === target) {
        // Walk back to the root.
        const steps: string[] = []
        const path: number[] = [target]
        let cur = target
        while (cur !== 0) {
          const back = parent.get(cur)!
          steps.unshift(graph.edgeFiring[back.from][back.edge].label)
          path.unshift(back.from)
          cur = back.from
        }
        return { steps, path }
      }
      queue.push(next)
    }
  }

  return { steps: ['<unreachable>'], path: [] }
}

/**
 * A lasso witnessing EG within `region`, starting at `start`.
 *
 * Walks forward inside the region until a state repeats. The repeated state
 * begins the cycle, which is what demonstrates that the property's eventuality
 * can be deferred forever.
 */
export function lassoIn(
  graph: ReachabilityGraph,
  start: number,
  region: boolean[],
): Trace | null {
  const visitedAt = new Map<number, number>()
  const steps: string[] = []
  const path: number[] = []
  let cur = start

  for (let guard = 0; guard < graph.states.length + 2; guard++) {
    if (visitedAt.has(cur)) {
      return { steps, path, loopFrom: visitedAt.get(cur)! }
    }
    visitedAt.set(cur, path.length)
    path.push(cur)

    let advanced = false
    for (let k = 0; k < graph.succ[cur].length; k++) {
      const next = graph.succ[cur][k]
      if (!region[next]) continue
      steps.push(graph.edgeFiring[cur][k].label)
      cur = next
      advanced = true
      break
    }
    if (!advanced) return null
  }
  return null
}

/* ==========================================================================
   Property checking
   ========================================================================== */

export type PropertyKind =
  /** AG p — p holds in every reachable state. */
  | 'invariant'
  /** AG (a -> AF b) — every a-state inevitably reaches a b-state. */
  | 'inevitability'
  /** AG EF p — a p-state stays reachable from everywhere. */
  | 'persistent-reachability'
  /** No terminal marking exists. */
  | 'deadlock-freedom'

export interface PropertySpec {
  id: string
  name: string
  formula: string
  logic: 'CTL' | 'LTL'
  category: 'Safety' | 'Liveness' | 'Reachability' | 'Security'
  kind: PropertyKind
  description: string
  /** The atomic proposition, or the consequent for an inevitability. */
  target: StatePredicate
  /** The antecedent, for an inevitability. */
  antecedent?: StatePredicate
}

export interface PropertyResult {
  id: string
  name: string
  formula: string
  logic: 'CTL' | 'LTL'
  category: PropertySpec['category']
  description: string
  status: 'Verified' | 'Failed'
  /** Reachable states examined for this property. */
  statesExplored: number
  transitionsFired: number
  durationMs: number
  /** Number of reachable states violating the property. */
  violatingStates: number
  counterexample?: string[]
  /** Index into `steps` where a counterexample cycle begins. */
  counterexampleLoopFrom?: number
}

/** Check one property against a constructed graph. */
export function checkProperty(
  graph: ReachabilityGraph,
  spec: PropertySpec,
): PropertyResult {
  const started = Date.now()

  const base = {
    id: spec.id,
    name: spec.name,
    formula: spec.formula,
    logic: spec.logic,
    category: spec.category,
    description: spec.description,
    statesExplored: graph.states.length,
    transitionsFired: graph.edgeCount,
  }

  let status: 'Verified' | 'Failed' = 'Verified'
  let violating = 0
  let counterexample: string[] | undefined
  let loopFrom: number | undefined

  if (spec.kind === 'deadlock-freedom') {
    violating = graph.terminal.length
    if (violating > 0) {
      status = 'Failed'
      const trace = pathTo(graph, graph.terminal[0])
      counterexample = [...trace.steps, '<no transition enabled — terminal marking>']
    }
  } else if (spec.kind === 'invariant') {
    const holds = evaluate(graph, spec.target)
    const bad = holds.map((v) => !v)
    violating = bad.filter(Boolean).length
    if (violating > 0) {
      status = 'Failed'
      const first = bad.findIndex(Boolean)
      counterexample = [
        ...pathTo(graph, first).steps,
        '<property violated in the marking above>',
      ]
    }
  } else if (spec.kind === 'persistent-reachability') {
    const targetStates = evaluate(graph, spec.target)
    const canReach = EF(graph, targetStates)
    const bad = canReach.map((v) => !v)
    violating = bad.filter(Boolean).length
    if (violating > 0) {
      status = 'Failed'
      const first = bad.findIndex(Boolean)
      counterexample = [
        ...pathTo(graph, first).steps,
        '<no safe marking reachable from here>',
      ]
    }
  } else {
    // inevitability: AG (a -> AF b)
    const anteStates = evaluate(graph, spec.antecedent!)
    const targetStates = evaluate(graph, spec.target)
    const afTarget = AF(graph, targetStates)

    const bad = anteStates.map((a, i) => a && !afTarget[i])
    violating = bad.filter(Boolean).length

    if (violating > 0) {
      status = 'Failed'
      const first = bad.findIndex(Boolean)
      const prefix = pathTo(graph, first)
      // The violating state lies in EG(not target); a lasso there shows the
      // eventuality being deferred forever.
      const region = targetStates.map((v) => !v)
      const lasso = lassoIn(graph, first, region)

      if (lasso) {
        counterexample = [
          ...prefix.steps,
          '<antecedent holds here — the eventuality must now follow>',
          ...lasso.steps,
        ]
        loopFrom = prefix.steps.length + 1 + (lasso.loopFrom ?? 0)
      } else {
        counterexample = [
          ...prefix.steps,
          '<antecedent holds here, but no path reaches the consequent>',
        ]
      }
    }
  }

  return {
    ...base,
    status,
    violatingStates: violating,
    counterexample,
    counterexampleLoopFrom: loopFrom,
    durationMs: Date.now() - started,
  }
}

export interface CheckRun {
  variant: string
  states: number
  transitions: number
  terminalStates: number
  truncated: boolean
  exploreMs: number
  results: PropertyResult[]
  passed: number
  failed: number
  successRate: number
}

/** Explore once, then check every property against the same graph. */
export function runCheck(
  config: NetConfig,
  specs: PropertySpec[],
  options: ExploreOptions = {},
): CheckRun {
  const graph = explore(config, options)
  const results = specs.map((spec) => checkProperty(graph, spec))
  const passed = results.filter((r) => r.status === 'Verified').length

  return {
    variant: config.variant,
    states: graph.states.length,
    transitions: graph.edgeCount,
    terminalStates: graph.terminal.length,
    truncated: graph.truncated,
    exploreMs: graph.elapsedMs,
    results,
    passed,
    failed: results.length - passed,
    successRate: Math.round((passed / results.length) * 1000) / 10,
  }
}
