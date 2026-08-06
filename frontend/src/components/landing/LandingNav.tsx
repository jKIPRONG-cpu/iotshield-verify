/**
 * Landing page navigation.
 *
 * Transparent over the hero, glass once the viewer scrolls past it — so the
 * hero reads full-bleed but the navigation stays legible over content.
 *
 * Section links are native anchors rather than router links: they are
 * same-page jumps, and an `<a href="#id">` gets correct keyboard activation,
 * middle-click, and "copy link address" behaviour at no cost.
 */

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, ShieldCheck, X } from 'lucide-react'
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '@/lib/research'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '#overview', label: 'Overview' },
  { href: '#modules', label: 'Modules' },
  { href: '#architecture', label: 'Architecture' },
  { href: '#capabilities', label: 'Capabilities' },
  { href: '#why', label: 'Why Verification' },
]

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-white/[0.07] bg-navy-950/80 backdrop-blur-xl'
          : 'border-b border-transparent',
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-8"
      >
        {/* ---- Brand -------------------------------------------------------- */}
        <a href="#top" className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand-400/30 bg-gradient-to-br from-brand-500/25 to-ice-500/15 shadow-glow">
            <ShieldCheck className="size-[18px] text-brand-200" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold leading-tight tracking-tight text-ink-100">
              {PRODUCT_NAME.split(' ')[0]}{' '}
              <span className="text-brand-300">{PRODUCT_NAME.split(' ')[1]}</span>
            </span>
            <span className="hidden text-[10px] leading-tight text-ink-500 sm:block">
              {PRODUCT_TAGLINE}
            </span>
          </span>
        </a>

        {/* ---- Desktop links ------------------------------------------------ */}
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-ink-300 transition hover:bg-white/[0.06] hover:text-ink-100"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* ---- Mobile trigger ------------------------------------------------
            No call to action lives in the bar; the hero owns that. With the
            desktop link list right-aligned by `justify-between`, the bar stays
            balanced on both breakpoints. */}
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-ink-300 transition hover:text-ink-100 md:hidden"
        >
          <Menu className="size-[17px]" aria-hidden />
        </button>
      </nav>

      {/* ---- Mobile sheet ---------------------------------------------------- */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-navy-950/80 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-3 top-3 z-50 rounded-2xl border border-white/[0.09] bg-navy-880/95 p-4 backdrop-blur-2xl md:hidden"
              role="dialog"
              aria-label="Menu"
            >
              <div className="flex items-center justify-between pb-3">
                <span className="text-[13px] font-semibold text-ink-100">
                  {PRODUCT_NAME}
                </span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="grid size-8 place-items-center rounded-lg text-ink-500 transition hover:bg-white/[0.06] hover:text-ink-100"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              <ul className="space-y-0.5 border-t border-white/[0.06] pt-3">
                {LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-300 transition hover:bg-white/[0.06] hover:text-ink-100"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
