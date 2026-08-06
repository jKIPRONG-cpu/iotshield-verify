/**
 * Hero section.
 *
 * The official research title is rendered as a SINGLE unbroken text node. It is
 * tempting to split it across styled spans for a designed line break, but a
 * split heading can copy-paste and read aloud as something other than the
 * official wording. `text-balance` handles the wrapping instead, and the
 * gradient is applied to the whole heading rather than to fragments of it.
 *
 * Two calls to action, as specified: "Launch Dashboard" crosses into the
 * console, "View System Architecture" scrolls to the architecture section on
 * this page.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Bug,
  CheckCircle2,
  ChevronDown,
  GitBranch,
  Network,
  RadioTower,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { RESEARCH_SUBTITLE, RESEARCH_TITLE } from '@/lib/research'
import { NetworkVisual } from './NetworkVisual'
import { Reveal, StatStrip, type Stat } from './primitives'

/**
 * Figures describing the demonstration environment, not measured results.
 *
 * Icons are Lucide rather than emoji so they inherit the accent colour, stay
 * crisp at any size, and render identically across platforms.
 */
const HERO_STATS: Stat[] = [
  {
    value: '40',
    label: 'IoT endpoints',
    detail: 'Ten device classes',
    icon: <RadioTower className="size-[18px]" />,
    accent: '#22D3EE',
  },
  {
    value: '10',
    label: 'Malware families',
    detail: 'With IOCs and mitigations',
    icon: <Bug className="size-[18px]" />,
    accent: '#F04438',
  },
  {
    value: '6',
    label: 'Formal properties',
    detail: 'CTL and LTL',
    icon: <CheckCircle2 className="size-[18px]" />,
    accent: '#22C55E',
  },
  {
    value: '5',
    label: 'Attack scenarios',
    detail: 'Scripted end to end',
    icon: <ShieldAlert className="size-[18px]" />,
    accent: '#A78BFA',
  },
]

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden px-5 pb-20 pt-28 sm:px-8 sm:pb-24 sm:pt-32 lg:pb-28 lg:pt-36"
    >
      {/* ---- Background ---------------------------------------------------- */}
      <HeroBackdrop />

      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        {/* ---- Copy -------------------------------------------------------- */}
        <div className="relative z-10 text-center lg:text-left">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/25 bg-brand-500/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">
              <Sparkles className="size-3.5" aria-hidden />
              MSc Research · Formal Methods for IoT Security
            </span>
          </Reveal>

          {/* The official research title, reproduced verbatim. */}
          <Reveal delay={0.08}>
            <h1 className="mt-6 text-balance bg-gradient-to-br from-white via-ink-100 to-brand-200 bg-clip-text text-[30px] font-semibold leading-[1.14] tracking-tight text-transparent sm:text-[42px] lg:text-[50px]">
              {RESEARCH_TITLE}
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-[15px] leading-relaxed text-ink-300 sm:text-[17px] lg:mx-0">
              {RESEARCH_SUBTITLE}
            </p>
          </Reveal>

          {/* ---- Calls to action ------------------------------------------ */}
          <Reveal delay={0.24}>
            <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
              <Link
                to="/dashboard"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-brand-400/40 bg-gradient-to-b from-brand-500 to-brand-600 px-6 py-3 text-[15px] font-medium text-white shadow-glow transition duration-200 hover:from-brand-400 hover:to-brand-500"
              >
                <ShieldCheck className="size-[18px]" aria-hidden />
                Launch Dashboard
                <ArrowRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>

              <a
                href="#architecture"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-6 py-3 text-[15px] font-medium text-ink-100 transition duration-200 hover:border-brand-400/40 hover:bg-brand-500/10 hover:text-brand-200"
              >
                <Network className="size-[18px]" aria-hidden />
                View System Architecture
              </a>
            </div>
          </Reveal>

          {/* Positioning line, then the honesty note. Two weights rather than
              one block, so the framing reads first and the caveat still lands. */}
          <Reveal delay={0.32}>
            <p className="mt-7 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[12.5px] font-medium text-ink-300 lg:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-brand-400" aria-hidden />
                Research Demonstration Platform
              </span>
              <span className="text-ink-700" aria-hidden>
                •
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GitBranch className="size-3.5 text-violet-400" aria-hidden />
                Powered by Formal Verification &amp; Coloured Petri Nets
              </span>
            </p>
          </Reveal>

          <Reveal delay={0.38}>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-700">
              All devices, telemetry and verification results are synthetic. No
              real hardware or live network traffic is involved.
            </p>
          </Reveal>
        </div>

        {/* ---- Visualisation --------------------------------------------- */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10"
        >
          <NetworkVisual />
        </motion.div>
      </div>

      {/* ---- Headline figures ---------------------------------------------- */}
      <div className="mx-auto mt-16 w-full max-w-[1200px] sm:mt-20">
        <StatStrip stats={HERO_STATS} />
      </div>

      <ScrollCue />
    </section>
  )
}

/* ==========================================================================
   Scroll cue
   ========================================================================== */

/**
 * Signals that content continues below the fold.
 *
 * It is a real anchor, not a decoration — clicking it jumps to the first
 * section, so the cue is useful rather than merely suggestive. It fades out
 * once the viewer has actually scrolled, because an indicator that keeps
 * bouncing after you have taken its advice is just noise.
 */
function ScrollCue() {
  const reduced = useReducedMotion()
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY > 90)
    onScroll()

    // Child effects run before parent ones, so this component reads scrollY
    // before <Landing> has reset it to the top. Arriving from a scrolled
    // console route would otherwise start the cue hidden. Re-check on the next
    // frame, once that reset has happened.
    const frame = requestAnimationFrame(onScroll)

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: hidden ? 0 : 1 }}
      transition={{ duration: 0.5, delay: hidden ? 0 : 1.1 }}
      // Once faded, stop intercepting clicks over the content beneath it.
      style={{ pointerEvents: hidden ? 'none' : 'auto' }}
      className="mt-12 flex justify-center sm:mt-14"
    >
      <a
        href="#overview"
        className="group inline-flex flex-col items-center gap-2 rounded-xl px-4 py-2 text-ink-500 transition hover:text-brand-300"
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.16em]">
          Scroll to explore
        </span>

        <motion.span
          className="grid size-8 place-items-center rounded-full border border-white/10 bg-white/[0.03] transition group-hover:border-brand-400/40 group-hover:bg-brand-500/10"
          animate={reduced ? undefined : { y: [0, 5, 0] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown className="size-4" aria-hidden />
        </motion.span>
      </a>
    </motion.div>
  )
}

/* ==========================================================================
   Backdrop
   ========================================================================== */

/**
 * Layered, non-interactive background: a fine grid, two colour washes, and a
 * fade to the page plane so the hero dissolves into the sections below rather
 * than ending on a hard edge.
 */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(59,130,246,0.07) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(59,130,246,0.07) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage:
            'radial-gradient(ellipse 90% 60% at 50% 0%, black 30%, transparent 78%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 90% 60% at 50% 0%, black 30%, transparent 78%)',
        }}
      />

      {/* Colour washes */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(760px 420px at 18% 8%, rgba(59,130,246,0.16), transparent 62%),' +
            'radial-gradient(660px 380px at 84% 18%, rgba(34,211,238,0.11), transparent 60%),' +
            'radial-gradient(900px 460px at 50% 96%, rgba(167,139,250,0.09), transparent 66%)',
        }}
      />

      {/* Fade into the page plane */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-navy-900" />
    </div>
  )
}
