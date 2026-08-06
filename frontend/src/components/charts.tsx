/**
 * Charting layer.
 *
 * Every chart in the product is composed from these wrappers so axis
 * treatment, grid weight, tooltip shape, and legend behaviour are decided once
 * rather than per page.
 *
 * Conventions enforced here:
 *  - Recessive chrome: hairline horizontal gridlines only, no vertical rules,
 *    no axis lines, muted tick ink.
 *  - Thin marks: 2px strokes, >= 8px hover markers, rounded bar ends.
 *  - A single value axis. There is no dual-axis helper, deliberately — two
 *    measures of different scale get two charts.
 *  - A tooltip by default; a legend whenever there is more than one series.
 *  - Series colours come from the fixed-order validated palette in
 *    lib/utils and are assigned by index, never cycled.
 */

import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART, cn, formatAxisDate, SERIES } from '@/lib/utils'
import { GlassCard, SectionTitle } from './ui'

/* ==========================================================================
   Shell
   ========================================================================== */

interface ChartCardProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  action?: ReactNode
  /** Plot height in pixels. The container is responsive in width. */
  height?: number
  children: ReactNode
  className?: string
  /** Rendered under the plot — the "so what" line for a defence audience. */
  footnote?: string
}

export function ChartCard({
  title,
  subtitle,
  icon,
  action,
  height = 260,
  children,
  className,
  footnote,
}: ChartCardProps) {
  return (
    // `min-w-0` matters: a grid item defaults to `min-width: auto`, so the
    // chart's intrinsic width would otherwise widen its track and push the
    // whole page into horizontal overflow on narrow viewports.
    <GlassCard className={cn('flex min-w-0 flex-col p-5', className)} lit>
      <SectionTitle title={title} subtitle={subtitle} icon={icon} action={action} />
      <div className="mt-5 w-full min-w-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as never}
        </ResponsiveContainer>
      </div>
      {footnote && (
        <p className="mt-3 border-t border-white/[0.05] pt-3 text-[11px] leading-relaxed text-ink-500">
          {footnote}
        </p>
      )}
    </GlassCard>
  )
}

/* ==========================================================================
   Shared axis / grid / tooltip config
   ========================================================================== */

const axisTick = { fill: CHART.tickInk, fontSize: 11 }

export const gridProps = {
  stroke: CHART.grid,
  strokeDasharray: '0',
  vertical: false,
} as const

interface TooltipEntry {
  name?: string | number
  value?: number | string
  color?: string
  dataKey?: string | number
  payload?: Record<string, unknown>
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  /** Formats the label line; defaults to a date-aware formatter. */
  labelFormatter?: (label: string) => string
  /** Appended to every value, e.g. '%'. */
  suffix?: string
}

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  suffix = '',
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const heading =
    typeof label === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(label)
      ? formatAxisDate(label)
      : String(label ?? '')

  return (
    <div className="glass-strong rounded-xl px-3 py-2.5 shadow-raise">
      {heading && (
        <p className="mb-1.5 text-[11px] font-medium text-ink-300">
          {labelFormatter ? labelFormatter(String(label)) : heading}
        </p>
      )}
      <ul className="space-y-1">
        {payload.map((entry, i) => (
          <li key={i} className="flex items-center gap-2 text-[11px]">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ background: entry.color }}
              aria-hidden
            />
            <span className="text-ink-500">{entry.name}</span>
            <span className="tabular ml-auto font-medium text-ink-100">
              {typeof entry.value === 'number'
                ? entry.value.toLocaleString('en-GB')
                : entry.value}
              {suffix}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Legend styling shared by every multi-series chart. */
const legendProps = {
  iconType: 'circle' as const,
  iconSize: 7,
  wrapperStyle: { fontSize: 11, color: CHART.labelInk, paddingTop: 8 },
}

/* ==========================================================================
   Chart forms
   ========================================================================== */

interface SeriesSpec {
  key: string
  label: string
  /** Palette slot index, 0-7. Assign explicitly so filters never repaint. */
  slot: number
}

/**
 * Change over time, magnitude emphasised. Use for volumes (threats detected,
 * events processed) where the area under the line is meaningful.
 */
export function TrendArea({
  data,
  series,
  xKey = 'date',
  suffix = '',
}: {
  data: Record<string, unknown>[]
  series: SeriesSpec[]
  xKey?: string
  suffix?: string
}) {
  return (
    <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
      <defs>
        {series.map((s) => (
          <linearGradient
            key={s.key}
            id={`grad-${s.key}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={SERIES[s.slot]} stopOpacity={0.34} />
            <stop offset="100%" stopColor={SERIES[s.slot]} stopOpacity={0.02} />
          </linearGradient>
        ))}
      </defs>
      <CartesianGrid {...gridProps} />
      <XAxis
        dataKey={xKey}
        tick={axisTick}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatAxisDate}
        minTickGap={24}
      />
      <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
      <Tooltip
        content={<ChartTooltip suffix={suffix} />}
        cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
      />
      {series.length > 1 && <Legend {...legendProps} />}
      {series.map((s) => (
        <Area
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.label}
          stroke={SERIES[s.slot]}
          strokeWidth={2}
          fill={`url(#grad-${s.key})`}
          activeDot={{ r: 4.5, strokeWidth: 2, stroke: CHART.surface }}
          dot={false}
        />
      ))}
    </AreaChart>
  )
}

/** Change over time, comparison emphasised. Use for rates and percentages. */
export function TrendLine({
  data,
  series,
  xKey = 'date',
  domain,
  suffix = '',
}: {
  data: Record<string, unknown>[]
  series: SeriesSpec[]
  xKey?: string
  domain?: [number, number]
  suffix?: string
}) {
  return (
    <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
      <CartesianGrid {...gridProps} />
      <XAxis
        dataKey={xKey}
        tick={axisTick}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatAxisDate}
        minTickGap={24}
      />
      <YAxis
        tick={axisTick}
        tickLine={false}
        axisLine={false}
        width={44}
        domain={domain ?? ['auto', 'auto']}
      />
      <Tooltip
        content={<ChartTooltip suffix={suffix} />}
        cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
      />
      {series.length > 1 && <Legend {...legendProps} />}
      {series.map((s) => (
        <Line
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.label}
          stroke={SERIES[s.slot]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4.5, strokeWidth: 2, stroke: CHART.surface }}
        />
      ))}
    </LineChart>
  )
}

/**
 * Magnitude by category. Horizontal by default — category labels read left to
 * right without rotation, which is the main reason vertical bars go wrong.
 */
export function CategoryBar({
  data,
  dataKey = 'value',
  nameKey = 'name',
  layout = 'vertical',
  /** Per-bar colours. Supply status hex for severity, palette slots otherwise. */
  colors,
  suffix = '',
}: {
  data: Record<string, unknown>[]
  dataKey?: string
  nameKey?: string
  layout?: 'vertical' | 'horizontal'
  colors?: string[]
  suffix?: string
}) {
  const horizontal = layout === 'vertical'

  return (
    <BarChart
      data={data}
      layout={layout}
      margin={
        horizontal
          ? { top: 4, right: 16, left: 8, bottom: 4 }
          : { top: 6, right: 8, left: -18, bottom: 0 }
      }
      barCategoryGap="26%"
    >
      <CartesianGrid
        stroke={CHART.grid}
        strokeDasharray="0"
        vertical={horizontal}
        horizontal={!horizontal}
      />
      {horizontal ? (
        <>
          <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey={nameKey}
            tick={{ ...axisTick, fill: CHART.labelInk }}
            tickLine={false}
            axisLine={false}
            width={132}
          />
        </>
      ) : (
        <>
          <XAxis
            dataKey={nameKey}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
        </>
      )}
      <Tooltip
        content={<ChartTooltip suffix={suffix} />}
        cursor={{ fill: 'rgba(96,165,250,0.07)' }}
      />
      <Bar
        dataKey={dataKey}
        name="Count"
        radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
        maxBarSize={26}
      >
        {data.map((_, i) => (
          <Cell key={i} fill={colors?.[i] ?? SERIES[i % SERIES.length]} />
        ))}
      </Bar>
    </BarChart>
  )
}

/**
 * Stacked composition by category. A 2px surface-coloured gap separates
 * segments so adjacent fills never read as one block.
 */
export function StackedBar({
  data,
  series,
  nameKey = 'name',
  colors,
}: {
  data: Record<string, unknown>[]
  series: { key: string; label: string }[]
  nameKey?: string
  colors: string[]
}) {
  return (
    <BarChart
      data={data}
      layout="vertical"
      margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      barCategoryGap="24%"
    >
      <CartesianGrid stroke={CHART.grid} strokeDasharray="0" vertical horizontal={false} />
      <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} />
      <YAxis
        type="category"
        dataKey={nameKey}
        tick={{ ...axisTick, fill: CHART.labelInk }}
        tickLine={false}
        axisLine={false}
        width={132}
      />
      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(96,165,250,0.07)' }} />
      <Legend {...legendProps} />
      {series.map((s, i) => (
        <Bar
          key={s.key}
          dataKey={s.key}
          name={s.label}
          stackId="a"
          fill={colors[i]}
          stroke={CHART.surface}
          strokeWidth={2}
          maxBarSize={24}
        />
      ))}
    </BarChart>
  )
}

/**
 * Part-to-whole. Kept to a donut with a centre figure: the ring carries the
 * proportion, the centre carries the number that actually gets quoted.
 */
export function DonutChart({
  data,
  colors,
  centerValue,
  centerLabel,
  suffix = '',
}: {
  data: { name: string; value: number }[]
  colors: string[]
  centerValue?: string | number
  centerLabel?: string
  suffix?: string
}) {
  return (
    <PieChart>
      <Tooltip content={<ChartTooltip suffix={suffix} />} />
      <Legend {...legendProps} />
      <Pie
        data={data}
        dataKey="value"
        nameKey="name"
        innerRadius="58%"
        outerRadius="82%"
        paddingAngle={2}
        stroke={CHART.surface}
        strokeWidth={2}
        startAngle={90}
        endAngle={-270}
      >
        {data.map((_, i) => (
          <Cell key={i} fill={colors[i % colors.length]} />
        ))}
      </Pie>
      {centerValue !== undefined && (
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="tabular"
          style={{ fill: CHART.primaryInk, fontSize: 26, fontWeight: 600 }}
        >
          {centerValue}
        </text>
      )}
      {centerLabel && (
        <text
          x="50%"
          y="59%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fill: CHART.tickInk, fontSize: 11 }}
        >
          {centerLabel}
        </text>
      )}
    </PieChart>
  )
}

/** Multi-dimensional posture comparison. One shape, no axis clutter. */
export function PostureRadar({
  data,
  slot = 0,
}: {
  data: { axis: string; value: number }[]
  slot?: number
}) {
  return (
    <RadarChart data={data} outerRadius="72%">
      <PolarGrid stroke={CHART.grid} />
      <PolarAngleAxis
        dataKey="axis"
        tick={{ fill: CHART.tickInk, fontSize: 11 }}
      />
      <Tooltip content={<ChartTooltip suffix="%" />} />
      <Radar
        name="Score"
        dataKey="value"
        stroke={SERIES[slot]}
        strokeWidth={2}
        fill={SERIES[slot]}
        fillOpacity={0.22}
      />
    </RadarChart>
  )
}
