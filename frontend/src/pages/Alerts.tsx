/**
 * Security Alerts.
 *
 * The triage queue: filtering, free-text search, sorting, and an expandable
 * row that carries the analyst-facing detail — MITRE mapping, description and
 * the recommended action.
 *
 * Alerts raised by a running simulation are prepended to this feed by
 * AppState, so a scenario visibly lands here while it is still playing.
 */

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronRight,
  CircleSlash,
  Crosshair,
  Filter,
  Gauge,
  ListFilter,
  Search as SearchIcon,
  ShieldCheck,
  Siren,
  Wrench,
} from 'lucide-react'
import { useAppState } from '@/context/AppState'
import type { Alert, AlertStatus, Severity } from '@/types'
import {
  AlertStatusBadge,
  Button,
  EmptyState,
  GlassCard,
  PageHeader,
  SearchInput,
  SectionTitle,
  Select,
  SeverityBadge,
  SkeletonTable,
  SourceBadge,
  StatTile,
} from '@/components/ui'
import {
  cn,
  formatStamp,
  matchesQuery,
  SEVERITY_ORDER,
  SEVERITY_RANK,
  severityHex,
  timeAgo,
} from '@/lib/utils'

/* ==========================================================================
   Sorting
   ========================================================================== */

type SortKey = 'severity' | 'newest' | 'oldest' | 'confidence' | 'device'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'severity', label: 'Sort: severity' },
  { value: 'newest', label: 'Sort: newest first' },
  { value: 'oldest', label: 'Sort: oldest first' },
  { value: 'confidence', label: 'Sort: confidence' },
  { value: 'device', label: 'Sort: device' },
]

function sortAlerts(alerts: Alert[], key: SortKey): Alert[] {
  const sorted = [...alerts]
  switch (key) {
    case 'severity':
      return sorted.sort(
        (a, b) =>
          SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
          b.timestamp.localeCompare(a.timestamp),
      )
    case 'newest':
      return sorted.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    case 'oldest':
      return sorted.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    case 'confidence':
      return sorted.sort((a, b) => b.confidence - a.confidence)
    case 'device':
      return sorted.sort((a, b) => a.deviceName.localeCompare(b.deviceName))
  }
}

/* ==========================================================================
   Row
   ========================================================================== */

function AlertRow({
  alert,
  expanded,
  onToggle,
  index,
}: {
  alert: Alert
  expanded: boolean
  onToggle: () => void
  index: number
}) {
  const isOpen = alert.status === 'Open'

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.015, 0.25), duration: 0.28 }}
      className={cn(
        'overflow-hidden rounded-xl border transition',
        expanded
          ? 'border-brand-400/30 bg-white/[0.045]'
          : 'border-white/[0.05] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.035]',
      )}
    >
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        {/* Severity rail — colour plus the badge below, never colour alone. */}
        <span
          className={cn('mt-1 h-9 w-1 shrink-0 rounded-full', isOpen && 'animate-pulse')}
          style={{ background: severityHex[alert.severity] }}
          aria-hidden
        />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-[13px] font-medium text-ink-100">
              {alert.threat}
            </span>
            <span
              className="tabular shrink-0 text-[11px] text-ink-500"
              title={formatStamp(alert.timestamp)}
            >
              {timeAgo(alert.timestamp)}
            </span>
          </span>

          <span className="mt-1.5 flex flex-wrap items-center gap-2">
            <SeverityBadge severity={alert.severity} />
            <AlertStatusBadge status={alert.status} />
            <span className="font-mono text-[11px] text-ink-500">
              {alert.deviceName}
            </span>
            {alert.malwareFamily && (
              <span className="rounded-md border border-violet-400/25 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
                {alert.malwareFamily}
              </span>
            )}
            <span className="tabular ml-auto text-[11px] text-ink-500">
              {alert.confidence}% confidence
            </span>
          </span>
        </span>

        <ChevronRight
          className={cn(
            'mt-1 size-4 shrink-0 text-ink-500 transition-transform duration-200',
            expanded && 'rotate-90',
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="space-y-4 border-t border-white/[0.06] px-4 py-4">
              <p className="text-[13px] leading-relaxed text-ink-300">
                {alert.description}
              </p>

              <div className="rounded-xl border border-brand-400/25 bg-brand-500/[0.08] p-3.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-300">
                  <Wrench className="size-3.5" aria-hidden />
                  Recommended action
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-200">
                  {alert.action}
                </p>
              </div>

              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Alert ID', value: alert.id, mono: true },
                  { label: 'Source address', value: alert.sourceIp, mono: true },
                  { label: 'MITRE tactic', value: alert.mitreTactic },
                  { label: 'Technique', value: alert.mitreTechnique },
                ].map((d) => (
                  <div key={d.label} className="glass-sunken px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-[0.1em] text-ink-500">
                      {d.label}
                    </dt>
                    <dd
                      className={cn(
                        'mt-1 break-words text-[12px] text-ink-100',
                        d.mono && 'font-mono',
                      )}
                    >
                      {d.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="tabular text-[11px] text-ink-700">
                Raised {formatStamp(alert.timestamp)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

/* ==========================================================================
   Page
   ========================================================================== */

const PAGE_SIZE = 25

export default function Alerts() {
  const { alerts, alertsSource, alertsLoading } = useAppState()

  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState<SortKey>('severity')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    const result = alerts.filter((a) => {
      if (severity !== 'all' && a.severity !== severity) return false
      if (status !== 'all' && a.status !== status) return false
      return matchesQuery(
        query,
        a.threat,
        a.deviceName,
        a.description,
        a.mitreTactic,
        a.mitreTechnique,
        a.malwareFamily,
        a.sourceIp,
        a.id,
      )
    })
    return sortAlerts(result, sort)
  }, [alerts, query, severity, status, sort])

  const counts = useMemo(() => {
    const bySeverity: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    for (const a of alerts) {
      bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
    }
    return { bySeverity, byStatus }
  }, [alerts])

  const active = (counts.byStatus.Open ?? 0) + (counts.byStatus.Investigating ?? 0)
  const meanConfidence = useMemo(
    () =>
      alerts.length === 0
        ? 0
        : Math.round(alerts.reduce((s, a) => s + a.confidence, 0) / alerts.length),
    [alerts],
  )

  const visible = filtered.slice(0, limit)
  const hasFilters = query !== '' || severity !== 'all' || status !== 'all'

  const clearAll = () => {
    setQuery('')
    setSeverity('all')
    setStatus('all')
    setLimit(PAGE_SIZE)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Alerts"
        subtitle="Triage queue across the modelled estate, with MITRE ATT&CK mapping and recommended response"
        icon={<Siren className="size-5" aria-hidden />}
        action={<SourceBadge source={alertsSource} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total alerts"
          value={alerts.length}
          icon={<Siren className="size-4" aria-hidden />}
          hint="Rolling 72-hour window"
        />
        <StatTile
          label="Requiring attention"
          value={active}
          icon={<Crosshair className="size-4" aria-hidden />}
          tone={active > 0 ? 'warn' : 'good'}
          hint="Open and under investigation"
        />
        <StatTile
          label="Critical severity"
          value={counts.bySeverity.Critical ?? 0}
          icon={<Siren className="size-4" aria-hidden />}
          tone={(counts.bySeverity.Critical ?? 0) > 0 ? 'bad' : 'good'}
          hint="Immediate response required"
        />
        <StatTile
          label="Mean confidence"
          value={meanConfidence}
          suffix="%"
          icon={<Gauge className="size-4" aria-hidden />}
          hint="Across all detectors"
        />
      </div>

      {/* ---- Severity quick filters ---------------------------------------- */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSeverity('all')}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition',
            severity === 'all'
              ? 'border-brand-400/45 bg-brand-500/15 text-ink-100'
              : 'border-white/8 bg-white/[0.03] text-ink-300 hover:border-white/15 hover:text-ink-100',
          )}
        >
          <ListFilter className="size-3.5" aria-hidden />
          All severities
          <span className="tabular text-ink-500">{alerts.length}</span>
        </button>
        {SEVERITY_ORDER.map((s: Severity) => (
          <button
            key={s}
            onClick={() => setSeverity(s)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition',
              severity === s
                ? 'border-brand-400/45 bg-brand-500/15 text-ink-100'
                : 'border-white/8 bg-white/[0.03] text-ink-300 hover:border-white/15 hover:text-ink-100',
            )}
          >
            <span
              className="size-2 rounded-full"
              style={{ background: severityHex[s] }}
              aria-hidden
            />
            {s}
            <span className="tabular text-ink-500">{counts.bySeverity[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* ---- Search + sort --------------------------------------------------- */}
      <GlassCard className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE_SIZE)
            }}
            onClear={() => setQuery('')}
            placeholder="Search by threat, device, technique, family or address…"
            containerClassName="flex-1"
          />
          <div className="flex gap-3">
            <Select
              value={status}
              onChange={(v) => {
                setStatus(v)
                setLimit(PAGE_SIZE)
              }}
              label="Filter by status"
              className="w-44"
              options={[
                { value: 'all', label: 'All statuses' },
                ...(['Open', 'Investigating', 'Contained', 'Resolved'] as AlertStatus[]).map(
                  (s) => ({
                    value: s,
                    label: `${s} (${counts.byStatus[s] ?? 0})`,
                  }),
                ),
              ]}
            />
            <Select
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              label="Sort alerts"
              className="w-48"
              options={SORT_OPTIONS}
            />
          </div>
        </div>

        {hasFilters && (
          <div className="mt-3 flex items-center gap-3 border-t border-white/[0.05] pt-3">
            <p className="flex items-center gap-1.5 text-xs text-ink-500">
              <Filter className="size-3" aria-hidden />
              <span className="tabular text-ink-100">{filtered.length}</span> of{' '}
              {alerts.length} alerts match
            </p>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear filters
            </Button>
          </div>
        )}
      </GlassCard>

      {/* ---- Queue ------------------------------------------------------------ */}
      <GlassCard className="p-5" lit>
        <SectionTitle
          title="Triage queue"
          subtitle={`${filtered.length} alert${filtered.length === 1 ? '' : 's'} matching the current view`}
          icon={<Siren className="size-[18px]" aria-hidden />}
          action={
            filtered.every((a) => a.status === 'Resolved') && filtered.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ok">
                <ShieldCheck className="size-3.5" aria-hidden />
                All resolved
              </span>
            ) : null
          }
        />

        <div className="mt-5">
          {alertsLoading && alertsSource === 'loading' ? (
            <SkeletonTable rows={8} columns={4} />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<SearchIcon className="size-5" aria-hidden />}
              title="No alerts match this view"
              message="Widen the severity or status filter, or clear the search term."
              action={
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <ul className="space-y-2">
                {visible.map((alert, i) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    index={i}
                    expanded={expanded === alert.id}
                    onToggle={() =>
                      setExpanded((cur) => (cur === alert.id ? null : alert.id))
                    }
                  />
                ))}
              </ul>

              {limit < filtered.length && (
                <div className="mt-4 flex justify-center border-t border-white/[0.05] pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<CircleSlash className="size-3.5" />}
                    onClick={() => setLimit((n) => n + PAGE_SIZE)}
                  >
                    Load {Math.min(PAGE_SIZE, filtered.length - limit)} more of{' '}
                    {filtered.length - limit} remaining
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </GlassCard>
    </div>
  )
}
