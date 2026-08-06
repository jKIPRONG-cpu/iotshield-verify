/**
 * Section 2 — Core Modules.
 *
 * Ten cards, each a live link into the corresponding console route, so the
 * landing page doubles as a navigation surface rather than being purely
 * descriptive.
 *
 * The AI Security Assistant is a drawer rather than a route; its card says so
 * and points at the dashboard, where the assistant can be opened.
 */

import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Bug,
  FileText,
  Gauge,
  GitBranch,
  Radar,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Reveal, SectionHeading, SectionShell } from './primitives'
import { cn } from '@/lib/utils'

interface ModuleCard {
  icon: typeof Boxes
  title: string
  body: string
  to: string
  /** Hex accent for the card's icon plate and top rule. */
  accent: string
  /** Marks the module as the project's centrepiece. */
  featured?: boolean
  /** Shown instead of "Open module" when the target is not a route. */
  note?: string
}

const MODULES: ModuleCard[] = [
  {
    icon: BarChart3,
    title: 'Dashboard',
    body: 'Fleet posture at a glance — composite security score, threat trend, detection accuracy, and a live activity feed across the estate.',
    to: '/dashboard',
    accent: '#3B82F6',
  },
  {
    icon: Boxes,
    title: 'IoT Device Inventory',
    body: 'Forty managed endpoints across ten device classes, with health score, risk rating, firmware state, exposed ports and malware attribution.',
    to: '/devices',
    accent: '#22D3EE',
  },
  {
    icon: Activity,
    title: 'Network Activity Monitor',
    body: 'A streaming event timeline covering boots, authentications, scans, payload retrievals, C2 beaconing and exfiltration attempts.',
    to: '/network',
    accent: '#12A88F',
  },
  {
    icon: Bug,
    title: 'Malware Analysis',
    body: 'Ten IoT malware families with infection tradecraft, propagation model, observed behaviour, indicators of compromise and mitigation guidance.',
    to: '/malware',
    accent: '#DD6320',
  },
  {
    icon: Radar,
    title: 'Threat Detection',
    body: 'Launch scripted attack scenarios and watch detection, verification, isolation and recovery unfold phase by phase against the modelled estate.',
    to: '/detection',
    accent: '#F04438',
  },
  {
    icon: GitBranch,
    title: 'Coloured Petri Net Visualization',
    body: 'An executable model of the defence pipeline — ten places, eight transitions, five token colours — with play, pause, step and reset controls.',
    to: '/petri-net',
    accent: '#A78BFA',
    featured: true,
  },
  {
    icon: ShieldCheck,
    title: 'Formal Verification Engine',
    body: 'Six CTL and LTL properties checked against the reachability graph, each with its verdict, reasoning, counterexample trace and remediation.',
    to: '/verification',
    accent: '#22C55E',
    featured: true,
  },
  {
    icon: Gauge,
    title: 'Resilience Center',
    body: 'Containment, recovery, risk reduction and stability scores, an automated recovery workflow, and the stability trace across the incident window.',
    to: '/resilience',
    accent: '#D9589A',
  },
  {
    icon: FileText,
    title: 'Incident Reports',
    body: 'A formatted security assessment with executive summary, affected assets, timeline, verification table and recommendations — exportable to PDF.',
    to: '/reports',
    accent: '#B58700',
  },
  {
    icon: Sparkles,
    title: 'AI Security Assistant',
    body: 'A co-pilot that explains the active attack, why a property failed, what to remediate, and how resilient the estate currently is.',
    to: '/dashboard',
    accent: '#8878E6',
    note: 'Available in-console',
  },
]

export function CoreModules() {
  return (
    <SectionShell id="modules" divider>
      <SectionHeading
        eyebrow="Core Modules"
        title="Ten modules that behave as one system"
        description="Launching a scenario in Threat Detection changes device status in the inventory, raises alerts in the triage queue, drives tokens through the Petri net, recomputes the verification verdicts, and rewrites the resilience posture — from a single run."
      />

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((module, i) => {
          const Icon = module.icon
          return (
            <Reveal key={module.title} delay={Math.min(i * 0.05, 0.35)}>
              <Link
                to={module.to}
                className={cn(
                  'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5',
                  'transition duration-300 ease-out-quint hover:-translate-y-1 hover:border-white/[0.16] hover:bg-white/[0.05] hover:shadow-raise',
                )}
              >
                {/* Accent rule, brightened on hover. */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[2px] opacity-60 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${module.accent}, transparent)`,
                  }}
                />

                <div className="flex items-start justify-between gap-3">
                  <span
                    className="grid size-11 place-items-center rounded-xl border transition duration-300"
                    style={{
                      borderColor: `${module.accent}44`,
                      background: `${module.accent}14`,
                      color: module.accent,
                    }}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>

                  {module.featured && (
                    <span className="rounded-full border border-brand-400/30 bg-brand-500/12 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-brand-300">
                      Core
                    </span>
                  )}
                </div>

                <h3 className="mt-4 text-[15px] font-semibold text-ink-100">
                  {module.title}
                </h3>
                <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-ink-300">
                  {module.body}
                </p>

                <span className="mt-4 inline-flex items-center gap-1.5 border-t border-white/[0.06] pt-3.5 text-[12px] font-medium text-ink-500 transition group-hover:text-brand-300">
                  {module.note ?? 'Open module'}
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

      {/* Alerts and Analytics exist in the console but are not among the ten
          named modules; naming them here keeps the module list honest. */}
      <Reveal delay={0.2}>
        <p className="mt-8 text-center text-[12.5px] text-ink-500">
          The console also includes a{' '}
          <Link
            to="/alerts"
            className="font-medium text-brand-300 underline-offset-4 hover:underline"
          >
            Security Alerts
          </Link>{' '}
          triage queue and an{' '}
          <Link
            to="/analytics"
            className="font-medium text-brand-300 underline-offset-4 hover:underline"
          >
            Analytics
          </Link>{' '}
          workspace, plus configurable detection thresholds under Settings.
        </p>
      </Reveal>
    </SectionShell>
  )
}
