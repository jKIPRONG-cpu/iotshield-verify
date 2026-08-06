/**
 * Network Activity.
 *
 * A live-feeling event timeline over the device estate. The underlying dataset
 * is fixed; the "live" behaviour comes from revealing events on a timer and
 * pushing them in at the head of the list, which is what a streaming SIEM view
 * looks like without pretending to capture real traffic.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  ArrowDownUp,
  Cloud,
  Download,
  FileWarning,
  Fingerprint,
  Pause,
  Play,
  Power,
  RadioTower,
  RefreshCw,
  ScanLine,
  Server,
  Upload,
} from 'lucide-react'
import { api } from '@/api/client'
import { useResource } from '@/hooks/useResource'
import { useAppState } from '@/context/AppState'
import { mock } from '@/data/mock'
import type { EventKind, EventVerdict, NetworkEvent } from '@/types'
import {
  Button,
  EmptyState,
  GlassCard,
  LiveDot,
  PageHeader,
  SearchInput,
  SectionTitle,
  Select,
  Skeleton,
  SourceBadge,
  StatTile,
  Tabs,
  VerdictBadge,
} from '@/components/ui'
import {
  cn,
  formatBytes,
  formatClock,
  matchesQuery,
  severityHex,
  timeAgo,
} from '@/lib/utils'

/* ==========================================================================
   Event presentation
   ========================================================================== */

const KIND_ICON: Record<EventKind, typeof Activity> = {
  'Device Boot': Power,
  Authentication: Fingerprint,
  'Firmware Update': Download,
  'Telemetry Sync': Cloud,
  'DNS Query': Server,
  'Port Scan': ScanLine,
  'Suspicious Login': FileWarning,
  'Malware Download': Download,
  'Command & Control': RadioTower,
  'Data Exfiltration': Upload,
}

const VERDICT_RING: Record<EventVerdict, string> = {
  Benign: 'border-ok/25 bg-ok/[0.08] text-ok',
  Suspicious: 'border-warn/30 bg-warn/10 text-warn',
  Malicious: 'border-bad/35 bg-bad/12 text-bad',
}

/** One row on the timeline rail. */
function EventRow({ event, index }: { event: NetworkEvent; index: number }) {
  const Icon = KIND_ICON[event.kind] ?? Activity

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.34,
        ease: [0.22, 1, 0.36, 1],
        delay: Math.min(index * 0.012, 0.2),
      }}
      className="relative pl-11"
    >
      {/* Rail marker */}
      <span
        className={cn(
          'absolute left-2 top-3 grid size-7 place-items-center rounded-lg border',
          VERDICT_RING[event.verdict],
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>

      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 transition hover:border-white/10 hover:bg-white/[0.04]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-[13px] font-medium text-ink-100">{event.kind}</p>
          <div className="flex items-center gap-2">
            <VerdictBadge verdict={event.verdict} />
            <time
              className="tabular font-mono text-[11px] text-ink-500"
              dateTime={event.timestamp}
              title={new Date(event.timestamp).toLocaleString('en-GB')}
            >
              {formatClock(event.timestamp)}
            </time>
          </div>
        </div>

        <p className="mt-1 text-xs leading-relaxed text-ink-300">{event.detail}</p>

        <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] text-ink-500">
          <div className="flex items-center gap-1">
            <dt className="sr-only">Device</dt>
            <dd className="text-ink-300">{event.deviceName}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Flow</dt>
            <dd>
              {event.sourceIp}
              <ArrowDownUp className="mx-1 inline size-2.5 -rotate-90" aria-hidden />
              {event.destIp}
              {event.destPort > 0 && `:${event.destPort}`}
            </dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="sr-only">Protocol</dt>
            <dd>{event.protocol}</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="sr-only">Volume</dt>
            <dd>{formatBytes(event.bytes)}</dd>
          </div>
        </dl>
      </div>
    </motion.li>
  )
}

/* ==========================================================================
   Volume strip
   --------------------------------------------------------------------------
   A compact density plot: one bar per hour of the last 24, coloured by the
   worst verdict seen in that hour. Deliberately not a full chart — it is an
   orientation device above the timeline, not something anyone reads values off.
   ========================================================================== */

function VolumeStrip({ events }: { events: NetworkEvent[] }) {
  const buckets = useMemo(() => {
    const now = Date.now()
    const slots = Array.from({ length: 24 }, () => ({
      total: 0,
      malicious: 0,
      suspicious: 0,
    }))

    for (const e of events) {
      const hoursAgo = Math.floor((now - new Date(e.timestamp).getTime()) / 3_600_000)
      if (hoursAgo < 0 || hoursAgo > 23) continue
      const slot = slots[23 - hoursAgo]
      slot.total++
      if (e.verdict === 'Malicious') slot.malicious++
      else if (e.verdict === 'Suspicious') slot.suspicious++
    }
    return slots
  }, [events])

  const peak = Math.max(...buckets.map((b) => b.total), 1)

  return (
    <div>
      <div className="flex h-16 items-end gap-[3px]">
        {buckets.map((b, i) => {
          const tone =
            b.malicious > 0
              ? severityHex.Critical
              : b.suspicious > 0
                ? severityHex.Medium
                : '#2E90FA'
          return (
            <div
              key={i}
              className="group relative flex-1"
              title={`${24 - i}h ago · ${b.total} events, ${b.malicious} malicious`}
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max((b.total / peak) * 100, 4)}%` }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.014,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="w-full rounded-t-[3px] opacity-85 transition group-hover:opacity-100"
                style={{ background: tone, minHeight: 3 }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-ink-700">
        <span>24h ago</span>
        <span>12h</span>
        <span>now</span>
      </div>
    </div>
  )
}

/* ==========================================================================
   Page
   ========================================================================== */

type FeedMode = 'live' | 'all'

/** How many events the live feed starts with before it begins streaming. */
const LIVE_SEED = 12
const STREAM_INTERVAL_MS = 2600

export default function NetworkActivity() {
  const { settings, simulation } = useAppState()
  const eventsRes = useResource<NetworkEvent[]>(
    (signal) => api.events({ limit: 500 }, signal),
    mock.events,
  )

  const [mode, setMode] = useState<FeedMode>('live')
  const [query, setQuery] = useState('')
  const [verdict, setVerdict] = useState('all')
  const [paused, setPaused] = useState(false)
  const [revealed, setRevealed] = useState(LIVE_SEED)

  const all = eventsRes.data

  /** Filtered pool the feed draws from. */
  const pool = useMemo(
    () =>
      all.filter((e) => {
        if (verdict !== 'all' && e.verdict !== verdict) return false
        return matchesQuery(
          query,
          e.kind,
          e.deviceName,
          e.detail,
          e.sourceIp,
          e.destIp,
          e.protocol,
        )
      }),
    [all, query, verdict],
  )

  // Reset the reveal window whenever the filter changes, so switching to
  // "Malicious only" does not show a near-empty feed.
  useEffect(() => setRevealed(LIVE_SEED), [query, verdict, mode])

  /** Streaming: reveal one more event on each tick. */
  const timerRef = useRef<number | null>(null)
  const streaming =
    mode === 'live' && !paused && settings.liveEventStream && pool.length > 0

  useEffect(() => {
    if (!streaming) {
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
      return
    }

    timerRef.current = window.setInterval(() => {
      setRevealed((n) => (n >= pool.length ? LIVE_SEED : n + 1))
    }, STREAM_INTERVAL_MS)

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [streaming, pool.length])

  const visible = useMemo(
    () => (mode === 'live' ? pool.slice(0, revealed) : pool.slice(0, 120)),
    [pool, revealed, mode],
  )

  const stats = useMemo(() => {
    const malicious = all.filter((e) => e.verdict === 'Malicious').length
    const suspicious = all.filter((e) => e.verdict === 'Suspicious').length
    const volume = all.reduce((sum, e) => sum + e.bytes, 0)
    return { total: all.length, malicious, suspicious, volume }
  }, [all])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Network Activity"
        subtitle="Event stream across the managed estate — boots, authentications, scans, payload retrievals and C2 traffic"
        icon={<Activity className="size-5" aria-hidden />}
        action={<SourceBadge source={eventsRes.source} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Events observed"
          value={stats.total}
          icon={<Activity className="size-4" aria-hidden />}
          hint="Rolling 24-hour window"
        />
        <StatTile
          label="Malicious"
          value={stats.malicious}
          icon={<RadioTower className="size-4" aria-hidden />}
          tone="bad"
          hint="Payload retrieval, C2 and exfiltration"
        />
        <StatTile
          label="Suspicious"
          value={stats.suspicious}
          icon={<ScanLine className="size-4" aria-hidden />}
          tone="warn"
          hint="Scans and anomalous authentication"
        />
        <StatTile
          label="Volume observed"
          value={Math.round(stats.volume / 1_048_576)}
          suffix=" MB"
          icon={<ArrowDownUp className="size-4" aria-hidden />}
          hint="Aggregate across all flows"
        />
      </div>

      <GlassCard className="p-5" lit>
        <SectionTitle
          title="Event density"
          subtitle="Hourly volume, coloured by the most severe verdict in each hour"
          icon={<Activity className="size-[18px]" aria-hidden />}
        />
        <div className="mt-4">
          {eventsRes.source === 'loading' ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <VolumeStrip events={all} />
          )}
        </div>
      </GlassCard>

      {/* ---- Feed controls --------------------------------------------------- */}
      <GlassCard className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery('')}
            placeholder="Search events by kind, device, address or detail…"
            containerClassName="flex-1"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={verdict}
              onChange={setVerdict}
              label="Filter by verdict"
              className="w-40"
              options={[
                { value: 'all', label: 'All verdicts' },
                { value: 'Malicious', label: 'Malicious' },
                { value: 'Suspicious', label: 'Suspicious' },
                { value: 'Benign', label: 'Benign' },
              ]}
            />
            <Tabs
              value={mode}
              onChange={setMode}
              options={[
                { value: 'live', label: 'Live feed' },
                { value: 'all', label: 'Full log' },
              ]}
            />
            {mode === 'live' && (
              <Button
                variant={paused ? 'primary' : 'subtle'}
                size="sm"
                icon={
                  paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />
                }
                onClick={() => setPaused((p) => !p)}
              >
                {paused ? 'Resume' : 'Pause'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw className="size-3.5" />}
              onClick={() => {
                setRevealed(LIVE_SEED)
                eventsRes.reload()
              }}
            >
              Refresh
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ---- Timeline --------------------------------------------------------- */}
      <GlassCard className="p-5" lit>
        <SectionTitle
          title={mode === 'live' ? 'Live event timeline' : 'Event log'}
          subtitle={
            mode === 'live'
              ? 'Newest events arrive at the top'
              : `Showing the ${Math.min(pool.length, 120)} most recent of ${pool.length} matching events`
          }
          icon={<Activity className="size-[18px]" aria-hidden />}
          action={
            <div className="flex items-center gap-2">
              <LiveDot active={streaming} />
              <span className="text-[11px] text-ink-500">
                {simulation.status === 'running'
                  ? 'Simulation active'
                  : streaming
                    ? 'Streaming'
                    : 'Paused'}
              </span>
            </div>
          }
        />

        <div className="relative mt-5">
          {/* Vertical rail behind the markers. */}
          {visible.length > 0 && (
            <span
              className="absolute bottom-4 left-[21px] top-4 w-px bg-gradient-to-b from-transparent via-navy-600 to-transparent"
              aria-hidden
            />
          )}

          {eventsRes.source === 'loading' ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-[86px] w-full rounded-xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Activity className="size-5" aria-hidden />}
              title="No events match this filter"
              message="Widen the verdict filter or clear the search term to see traffic again."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery('')
                    setVerdict('all')
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2.5">
              <AnimatePresence initial={false}>
                {visible.map((event, i) => (
                  <EventRow key={event.id} event={event} index={i} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {mode === 'live' && visible.length > 0 && (
          <p className="mt-4 border-t border-white/[0.05] pt-3 text-[11px] text-ink-700">
            Showing {visible.length} of {pool.length} matching events · oldest
            visible {timeAgo(visible[visible.length - 1].timestamp)}
          </p>
        )}
      </GlassCard>
    </div>
  )
}
