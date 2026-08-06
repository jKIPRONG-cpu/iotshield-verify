/**
 * IoTShield Verify — shared UI kit.
 *
 * Every surface in the product is assembled from these primitives, which is
 * what keeps a severity chip, a health bar, or a panel edge identical on ten
 * different pages. Status colour is never the sole carrier of meaning here:
 * each badge pairs its colour with an icon and a text label.
 */

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { motion, useInView, useMotionValue, useSpring } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  Database,
  Info,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Siren,
  Wifi,
  X,
  XCircle,
} from 'lucide-react'
import type {
  AlertStatus,
  DataSource,
  DeviceStatus,
  EventVerdict,
  Severity,
  VerificationStatus,
} from '@/types'
import {
  alertStatusClasses,
  cn,
  deviceStatusClasses,
  healthTone,
  severityClasses,
  verdictClasses,
  verificationClasses,
} from '@/lib/utils'

/* ==========================================================================
   Panels
   ========================================================================== */

interface GlassCardProps {
  children: ReactNode
  className?: string
  /** Adds the hairline lit top edge used on hero panels. */
  lit?: boolean
  /** Subtle lift and border brightening on hover. */
  interactive?: boolean
  onClick?: () => void
}

export function GlassCard({
  children,
  className,
  lit = false,
  interactive = false,
  onClick,
}: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'glass print-plain relative rounded-2xl',
        lit && 'lit-edge',
        interactive &&
          'cursor-pointer transition duration-300 ease-out-quint hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-raise',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface SectionTitleProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  /** Rendered flush right — filters, toggles, actions. */
  action?: ReactNode
  className?: string
}

export function SectionTitle({
  title,
  subtitle,
  icon,
  action,
  className,
}: SectionTitleProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap sm:items-center',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand-400/25 bg-brand-500/10 text-brand-300">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-ink-100">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-ink-500">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** Page-level heading used at the top of every route. */
export function PageHeader({
  title,
  subtitle,
  icon,
  action,
}: SectionTitleProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-1">
      <div className="flex items-center gap-3.5">
        {icon && (
          <span className="grid size-11 place-items-center rounded-2xl border border-brand-400/25 bg-gradient-to-br from-brand-500/20 to-ice-500/10 text-brand-300 shadow-glow">
            {icon}
          </span>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-100 sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-sm text-ink-500">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="no-print">{action}</div>}
    </header>
  )
}

/* ==========================================================================
   Badges
   --------------------------------------------------------------------------
   Colour + icon + label, always. None of these communicate by hue alone.
   ========================================================================== */

function Chip({
  className,
  icon,
  children,
  title,
}: {
  className?: string
  icon?: ReactNode
  children: ReactNode
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

const severityIcon: Record<Severity, ReactNode> = {
  Critical: <Siren className="size-3" aria-hidden />,
  High: <ShieldAlert className="size-3" aria-hidden />,
  Medium: <AlertTriangle className="size-3" aria-hidden />,
  Low: <Info className="size-3" aria-hidden />,
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Chip className={severityClasses[severity]} icon={severityIcon[severity]}>
      {severity}
    </Chip>
  )
}

/** Risk uses the same scale as severity but reads as an asset property. */
export function RiskBadge({ risk }: { risk: Severity }) {
  return (
    <Chip className={severityClasses[risk]} icon={severityIcon[risk]}>
      {risk} risk
    </Chip>
  )
}

const deviceStatusIcon: Record<DeviceStatus, ReactNode> = {
  Healthy: <ShieldCheck className="size-3" aria-hidden />,
  'At Risk': <AlertTriangle className="size-3" aria-hidden />,
  Compromised: <ShieldX className="size-3" aria-hidden />,
  Isolated: <CircleSlash className="size-3" aria-hidden />,
  Recovering: <Loader2 className="size-3" aria-hidden />,
  Offline: <Wifi className="size-3" aria-hidden />,
}

export function StatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <Chip
      className={deviceStatusClasses[status]}
      icon={deviceStatusIcon[status]}
    >
      {status}
    </Chip>
  )
}

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const icon =
    status === 'Resolved' ? (
      <CheckCircle2 className="size-3" aria-hidden />
    ) : status === 'Contained' ? (
      <CircleSlash className="size-3" aria-hidden />
    ) : status === 'Investigating' ? (
      <Search className="size-3" aria-hidden />
    ) : (
      <Siren className="size-3" aria-hidden />
    )
  return (
    <Chip className={alertStatusClasses[status]} icon={icon}>
      {status}
    </Chip>
  )
}

export function VerdictBadge({ verdict }: { verdict: EventVerdict }) {
  const icon =
    verdict === 'Benign' ? (
      <CheckCircle2 className="size-3" aria-hidden />
    ) : verdict === 'Suspicious' ? (
      <AlertTriangle className="size-3" aria-hidden />
    ) : (
      <ShieldX className="size-3" aria-hidden />
    )
  return (
    <Chip className={verdictClasses[verdict]} icon={icon}>
      {verdict}
    </Chip>
  )
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const icon =
    status === 'Verified' ? (
      <CheckCircle2 className="size-3" aria-hidden />
    ) : status === 'Failed' ? (
      <XCircle className="size-3" aria-hidden />
    ) : (
      <AlertTriangle className="size-3" aria-hidden />
    )
  return (
    <Chip className={verificationClasses[status]} icon={icon}>
      {status}
    </Chip>
  )
}

/**
 * Tells the viewer whether the panel above is served by the API or drawn from
 * the bundled dataset. Keeping the fallback visible is deliberate: silent
 * substitution would be misleading in a demonstration.
 */
export function SourceBadge({
  source,
  className,
}: {
  source: DataSource
  className?: string
}) {
  if (source === 'loading') {
    return (
      <Chip className={cn('border-white/10 bg-white/5 text-ink-500', className)}
        icon={<Loader2 className="size-3 animate-spin" aria-hidden />}
      >
        Loading
      </Chip>
    )
  }
  if (source === 'live') {
    return (
      <Chip
        className={cn('border-ok/30 bg-ok/10 text-ok', className)}
        icon={<Wifi className="size-3" aria-hidden />}
        title="Served by the FastAPI backend"
      >
        Live API
      </Chip>
    )
  }
  return (
    <Chip
      className={cn('border-brand-400/25 bg-brand-500/10 text-brand-300', className)}
      icon={<Database className="size-3" aria-hidden />}
      title="Backend unreachable — rendering the bundled demonstration dataset"
    >
      Demo data
    </Chip>
  )
}

/* ==========================================================================
   Metrics
   ========================================================================== */

/**
 * Counts up to `value` when scrolled into view. Uses a spring rather than a
 * linear tween so large numbers settle instead of ticking mechanically.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = '',
  prefix = '',
  className,
}: {
  value: number
  decimals?: number
  suffix?: string
  prefix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { stiffness: 90, damping: 20, mass: 0.7 })
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    if (inView) motionValue.set(value)
  }, [inView, value, motionValue])

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest: number) => {
      setDisplay(
        latest.toLocaleString('en-GB', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }),
      )
    })
    return unsubscribe
  }, [spring, decimals])

  return (
    <span ref={ref} className={cn('tabular', className)}>
      {prefix}
      {display}
      {suffix}
    </span>
  )
}

interface StatTileProps {
  label: string
  value: number
  icon: ReactNode
  /** Percentage-point change versus the previous window. */
  delta?: number
  /** For deltas where down is the good direction (threats, latency). */
  invertDelta?: boolean
  suffix?: string
  decimals?: number
  hint?: string
  tone?: 'default' | 'good' | 'warn' | 'bad'
  className?: string
}

const toneRing: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'border-brand-400/25 bg-brand-500/10 text-brand-300',
  good: 'border-ok/30 bg-ok/10 text-ok',
  warn: 'border-warn/30 bg-warn/10 text-warn',
  bad: 'border-bad/35 bg-bad/12 text-bad',
}

export function StatTile({
  label,
  value,
  icon,
  delta,
  invertDelta = false,
  suffix = '',
  decimals = 0,
  hint,
  tone = 'default',
  className,
}: StatTileProps) {
  const good = delta === undefined ? null : invertDelta ? delta <= 0 : delta >= 0

  return (
    <GlassCard className={cn('p-4 sm:p-5', className)} lit>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg border',
            toneRing[tone],
          )}
        >
          {icon}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <AnimatedNumber
          value={value}
          decimals={decimals}
          suffix={suffix}
          className="text-2xl font-semibold tracking-tight text-ink-100 sm:text-3xl"
        />
        {delta !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              good ? 'text-ok' : 'text-bad',
            )}
          >
            {/* Arrow glyph + sign, so direction survives greyscale. */}
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}
            {suffix === '%' ? 'pp' : ''}
          </span>
        )}
      </div>

      {hint && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
    </GlassCard>
  )
}

/** Horizontal 0-100 meter. The numeric label is always rendered alongside. */
export function HealthBar({
  value,
  showLabel = true,
  className,
}: {
  value: number
  showLabel?: boolean
  className?: string
}) {
  const tone = healthTone(value)
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className="h-1.5 w-full min-w-[52px] overflow-hidden rounded-full bg-navy-600/70"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Device health score"
      >
        <motion.div
          className={cn('h-full rounded-full', tone.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      {showLabel && (
        <span className={cn('tabular w-8 text-right text-xs font-medium', tone.text)}>
          {value}
        </span>
      )}
    </div>
  )
}

/**
 * SVG progress ring used across the Resilience Center. The value is drawn in
 * the centre, so the arc is reinforcement rather than the only encoding.
 */
export function ProgressRing({
  value,
  label,
  sublabel,
  color = '#3B82F6',
  size = 132,
  stroke = 9,
}: {
  value: number
  label: string
  sublabel?: string
  color?: string
  size?: number
  stroke?: number
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - value / 100)

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative" style={{ width: size, height: size }}>
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
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ filter: `drop-shadow(0 0 7px ${color}55)` }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <AnimatedNumber
            value={value}
            suffix="%"
            className="text-2xl font-semibold text-ink-100"
          />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-ink-100">{label}</p>
        {sublabel && <p className="mt-0.5 text-xs text-ink-500">{sublabel}</p>}
      </div>
    </div>
  )
}

/* ==========================================================================
   Controls
   ========================================================================== */

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'subtle'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-glow hover:from-brand-400 hover:to-brand-500 border border-brand-400/40',
  outline:
    'border border-white/12 bg-white/[0.03] text-ink-100 hover:border-brand-400/40 hover:bg-brand-500/10 hover:text-brand-200',
  ghost: 'text-ink-300 hover:bg-white/[0.06] hover:text-ink-100 border border-transparent',
  subtle:
    'border border-white/8 bg-navy-750/60 text-ink-300 hover:bg-navy-700/70 hover:text-ink-100',
  danger:
    'border border-bad/40 bg-bad/15 text-bad hover:bg-bad/25 hover:text-red-200',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  icon?: ReactNode
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'outline', size = 'md', icon, loading, className, children, disabled, ...rest },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition duration-200 ease-out-quint',
        'disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        buttonVariants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void
  containerClassName?: string
}

export function SearchInput({
  onClear,
  containerClassName,
  className,
  value,
  ...rest
}: SearchInputProps) {
  return (
    <div className={cn('relative', containerClassName)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        className={cn(
          'w-full rounded-xl border border-white/8 bg-navy-850/70 py-2 pl-9 pr-8 text-sm text-ink-100 placeholder:text-ink-700',
          'transition focus:border-brand-400/50 focus:bg-navy-800/80 focus:outline-none',
          '[&::-webkit-search-cancel-button]:appearance-none',
          className,
        )}
        {...rest}
      />
      {onClear && typeof value === 'string' && value.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-500 transition hover:text-ink-100"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function Select({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  label?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      {label && <span className="sr-only">{label}</span>}
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full appearance-none rounded-xl border border-white/8 bg-navy-850/70 py-2 pl-3 pr-9 text-sm text-ink-100',
          'transition focus:border-brand-400/50 focus:outline-none',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-navy-800 text-ink-100">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-500"
        aria-hidden
      />
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-100">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
            {description}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition duration-300 ease-out-quint',
          checked
            ? 'border-brand-400/50 bg-brand-500/80 shadow-glow'
            : 'border-white/10 bg-navy-700',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
          className={cn(
            'absolute top-0.5 size-4.5 rounded-full bg-white shadow-sm',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
          style={{ width: 18, height: 18 }}
        />
      </button>
    </label>
  )
}

/** Segmented control used for view switching. */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: ReactNode }[]
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-white/8 bg-navy-850/60 p-1',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
              active ? 'text-ink-100' : 'text-ink-500 hover:text-ink-300',
            )}
          >
            {active && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-lg border border-brand-400/30 bg-brand-500/15"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {o.icon}
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ==========================================================================
   Loading & empty states
   ========================================================================== */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}

export function SkeletonTable({
  rows = 6,
  columns = 5,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading table">
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="grid gap-3 rounded-xl border border-white/[0.04] bg-white/[0.015] px-4 py-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cn('h-3.5', c === 0 ? 'w-4/5' : 'w-3/5')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <GlassCard key={i} className="p-5">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-4 h-7 w-16" />
          <Skeleton className="mt-3 h-2.5 w-28" />
        </GlassCard>
      ))}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode
  title: string
  message?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl border border-white/8 bg-white/[0.03] text-ink-500">
        {icon ?? <Search className="size-5" aria-hidden />}
      </span>
      <div>
        <p className="text-sm font-medium text-ink-100">{title}</p>
        {message && (
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-500">
            {message}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

/* ==========================================================================
   Misc
   ========================================================================== */

/** Monospace key/value row used in detail panels. */
export function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/[0.04] py-2 last:border-0">
      <span className="shrink-0 text-xs text-ink-500">{label}</span>
      <span
        className={cn(
          'min-w-0 truncate text-right text-xs text-ink-100',
          mono && 'font-mono tabular',
        )}
      >
        {value}
      </span>
    </div>
  )
}

/** Small pulsing dot indicating a live/streaming region. */
export function LiveDot({ active = true }: { active?: boolean }) {
  return (
    <span className="relative inline-flex size-2">
      {active && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok/60" />
      )}
      <span
        className={cn(
          'relative inline-flex size-2 rounded-full',
          active ? 'bg-ok' : 'bg-ink-700',
        )}
      />
    </span>
  )
}
