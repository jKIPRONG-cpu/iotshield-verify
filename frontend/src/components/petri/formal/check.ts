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
  TRANSITION_IDS,
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
  /**
   * edgePacked[i][k] encodes the firing producing succ[i][k] as one integer.
   *
   * Storing a `Firing` object per edge exhausted the heap at roughly two
   * million edges — the label strings dominated. Packing to an integer and
   * rebuilding the label only when a counterexample is printed keeps the whole
   * graph in memory comfortably.
   */
  edgePacked: number[][]
  /** The configuration explored, needed to decode packed edges. */
  config: NetConfig
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

const DEFAULT_MAX_STATES = 1_000_000

/* --------------------------------------------------------------------------
   Edge packing: transitionIndex * 121 + device * 11 + (partner + 1)
   Supports up to 11 devices and any number of transitions.
   -------------------------------------------------------------------------- */

const TRANSITION_INDEX = new Map<string, number>(
  TRANSITION_IDS.map((id, i) => [id, i]),
)

function packFiring(transition: string, device: number, partner?: number): number {
  const t = TRANSITION_INDEX.get(transition) ?? 0
  return t * 121 + device * 11 + (partner === undefined ? 0 : partner + 1)
}

/** Rebuild a readable inscription from a packed edge. */
export function decodeFiring(packed: number, config: NetConfig): string {
  const t = Math.floor(packed / 121)
  const rest = packed % 121
  const device = Math.floor(rest / 11)
  const partnerCode = rest % 11

  const transition = TRANSITION_IDS[t] ?? 't-?'
  const who = config.devices[device]?.id ?? `d${device}`

  if (partnerCode > 0) {
    const partner = config.devices[partnerCode - 1]?.id ?? `d${partnerCode - 1}`
    return `${transition}(${who} -> ${partner})`
  }
  return `${transition}(${who})`
}

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
  const edgePacked: number[][] = []

  /** Intern a marking, reporting whether it was newly discovered. */
  const intern = (m: Marking): { id: number; isNew: boolean } => {
    const key = markingKey(m)
    const existing = index.get(key)
    if (existing !== undefined) return { id: existing, isNew: false }
    const id = states.length
    index.set(key, id)
    states.push(m)
    succ.push([])
    edgePacked.push([])
    return { id, isNew: true }
  }

  intern(initial)

  let edgeCount = 0
  let truncated = false
  const queue: number[] = [0]

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]

    for (const s of successors(states[current], config)) {
      // Respect the cap, but still record edges into already-known states so
      // the explored fragment stays internally consistent.
      if (states.length >= maxStates && !index.has(markingKey(s.marking))) {
        truncated = true
        continue
      }
      const { id, isNew } = intern(s.marking)
      succ[current].push(id)
      edgePacked[current].push(
        packFiring(s.firing.transition, s.firing.device, s.firing.partner),
      )
      edgeCount++
      if (isNew) queue.push(id)
    }
  }

  const terminal: number[] = []
  for (let i = 0; i < succ.length; i++) {
    if (succ[i].length === 0) terminal.push(i)
  }

  return {
    states,
    succ,
    edgePacked,
    config,
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


/* ==========================================================================
   Weak fairness
   --------------------------------------------------------------------------
   A concurrent net fails almost every liveness property under an arbitrary
   scheduler: nothing stops one device cycling forever while another waits to
   be isolated. That is starvation, not a security defect, and reporting it as
   one would be misleading.

   The standard remedy is to evaluate liveness under a fairness assumption.
   Weak fairness says: a transition that stays continuously enabled must
   eventually fire. Under that assumption a cycle is admissible only if, for
   every transition, either the transition is disabled somewhere on the cycle,
   or it actually fires on the cycle.

   Both readings are reported. The distinction matters for the research claim:
   a property that holds only under fairness depends on a scheduler guarantee,
   whereas one that holds without it is guaranteed structurally.
   ========================================================================== */

/**
 * Binding elements enabled at a state — read off its outgoing edges.
 *
 * The unit of fairness in a coloured net is the BINDING ELEMENT (a transition
 * together with the tokens it binds), not the transition alone. Treating
 * `t-analyse` as one unit would let `t-analyse(TH-1)` discharge the fairness
 * obligation owed to `t-analyse(GW-1)`, so a cycle in which one device is
 * starved would be judged fair. The packed edge value already encodes the
 * binding, so it is used directly as the fairness key.
 */
function enabledAt(graph: ReachabilityGraph, s: number): Set<number> {
  return new Set(graph.edgePacked[s])
}

/**
 * EG p under weak fairness.
 *
 * Tarjan's algorithm over the p-subgraph, keeping only strongly connected
 * components that admit a weakly fair infinite path, then taking backward
 * reachability to those components within p.
 */
export function EGfair(graph: ReachabilityGraph, p: boolean[]): boolean[] {
  const n = graph.states.length
  const indexOf = new Int32Array(n).fill(-1)
  const low = new Int32Array(n)
  const onStack = new Uint8Array(n)
  const stack: number[] = []
  let counter = 0

  const fairSeed = new Array<boolean>(n).fill(false)

  // Iterative Tarjan — the graph is far too deep for recursion.
  for (let root = 0; root < n; root++) {
    if (!p[root] || indexOf[root] !== -1) continue

    const work: { v: number; k: number }[] = [{ v: root, k: 0 }]
    indexOf[root] = low[root] = counter++
    stack.push(root)
    onStack[root] = 1

    while (work.length > 0) {
      const frame = work[work.length - 1]
      const v = frame.v

      if (frame.k < graph.succ[v].length) {
        const w = graph.succ[v][frame.k++]
        if (!p[w]) continue
        if (indexOf[w] === -1) {
          indexOf[w] = low[w] = counter++
          stack.push(w)
          onStack[w] = 1
          work.push({ v: w, k: 0 })
        } else if (onStack[w]) {
          if (indexOf[w] < low[v]) low[v] = indexOf[w]
        }
      } else {
        work.pop()
        if (work.length > 0) {
          const parent = work[work.length - 1].v
          if (low[v] < low[parent]) low[parent] = low[v]
        }

        if (low[v] === indexOf[v]) {
          // Pop one strongly connected component.
          const component: number[] = []
          for (;;) {
            const w = stack.pop()!
            onStack[w] = 0
            component.push(w)
            if (w === v) break
          }

          // A single state with no self-loop inside p is not an infinite path.
          const members = new Set(component)
          let hasInternalEdge = false
          const firedInside = new Set<number>()

          // Binding elements continuously enabled across the whole cycle =
          // the intersection of the per-state enabled sets. Anything outside
          // that intersection is disabled somewhere, so weak fairness imposes
          // no obligation on it.
          let continuouslyEnabled: Set<number> | null = null

          for (const u of component) {
            const enabled = enabledAt(graph, u)
            if (continuouslyEnabled === null) {
              continuouslyEnabled = new Set(enabled)
            } else {
              for (const b of [...continuouslyEnabled]) {
                if (!enabled.has(b)) continuouslyEnabled.delete(b)
              }
            }
            for (let k = 0; k < graph.succ[u].length; k++) {
              const w = graph.succ[u][k]
              if (!members.has(w) || !p[w]) continue
              hasInternalEdge = true
              firedInside.add(graph.edgePacked[u][k])
            }
          }

          if (hasInternalEdge) {
            let fair = true
            for (const b of continuouslyEnabled ?? []) {
              if (!firedInside.has(b)) {
                fair = false
                break
              }
            }
            if (fair) for (const u of component) fairSeed[u] = true
          }
        }
      }
    }
  }

  // Backward reachability to a fair component, staying inside p.
  const pred: number[][] = graph.states.map(() => [])
  for (let i = 0; i < graph.succ.length; i++) {
    for (const j of graph.succ[i]) if (p[i] && p[j]) pred[j].push(i)
  }

  const result = [...fairSeed]
  const queue: number[] = []
  for (let i = 0; i < n; i++) if (result[i]) queue.push(i)
  for (let head = 0; head < queue.length; head++) {
    for (const q of pred[queue[head]]) {
      if (!result[q]) {
        result[q] = true
        queue.push(q)
      }
    }
  }
  return result
}

/** AF p under weak fairness. */
export function AFfair(graph: ReachabilityGraph, p: boolean[]): boolean[] {
  const egNotP = EGfair(graph, p.map((v) => !v))
  return egNotP.map((v) => !v)
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
          steps.unshift(decodeFiring(graph.edgePacked[back.from][back.edge], graph.config))
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
      steps.push(decodeFiring(graph.edgePacked[cur][k], graph.config))
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
  /**
   * For a liveness property, the verdict under weak fairness.
   *
   * `undefined` for safety properties, where fairness is irrelevant.
   */
  statusUnderFairness?: 'Verified' | 'Failed'
  violatingStatesUnderFairness?: number
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
  let fairStatus: 'Verified' | 'Failed' | undefined
  let fairViolating: number | undefined
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
    const afFair = AFfair(graph, targetStates)

    const bad = anteStates.map((a, i) => a && !afTarget[i])
    violating = bad.filter(Boolean).length

    const badFair = anteStates.map((a, i) => a && !afFair[i])
    fairViolating = badFair.filter(Boolean).length
    fairStatus = fairViolating > 0 ? 'Failed' : 'Verified'

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
    statusUnderFairness: fairStatus,
    violatingStatesUnderFairness: fairViolating,
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
  /** Properties satisfied when liveness is judged under weak fairness. */
  passedUnderFairness: number
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

  const passedFair = results.filter(
    (r) => (r.statusUnderFairness ?? r.status) === 'Verified',
  ).length

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
    passedUnderFairness: passedFair,
  }
}
