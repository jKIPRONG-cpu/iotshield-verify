/**
 * Section 3 — Research Workflow.
 *
 * Carries `id="architecture"`, because this is where the hero's
 * "View System Architecture" call to action scrolls to. It therefore does two
 * jobs: the eight-stage research pipeline, and a four-tier system architecture
 * panel beneath it — which is what someone clicking that button expects to
 * find.
 *
 * The timeline is a horizontal rail on desktop and reflows to a vertical one
 * on mobile, where eight stages side by side would be unreadable.
 */

import {
  Activity,
  Bug,
  Cpu,
  Database,
  FileText,
  Gauge,
  GitBranch,
  Layers,
  Radar,
  Server,
  ShieldCheck,
  MonitorSmartphone,
} from 'lucide-react'
import { Reveal, SectionHeading, SectionShell } from './primitives'

/* ==========================================================================
   Pipeline
   ========================================================================== */

interface Stage {
  icon: typeof Cpu
  title: string
  body: string
}

const STAGES: Stage[] = [
  {
    icon: Cpu,
    title: 'IoT Devices',
    body: 'Forty endpoints across ten classes, each with firmware state, exposed ports and a posture score.',
  },
  {
    icon: Activity,
    title: 'Data Collection',
    body: 'Telemetry, authentication, DNS and flow records gathered into a rolling event corpus.',
  },
  {
    icon: Bug,
    title: 'Malware Analysis',
    body: 'Observed behaviour matched against family tradecraft and indicators of compromise.',
  },
  {
    icon: Radar,
    title: 'Threat Detection',
    body: 'Behavioural deviation from the per-class baseline, correlated across independent indicators.',
  },
  {
    icon: GitBranch,
    title: 'Coloured Petri Nets',
    body: 'The defence pipeline expressed as a formal model with typed, coloured tokens.',
  },
  {
    icon: ShieldCheck,
    title: 'Formal Verification',
    body: 'CTL and LTL properties model-checked against the reachability graph.',
  },
  {
    icon: Gauge,
    title: 'Resilience Evaluation',
    body: 'Containment, recovery and stability measured against the verified guarantees.',
  },
  {
    icon: FileText,
    title: 'Reports',
    body: 'An executive assessment with the timeline, verdicts and prioritised remediation.',
  },
]

/* ==========================================================================
   Architecture tiers
   ========================================================================== */

interface Tier {
  icon: typeof Layers
  label: string
  title: string
  items: string[]
  accent: string
}

const TIERS: Tier[] = [
  {
    icon: MonitorSmartphone,
    label: 'Presentation',
    title: 'React SPA',
    items: [
      'Twelve routed modules',
      'React Flow · Recharts · Framer Motion',
      'Automatic fallback to a bundled dataset',
    ],
    accent: '#3B82F6',
  },
  {
    icon: Server,
    label: 'Service',
    title: 'FastAPI',
    items: [
      'Fifteen documented endpoints',
      'Pydantic response contracts',
      'OpenAPI documentation at /docs',
    ],
    accent: '#22D3EE',
  },
  {
    icon: Layers,
    label: 'Domain',
    title: 'Analysis & verification',
    items: [
      'Scripted attack simulation engine',
      'Coloured Petri Net firing interpreter',
      'Property results and ReportLab rendering',
    ],
    accent: '#A78BFA',
  },
  {
    icon: Database,
    label: 'Data',
    title: 'SQLite',
    items: [
      'Idempotent schema and seeding',
      'Deterministic synthetic generator',
      'Verified parity with the client fallback',
    ],
    accent: '#12A88F',
  },
]

/* ==========================================================================
   Section
   ========================================================================== */

export function ResearchWorkflow() {
  return (
    <SectionShell id="architecture" divider>
      <SectionHeading
        eyebrow="Research Workflow"
        title="From raw device telemetry to a proven guarantee"
        description="Each stage produces the input the next one needs. Formal verification sits between detection and response deliberately — the response acts on what the model can prove, not merely on what the detector reported."
      />

      {/* ---- Pipeline ------------------------------------------------------- */}
      <div className="relative mt-14">
        {/* Connecting rail, desktop only. Positioned to pass through the icon
            plates, which sit 28px from the top of each column. */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-7 hidden h-px lg:block"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(59,130,246,0.45) 12%, rgba(34,211,238,0.45) 50%, rgba(167,139,250,0.45) 88%, transparent)',
          }}
        />

        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {STAGES.map((stage, i) => {
            const Icon = stage.icon
            return (
              <Reveal key={stage.title} delay={Math.min(i * 0.06, 0.4)}>
                <li className="group relative flex flex-col items-center text-center">
                  <span className="relative z-10 grid size-14 place-items-center rounded-2xl border border-brand-400/25 bg-navy-900 text-brand-300 transition duration-300 group-hover:border-brand-400/55 group-hover:bg-brand-500/10 group-hover:text-brand-200">
                    <Icon className="size-[22px]" aria-hidden />
                    <span className="tabular absolute -bottom-1.5 -right-1.5 grid size-5 place-items-center rounded-full border border-navy-900 bg-navy-700 text-[9.5px] font-semibold text-ink-300">
                      {i + 1}
                    </span>
                  </span>

                  <h3 className="mt-4 text-[13.5px] font-semibold leading-tight text-ink-100">
                    {stage.title}
                  </h3>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-500">
                    {stage.body}
                  </p>
                </li>
              </Reveal>
            )
          })}
        </ol>
      </div>

      {/* ---- Architecture ---------------------------------------------------- */}
      <div className="mt-20">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <h3 className="text-[22px] font-semibold tracking-tight text-ink-100 sm:text-[26px]">
              System architecture
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-300">
              A four-tier separation. The presentation tier degrades to a bundled
              dataset when the service tier is unreachable, so the console stays
              fully explorable with no backend running — which is what makes it
              safe to present without a network.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TIERS.map((tier, i) => {
            const Icon = tier.icon
            return (
              <Reveal key={tier.label} delay={i * 0.08}>
                <div className="relative h-full overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition duration-300 hover:border-white/[0.14] hover:bg-white/[0.04]">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-[3px]"
                    style={{ background: tier.accent, opacity: 0.75 }}
                  />

                  <div className="flex items-center gap-3">
                    <span
                      className="grid size-10 place-items-center rounded-xl border"
                      style={{
                        borderColor: `${tier.accent}44`,
                        background: `${tier.accent}14`,
                        color: tier.accent,
                      }}
                    >
                      <Icon className="size-[18px]" aria-hidden />
                    </span>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-500">
                        {tier.label}
                      </p>
                      <p className="text-[14.5px] font-semibold text-ink-100">
                        {tier.title}
                      </p>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
                    {tier.items.map((item) => (
                      <li
                        key={item}
                        className="flex gap-2.5 text-[12.5px] leading-relaxed text-ink-300"
                      >
                        <span
                          aria-hidden
                          className="mt-[7px] size-1.5 shrink-0 rounded-full"
                          style={{ background: tier.accent }}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </SectionShell>
  )
}
