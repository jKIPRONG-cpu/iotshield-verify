/**
 * Section 5 — Why Formal Verification?
 *
 * Five pillars in an asymmetric grid, followed by a direct comparison between
 * testing and model checking. The comparison earns its place: it turns an
 * assertion ("formal methods are rigorous") into something a viewer can check
 * for themselves.
 */

import {
  Binary,
  GraduationCap,
  Radar,
  ShieldCheck,
  Sigma,
  TrendingUp,
} from 'lucide-react'
import { Reveal, SectionHeading, SectionShell } from './primitives'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Pillars
   ========================================================================== */

interface Pillar {
  icon: typeof Sigma
  title: string
  body: string
  accent: string
  /** Wide cards lead the grid on large screens. */
  wide?: boolean
}

const PILLARS: Pillar[] = [
  {
    icon: Sigma,
    title: 'Mathematical correctness',
    body: 'A property is checked against every reachable state, not a sampled subset of executions. The model checker returns either a proof that it holds on all paths, or a concrete firing sequence showing exactly how it fails — a result you can act on rather than a probability you have to interpret.',
    accent: '#3B82F6',
    wide: true,
  },
  {
    icon: Radar,
    title: 'Early malware detection',
    body: 'Expressing the detector as a formal model exposes its blind spots before deployment. The requirement for two consecutive suspicious observations, for instance, is visibly a one-observation exposure window — a gap the model surfaces long before an incident would.',
    accent: '#22D3EE',
    wide: true,
  },
  {
    icon: TrendingUp,
    title: 'Improved resilience',
    body: 'Recovery paths are verified reachable from every compromised state, so containment is designed in rather than hoped for.',
    accent: '#12A88F',
  },
  {
    icon: ShieldCheck,
    title: 'Secure IoT systems',
    body: 'Constrained endpoints cannot run heavyweight agents. Guarantees must come from the architecture around them, and architecture is exactly what a formal model captures.',
    accent: '#A78BFA',
  },
  {
    icon: GraduationCap,
    title: 'Research significance',
    body: 'Bridges formal methods and applied IoT security: a modelled defence, a verified property set, and an honest account of what could not be proven.',
    accent: '#F59E0B',
  },
]

/* ==========================================================================
   Comparison
   ========================================================================== */

const COMPARISON = [
  {
    question: 'What does it examine?',
    testing: 'The executions the test suite happens to produce',
    verification: 'Every execution the model admits',
  },
  {
    question: 'What does a pass mean?',
    testing: 'No fault was observed in those runs',
    verification: 'The property holds on all paths',
  },
  {
    question: 'What does a failure give you?',
    testing: 'A failing case, sometimes intermittent',
    verification: 'A reproducible counterexample trace',
  },
  {
    question: 'Concurrency defects?',
    testing: 'Found only if the schedule is hit by chance',
    verification: 'Found by construction — interleavings are enumerated',
  },
]

/* ==========================================================================
   Section
   ========================================================================== */

export function WhyFormalVerification() {
  return (
    <SectionShell id="why" divider>
      <SectionHeading
        eyebrow="Why Formal Verification?"
        title="The difference between believing a defence works and proving what it guarantees"
        description="Every module in this platform exists to support one claim: that a security pipeline should be able to state, precisely, what it guarantees — and be equally precise about what it does not."
      />

      <div className="mt-14 grid gap-4 lg:grid-cols-6">
        {PILLARS.map((pillar, i) => {
          const Icon = pillar.icon
          return (
            <Reveal
              key={pillar.title}
              delay={Math.min(i * 0.07, 0.35)}
              className={cn(pillar.wide ? 'lg:col-span-3' : 'lg:col-span-2')}
            >
              <div className="relative h-full overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition duration-300 hover:border-white/[0.15] hover:bg-white/[0.045]">
                {/* Corner wash keyed to the pillar's accent. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full blur-3xl"
                  style={{ background: `${pillar.accent}22` }}
                />

                <span
                  className="relative grid size-11 place-items-center rounded-xl border"
                  style={{
                    borderColor: `${pillar.accent}44`,
                    background: `${pillar.accent}14`,
                    color: pillar.accent,
                  }}
                >
                  <Icon className="size-5" aria-hidden />
                </span>

                <h3 className="relative mt-4 text-[16px] font-semibold text-ink-100">
                  {pillar.title}
                </h3>
                <p className="relative mt-2 text-[13.5px] leading-relaxed text-ink-300">
                  {pillar.body}
                </p>
              </div>
            </Reveal>
          )
        })}
      </div>

      {/* ---- Testing vs verification ---------------------------------------- */}
      <Reveal delay={0.1}>
        <div className="mt-12 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
          <div className="flex items-center gap-3 border-b border-white/[0.07] px-6 py-4">
            <Binary className="size-[18px] text-brand-300" aria-hidden />
            <h3 className="text-[15px] font-semibold text-ink-100">
              Testing versus model checking
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <th
                    scope="col"
                    className="px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-500"
                  >
                    Question
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-500"
                  >
                    Conventional testing
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-brand-300"
                  >
                    Formal verification
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr
                    key={row.question}
                    className="border-b border-white/[0.04] last:border-0"
                  >
                    <td className="px-6 py-3.5 text-[13px] font-medium text-ink-100">
                      {row.question}
                    </td>
                    <td className="px-6 py-3.5 text-[13px] leading-relaxed text-ink-500">
                      {row.testing}
                    </td>
                    <td className="bg-brand-500/[0.05] px-6 py-3.5 text-[13px] leading-relaxed text-ink-200">
                      {row.verification}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
    </SectionShell>
  )
}
