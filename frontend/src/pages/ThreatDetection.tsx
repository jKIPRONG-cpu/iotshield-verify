/**
 * Threat Detection.
 *
 * The control room for the attack simulation engine. Launching a scenario here
 * is what makes the console behave as one system: the run drives device state,
 * the alert feed, the Petri net, the verification verdicts, and the resilience
 * posture, all from the single scripted result held in AppState.
 *
 * The run log is stepped against the wall clock, so the phases arrive in order
 * and at a pace an audience can follow rather than appearing all at once.
 */

import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CircleSlash,
  Crosshair,
  Gauge,
  GitBranch,
  Loader2,
  Radar,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Target,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { useAppState } from '@/context/AppState'
import { SCENARIOS } from '@/data/mock'
import type { Scenario, SimulationPhase, SimulationStep } from '@/types'
import {
  AnimatedNumber,
  Button,
  GlassCard,
  LiveDot,
  PageHeader,
  SectionTitle,
  SeverityBadge,
  SourceBadge,
} from '@/components/ui'
import { cn, formatClock, severityHex } from '@/lib/utils'

/* ==========================================================================
   Phase presentation
   ========================================================================== */

const PHASE_ICON: Record<SimulationPhase, typeof Radar> = {
  Reconnaissance: Radar,
  Intrusion: Target,
  Execution: Zap,
  Detection: Crosshair,
  Verification: ShieldCheck,
  Isolation: CircleSlash,
  Recovery: Sparkles,
}

const PHASE_ORDER: SimulationPhase[] = [
  'Reconnaissance',
  'Intrusion',
  'Execution',
  'Detection',
  'Verification',
  'Isolation',
  'Recovery',
]

/* ==========================================================================
   Scenario card
   ========================================================================== */

function ScenarioCard({
  scenario,
  active,
  running,
  onLaunch,
}: {
  scenario: Scenario
  active: boolean
  running: boolean
  onLaunch: () => void
}) {
  const isBaseline = scenario.id === 'normal'

  return (
    <GlassCard
      className={cn(
        'flex h-full flex-col p-5 transition',
        active && 'border-brand-400/45 shadow-glow',
      )}
      lit={active}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-xl border',
            isBaseline
              ? 'border-ok/30 bg-ok/10 text-ok'
              : 'border-bad/30 bg-bad/10 text-bad',
          )}
        >
          {isBaseline ? (
            <ShieldCheck className="size-4" aria-hidden />
          ) : (
            <ShieldAlert className="size-4" aria-hidden />
          )}
        </span>
        <SeverityBadge severity={scenario.severity} />
      </div>

      <h3 className="mt-3.5 text-[14px] font-semibold text-ink-100">
        {scenario.label}
      </h3>
      <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-ink-500">
        {scenario.description}
      </p>

      <dl className="mt-3.5 flex items-center gap-4 border-t border-white/[0.05] pt-3">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.1em] text-ink-500">
            Expected detection
          </dt>
          <dd className="tabular mt-0.5 text-[13px] font-medium text-ink-100">
            {scenario.expectedDetectionMs === 0
              ? 'n/a'
              : `${(scenario.expectedDetectionMs / 1000).toFixed(1)}s`}
          </dd>
        </div>
      </dl>

      <Button
        variant={active ? 'subtle' : 'primary'}
        size="sm"
        className="mt-4 w-full"
        disabled={running}
        loading={running && active}
        icon={!running ? <Radar className="size-3.5" /> : undefined}
        onClick={onLaunch}
      >
        {running && active ? 'Running…' : active ? 'Run again' : 'Launch scenario'}
      </Button>
    </GlassCard>
  )
}

/* ==========================================================================
   Run log
   ========================================================================== */

function RunLogEntry({
  step,
  index,
  startedAt,
}: {
  step: SimulationStep
  index: number
  startedAt: string
}) {
  const Icon = PHASE_ICON[step.phase]
  const at = new Date(new Date(startedAt).getTime() + step.atOffsetMs).toISOString()

  return (
    <motion.li
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className="relative pl-11"
    >
      <span
        className="absolute left-1.5 top-2.5 grid size-7 place-items-center rounded-lg border"
        style={{
          borderColor: `${severityHex[step.severity]}55`,
          background: `${severityHex[step.severity]}18`,
          color: severityHex[step.severity],
        }}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>

      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-500">
              {step.phase}
            </span>
            <span className="text-[13px] font-medium text-ink-100">
              {step.label}
            </span>
          </div>
          <span className="tabular font-mono text-[11px] text-ink-500">
            +{(step.atOffsetMs / 1000).toFixed(1)}s · {formatClock(at)}
          </span>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-300">
          {step.detail}
        </p>
      </div>

      <span className="sr-only">Step {index + 1}</span>
    </motion.li>
  )
}

/* ==========================================================================
   Phase rail
   ========================================================================== */

function PhaseRail({ reached }: { reached: Set<SimulationPhase> }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {PHASE_ORDER.map((phase, i) => {
        const done = reached.has(phase)
        const Icon = PHASE_ICON[phase]
        return (
          <li key={phase} className="flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-300',
                done
                  ? 'border-brand-400/40 bg-brand-500/15 text-brand-200'
                  : 'border-white/[0.06] bg-white/[0.02] text-ink-700',
              )}
            >
              <Icon className="size-3" aria-hidden />
              {phase}
            </span>
            {i < PHASE_ORDER.length - 1 && (
              <span
                className={cn(
                  'h-px w-3 transition-colors duration-300',
                  done ? 'bg-brand-400/50' : 'bg-white/[0.08]',
                )}
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

/* ==========================================================================
   Page
   ========================================================================== */

export default function ThreatDetection() {
  const { simulation, startSimulation, resetSimulation, devices } = useAppState()

  const running = simulation.status === 'running'
  const result = simulation.result

  const reachedPhases = useMemo(
    () => new Set(simulation.emitted.map((s) => s.phase)),
    [simulation.emitted],
  )

  const affected = useMemo(
    () =>
      result
        ? devices.filter((d) => result.affectedDeviceIds.includes(d.id))
        : [],
    [devices, result],
  )

  // Keep the newest log entry in view while a run is playing.
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (running && logRef.current) {
      logRef.current.scrollTo({
        top: logRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [simulation.emitted.length, running])

  const metrics = result?.metrics

  return (
    <div className="space-y-6">
      <PageHeader
        title="Threat Detection"
        subtitle="Launch an attack scenario against the modelled estate and watch detection, verification, isolation and recovery unfold"
        icon={<Radar className="size-5" aria-hidden />}
        action={
          <div className="flex items-center gap-2">
            {result && <SourceBadge source={simulation.source} />}
            <Button
              variant="outline"
              size="sm"
              icon={<RotateCcw className="size-3.5" />}
              onClick={resetSimulation}
              disabled={simulation.status === 'idle'}
            >
              Reset
            </Button>
          </div>
        }
      />

      {/* ---- Scenario picker -------------------------------------------------- */}
      <section>
        <SectionTitle
          title="Scenarios"
          subtitle="Five scripted runs — one baseline and four attacks"
          icon={<Target className="size-[18px]" aria-hidden />}
          className="mb-4"
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {SCENARIOS.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              active={simulation.scenario === scenario.id}
              running={running}
              onLaunch={() => startSimulation(scenario.id)}
            />
          ))}
        </div>
      </section>

      {/* ---- Progress --------------------------------------------------------- */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <GlassCard className="p-5" lit>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-semibold text-ink-100">
                      {result.scenarioLabel}
                    </h2>
                    <SeverityBadge severity={result.severity} />
                    {running && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-warn">
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                        Executing
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-ink-300">
                    {simulation.status === 'complete'
                      ? result.outcome
                      : 'Run in progress — the estate, the Petri net and the verification results are updating as each phase fires.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <LiveDot active={running} />
                  <span className="tabular text-sm font-semibold text-ink-100">
                    {Math.round(simulation.progress)}%
                  </span>
                </div>
              </div>

              {/* Progress meter */}
              <div
                className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-navy-600/60"
                role="progressbar"
                aria-valuenow={Math.round(simulation.progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Simulation progress"
              >
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    result.outcomeLevel === 'clean'
                      ? 'bg-ok'
                      : result.outcomeLevel === 'contained'
                        ? 'bg-brand-400'
                        : 'bg-warn',
                  )}
                  animate={{ width: `${simulation.progress}%` }}
                  transition={{ duration: 0.2, ease: 'linear' }}
                />
              </div>

              <div className="mt-4">
                <PhaseRail reached={reachedPhases} />
              </div>
            </GlassCard>

            {/* ---- Metrics ------------------------------------------------------ */}
            {metrics && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                {[
                  {
                    label: 'Events processed',
                    value: metrics.eventsProcessed,
                    icon: Activity,
                    tone: 'default' as const,
                  },
                  {
                    label: 'Threats detected',
                    value: metrics.threatsDetected,
                    icon: Crosshair,
                    tone:
                      metrics.threatsDetected > 0
                        ? ('bad' as const)
                        : ('good' as const),
                  },
                  {
                    label: 'Detection accuracy',
                    value: metrics.detectionAccuracy,
                    suffix: '%',
                    decimals: 1,
                    icon: Gauge,
                    tone: 'good' as const,
                  },
                  {
                    label: 'Devices isolated',
                    value: metrics.devicesIsolated,
                    icon: CircleSlash,
                    tone: 'warn' as const,
                  },
                  {
                    label: 'Detection latency',
                    value: metrics.detectionLatencyMs / 1000,
                    suffix: 's',
                    decimals: 1,
                    icon: Zap,
                    tone: 'default' as const,
                  },
                  {
                    label: 'Properties violated',
                    value: metrics.propertiesViolated,
                    icon: ShieldAlert,
                    tone:
                      metrics.propertiesViolated > 0
                        ? ('bad' as const)
                        : ('good' as const),
                  },
                ].map((m) => (
                  <GlassCard key={m.label} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="eyebrow">{m.label}</p>
                      <m.icon
                        className={cn(
                          'size-3.5 shrink-0',
                          m.tone === 'bad'
                            ? 'text-bad'
                            : m.tone === 'good'
                              ? 'text-ok'
                              : m.tone === 'warn'
                                ? 'text-warn'
                                : 'text-brand-300',
                        )}
                        aria-hidden
                      />
                    </div>
                    <AnimatedNumber
                      value={m.value}
                      suffix={m.suffix ?? ''}
                      decimals={m.decimals ?? 0}
                      className="mt-2 block text-xl font-semibold text-ink-100"
                    />
                  </GlassCard>
                ))}
              </div>
            )}

            {/* ---- Run log + side panel ----------------------------------------- */}
            <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
              <GlassCard className="flex flex-col p-5" lit>
                <SectionTitle
                  title="Run log"
                  subtitle={`${simulation.emitted.length} of ${result.steps.length} phases emitted`}
                  icon={<Activity className="size-[18px]" aria-hidden />}
                  action={
                    <div className="flex items-center gap-2">
                      <LiveDot active={running} />
                      <span className="text-[11px] text-ink-500">
                        {running ? 'Streaming' : 'Complete'}
                      </span>
                    </div>
                  }
                />

                <div
                  ref={logRef}
                  className="relative mt-5 max-h-[520px] overflow-y-auto pr-1"
                >
                  {simulation.emitted.length > 0 && (
                    <span
                      className="absolute bottom-4 left-[21px] top-4 w-px bg-gradient-to-b from-transparent via-navy-600 to-transparent"
                      aria-hidden
                    />
                  )}
                  <ul className="space-y-2.5">
                    <AnimatePresence initial={false}>
                      {simulation.emitted.map((step, i) => (
                        <RunLogEntry
                          key={step.id}
                          step={step}
                          index={i}
                          startedAt={result.startedAt}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>

                  {simulation.emitted.length === 0 && (
                    <p className="py-8 text-center text-xs text-ink-500">
                      Waiting for the first phase…
                    </p>
                  )}
                </div>
              </GlassCard>

              <div className="space-y-4">
                {/* Outcome */}
                {simulation.status === 'complete' && (
                  <GlassCard
                    className={cn(
                      'p-5',
                      result.outcomeLevel === 'clean'
                        ? 'border-ok/30'
                        : result.outcomeLevel === 'contained'
                          ? 'border-brand-400/30'
                          : 'border-warn/30',
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      {result.outcomeLevel === 'clean' ? (
                        <CheckCircle2 className="size-4 text-ok" aria-hidden />
                      ) : result.outcomeLevel === 'contained' ? (
                        <ShieldCheck className="size-4 text-brand-300" aria-hidden />
                      ) : (
                        <TriangleAlert className="size-4 text-warn" aria-hidden />
                      )}
                      <h3 className="text-[13px] font-semibold text-ink-100">
                        {result.outcomeLevel === 'clean'
                          ? 'Baseline clean'
                          : result.outcomeLevel === 'contained'
                            ? 'Threat contained'
                            : 'Partial containment'}
                      </h3>
                    </div>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-ink-300">
                      {result.outcome}
                    </p>
                  </GlassCard>
                )}

                {/* Affected devices */}
                {affected.length > 0 && (
                  <GlassCard className="p-5">
                    <SectionTitle
                      title="Affected devices"
                      subtitle={`${affected.length} endpoint${affected.length === 1 ? '' : 's'} touched by this run`}
                      icon={<Siren className="size-[18px]" aria-hidden />}
                    />
                    <ul className="mt-3.5 space-y-2">
                      {affected.map((device) => (
                        <li
                          key={device.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[12px] text-ink-100">
                              {device.name}
                            </p>
                            <p className="truncate text-[10.5px] text-ink-500">
                              {device.ip} · {device.location}
                            </p>
                          </div>
                          <span
                            className="shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              borderColor: `${severityHex[device.risk]}55`,
                              background: `${severityHex[device.risk]}18`,
                              color: severityHex[device.risk],
                            }}
                          >
                            {device.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/devices"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-300 transition hover:text-brand-200"
                    >
                      Open the inventory
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </Link>
                  </GlassCard>
                )}

                {/* Downstream links */}
                <GlassCard className="p-5">
                  <SectionTitle
                    title="Follow this run"
                    subtitle="Where the effects landed"
                    icon={<GitBranch className="size-[18px]" aria-hidden />}
                  />
                  <ul className="mt-3.5 space-y-2">
                    {[
                      {
                        to: '/petri-net',
                        label: 'Coloured Petri Net',
                        detail: 'Tokens injected by this run',
                        ready: reachedPhases.size > 0,
                      },
                      {
                        to: '/verification',
                        label: 'Formal Verification',
                        detail: `${metrics?.propertiesViolated ?? 0} propert${
                          (metrics?.propertiesViolated ?? 0) === 1 ? 'y' : 'ies'
                        } violated`,
                        ready: reachedPhases.has('Verification'),
                      },
                      {
                        to: '/resilience',
                        label: 'Resilience Center',
                        detail: 'Containment and recovery posture',
                        ready: reachedPhases.has('Isolation'),
                      },
                      {
                        to: '/alerts',
                        label: 'Security Alerts',
                        detail: `${result.alerts.length} alert${result.alerts.length === 1 ? '' : 's'} raised`,
                        ready: reachedPhases.has('Detection'),
                      },
                    ].map((link) => (
                      <li key={link.to}>
                        <Link
                          to={link.to}
                          className={cn(
                            'flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition',
                            link.ready
                              ? 'border-white/[0.07] bg-white/[0.025] hover:border-brand-400/35 hover:bg-brand-500/[0.08]'
                              : 'border-white/[0.04] bg-white/[0.01] opacity-55',
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[12.5px] font-medium text-ink-100">
                              {link.label}
                            </span>
                            <span className="block truncate text-[10.5px] text-ink-500">
                              {link.ready ? link.detail : 'Awaiting this phase'}
                            </span>
                          </span>
                          <ArrowUpRight
                            className="size-3.5 shrink-0 text-ink-500"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Idle state -------------------------------------------------------- */}
      {!result && (
        <GlassCard className="p-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-brand-400/25 bg-brand-500/10 text-brand-300">
            <Radar className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 text-base font-semibold text-ink-100">
            No scenario running
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-ink-500">
            Pick a scenario above to start. The run drives the whole console:
            device status changes, alerts are raised, tokens move through the
            Coloured Petri Net, the verification verdicts are recomputed against
            the reached marking, and the resilience posture updates in step.
          </p>
        </GlassCard>
      )}
    </div>
  )
}
