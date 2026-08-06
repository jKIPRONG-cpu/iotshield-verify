/**
 * Executive Dashboard.
 *
 * The landing view: fleet posture at a glance, the trends behind it, and the
 * live activity feed. Every figure reacts to a running simulation, so the
 * dashboard is the fastest way to show that the modules form one system rather
 * than twelve independent screens.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  Gauge,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TrendingUp,
  Waves,
} from 'lucide-react'
import { api } from '@/api/client'
import { useResource } from '@/hooks/useResource'
import { useAppState } from '@/context/AppState'
import { mock } from '@/data/mock'
import type { Summary } from '@/types'
import {
  CategoryBar,
  ChartCard,
  DonutChart,
  TrendArea,
  TrendLine,
} from '@/components/charts'
import {
  AnimatedNumber,
  Button,
  GlassCard,
  LiveDot,
  PageHeader,
  SectionTitle,
  SeverityBadge,
  SkeletonCards,
  SourceBadge,
  StatTile,
} from '@/components/ui'
import {
  cn,
  deviceStatusHex,
  formatDuration,
  SERIES,
  severityHex,
  timeAgo,
} from '@/lib/utils'

/* ==========================================================================
   Security score hero
   ========================================================================== */

/**
 * The headline number. Rendered as a hero figure with a supporting arc rather
 * than a chart — a single value with no comparison does not need a plot.
 */
function SecurityScore({
  score,
  verificationRate,
  networkHealth,
  detectionAccuracy,
}: {
  score: number
  verificationRate: number
  networkHealth: number
  detectionAccuracy: number
}) {
  const band =
    score >= 80
      ? { label: 'Strong', tone: 'text-ok', ring: '#22C55E' }
      : score >= 60
        ? { label: 'Moderate', tone: 'text-warn', ring: '#F59E0B' }
        : { label: 'Degraded', tone: 'text-bad', ring: '#F04438' }

  const size = 176
  const stroke = 12
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  const supporting = [
    { label: 'Network health', value: networkHealth, suffix: '%', decimals: 0 },
    {
      label: 'Detection accuracy',
      value: detectionAccuracy,
      suffix: '%',
      decimals: 1,
    },
    {
      label: 'Properties satisfied',
      value: verificationRate,
      suffix: '%',
      decimals: 1,
    },
  ]

  return (
    <GlassCard
      className="flex h-full flex-col gap-6 p-6 sm:flex-row sm:items-center"
      lit
    >
      <div
        className="relative mx-auto shrink-0"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1C2C48"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={band.ring}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
            transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ filter: `drop-shadow(0 0 10px ${band.ring}55)` }}
          />
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <AnimatedNumber
            value={score}
            className="text-[42px] font-semibold leading-none tracking-tight text-ink-100"
          />
          <p className={cn('mt-1.5 text-xs font-semibold', band.tone)}>
            {band.label}
          </p>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="eyebrow">Composite security score</p>
        <h2 className="mt-1.5 text-lg font-semibold text-ink-100">
          Estate posture is {band.label.toLowerCase()}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
          A weighted blend of device health, formal-verification coverage, and
          the share of the fleet currently compromised. Verification carries
          real weight here — a fleet that looks healthy but cannot prove
          containment does not score well.
        </p>

        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          {supporting.map((s) => (
            <div key={s.label} className="glass-sunken px-3 py-2.5">
              <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-500">
                {s.label}
              </dt>
              <dd className="mt-1">
                <AnimatedNumber
                  value={s.value}
                  suffix={s.suffix}
                  decimals={s.decimals}
                  className="text-lg font-semibold text-ink-100"
                />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </GlassCard>
  )
}

/* ==========================================================================
   Activity feed
   ========================================================================== */

function RecentActivity() {
  const { alerts, simulation } = useAppState()
  const recent = useMemo(() => alerts.slice(0, 8), [alerts])
  const streaming = simulation.status === 'running'

  return (
    <GlassCard className="flex h-full flex-col p-5" lit>
      <SectionTitle
        title="Recent activity"
        subtitle="Newest detections across the estate"
        icon={<Waves className="size-[18px]" aria-hidden />}
        action={
          <div className="flex items-center gap-2">
            <LiveDot active={streaming} />
            <span className="text-[11px] text-ink-500">
              {streaming ? 'Streaming' : 'Idle'}
            </span>
          </div>
        }
      />

      {/* The feed scrolls rather than setting the row height. The grid stretches
          both cards to the taller of the two, and `flex-1` alone does not bound
          a list's intrinsic height — so without an explicit cap this feed would
          stretch the row and leave a void beside the security score. */}
      <ul className="mt-4 max-h-[336px] min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {recent.map((alert, i) => (
          <motion.li
            key={alert.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: i * 0.04,
              duration: 0.3,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <Link
              to="/alerts"
              className="flex items-start gap-3 rounded-xl px-2.5 py-2 transition hover:bg-white/[0.04]"
            >
              <span
                className="mt-1.5 size-2 shrink-0 rounded-full"
                style={{ background: severityHex[alert.severity] }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] font-medium text-ink-100">
                    {alert.threat}
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-500">
                    {timeAgo(alert.timestamp)}
                  </span>
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="truncate font-mono text-[11px] text-ink-500">
                    {alert.deviceName}
                  </span>
                  <SeverityBadge severity={alert.severity} />
                </span>
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>

      <Link
        to="/alerts"
        className="mt-3 inline-flex items-center gap-1.5 border-t border-white/[0.05] pt-3 text-xs font-medium text-brand-300 transition hover:text-brand-200"
      >
        Open the triage queue
        <ArrowUpRight className="size-3.5" aria-hidden />
      </Link>
    </GlassCard>
  )
}

/* ==========================================================================
   Page
   ========================================================================== */

export default function Dashboard() {
  const { devices, alerts, simulation, verificationOverride } = useAppState()
  const summaryRes = useResource<Summary>(
    (signal) => api.summary(signal),
    mock.summary,
  )

  /**
   * Counts are derived from the device list rather than read off the summary
   * payload, so a running simulation moves the tiles immediately instead of
   * waiting for the next fetch.
   */
  const live = useMemo(() => {
    const by = (status: string) =>
      devices.filter((d) => d.status === status).length
    const properties = verificationOverride ?? mock.verification.properties
    const passed = properties.filter((p) => p.status === 'Verified').length
    const offline = by('Offline')

    return {
      connected: devices.length - offline,
      healthy: by('Healthy'),
      compromised: by('Compromised'),
      isolated: by('Isolated'),
      recovering: by('Recovering'),
      atRisk: by('At Risk'),
      offline,
      activeThreats: alerts.filter(
        (a) => a.status === 'Open' || a.status === 'Investigating',
      ).length,
      verificationPassed: passed,
      verificationTotal: properties.length,
      verificationRate: Math.round((passed / properties.length) * 1000) / 10,
      networkHealth: Math.round(
        devices.reduce((sum, d) => sum + d.health, 0) /
          Math.max(devices.length, 1),
      ),
    }
  }, [devices, alerts, verificationOverride])

  const securityScore = useMemo(() => {
    const raw =
      live.networkHealth * 0.5 +
      live.verificationRate * 0.25 +
      (100 - (live.compromised / Math.max(devices.length, 1)) * 400) * 0.25
    return Math.max(0, Math.min(100, Math.round(raw)))
  }, [live, devices.length])

  const summary = summaryRes.data

  const deviceHealthData = useMemo(
    () =>
      [
        { name: 'Healthy', value: live.healthy },
        { name: 'At Risk', value: live.atRisk },
        { name: 'Compromised', value: live.compromised },
        { name: 'Isolated', value: live.isolated },
        { name: 'Recovering', value: live.recovering },
        { name: 'Offline', value: live.offline },
      ].filter((d) => d.value > 0),
    [live],
  )

  const deviceHealthColors = useMemo(
    () =>
      deviceHealthData.map(
        (d) => deviceStatusHex[d.name as keyof typeof deviceStatusHex],
      ),
    [deviceHealthData],
  )

  if (summaryRes.source === 'loading') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Executive Dashboard"
          subtitle="Fleet posture, threat activity and formal-verification coverage"
          icon={<BarChart3 className="size-5" aria-hidden />}
        />
        <SkeletonCards count={6} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Dashboard"
        subtitle="Fleet posture, threat activity and formal-verification coverage across the modelled IoT estate"
        icon={<BarChart3 className="size-5" aria-hidden />}
        action={
          <div className="flex items-center gap-2">
            <SourceBadge source={summaryRes.source} />
            <Link to="/detection">
              <Button
                variant="primary"
                size="sm"
                icon={<Radar className="size-4" />}
              >
                Run a scenario
              </Button>
            </Link>
          </div>
        }
      />

      {/* Banner appears only while a scenario is in flight or just finished. */}
      {simulation.status !== 'idle' && simulation.result && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3',
            simulation.status === 'running'
              ? 'border-warn/30 bg-warn/[0.08]'
              : simulation.result.outcomeLevel === 'clean'
                ? 'border-ok/30 bg-ok/[0.08]'
                : 'border-bad/30 bg-bad/[0.08]',
          )}
        >
          <Siren
            className={cn(
              'size-4 shrink-0',
              simulation.status === 'running' ? 'text-warn' : 'text-ink-300',
            )}
            aria-hidden
          />
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-300">
            <span className="font-semibold text-ink-100">
              {simulation.result.scenarioLabel}
            </span>{' '}
            {simulation.status === 'running'
              ? `in progress — ${Math.round(simulation.progress)}% complete`
              : simulation.result.outcome}
          </p>
          <Link to="/detection">
            <Button variant="subtle" size="sm">
              View run
            </Button>
          </Link>
        </motion.div>
      )}

      {/* ---- Headline statistics ------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatTile
          label="Connected devices"
          value={live.connected}
          icon={<Boxes className="size-4" aria-hidden />}
          delta={summary.deltas.devices}
          hint={`${live.offline} offline`}
        />
        <StatTile
          label="Healthy devices"
          value={live.healthy}
          icon={<ShieldCheck className="size-4" aria-hidden />}
          tone="good"
          hint={`${Math.round((live.healthy / Math.max(devices.length, 1)) * 100)}% of the fleet`}
        />
        <StatTile
          label="Compromised"
          value={live.compromised}
          icon={<ShieldAlert className="size-4" aria-hidden />}
          tone={live.compromised > 0 ? 'bad' : 'good'}
          hint={`${live.isolated} isolated · ${live.recovering} recovering`}
        />
        <StatTile
          label="Active threats"
          value={live.activeThreats}
          icon={<Siren className="size-4" aria-hidden />}
          tone={live.activeThreats > 0 ? 'warn' : 'good'}
          delta={summary.deltas.threats}
          invertDelta
          hint="Open and under investigation"
        />
        <StatTile
          label="Verification status"
          value={live.verificationPassed}
          icon={<CheckCircle2 className="size-4" aria-hidden />}
          tone={
            live.verificationPassed === live.verificationTotal ? 'good' : 'warn'
          }
          hint={`${live.verificationPassed} of ${live.verificationTotal} properties satisfied`}
        />
        <StatTile
          label="Network health"
          value={live.networkHealth}
          suffix="%"
          icon={<Gauge className="size-4" aria-hidden />}
          tone={live.networkHealth >= 80 ? 'good' : 'warn'}
          delta={summary.deltas.health}
          hint={`Mean response ${formatDuration(summary.meanResponseSec)}`}
        />
      </div>

      {/* ---- Score + activity ---------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SecurityScore
            score={securityScore}
            verificationRate={live.verificationRate}
            networkHealth={live.networkHealth}
            detectionAccuracy={summary.detectionAccuracy}
          />
        </div>
        <RecentActivity />
      </div>

      {/* ---- Trends --------------------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Threat trend"
          subtitle="Detections, blocks and verified containments over 14 days"
          icon={<TrendingUp className="size-[18px]" aria-hidden />}
          height={268}
          footnote="Verified containments track below blocks throughout: the response succeeds more often than the model can prove it will."
        >
          <TrendArea
            data={summary.threatTrend as unknown as Record<string, unknown>[]}
            series={[
              { key: 'detected', label: 'Detected', slot: 0 },
              { key: 'blocked', label: 'Blocked', slot: 2 },
              { key: 'verified', label: 'Formally verified', slot: 6 },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Device health distribution"
          subtitle="Current status across the managed estate"
          icon={<Boxes className="size-[18px]" aria-hidden />}
          height={268}
          footnote="Status colours are reserved and used nowhere else in the console; every slice is named in the legend."
        >
          <DonutChart
            data={deviceHealthData}
            colors={deviceHealthColors}
            centerValue={devices.length}
            centerLabel="devices"
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Attack distribution"
          subtitle="Share of simulated incidents by class"
          icon={<Radar className="size-[18px]" aria-hidden />}
          height={264}
        >
          <CategoryBar
            data={
              summary.attackDistribution as unknown as Record<string, unknown>[]
            }
            suffix="%"
          />
        </ChartCard>

        <ChartCard
          title="Detection accuracy"
          subtitle="Accuracy, precision and recall"
          icon={<Activity className="size-[18px]" aria-hidden />}
          height={264}
          footnote="All three metrics share one unit and one axis, so they belong on a single plot."
        >
          <TrendLine
            data={summary.accuracyTrend as unknown as Record<string, unknown>[]}
            series={[
              { key: 'accuracy', label: 'Accuracy', slot: 0 },
              { key: 'precision', label: 'Precision', slot: 2 },
              { key: 'recall', label: 'Recall', slot: 4 },
            ]}
            domain={[80, 100]}
            suffix="%"
          />
        </ChartCard>

        <ChartCard
          title="Verification success rate"
          subtitle="Proportion of properties satisfied per run"
          icon={<ShieldCheck className="size-[18px]" aria-hidden />}
          height={264}
          footnote="The rate never reaches 100%: two baseline properties fail by construction, which is precisely the finding under examination."
        >
          <TrendArea
            data={
              summary.verificationTrend as unknown as Record<string, unknown>[]
            }
            series={[{ key: 'rate', label: 'Satisfied', slot: 6 }]}
            suffix="%"
          />
        </ChartCard>
      </div>

      {/* ---- Quick links ---------------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            to: '/petri-net',
            title: 'Coloured Petri Net',
            body: 'Step tokens through the detection and recovery model.',
            color: SERIES[0],
          },
          {
            to: '/verification',
            title: 'Formal Verification',
            body: 'Six CTL and LTL properties with counterexample traces.',
            color: SERIES[6],
          },
          {
            to: '/resilience',
            title: 'Resilience Center',
            body: 'Containment, recovery workflow and stability score.',
            color: SERIES[2],
          },
          {
            to: '/reports',
            title: 'Incident Reports',
            body: 'Executive assessment with PDF export.',
            color: SERIES[3],
          },
        ].map((card) => (
          <Link key={card.to} to={card.to}>
            <GlassCard className="h-full p-4" interactive>
              <span
                className="block h-1 w-9 rounded-full"
                style={{ background: card.color }}
                aria-hidden
              />
              <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink-100">
                {card.title}
                <ArrowUpRight className="size-3.5 text-ink-500" aria-hidden />
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                {card.body}
              </p>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  )
}
