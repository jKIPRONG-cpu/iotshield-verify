/**
 * Shared presentation helpers.
 *
 * Anything that formats a value for display, maps a domain enum onto a colour
 * token, or merges class names lives here — so a severity never picks up two
 * different colours in two different pages.
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type {
  AlertStatus,
  DeviceStatus,
  EventVerdict,
  Severity,
  VerificationStatus,
} from '@/types'

/** Merge conditional class names, letting later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/* ==========================================================================
   Numbers & time
   ========================================================================== */

export const formatNumber = (n: number): string =>
  new Intl.NumberFormat('en-GB').format(Math.round(n))

export const formatPercent = (n: number, dp = 0): string => `${n.toFixed(dp)}%`

/** Bytes to a human-scaled string: 48200 -> "47.1 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`
}

/** Seconds to a compact duration: 1640 -> "27m 20s". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

/** Relative time from an ISO timestamp: "4m ago", "just now". */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'just now'
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  if (s < 90) return '1m ago'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

/** Wall-clock time for timelines: "14:32:07". */
export const formatClock = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-GB', { hour12: false })

/** Short absolute stamp for tables: "3 Aug, 14:32". */
export const formatStamp = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

/** "2026-08-03" -> "3 Aug" for chart axes. */
export const formatAxisDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n))

/* ==========================================================================
   Domain -> colour mappings
   --------------------------------------------------------------------------
   Status colours are reserved: they never double as a chart series, and every
   component that uses one also renders an icon and a text label, so meaning
   never rests on hue alone.
   ========================================================================== */

/** Rank used for sorting and for "worst severity wins" reductions. */
export const SEVERITY_RANK: Record<Severity, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
}

export const SEVERITY_ORDER: Severity[] = ['Critical', 'High', 'Medium', 'Low']

/** Tailwind classes for a severity chip: text, background wash, border. */
export const severityClasses: Record<Severity, string> = {
  Critical: 'text-bad border-bad/35 bg-bad/12',
  High: 'text-orange-300 border-orange-400/30 bg-orange-400/10',
  Medium: 'text-warn border-warn/30 bg-warn/10',
  Low: 'text-brand-300 border-brand-400/30 bg-brand-400/10',
}

/** Raw hex for a severity — used by charts and SVG, which cannot take classes. */
export const severityHex: Record<Severity, string> = {
  Critical: '#F04438',
  High: '#FB923C',
  Medium: '#F59E0B',
  Low: '#60A5FA',
}

export const deviceStatusClasses: Record<DeviceStatus, string> = {
  Healthy: 'text-ok border-ok/30 bg-ok/10',
  'At Risk': 'text-warn border-warn/30 bg-warn/10',
  Compromised: 'text-bad border-bad/35 bg-bad/12',
  Isolated: 'text-violet-300 border-violet-400/30 bg-violet-400/10',
  Recovering: 'text-ice-300 border-ice-400/30 bg-ice-400/10',
  Offline: 'text-ink-500 border-white/10 bg-white/5',
}

export const deviceStatusHex: Record<DeviceStatus, string> = {
  Healthy: '#22C55E',
  'At Risk': '#F59E0B',
  Compromised: '#F04438',
  Isolated: '#A78BFA',
  Recovering: '#22D3EE',
  Offline: '#6B7A99',
}

export const alertStatusClasses: Record<AlertStatus, string> = {
  Open: 'text-bad border-bad/35 bg-bad/12',
  Investigating: 'text-warn border-warn/30 bg-warn/10',
  Contained: 'text-ice-300 border-ice-400/30 bg-ice-400/10',
  Resolved: 'text-ok border-ok/30 bg-ok/10',
}

export const verdictClasses: Record<EventVerdict, string> = {
  Benign: 'text-ok border-ok/25 bg-ok/8',
  Suspicious: 'text-warn border-warn/30 bg-warn/10',
  Malicious: 'text-bad border-bad/35 bg-bad/12',
}

export const verificationClasses: Record<VerificationStatus, string> = {
  Verified: 'text-ok border-ok/30 bg-ok/10',
  Failed: 'text-bad border-bad/35 bg-bad/12',
  Warning: 'text-warn border-warn/30 bg-warn/10',
}

/** Health score -> colour band. Paired with a numeric label everywhere. */
export function healthTone(health: number): {
  bar: string
  text: string
  hex: string
} {
  if (health >= 85)
    return { bar: 'bg-ok', text: 'text-ok', hex: '#22C55E' }
  if (health >= 65)
    return { bar: 'bg-brand-400', text: 'text-brand-300', hex: '#60A5FA' }
  if (health >= 40)
    return { bar: 'bg-warn', text: 'text-warn', hex: '#F59E0B' }
  return { bar: 'bg-bad', text: 'text-bad', hex: '#F04438' }
}

/* ==========================================================================
   Chart palette
   --------------------------------------------------------------------------
   Fixed-order categorical slots, validated against the chart surface
   (#0F1A2F): every slot sits in the OKLCH lightness band 0.48-0.67, clears a
   0.1 chroma floor, holds >= 3:1 contrast, and the worst adjacent pair
   separates at deltaE 12.9 under simulated protanopia.

   Assign by index in order. Never cycle past slot 8 — fold the remainder into
   an "Other" bucket instead, and never repaint survivors when a filter
   changes the series count.
   ========================================================================== */

export const SERIES = [
  '#2E90FA', // 1 blue
  '#DD6320', // 2 orange
  '#12A88F', // 3 teal
  '#B58700', // 4 amber
  '#D9589A', // 5 magenta
  '#118A33', // 6 green
  '#8878E6', // 7 violet
  '#E45855', // 8 red
] as const

/** Single-hue sequential ramp for magnitude encodings. */
export const SEQUENTIAL = [
  '#CDE2FB',
  '#9EC5F4',
  '#6DA7EC',
  '#3987E5',
  '#256ABF',
  '#184F95',
  '#0D366B',
] as const

/** Chart chrome, matched to the navy plane. */
export const CHART = {
  surface: '#0F1A2F',
  grid: '#1B2942',
  axis: '#263A5C',
  tickInk: '#6B7A99',
  labelInk: '#A7B4CC',
  primaryInk: '#EAF1FF',
} as const

/* ==========================================================================
   Misc
   ========================================================================== */

/** Stable id for client-generated records (alerts raised by a simulation). */
let idCounter = 0
export const localId = (prefix: string): string =>
  `${prefix}-L${String(++idCounter).padStart(4, '0')}`

/** Case-insensitive substring match across several fields of a record. */
export function matchesQuery(query: string, ...fields: (string | undefined)[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => f?.toLowerCase().includes(q))
}
