/**
 * Route table and provider stack.
 *
 * Two layouts:
 *
 *   `/`            the landing page, rendered bare — no sidebar, no top bar,
 *                  so the hero is full-bleed and the page reads as a product
 *                  entry point rather than another module.
 *
 *   everything else  the console, wrapped by <Shell> through a pathless layout
 *                  route. Using <Outlet/> rather than nesting <Routes> keeps
 *                  every console path absolute and readable.
 *
 * HashRouter rather than BrowserRouter: the built bundle is meant to run from
 * any static host or a bare file path during a defence, with no server-side
 * rewrite rules available to it.
 *
 * Provider order matters — DataProvider probes the API, and AppStateProvider
 * consumes that decision when it loads the shared datasets. Both sit above the
 * landing page too, so the console's data is already in flight by the time a
 * viewer clicks "Launch Dashboard".
 */

import { Suspense, lazy } from 'react'
import {
  HashRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { DataProvider } from '@/api/DataContext'
import { AppStateProvider } from '@/context/AppState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Shell } from '@/components/Shell'
import { GlassCard, Skeleton } from '@/components/ui'

/* Route-level code splitting: the landing page and the visualisation-heavy
   console modules load on demand rather than in the entry chunk. */
const Landing = lazy(() => import('@/pages/Landing'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Devices = lazy(() => import('@/pages/Devices'))
const NetworkActivity = lazy(() => import('@/pages/NetworkActivity'))
const MalwareAnalysis = lazy(() => import('@/pages/MalwareAnalysis'))
const ThreatDetection = lazy(() => import('@/pages/ThreatDetection'))
const PetriNet = lazy(() => import('@/pages/PetriNet'))
const Verification = lazy(() => import('@/pages/Verification'))
const Resilience = lazy(() => import('@/pages/Resilience'))
const Reports = lazy(() => import('@/pages/Reports'))
const Alerts = lazy(() => import('@/pages/Alerts'))
const Analytics = lazy(() => import('@/pages/Analytics'))
const Settings = lazy(() => import('@/pages/Settings'))

/** Shown while a console route chunk is in flight. Mirrors a page skeleton. */
function RouteFallback() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-3.5 w-96" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <GlassCard key={i} className="p-5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-4 h-7 w-16" />
            <Skeleton className="mt-3 h-2.5 w-28" />
          </GlassCard>
        ))}
      </div>
      <GlassCard className="p-5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="mt-5 h-64 w-full" />
      </GlassCard>
    </div>
  )
}

/** Minimal fallback for the landing page, which has no console chrome. */
function LandingFallback() {
  return (
    <div className="grid min-h-svh place-items-center bg-navy-900">
      <div className="size-9 animate-spin rounded-full border-2 border-white/10 border-t-brand-400" />
    </div>
  )
}

/**
 * Console layout. Wraps every non-landing route in the persistent shell and
 * contains render faults per route — navigating away clears the boundary.
 */
function ConsoleLayout() {
  const location = useLocation()

  return (
    <Shell>
      <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </Shell>
  )
}

export function App() {
  return (
    <HashRouter>
      <DataProvider>
        <AppStateProvider>
          <Routes>
            {/* Landing — no console chrome. */}
            <Route
              path="/"
              element={
                <ErrorBoundary resetKey="landing">
                  <Suspense fallback={<LandingFallback />}>
                    <Landing />
                  </Suspense>
                </ErrorBoundary>
              }
            />

            {/* Console — pathless layout route supplying the shell. */}
            <Route element={<ConsoleLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/network" element={<NetworkActivity />} />
              <Route path="/malware" element={<MalwareAnalysis />} />
              <Route path="/detection" element={<ThreatDetection />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/petri-net" element={<PetriNet />} />
              <Route path="/verification" element={<Verification />} />
              <Route path="/resilience" element={<Resilience />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Unknown paths return to the landing page. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppStateProvider>
      </DataProvider>
    </HashRouter>
  )
}

export default App
