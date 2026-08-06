/**
 * Section 1 — Research Overview.
 *
 * Two columns: the narrative objectives on the left, discrete objective cards
 * on the right, and a closing panel that states the case for formal
 * verification in concrete terms rather than as an abstract virtue.
 */

import { Binary, Boxes, GitBranch, Radar, ShieldCheck } from 'lucide-react'
import { Reveal, SectionHeading, SectionShell } from './primitives'

interface Objective {
  icon: typeof Boxes
  title: string
  body: string
}

const OBJECTIVES: Objective[] = [
  {
    icon: Boxes,
    title: 'Model the estate',
    body: 'Represent a heterogeneous IoT deployment — cameras, gateways, medical monitors, industrial controllers — with the posture, exposure and firmware state that determine how each behaves under attack.',
  },
  {
    icon: Radar,
    title: 'Detect behaviourally',
    body: 'Identify compromise from deviation against a per-device-class baseline rather than from static signatures, which constrained IoT firmware rarely supports.',
  },
  {
    icon: GitBranch,
    title: 'Formalise the pipeline',
    body: 'Express detection, verification, isolation and recovery as a Coloured Petri Net, so the defence itself becomes a mathematical object that can be reasoned about.',
  },
  {
    icon: Binary,
    title: 'Verify and measure',
    body: 'Model-check temporal-logic properties against the reachability graph, then quantify how well the estate absorbs an incident once those guarantees are known.',
  },
]

export function ResearchOverview() {
  return (
    <SectionShell id="overview" divider>
      <SectionHeading
        eyebrow="Research Overview"
        title="Proving what a security pipeline guarantees — not just observing that it worked"
        description="Conventional IoT defence establishes that a threat was caught in the runs that happened to be observed. This research asks a stricter question: across every execution the system admits, what is actually guaranteed?"
      />

      <div className="mt-14 grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
        {/* ---- Narrative ---------------------------------------------------- */}
        <div className="space-y-5">
          <Reveal>
            <h3 className="text-lg font-semibold text-ink-100">
              Why formal verification belongs in IoT security
            </h3>
          </Reveal>

          <Reveal delay={0.06}>
            <p className="text-[15px] leading-relaxed text-ink-300">
              IoT endpoints are a difficult defensive surface: minimal compute,
              infrequent patching, long deployment lifetimes, and firmware that
              often ships with credentials that are never rotated. Once
              compromised, they are rarely the target — they are the foothold.
            </p>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="text-[15px] leading-relaxed text-ink-300">
              Testing a defence tells you what happened in the executions you
              sampled. It cannot tell you what the system does across all of
              them. A concurrent pipeline — where analysis, detection and
              isolation compete for the same events — has interleavings that no
              realistic test suite will ever reach.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <p className="text-[15px] leading-relaxed text-ink-300">
              Model checking quantifies over the entire state space. It returns
              either a proof that a property holds on every path, or a concrete
              counterexample showing exactly how it fails. Both outcomes are
              actionable in a way that a passing test is not.
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="rounded-2xl border border-brand-400/25 bg-brand-500/[0.07] p-5">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-300">
                <ShieldCheck className="size-3.5" aria-hidden />
                The finding this platform demonstrates
              </p>
              <p className="mt-2.5 text-[14px] leading-relaxed text-ink-200">
                Four of six properties hold. Two do not. In every simulated run
                the response still succeeds — threats are caught and devices
                quarantined — but model checking shows containment is{' '}
                <strong className="font-semibold text-ink-100">reachable</strong>{' '}
                rather than{' '}
                <strong className="font-semibold text-ink-100">inevitable</strong>.
                That gap is invisible to testing and is precisely what formal
                methods exist to expose.
              </p>
            </div>
          </Reveal>
        </div>

        {/* ---- Objectives --------------------------------------------------- */}
        <ol className="space-y-3">
          {OBJECTIVES.map((objective, i) => {
            const Icon = objective.icon
            return (
              <Reveal key={objective.title} delay={i * 0.08}>
                <li className="group flex gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition duration-300 hover:border-brand-400/30 hover:bg-brand-500/[0.05]">
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <span className="grid size-10 place-items-center rounded-xl border border-brand-400/25 bg-brand-500/10 text-brand-300 transition group-hover:border-brand-400/45">
                      <Icon className="size-[18px]" aria-hidden />
                    </span>
                    <span className="tabular text-[10px] font-semibold text-ink-700">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[15px] font-semibold text-ink-100">
                      {objective.title}
                    </h4>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-300">
                      {objective.body}
                    </p>
                  </div>
                </li>
              </Reveal>
            )
          })}
        </ol>
      </div>
    </SectionShell>
  )
}
