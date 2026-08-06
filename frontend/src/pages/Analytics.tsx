/**
 * Analytics.
 *
 * The cross-cutting view: threat frequency, malware categories, device risk,
 * verification outcomes, recovery success and network health.
 *
 * Every chart here obeys the same rules as the rest of the console — one value
 * axis per plot, categorical colours assigned from the fixed-order validated
 * palette, reserved status colours only where the encoding really is a status,
 * and a named legend whenever more than one series is present.
 */

import { useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  Bug,
  Gauge,
  Layers,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import { api } from '@/api/client'
import { useResource } from '@/hooks/useResource'
import { useAppState } from '@/context/AppState'
import { mock } from '@/data/mock'
import type { Analytics as AnalyticsData, Severity } from '@/types'
import {
  CategoryBar,
  ChartCard,
  DonutChart,
  StackedBar,
  TrendArea,
  TrendLine,
} from '@/components/charts'
import {
  Button,
  GlassCard,
  PageHeader,
  SectionTitle,
  Skeleton,
  SourceBadge,
  StatTile,
  Tabs,
} from '@/components/ui'
import { SERIES, severityHex } from '@/lib/utils'

/* ==========================================================================
   Page
   ========================================================================== */

type Window = '7d' | '14d'

export default function Analytics() {
  const { alerts, devices } = useAppState()
  const analyticsRes = useResource<AnalyticsData>(
    (signal) => api.analytics(signal),
    mock.analytics,
  )

  const [window, setWindow] = useState<Window>('14d')
  const data = analyticsRes.data

  /** Trim the time series to the selected window, newest kept. */
  const slice = <T,>(series: T[]): T[] =>
    window === '7d' ? series.slice(-7) : series

  const totals = useMemo(() => {
    const critical = alerts.filter((a) => a.severity === 'Critical').length
    const recovered = data.recoverySuccess.reduce((s, d) => s + d.recovered, 0)
    const failedRecoveries = data.recoverySuccess.reduce((s, d) => s + d.failed, 0)
    const meanHealth = Math.round(
      data.networkHealthSeries.reduce((s, d) => s + d.health, 0) /
        Math.max(data.networkHealthSeries.length, 1),
    )
    return {
      critical,
      recovered,
      recoveryRate:
        recovered + failedRecoveries === 0
          ? 100
          : Math.round((recovered / (recovered + failedRecoveries)) * 1000) / 10,
      meanHealth,
    }
  }, [alerts, data])

  /** Device risk is a status encoding, so it uses the reserved palette. */
  const riskColors = useMemo(
    () => data.deviceRisk.map((r) => severityHex[r.name as Severity] ?? SERIES[0]),
    [data.deviceRisk],
  )

  if (analyticsRes.source === 'loading') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Analytics"
          subtitle="Threat frequency, risk distribution, verification outcomes and recovery"
          icon={<BarChart3 className="size-5" aria-hidden />}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Cross-cutting analysis of threat activity, asset risk, verification outcomes and recovery performance"
        icon={<BarChart3 className="size-5" aria-hidden />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={window}
              onChange={setWindow}
              options={[
                { value: '7d', label: '7 days' },
                { value: '14d', label: '14 days' },
              ]}
            />
            <SourceBadge source={analyticsRes.source} />
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw className="size-3.5" />}
              onClick={analyticsRes.reload}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Alerts analysed"
          value={alerts.length}
          icon={<Activity className="size-4" aria-hidden />}
          hint={`${totals.critical} at critical severity`}
        />
        <StatTile
          label="Devices under management"
          value={devices.length}
          icon={<Layers className="size-4" aria-hidden />}
          hint="Across ten device classes"
        />
        <StatTile
          label="Recovery success rate"
          value={totals.recoveryRate}
          suffix="%"
          decimals={1}
          icon={<ShieldCheck className="size-4" aria-hidden />}
          tone={totals.recoveryRate >= 85 ? 'good' : 'warn'}
          hint={`${totals.recovered} devices restored`}
        />
        <StatTile
          label="Mean network health"
          value={totals.meanHealth}
          suffix="%"
          icon={<Gauge className="size-4" aria-hidden />}
          tone={totals.meanHealth >= 80 ? 'good' : 'warn'}
          hint="Averaged across the window"
        />
      </div>

      {/* ---- Frequency and categories ------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Threat frequency"
          subtitle="Most common detections across the alert corpus"
          icon={<TrendingUp className="size-[18px]" aria-hidden />}
          height={300}
          footnote="Horizontal bars so the threat names read left to right without rotation."
        >
          <CategoryBar
            data={data.threatFrequency as unknown as Record<string, unknown>[]}
          />
        </ChartCard>

        <ChartCard
          title="Malware categories"
          subtitle="Prevalence aggregated by family class"
          icon={<Bug className="size-[18px]" aria-hidden />}
          height={300}
        >
          <CategoryBar
            data={data.malwareCategories as unknown as Record<string, unknown>[]}
            suffix="%"
          />
        </ChartCard>
      </div>

      {/* ---- Risk and outcomes --------------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Device risk distribution"
          subtitle="Current risk rating across the estate"
          icon={<Gauge className="size-[18px]" aria-hidden />}
          height={260}
          footnote="Risk is a status encoding, so it uses the reserved status palette rather than a series palette."
        >
          <DonutChart
            data={data.deviceRisk}
            colors={riskColors}
            centerValue={devices.length}
            centerLabel="devices"
          />
        </ChartCard>

        <ChartCard
          title="Verification outcomes"
          subtitle="Properties satisfied versus violated"
          icon={<ShieldCheck className="size-[18px]" aria-hidden />}
          height={260}
        >
          <DonutChart
            data={data.verificationOutcomes}
            colors={['#22C55E', '#F04438']}
            centerValue={data.verificationOutcomes.reduce((s, d) => s + d.value, 0)}
            centerLabel="properties"
          />
        </ChartCard>

        <ChartCard
          title="Network health and load"
          subtitle="Estate health against traffic load"
          icon={<Activity className="size-[18px]" aria-hidden />}
          height={260}
          footnote="Both series are percentages, so they share one axis legitimately."
        >
          <TrendLine
            data={
              slice(data.networkHealthSeries) as unknown as Record<string, unknown>[]
            }
            series={[
              { key: 'health', label: 'Health', slot: 2 },
              { key: 'load', label: 'Load', slot: 0 },
            ]}
            domain={[0, 100]}
            suffix="%"
          />
        </ChartCard>
      </div>

      {/* ---- Recovery and severity mix -------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Recovery outcomes"
          subtitle="Devices restored versus recoveries that failed"
          icon={<RefreshCw className="size-[18px]" aria-hidden />}
          height={290}
          footnote="Failed recoveries are the ones that needed physical reflashing — a cost that scales with fleet size."
        >
          <TrendArea
            data={slice(data.recoverySuccess) as unknown as Record<string, unknown>[]}
            series={[
              { key: 'recovered', label: 'Recovered', slot: 2 },
              { key: 'failed', label: 'Failed', slot: 7 },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Alert severity by device class"
          subtitle="Where the serious detections concentrate"
          icon={<Layers className="size-[18px]" aria-hidden />}
          height={290}
          footnote="Segments carry a 2px surface gap so adjacent fills never read as one block; every segment is named in the legend."
        >
          <StackedBar
            data={data.severityByCategory as unknown as Record<string, unknown>[]}
            nameKey="category"
            series={[
              { key: 'Critical', label: 'Critical' },
              { key: 'High', label: 'High' },
              { key: 'Medium', label: 'Medium' },
              { key: 'Low', label: 'Low' },
            ]}
            colors={[
              severityHex.Critical,
              severityHex.High,
              severityHex.Medium,
              severityHex.Low,
            ]}
          />
        </ChartCard>
      </div>

      <GlassCard className="p-5">
        <SectionTitle
          title="About these figures"
          icon={<BarChart3 className="size-[18px]" aria-hidden />}
        />
        <p className="mt-2.5 max-w-4xl text-[12px] leading-relaxed text-ink-500">
          Every value on this page is derived from the synthetic demonstration
          dataset. Distributions were shaped to be internally consistent — the
          risk mix matches the device inventory, and the alert corpus matches the
          malware attributions — so the analytics read plausibly. They are not
          experimental results and should not be cited as such.
        </p>
      </GlassCard>
    </div>
  )
}
