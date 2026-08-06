/**
 * Section 6 — Closing call to action and footer.
 *
 * The footer carries the required "Research Project" label with the official
 * title reproduced verbatim from RESEARCH_TITLE, alongside navigation and the
 * synthetic-data disclaimer that must travel with this work wherever it is
 * shown.
 */

import { Link } from 'react-router-dom'
import { ArrowRight, FileText, Radar, ShieldCheck, Sparkles } from 'lucide-react'
import {
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  RESEARCH_TITLE,
} from '@/lib/research'
import { Reveal } from './primitives'

const MODULE_LINKS = [
  { to: '/dashboard', label: 'Executive Dashboard' },
  { to: '/devices', label: 'IoT Devices' },
  { to: '/network', label: 'Network Activity' },
  { to: '/malware', label: 'Malware Analysis' },
  { to: '/detection', label: 'Threat Detection' },
]

const FORMAL_LINKS = [
  { to: '/petri-net', label: 'Coloured Petri Nets' },
  { to: '/verification', label: 'Formal Verification' },
  { to: '/resilience', label: 'Resilience Center' },
  { to: '/reports', label: 'Incident Reports' },
  { to: '/analytics', label: 'Analytics' },
]

const PAGE_LINKS = [
  { href: '#overview', label: 'Research Overview' },
  { href: '#modules', label: 'Core Modules' },
  { href: '#architecture', label: 'System Architecture' },
  { href: '#capabilities', label: 'Capabilities' },
  { href: '#why', label: 'Why Formal Verification' },
]

export function LandingFooter() {
  return (
    <>
      {/* ==================================================================
          Closing call to action
          ================================================================== */}
      <section className="relative overflow-hidden border-t border-white/[0.06] px-5 py-20 sm:px-8 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(680px 340px at 50% 0%, rgba(59,130,246,0.16), transparent 68%),' +
              'radial-gradient(520px 280px at 82% 90%, rgba(34,211,238,0.10), transparent 65%)',
          }}
        />

        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/25 bg-brand-500/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">
              <Sparkles className="size-3.5" aria-hidden />
              Ready to explore
            </span>

            <h2 className="mt-5 text-balance text-[27px] font-semibold leading-tight tracking-tight text-ink-100 sm:text-[34px]">
              Run an attack scenario and watch the whole system respond
            </h2>

            <p className="mt-4 text-pretty text-[15px] leading-relaxed text-ink-300">
              One run changes device status, raises alerts, moves tokens through
              the Coloured Petri Net, recomputes the verification verdicts, and
              rewrites the resilience posture — in front of you, in about ten
              seconds.
            </p>

            <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
              {/* Each label names where it actually goes. The primary action
                  here is the scenario runner, not the dashboard — the section
                  copy is about launching a run. */}
              <Link
                to="/detection"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-brand-400/40 bg-gradient-to-b from-brand-500 to-brand-600 px-6 py-3 text-[15px] font-medium text-white shadow-glow transition hover:from-brand-400 hover:to-brand-500"
              >
                <Radar className="size-[18px]" aria-hidden />
                Run a scenario
                <ArrowRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>

              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-6 py-3 text-[15px] font-medium text-ink-100 transition hover:border-brand-400/40 hover:bg-brand-500/10 hover:text-brand-200"
              >
                <ShieldCheck className="size-[18px]" aria-hidden />
                Launch Dashboard
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ==================================================================
          Footer
          ================================================================== */}
      <footer className="border-t border-white/[0.06] bg-navy-950/60 px-5 py-14 sm:px-8">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
            {/* ---- Research identity ------------------------------------- */}
            <div>
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-400/30 bg-gradient-to-br from-brand-500/25 to-ice-500/15 shadow-glow">
                  <ShieldCheck className="size-5 text-brand-200" aria-hidden />
                </span>
                <div>
                  <p className="text-[14px] font-semibold leading-tight text-ink-100">
                    {PRODUCT_NAME.split(' ')[0]}{' '}
                    <span className="text-brand-300">
                      {PRODUCT_NAME.split(' ')[1]}
                    </span>
                  </p>
                  <p className="text-[11px] leading-tight text-ink-500">
                    {PRODUCT_TAGLINE}
                  </p>
                </div>
              </div>

              {/* Required footer content: the label and the official title. */}
              <div className="mt-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-300">
                  Research Project
                </p>
                <p className="mt-2 max-w-md text-balance text-[15px] font-medium leading-snug text-ink-100">
                  {RESEARCH_TITLE}
                </p>
              </div>

              <p className="mt-5 max-w-md text-[11.5px] leading-relaxed text-ink-700">
                MSc research demonstration. All devices, telemetry, alerts and
                verification statistics are synthetic. Malware tradecraft is
                summarised from public reporting; quantitative figures are
                illustrative and are not experimental results.
              </p>
            </div>

            {/* ---- Link columns ------------------------------------------ */}
            <FooterColumn title="Modules" links={MODULE_LINKS} />
            <FooterColumn title="Formal Methods" links={FORMAL_LINKS} />

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-500">
                This Page
              </h3>
              <ul className="mt-4 space-y-2.5">
                {PAGE_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-[13px] text-ink-300 transition hover:text-brand-300"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ---- Bottom bar ---------------------------------------------- */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-6 sm:flex-row">
            <p className="text-[11.5px] text-ink-700">
              © {new Date().getFullYear()} {PRODUCT_NAME} · Demonstration build ·
              Synthetic data throughout
            </p>

            <div className="flex items-center gap-4">
              <Link
                to="/reports"
                className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-500 transition hover:text-brand-300"
              >
                <FileText className="size-3.5" aria-hidden />
                Incident Reports
              </Link>
              <Link
                to="/settings"
                className="text-[11.5px] text-ink-500 transition hover:text-brand-300"
              >
                Settings
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}

/* ==========================================================================
   Footer column
   ========================================================================== */

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: { to: string; label: string }[]
}) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-500">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="text-[13px] text-ink-300 transition hover:text-brand-300"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
