/**
 * Landing page primitives.
 *
 * Every marketing section is assembled from these four pieces, so vertical
 * rhythm, reveal timing and heading hierarchy are decided once here rather
 * than re-invented per section.
 */

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Reveal
   ========================================================================== */

/**
 * Scroll-triggered entrance. Fires once, so scrolling back up does not replay
 * the animation — repeated motion on a page a viewer is re-reading is noise.
 *
 * `prefers-reduced-motion` is handled globally in index.css, which collapses
 * every transition duration; this component needs no separate branch.
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode
  /** Seconds to stagger behind its siblings. */
  delay?: number
  /** Pixels to travel upward on entry. */
  y?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ==========================================================================
   Section shell
   ========================================================================== */

/**
 * The outer `<section>`. The `id` matters beyond styling: the hero's
 * "View System Architecture" button and the landing navigation both scroll to
 * these anchors, so every section needs a stable one.
 */
export function SectionShell({
  id,
  children,
  className,
  /** Draws a hairline rule above the section. */
  divider = false,
}: {
  id: string
  children: ReactNode
  className?: string
  divider?: boolean
}) {
  return (
    <section
      id={id}
      // `scroll-mt` keeps the sticky navigation from covering the heading when
      // an anchor is jumped to.
      className={cn(
        'relative scroll-mt-24 px-5 py-20 sm:px-8 sm:py-24 lg:py-28',
        divider && 'border-t border-white/[0.06]',
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[1200px]">{children}</div>
    </section>
  )
}

/* ==========================================================================
   Section heading
   ========================================================================== */

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/25 bg-brand-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">
      {children}
    </span>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  align?: 'center' | 'left'
  className?: string
}) {
  return (
    <div
      className={cn(
        'max-w-3xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
      </Reveal>

      <Reveal delay={0.06}>
        <h2 className="mt-4 text-balance text-[26px] font-semibold leading-tight tracking-tight text-ink-100 sm:text-[32px] lg:text-[38px]">
          {title}
        </h2>
      </Reveal>

      {description && (
        <Reveal delay={0.12}>
          <p className="mt-4 text-pretty text-[15px] leading-relaxed text-ink-300 sm:text-base">
            {description}
          </p>
        </Reveal>
      )}
    </div>
  )
}

/* ==========================================================================
   Stat strip
   ========================================================================== */

export interface Stat {
  value: string
  label: string
  /** Optional clarifier shown beneath the label. */
  detail?: string
  /**
   * Icon rendered beside the label. Lucide rather than emoji, so the glyph
   * inherits the accent colour, stays crisp at any size, and renders
   * identically on every platform — emoji do none of those things and would be
   * the only non-Lucide iconography in the product.
   */
  icon?: ReactNode
  /** Accent applied to the icon. Defaults to the brand blue. */
  accent?: string
}

/** A row of headline figures. Used under the hero and the research overview. */
export function StatStrip({
  stats,
  className,
}: {
  stats: Stat[]
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.05] sm:grid-cols-4',
        className,
      )}
    >
      {stats.map((stat, i) => (
        <Reveal key={stat.label} delay={i * 0.06}>
          <div className="group h-full bg-navy-900/85 px-4 py-5 text-center transition-colors duration-300 hover:bg-navy-850/85 sm:px-5">
            <dt className="sr-only">{stat.label}</dt>
            <dd>
              {stat.icon && (
                <span
                  className="mx-auto mb-2.5 grid size-9 place-items-center rounded-xl border transition duration-300"
                  style={{
                    color: stat.accent ?? '#60A5FA',
                    borderColor: `${stat.accent ?? '#60A5FA'}3D`,
                    background: `${stat.accent ?? '#60A5FA'}12`,
                  }}
                  aria-hidden
                >
                  {stat.icon}
                </span>
              )}

              <span className="tabular block bg-gradient-to-b from-ink-100 to-brand-300 bg-clip-text text-2xl font-semibold text-transparent sm:text-[28px]">
                {stat.value}
              </span>
              <span className="mt-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500">
                {stat.label}
              </span>
              {stat.detail && (
                <span className="mt-1 block text-[11px] leading-relaxed text-ink-700">
                  {stat.detail}
                </span>
              )}
            </dd>
          </div>
        </Reveal>
      ))}
    </dl>
  )
}
