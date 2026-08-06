/**
 * IoT Device Inventory.
 *
 * The asset register: 40 managed endpoints with posture, risk and exposure.
 * Filtering, search and sorting are all client-side over the loaded page so
 * the table stays responsive while a simulation is mutating device state
 * underneath it.
 */

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Boxes,
  ChevronDown,
  Cpu,
  Fingerprint,
  MapPin,
  Network,
  Router,
  ShieldAlert,
  Signal,
  X,
} from 'lucide-react'
import { useAppState } from '@/context/AppState'
import type { Device, DeviceStatus, Severity } from '@/types'
import {
  Button,
  DetailRow,
  EmptyState,
  GlassCard,
  HealthBar,
  PageHeader,
  RiskBadge,
  SearchInput,
  Select,
  SkeletonTable,
  SourceBadge,
  StatusBadge,
} from '@/components/ui'
import {
  cn,
  deviceStatusHex,
  formatDuration,
  matchesQuery,
  SEVERITY_RANK,
  timeAgo,
} from '@/lib/utils'

/* ==========================================================================
   Sorting
   ========================================================================== */

type SortKey = 'name' | 'risk' | 'health' | 'lastActivity' | 'status'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'risk', label: 'Sort: highest risk' },
  { value: 'health', label: 'Sort: lowest health' },
  { value: 'lastActivity', label: 'Sort: most recent' },
  { value: 'name', label: 'Sort: name' },
  { value: 'status', label: 'Sort: status' },
]

const STATUS_ORDER: DeviceStatus[] = [
  'Compromised',
  'Isolated',
  'At Risk',
  'Recovering',
  'Offline',
  'Healthy',
]

function sortDevices(devices: Device[], key: SortKey): Device[] {
  const sorted = [...devices]
  switch (key) {
    case 'risk':
      return sorted.sort(
        (a, b) =>
          SEVERITY_RANK[b.risk] - SEVERITY_RANK[a.risk] || a.health - b.health,
      )
    case 'health':
      return sorted.sort((a, b) => a.health - b.health)
    case 'lastActivity':
      return sorted.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'status':
      return sorted.sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
          a.health - b.health,
      )
  }
}

/* ==========================================================================
   Detail drawer
   ========================================================================== */

function DeviceDrawer({
  device,
  onClose,
}: {
  device: Device | null
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {device && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 38 }}
            role="dialog"
            aria-label={`Device detail — ${device.name}`}
            className="fixed inset-y-0 right-0 z-50 flex w-[min(100vw,27rem)] flex-col overflow-y-auto border-l border-white/[0.08] bg-navy-880/95 backdrop-blur-2xl"
          >
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-white/[0.06] bg-navy-880/90 px-5 py-4 backdrop-blur-xl">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-medium text-ink-100">
                  {device.name}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {device.vendor} · {device.category}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close device detail"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-500 transition hover:bg-white/[0.06] hover:text-ink-100"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={device.status} />
                <RiskBadge risk={device.risk} />
                {device.firmwareOutdated && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 text-[11px] font-medium leading-5 text-warn">
                    <ShieldAlert className="size-3" aria-hidden />
                    Firmware outdated
                  </span>
                )}
              </div>

              <div>
                <p className="eyebrow pb-2">Health score</p>
                <HealthBar value={device.health} />
              </div>

              {device.infectedBy && (
                <div className="rounded-xl border border-bad/30 bg-bad/[0.08] p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-bad">
                    <ShieldAlert className="size-3.5" aria-hidden />
                    Attributed to {device.infectedBy}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-300">
                    Behavioural indicators on this endpoint match the {device.infectedBy}{' '}
                    family. Treat as a full compromise: reflash from a verified
                    image rather than attempting in-place cleanup.
                  </p>
                </div>
              )}

              <div>
                <p className="eyebrow pb-1">Network</p>
                <DetailRow label="IP address" value={device.ip} mono />
                <DetailRow label="MAC address" value={device.mac} mono />
                <DetailRow label="Protocol" value={device.protocol} />
                <DetailRow
                  label="Open ports"
                  value={device.openPorts.join(', ')}
                  mono
                />
              </div>

              <div>
                <p className="eyebrow pb-1">Platform</p>
                <DetailRow label="Firmware" value={device.firmware} mono />
                <DetailRow
                  label="Patch state"
                  value={device.firmwareOutdated ? 'Update available' : 'Current'}
                />
                <DetailRow label="Uptime" value={formatDuration(device.uptimeHours * 3600)} />
                <DetailRow label="Location" value={device.location} />
                <DetailRow label="Last activity" value={timeAgo(device.lastActivity)} />
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

/* ==========================================================================
   Page
   ========================================================================== */

export default function Devices() {
  const { devices, devicesSource, devicesLoading } = useAppState()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [risk, setRisk] = useState('all')
  const [sort, setSort] = useState<SortKey>('risk')
  const [selected, setSelected] = useState<Device | null>(null)

  const filtered = useMemo(() => {
    const result = devices.filter((d) => {
      if (status !== 'all' && d.status !== status) return false
      if (risk !== 'all' && d.risk !== risk) return false
      return matchesQuery(
        query,
        d.name,
        d.ip,
        d.mac,
        d.vendor,
        d.category,
        d.location,
        d.firmware,
        d.infectedBy,
      )
    })
    return sortDevices(result, sort)
  }, [devices, query, status, risk, sort])

  /** Counts drive the filter chips, and update live during a simulation. */
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: devices.length }
    for (const d of devices) map[d.status] = (map[d.status] ?? 0) + 1
    return map
  }, [devices])

  const activeFilters = (status !== 'all' ? 1 : 0) + (risk !== 'all' ? 1 : 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="IoT Device Inventory"
        subtitle={`${devices.length} managed endpoints across ten device classes, with posture, exposure and attribution`}
        icon={<Boxes className="size-5" aria-hidden />}
        action={<SourceBadge source={devicesSource} />}
      />

      {/* ---- Status filter chips ------------------------------------------- */}
      <div className="flex flex-wrap gap-2">
        {(['all', ...STATUS_ORDER] as const).map((s) => {
          const count = counts[s] ?? 0
          if (s !== 'all' && count === 0) return null
          const active = status === s
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition',
                active
                  ? 'border-brand-400/45 bg-brand-500/15 text-ink-100'
                  : 'border-white/8 bg-white/[0.03] text-ink-300 hover:border-white/15 hover:text-ink-100',
              )}
            >
              {s !== 'all' && (
                <span
                  className="size-2 rounded-full"
                  style={{ background: deviceStatusHex[s] }}
                  aria-hidden
                />
              )}
              {s === 'all' ? 'All devices' : s}
              <span className="tabular text-ink-500">{count}</span>
            </button>
          )
        })}
      </div>

      {/* ---- Search + sort --------------------------------------------------- */}
      <GlassCard className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery('')}
            placeholder="Search by name, IP, MAC, vendor, location or firmware…"
            containerClassName="flex-1"
          />
          <div className="flex gap-3">
            <Select
              value={risk}
              onChange={setRisk}
              label="Filter by risk"
              className="w-40"
              options={[
                { value: 'all', label: 'All risk levels' },
                ...(['Critical', 'High', 'Medium', 'Low'] as Severity[]).map((r) => ({
                  value: r,
                  label: `${r} risk`,
                })),
              ]}
            />
            <Select
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              label="Sort devices"
              className="w-48"
              options={SORT_OPTIONS}
            />
          </div>
        </div>

        {(query || activeFilters > 0) && (
          <div className="mt-3 flex items-center gap-3 border-t border-white/[0.05] pt-3">
            <p className="text-xs text-ink-500">
              Showing <span className="tabular text-ink-100">{filtered.length}</span>{' '}
              of {devices.length} devices
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery('')
                setStatus('all')
                setRisk('all')
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </GlassCard>

      {/* ---- Table ----------------------------------------------------------- */}
      <GlassCard className="overflow-hidden">
        {devicesLoading && devicesSource === 'loading' ? (
          <div className="p-5">
            <SkeletonTable rows={8} columns={6} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Boxes className="size-5" aria-hidden />}
            title="No devices match these filters"
            message="Try widening the risk level or clearing the search term."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery('')
                  setStatus('all')
                  setRisk('all')
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  {[
                    { label: 'Device', icon: Router },
                    { label: 'Network', icon: Network },
                    { label: 'Firmware', icon: Cpu },
                    { label: 'Status', icon: Signal },
                    { label: 'Risk', icon: ShieldAlert },
                    { label: 'Health', icon: Fingerprint },
                    { label: 'Location', icon: MapPin },
                  ].map((h) => (
                    <th
                      key={h.label}
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <h.icon className="size-3" aria-hidden />
                        {h.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((device, i) => (
                  <motion.tr
                    key={device.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.012, 0.3), duration: 0.25 }}
                    onClick={() => setSelected(device)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelected(device)
                      }
                    }}
                    className="cursor-pointer border-b border-white/[0.04] transition last:border-0 hover:bg-white/[0.035]"
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono text-[13px] font-medium text-ink-100">
                        {device.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        {device.vendor} · {device.category}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="tabular font-mono text-[12px] text-ink-300">
                        {device.ip}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-ink-500">
                        {device.mac}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="tabular font-mono text-[12px] text-ink-300">
                        {device.firmware}
                      </p>
                      <p
                        className={cn(
                          'mt-0.5 text-[10px]',
                          device.firmwareOutdated ? 'text-warn' : 'text-ink-500',
                        )}
                      >
                        {device.firmwareOutdated ? 'Update available' : 'Current'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={device.status} />
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge risk={device.risk} />
                    </td>
                    <td className="px-4 py-3 min-w-[130px]">
                      <HealthBar value={device.health} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[12px] text-ink-300">{device.location}</p>
                      <p className="mt-0.5 text-[10px] text-ink-500">
                        {timeAgo(device.lastActivity)}
                      </p>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <p className="flex items-center gap-1.5 text-[11px] text-ink-700">
        <ChevronDown className="size-3" aria-hidden />
        Select any row to open the full device record.
      </p>

      <DeviceDrawer device={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
