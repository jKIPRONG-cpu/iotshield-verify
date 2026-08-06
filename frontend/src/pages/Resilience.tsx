/**
 * Resilience Center.
 *
 * What happens after detection: automatic isolation, the recovery workflow,
 * and the posture metrics that describe how well the estate absorbed the
 * incident.
 *
 * The page reads the live simulation's resilience state when one exists and
 * falls back to the standing baseline otherwise, so it is meaningful both
 * during a demonstration run and on a cold open.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CircleSlash,
  Clock,
  Cpu,
  Gauge,
  Hand,
  Loader2,
  Radar,
  RefreshCw,
  ShieldCheck,
  Timer,
  TrendingDown,
  TriangleAlert,
  Workflow,
  XCircle,
} from 'lucide-react'
import { api } from '@/api/client'
import { useResource } from '@/hooks/useResource'
import { useAppState } from '@/context/AppState'
import { mock } from '@/data/mock'
import type { RecoveryStep, RecoveryStepStatus, ResilienceState } from '@/types'
import { ChartCard, TrendLine } from '@/components/charts'
import {
  Button,
  GlassCard,
  PageHeader,
  ProgressRing,
  SectionTitle,
  Skeleton,
  SourceBadge,
  StatTile,
} from '@/components/ui'
import { cn, formatClock, formatDuration } from '@/lib/utils'

/* ==========================================================================
   Recovery workflow
   ========================================================================== */

const STEP_STYLE: Record<
  RecoveryStepStatus,
  { ring: string; icon: typeof CheckCircle2; label: string; tone: string }
> = {
  Complete: {
    ring: 'border-ok/35 bg-ok/12 text-ok',
    icon: CheckCircle2,
    label: 'Complete',
    tone: 'text-ok',
  },
  Active: {
    ring: 'border-brand-400/45 bg-brand-500/15 text-brand-300',
    icon: Loader2,
    label: 'In progress',
    tone: 'text-brand-300',
  },
  Pending: {
    ring: 'border-white/10 bg-white/[0.04] text-ink-500',
    icon: Clock,
    label: 'Pending',
    tone: 'text-ink-500',
  },
  Failed: {
    ring: 'border-bad/35 bg-bad/12 text-bad',
    icon: XCircle,
    label: 'Attention required',
    tone: 'text-bad',
  },
}

function WorkflowStep({ step, index }: { step: RecoveryStep; index: number }) {
  const style = STEP_STYLE[step.status]
  const Icon = style.icon

  return (
    <motion.li
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative pl-12"
    >
      <span
        className={cn(
          'absolute left-2 top-3 grid size-8 place-items-center rounded-xl border',
          style.ring,
        )}
      >
        <Icon
          className={cn('size-4', step.status === 'Active' && 'animate-spin')}
          aria-hidden
        />
      </span>

      <div
        className={cn(
          'rounded-xl border px-4 py-3.5 transition',
          step.status === 'Active'
            ? 'border-brand-400/30 bg-brand-500/[0.07]'
            : step.status === 'Failed'
              ? 'border-bad/25 bg-bad/[0.06]'
              : 'border-white/[0.05] bg-white/[0.02]',
        )}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-[13px] font-semibold text-ink-100">{step.label}</h4>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded border border-white/8 bg-white/[0.04] px-1.5 py-px text-[9.5px] font-medium uppercase tracking-[0.08em]',
                step.automated ? 'text-brand-300' : 'text-warn',
              )}
              title={
                step.automated
                  ? 'Executed automatically by the response engine'
                  : 'Requires an operator decision'
              }
            >
              {step.automated ? (
                <Cpu className="size-2.5" aria-hidden />
              ) : (
                <Hand className="size-2.5" aria-hidden />
              )}
              {step.automated ? 'Automated' : 'Manual'}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className={cn('text-[10.5px] font-medium', style.tone)}>
              {style.label}
            </span>
            {step.at && (
              <span className="tabular font-mono text-[10.5px] text-ink-500">
                {formatClock(step.at)}
              </span>
            )}
          </div>
        </div>

        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-300">
          {step.description}
        </p>

        {step.durationSec > 0 && (
          <p className="tabular mt-1.5 flex items-center gap-1 text-[10.5px] text-ink-700">
            <Timer className="size-3" aria-hidden />
            {formatDuration(step.durationSec)}
          </p>
        )}
      </div>
    </motion.li>
  )
}

/* ==========================================================================
   Page
   ========================================================================== */

export default function Resilience() {
  const { resilienceOverride, simulation, devices } = useAppState()
  const resilienceRes = useResource<ResilienceState>(
    (signal) => api.resilience(signal),
    mock.resilience,
  )

  /** A run in progress takes precedence over the standing baseline. */
  const state = resilienceOverride ?? resilienceRes.data
  const usingRunResults = resilienceOverride !== null

  const completed = state.workflow.filter((s) => s.status === 'Complete').length
  const blocked = state.workflow.filter((s) => s.status === 'Failed').length

  const isolatedNow = useMemo(
    () =>
      devices.filter((d) => d.status === 'Isolated' || d.status === 'Compromised')
        .length,
    [devices],
  )

  const rings = [
    {
      value: state.containment,
      label: 'Containment',
      sublabel: 'Blast radius held',
      color: '#2E90FA',
    },
    {
      value: state.recovery,
      label: 'Recovery',
      sublabel: 'Devices restored',
      color: '#12A88F',
    },
    {
      value: state.riskReduction,
      label: 'Risk reduction',
      sublabel: 'Versus incident peak',
      color: '#8878E6',
    },
    {
      value: state.stability,
      label: 'System stability',
      sublabel: 'Estate-wide score',
      color: state.stability >= 80 ? '#22C55E' : '#F59E0B',
    },
  ]

  if (resilienceRes.source === 'loading') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Resilience Center"
          subtitle="Containment, recovery and stability after detection"
          icon={<Gauge className="size-5" aria-hidden />}
        />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resilience Center"
        subtitle="Automatic isolation, the recovery workflow, and how well the estate absorbed the incident"
        icon={<Gauge className="size-5" aria-hidden />}
        action={
          <div className="flex items-center gap-2">
            <SourceBadge source={resilienceRes.source} />
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="size-3.5" />}
              onClick={resilienceRes.reload}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {usingRunResults && simulation.result && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-start gap-3 rounded-2xl border border-brand-400/30 bg-brand-500/[0.08] px-4 py-3.5"
        >
          <Radar className="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden />
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-300">
            <span className="font-semibold text-ink-100">
              Live posture for the {simulation.result.scenarioLabel} run.
            </span>{' '}
            These figures describe the incident currently playing, not the
            standing baseline.
          </p>
          <Link to="/detection">
            <Button variant="subtle" size="sm">
              View run
            </Button>
          </Link>
        </motion.div>
      )}

      {/* ---- Rings -------------------------------------------------------------- */}
      <GlassCard className="p-6" lit>
        <SectionTitle
          title="Resilience posture"
          subtitle="Four headline ratios describing how the estate handled the incident"
          icon={<ShieldCheck className="size-[18px]" aria-hidden />}
        />
        <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {rings.map((ring) => (
            <ProgressRing
              key={ring.label}
              value={ring.value}
              label={ring.label}
              sublabel={ring.sublabel}
              color={ring.color}
            />
          ))}
        </div>
      </GlassCard>

      {/* ---- Response timings ---------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Mean time to detect"
          value={state.mttdSec}
          suffix="s"
          icon={<Activity className="size-4" aria-hidden />}
          tone={state.mttdSec <= 60 ? 'good' : 'warn'}
          hint="Threat confirmed above threshold"
        />
        <StatTile
          label="Mean time to contain"
          value={state.mttcSec}
          suffix="s"
          icon={<CircleSlash className="size-4" aria-hidden />}
          tone={state.mttcSec <= 180 ? 'good' : 'warn'}
          hint="Quarantine applied at the switch port"
        />
        <StatTile
          label="Mean time to recover"
          value={Math.round(state.mttrSec / 60)}
          suffix=" min"
          icon={<RefreshCw className="size-4" aria-hidden />}
          tone="default"
          hint="Reflash and re-admission complete"
        />
        <StatTile
          label="Devices isolated"
          value={Math.max(state.devicesIsolated, isolatedNow)}
          icon={<CircleSlash className="size-4" aria-hidden />}
          tone={state.devicesIsolated > 0 ? 'warn' : 'good'}
          hint={`${state.devicesRecovered} recovered · ${state.devicesPendingRecovery} pending`}
        />
      </div>

      {/* ---- Workflow + trace ---------------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <GlassCard className="p-5" lit>
          <SectionTitle
            title="Automated recovery workflow"
            subtitle={`${completed} of ${state.workflow.length} stages complete${blocked > 0 ? ` · ${blocked} requiring attention` : ''}`}
            icon={<Workflow className="size-[18px]" aria-hidden />}
            action={
              blocked > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-bad">
                  <TriangleAlert className="size-3.5" aria-hidden />
                  Action required
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ok">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  On track
                </span>
              )
            }
          />

          <div className="relative mt-5">
            <span
              className="absolute bottom-5 left-6 top-5 w-px bg-gradient-to-b from-transparent via-navy-600 to-transparent"
              aria-hidden
            />
            <ul className="space-y-2.5">
              <AnimatePresence initial={false}>
                {state.workflow.map((step, i) => (
                  <WorkflowStep key={step.id} step={step} index={i} />
                ))}
              </AnimatePresence>
            </ul>
          </div>
        </GlassCard>

        <div className="space-y-4">
          <ChartCard
            title="Stability trace"
            subtitle="Stability against residual risk across the incident window"
            icon={<TrendingDown className="size-[18px]" aria-hidden />}
            height={230}
            footnote="Both series are percentages on a shared axis, so a single plot is correct here."
          >
            <TrendLine
              data={
                state.timeline.map((t) => ({
                  date: t.t,
                  stability: t.stability,
                  risk: t.risk,
                })) as unknown as Record<string, unknown>[]
              }
              series={[
                { key: 'stability', label: 'Stability', slot: 2 },
                { key: 'risk', label: 'Residual risk', slot: 1 },
              ]}
              domain={[0, 100]}
              suffix="%"
            />
          </ChartCard>

          <GlassCard className="p-5">
            <SectionTitle
              title="Reading the posture"
              icon={<Gauge className="size-[18px]" aria-hidden />}
            />
            <div className="mt-3.5 space-y-3 text-[12.5px] leading-relaxed text-ink-300">
              <p>
                {state.containment >= 85
                  ? 'Containment is strong. Affected devices reach quarantine quickly and the blast radius stays bounded.'
                  : 'Containment is the weak link here. Where control is peer-to-peer rather than centralised there is no single choke point to close, so isolation must be applied across the whole segment at once — slower, and costlier.'}
              </p>
              <p className="text-ink-500">
                Detection at {state.mttdSec}s and containment at {state.mttcSec}s
                both sit inside the response envelope. The caveat is the one the
                model checker raises: fast containment in these runs is a
                property of the schedules observed, not a guarantee. Until the
                priority guard is added, this resilience is empirical rather than
                proven.
              </p>
            </div>
            <Link
              to="/verification"
              className="mt-4 inline-flex items-center gap-1.5 border-t border-white/[0.05] pt-3 text-xs font-medium text-brand-300 transition hover:text-brand-200"
            >
              See the verification results
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
