/**
 * Bridge from computed verification results to the application's view model.
 *
 * `verification-results.json` is produced by `tools/verify_model.mjs`, which
 * runs the explicit-state model checker over the Coloured Petri Net. This
 * module reshapes that output into the `VerificationRun` the Verification
 * module renders.
 *
 * The point of the indirection is that the console can no longer display a
 * verdict nobody computed. Regenerate with:
 *
 *     npm run verify:model:write
 */

import type { VerificationProperty, VerificationRun } from '@/types'
import results from './verification-results.json'

type RawResult = (typeof results)['baseline']['results'][number]

/** Recommendations are editorial; verdicts and traces are not. */
const RECOMMENDATION: Record<string, string> = {
  'VP-01':
    'Hold this invariant when extending the model. Any new arc writing into Malware Execution must consume from Authentication, or the property regresses.',
  'VP-02':
    'Recovery capacity is what makes this hold. Gating the Recover Device transition on an external dependency would break it.',
  'VP-03':
    'Preserve the token-recycling arc from Recovery back to Idle. Removing it introduces terminal markings.',
  'VP-04':
    'The guarantee rests on the quarantine guard. Add a regression check whenever the colour set is extended.',
  'VP-05':
    'Bound the analysis retry so the detector becomes enabled after a fixed number of deferrals, and add the retry count as a detection disjunct.',
  'VP-06':
    'Add an abnormal-volume disjunct to the detector, and hold egress for any device carrying an open suspicion indicator until the detector has ruled.',
  'VP-07':
    'Keep critical assets hardened above the strongest inbound route in the susceptibility matrix. The guarantee is a consequence of that margin.',
  'VP-08':
    'The bound follows from the susceptibility matrix and the segment policy together. Re-verify after changing either.',
}

function toProperty(raw: RawResult): VerificationProperty {
  const fair = (raw as { statusUnderFairness?: string }).statusUnderFairness

  // A liveness property that holds only under weak fairness is reported as a
  // warning rather than a pass: the guarantee is real but conditional on a
  // scheduler assumption, and collapsing that distinction would overstate it.
  const status: VerificationProperty['status'] =
    raw.status === 'Verified'
      ? 'Verified'
      : fair === 'Verified'
        ? 'Warning'
        : 'Failed'

  const reason =
    raw.status === 'Verified'
      ? `Exhaustive exploration of ${raw.statesExplored.toLocaleString()} reachable markings found no violation.`
      : fair === 'Verified'
        ? `Violated in ${raw.violatingStates.toLocaleString()} of ${raw.statesExplored.toLocaleString()} reachable markings under an arbitrary scheduler, but satisfied under weak fairness. The guarantee holds provided a continuously enabled action eventually fires — the weakest assumption a concurrent system needs.`
        : `Violated in ${raw.violatingStates.toLocaleString()} of ${raw.statesExplored.toLocaleString()} reachable markings, including under weak fairness. The failure is structural rather than a scheduling artefact.`

  return {
    id: raw.id,
    name: raw.name,
    formula: raw.formula,
    logic: raw.logic as VerificationProperty['logic'],
    status,
    description: raw.description,
    reason,
    recommendation: RECOMMENDATION[raw.id] ?? '',
    statesExplored: raw.statesExplored,
    transitionsFired: raw.transitionsFired,
    // Wall-clock timing is not persisted: it is a property of the machine
    // that ran the checker, not of the model. States explored is the
    // reproducible measure of effort and is shown instead.
    durationMs: 0,
    counterexample: raw.counterexample ?? undefined,
    category: raw.category as VerificationProperty['category'],
  }
}

function toRun(
  run: (typeof results)['baseline'],
  id: string,
  model: string,
): VerificationRun {
  const properties = run.results.map(toProperty)
  const passed = properties.filter((p) => p.status === 'Verified').length

  return {
    id,
    model,
    startedAt: new Date().toISOString(),
    properties,
    passed,
    failed: properties.length - passed,
    successRate: Math.round((passed / properties.length) * 1000) / 10,
    stateSpaceSize: run.states,
    deadlockFree: run.terminalStates === 0,
  }
}

/** The baseline model — the system before the derived security controls. */
export const baselineVerification = toRun(
  results.baseline,
  'VRUN-BASELINE',
  'CPN-IoT-Defence — baseline',
)

/** The hardened model — baseline plus the counterexample-derived controls. */
export const hardenedVerification = toRun(
  results.hardened as typeof results.baseline,
  'VRUN-HARDENED',
  'CPN-IoT-Defence — hardened',
)

/** Metadata describing how the results were produced. */
export const verificationMeta = {
  semantics: results.semantics,
  parameters: results.parameters,
  devices: results.devices,
  scenarios: (results as { scenarios?: unknown[] }).scenarios ?? [],
  baselineStates: results.baseline.states,
  hardenedStates: results.hardened.states,
  baselinePassedFair: results.baseline.passedUnderFairness,
  hardenedPassedFair: results.hardened.passedUnderFairness,
}

/** What the console shows by default. */
export const computedVerification = baselineVerification
