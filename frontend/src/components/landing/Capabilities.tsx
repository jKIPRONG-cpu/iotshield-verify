/**
 * Section 4 — Platform Capabilities.
 *
 * Replaces the technology-stack logo wall. Six capability statements, each a
 * claim the console can actually demonstrate, with a link to the module that
 * demonstrates it — so a viewer can verify any line on this list in two clicks.
 *
 * Spelling follows the rest of the application (Coloured, behaviour, visualise)
 * rather than the US forms, so the landing page and the console agree.
 */

import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  BarChart3,
  Bug,
  Check,
  FileText,
  Gauge,
  GitBranch,
  Radar,
} from 'lucide-react'
import { Reveal, SectionHeading, SectionShell } from './primitives'

interface Capability {
  icon: typeof Bug
  title: string
  detail: string
  /** The module that demonstrates this capability. */
  to: string
  linkLabel: string
  accent: string
}

const CAPABILITIES: Capability[] = [
  {
    icon: Bug,
    title: 'IoT Malware Detection',
    detail:
      'Identify malicious behaviour in simulated IoT environments, matched against the tradecraft and indicators of ten documented malware families.',
    to: '/malware',
    linkLabel: 'Malware Analysis',
    accent: '#F04438',
  },
  {
    icon: GitBranch,
    title: 'Formal Verification',
    detail:
      'Validate system behaviour using Coloured Petri Nets, model-checking six temporal-logic properties against the full reachability graph.',
    to: '/verification',
    linkLabel: 'Formal Verification',
    accent: '#A78BFA',
  },
  {
    icon: Radar,
    title: 'Threat Analysis',
    detail:
      'Visualise attack paths and malware propagation phase by phase, from reconnaissance through execution to containment.',
    to: '/detection',
    linkLabel: 'Threat Detection',
    accent: '#22D3EE',
  },
  {
    icon: Gauge,
    title: 'Resilience Assessment',
    detail:
      'Evaluate mitigation strategies and system recovery, with containment, recovery and stability scored against the verified guarantees.',
    to: '/resilience',
    linkLabel: 'Resilience Center',
    accent: '#12A88F',
  },
  {
    icon: BarChart3,
    title: 'Interactive Dashboard',
    detail:
      'Monitor devices, alerts and verification results in real time, with every figure reacting to the scenario currently running.',
    to: '/dashboard',
    linkLabel: 'Executive Dashboard',
    accent: '#3B82F6',
  },
  {
    icon: FileText,
    title: 'Automated Reports',
    detail:
      'Generate professional security and verification reports, exportable as a branded PDF with timeline, verdicts and prioritised remediation.',
    to: '/reports',
    linkLabel: 'Incident Reports',
    accent: '#B58700',
  },
]

export function Capabilities() {
  return (
    <SectionShell id="capabilities" divider>
      <SectionHeading
        eyebrow="Platform Capabilities"
        title="What the platform does, and where to see it"
        description="Every capability below is demonstrable in the console rather than asserted here. Each card links to the module that performs it."
      />

      <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CAPABILITIES.map((capability, i) => {
          const Icon = capability.icon
          return (
            <Reveal key={capability.title} delay={Math.min(i * 0.06, 0.35)}>
              <Link
                to={capability.to}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition duration-300 ease-out-quint hover:-translate-y-1 hover:border-white/[0.16] hover:bg-white/[0.05] hover:shadow-raise"
              >
                {/* Corner wash keyed to the capability's accent. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-150"
                  style={{ background: `${capability.accent}20` }}
                />

                <div className="relative flex items-center gap-3">
                  {/* The tick is the required visual mark; the icon carries
                      the subject, so the two together read faster than either
                      alone. */}
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-ok/35 bg-ok/12 text-ok">
                    <Check className="size-4" strokeWidth={3} aria-hidden />
                  </span>
                  <span
                    className="grid size-10 place-items-center rounded-xl border"
                    style={{
                      borderColor: `${capability.accent}44`,
                      background: `${capability.accent}14`,
                      color: capability.accent,
                    }}
                  >
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                </div>

                <h3 className="relative mt-4 text-[16px] font-semibold text-ink-100">
                  {capability.title}
                </h3>
                <p className="relative mt-2 flex-1 text-[13.5px] leading-relaxed text-ink-300">
                  {capability.detail}
                </p>

                <span className="relative mt-4 inline-flex items-center gap-1.5 border-t border-white/[0.06] pt-3.5 text-[12px] font-medium text-ink-500 transition group-hover:text-brand-300">
                  {capability.linkLabel}
                  <ArrowUpRight
                    className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </Reveal>
          )
        })}
      </div>
    </SectionShell>
  )
}
