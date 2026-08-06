/**
 * Application shell — the persistent chrome around every route.
 *
 * Layout is a two-column grid on desktop (fixed rail + scrolling content) and
 * collapses to an overlay drawer below the `lg` breakpoint. The rail can also
 * be collapsed to icons on desktop, which matters on a projector where
 * horizontal space is scarce.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  Bug,
  ChevronsLeft,
  CornerDownLeft,
  FileText,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Menu,
  Radar,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Siren,
  Sparkles,
  X,
} from 'lucide-react'
import { useDataContext } from '@/api/DataContext'
import { PRODUCT_NAME, RESEARCH_TITLE } from '@/lib/research'
import { useAlertFeed } from '@/context/AppState'
import { cn, timeAgo } from '@/lib/utils'
import { SeverityBadge, SourceBadge } from './ui'
import { AIAssistant } from './AIAssistant'

/* ==========================================================================
   Navigation model
   ========================================================================== */

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  /** Shown in the collapsed rail tooltip and the quick-search results. */
  hint: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        to: '/dashboard',
        label: 'Executive Dashboard',
        icon: LayoutDashboard,
        hint: 'Fleet posture, threat trend and security score',
      },
      {
        to: '/analytics',
        label: 'Analytics',
        icon: BarChart3,
        hint: 'Threat frequency, risk distribution and recovery outcomes',
      },
    ],
  },
  {
    title: 'Assets',
    items: [
      {
        to: '/devices',
        label: 'IoT Devices',
        icon: Boxes,
        hint: 'Inventory of 40 managed endpoints with health and risk',
      },
      {
        to: '/network',
        label: 'Network Activity',
        icon: Activity,
        hint: 'Live event timeline across the device estate',
      },
    ],
  },
  {
    title: 'Threat Intelligence',
    items: [
      {
        to: '/malware',
        label: 'Malware Analysis',
        icon: Bug,
        hint: 'Ten IoT malware families with IOCs and mitigations',
      },
      {
        to: '/detection',
        label: 'Threat Detection',
        icon: Radar,
        hint: 'Run attack scenarios against the model',
      },
      {
        to: '/alerts',
        label: 'Security Alerts',
        icon: Siren,
        hint: 'Triage queue with filtering, search and sorting',
      },
    ],
  },
  {
    title: 'Formal Methods',
    items: [
      {
        to: '/petri-net',
        label: 'Coloured Petri Nets',
        icon: GitBranch,
        hint: 'Interactive CPN model with animated token flow',
      },
      {
        to: '/verification',
        label: 'Formal Verification',
        icon: ShieldCheck,
        hint: 'CTL and LTL property results with counterexamples',
      },
    ],
  },
  {
    title: 'Response',
    items: [
      {
        to: '/resilience',
        label: 'Resilience Center',
        icon: Gauge,
        hint: 'Containment, recovery workflow and stability score',
      },
      {
        to: '/reports',
        label: 'Incident Reports',
        icon: FileText,
        hint: 'Executive assessment with PDF export',
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        to: '/settings',
        label: 'Settings',
        icon: SettingsIcon,
        hint: 'Detection thresholds, interface options and API status',
      },
    ],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

/* ==========================================================================
   Brand mark
   ========================================================================== */

function BrandMark({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      to="/"
      className="flex items-center gap-3 rounded-xl px-1 py-1 transition hover:opacity-90"
      aria-label="IoTShield Verify — return to the landing page"
    >
      <span className="relative grid size-9 shrink-0 place-items-center rounded-xl border border-brand-400/30 bg-gradient-to-br from-brand-500/25 to-ice-500/15 shadow-glow">
        <ShieldCheck className="size-[18px] text-brand-200" aria-hidden />
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold leading-tight tracking-tight text-ink-100">
            IoTShield <span className="text-brand-300">Verify</span>
          </span>
          <span className="block truncate text-[10px] leading-tight text-ink-500">
            Formal Verification Platform
          </span>
        </span>
      )}
    </Link>
  )
}

/* ==========================================================================
   Sidebar
   ========================================================================== */

function SidebarContent({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean
  onNavigate?: () => void
}) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Modules">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          {!collapsed && (
            <p className="eyebrow px-3 pb-1.5">{group.title}</p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition duration-200',
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-brand-500/12 text-ink-100'
                          : 'text-ink-300 hover:bg-white/[0.05] hover:text-ink-100',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active marker is a shape, not just a colour shift. */}
                        {isActive && (
                          <motion.span
                            layoutId="nav-active"
                            className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-400 shadow-glow"
                            transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                          />
                        )}
                        <Icon
                          className={cn(
                            'size-[17px] shrink-0 transition',
                            isActive
                              ? 'text-brand-300'
                              : 'text-ink-500 group-hover:text-ink-300',
                          )}
                          aria-hidden
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** Footer plate reminding the audience that every value on screen is synthetic. */
function DemoNotice({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="px-3 pb-4" title="Demonstration build — synthetic data only">
        <div className="grid h-9 place-items-center rounded-xl border border-warn/25 bg-warn/10 text-warn">
          <Sparkles className="size-4" aria-hidden />
        </div>
      </div>
    )
  }
  return (
    <div className="px-3 pb-4">
      <div className="rounded-xl border border-warn/20 bg-warn/[0.07] p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-warn">
          <Sparkles className="size-3.5" aria-hidden />
          Demonstration build
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
          All devices, telemetry and verification results are synthetic. No real
          hardware or live network traffic is involved.
        </p>
      </div>
    </div>
  )
}

/* ==========================================================================
   Quick search — jump to a module
   ========================================================================== */

function QuickSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const navigate = useNavigate()
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return ALL_ITEMS.filter(
      (i) =>
        i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q),
    ).slice(0, 6)
  }, [query])

  // Dismiss on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Ctrl/Cmd+K focuses the field, matching the convention operators expect.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (to: string) => {
    navigate(to)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Search modules…"
        aria-label="Search modules"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setCursor(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setCursor((c) => Math.min(c + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setCursor((c) => Math.max(c - 1, 0))
          } else if (e.key === 'Enter' && results[cursor]) {
            go(results[cursor].to)
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        className="w-full rounded-xl border border-white/8 bg-navy-850/70 py-2 pl-9 pr-14 text-sm text-ink-100 placeholder:text-ink-700 transition focus:border-brand-400/50 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-ink-500 sm:block">
        ⌘K
      </kbd>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="glass-strong absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl p-1.5"
          >
            {results.map((r, i) => {
              const Icon = r.icon
              return (
                <li key={r.to}>
                  <button
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(r.to)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition',
                      i === cursor ? 'bg-brand-500/15' : 'hover:bg-white/[0.05]',
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-brand-300" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink-100">
                        {r.label}
                      </span>
                      <span className="block truncate text-[11px] text-ink-500">
                        {r.hint}
                      </span>
                    </span>
                    {i === cursor && (
                      <CornerDownLeft className="size-3.5 shrink-0 text-ink-500" aria-hidden />
                    )}
                  </button>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ==========================================================================
   Alerts bell
   ========================================================================== */

function AlertsBell() {
  const { alerts } = useAlertFeed()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const unread = useMemo(
    () => alerts.filter((a) => a.status === 'Open' || a.status === 'Investigating'),
    [alerts],
  )
  const recent = useMemo(() => unread.slice(0, 6), [unread])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Security alerts — ${unread.length} requiring attention`}
        aria-expanded={open}
        className="relative grid size-9 place-items-center rounded-xl border border-white/8 bg-white/[0.03] text-ink-300 transition hover:border-brand-400/35 hover:text-ink-100"
      >
        <Bell className="size-[17px]" aria-hidden />
        {unread.length > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full border border-navy-900 bg-bad px-1 text-[10px] font-semibold leading-4 text-white">
            {unread.length > 99 ? '99+' : unread.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong absolute right-0 top-full z-50 mt-2 w-[min(92vw,26rem)] origin-top-right overflow-hidden rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <p className="text-[13px] font-semibold text-ink-100">
                Active alerts
              </p>
              <span className="text-[11px] text-ink-500">
                {unread.length} open
              </span>
            </div>

            <ul className="max-h-[22rem] divide-y divide-white/[0.04] overflow-y-auto">
              {recent.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => {
                      navigate('/alerts')
                      setOpen(false)
                    }}
                    className="w-full px-4 py-3 text-left transition hover:bg-white/[0.04]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-100">
                        {a.threat}
                      </p>
                      <SeverityBadge severity={a.severity} />
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] text-ink-500">
                      {a.deviceName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {timeAgo(a.timestamp)}
                    </p>
                  </button>
                </li>
              ))}
              {recent.length === 0 && (
                <li className="px-4 py-8 text-center text-xs text-ink-500">
                  No open alerts. The estate is quiet.
                </li>
              )}
            </ul>

            <button
              onClick={() => {
                navigate('/alerts')
                setOpen(false)
              }}
              className="block w-full border-t border-white/[0.06] px-4 py-2.5 text-center text-xs font-medium text-brand-300 transition hover:bg-brand-500/10"
            >
              View all alerts
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ==========================================================================
   Shell
   ========================================================================== */

export function Shell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const location = useLocation()
  const { live, checking } = useDataContext()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setDrawerOpen(false), [location.pathname])

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  const railWidth = collapsed ? 'lg:w-[74px]' : 'lg:w-[264px]'

  return (
    <div className="relative z-10 min-h-svh">
      {/* ---- Desktop rail ------------------------------------------------ */}
      <aside
        className={cn(
          'no-print fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-white/[0.06] bg-navy-880/80 backdrop-blur-xl transition-[width] duration-300 ease-out-quint lg:flex',
          railWidth,
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center border-b border-white/[0.06] px-4',
            collapsed ? 'justify-center px-2' : 'justify-between',
          )}
        >
          <BrandMark collapsed={collapsed} />
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className="grid size-7 place-items-center rounded-lg text-ink-500 transition hover:bg-white/[0.06] hover:text-ink-100"
            >
              <ChevronsLeft className="size-4" aria-hidden />
            </button>
          )}
        </div>

        <SidebarContent collapsed={collapsed} />

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            className="mx-3 mb-2 grid h-9 place-items-center rounded-xl text-ink-500 transition hover:bg-white/[0.06] hover:text-ink-100"
          >
            <ChevronsLeft className="size-4 rotate-180" aria-hidden />
          </button>
        )}

        <DemoNotice collapsed={collapsed} />
      </aside>

      {/* ---- Mobile drawer ----------------------------------------------- */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="no-print fixed inset-0 z-40 bg-navy-950/75 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 40 }}
              className="no-print fixed inset-y-0 left-0 z-50 flex w-[min(84vw,17rem)] flex-col border-r border-white/[0.08] bg-navy-880/95 backdrop-blur-2xl lg:hidden"
              role="dialog"
              aria-label="Navigation"
            >
              <div className="flex h-16 items-center justify-between border-b border-white/[0.06] px-4">
                <BrandMark collapsed={false} />
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation"
                  className="grid size-8 place-items-center rounded-lg text-ink-500 transition hover:bg-white/[0.06] hover:text-ink-100"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <SidebarContent collapsed={false} onNavigate={() => setDrawerOpen(false)} />
              <DemoNotice collapsed={false} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ---- Main column -------------------------------------------------- */}
      <div
        className={cn(
          'flex min-h-svh flex-col transition-[padding] duration-300 ease-out-quint',
          collapsed ? 'lg:pl-[74px]' : 'lg:pl-[264px]',
        )}
      >
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-navy-900/70 px-4 backdrop-blur-xl sm:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/8 bg-white/[0.03] text-ink-300 transition hover:text-ink-100 lg:hidden"
          >
            <Menu className="size-[17px]" aria-hidden />
          </button>

          <div className="hidden flex-1 sm:block">
            <QuickSearch />
          </div>
          <div className="flex-1 sm:hidden" />

          <div className="flex shrink-0 items-center gap-2.5">
            <SourceBadge
              source={checking ? 'loading' : live ? 'live' : 'demo'}
              className="hidden sm:inline-flex"
            />

            <button
              onClick={() => setAssistantOpen(true)}
              aria-label="Open AI security assistant"
              className="hidden items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/12 px-3 py-2 text-xs font-medium text-violet-300 transition hover:bg-violet-500/20 md:inline-flex"
            >
              <Sparkles className="size-4" aria-hidden />
              Assistant
            </button>

            <AlertsBell />

            <div className="ml-1 hidden items-center gap-2.5 border-l border-white/[0.08] pl-3 lg:flex">
              <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-ice-500 text-[11px] font-semibold text-white">
                SA
              </span>
              <span className="leading-tight">
                <span className="block text-[12px] font-medium text-ink-100">
                  Security Analyst
                </span>
                <span className="block text-[10px] text-ink-500">
                  SOC · Tier 2
                </span>
              </span>
            </div>
          </div>
        </header>

        {/* Route content. The key on the motion wrapper drives the page
            transition; ErrorBoundary lives outside it in App so a fault does
            not interrupt the animation. */}
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-[1600px]"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="no-print border-t border-white/[0.05] px-6 py-4">
          <p className="mx-auto max-w-[1600px] text-[11px] leading-relaxed text-ink-700">
            {PRODUCT_NAME} · {RESEARCH_TITLE} — MSc research demonstration.
            Synthetic data throughout; figures are illustrative and are not
            experimental results.
          </p>
        </footer>
      </div>

      <AIAssistant open={assistantOpen} onOpenChange={setAssistantOpen} />
    </div>
  )
}
