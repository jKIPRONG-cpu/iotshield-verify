/**
 * Global application state.
 *
 * Two jobs:
 *
 *  1. Own the datasets more than one module needs — the device inventory and
 *     the alert feed — so the top-bar bell, the dashboard, and the device
 *     table cannot disagree with each other.
 *
 *  2. Run the attack simulation and publish its effects. A run is the thing
 *     that makes this a system rather than ten separate screens: starting one
 *     changes device status, appends alerts, advances the Petri net, replaces
 *     the verification verdicts, and rewrites the resilience posture. That
 *     fan-out is modelled here as an overlay applied on top of the base data,
 *     so `resetSimulation` is a single discard rather than a re-fetch.
 *
 * No browser storage is used anywhere — state lives for the session only.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  Alert,
  Device,
  ResilienceState,
  ScenarioId,
  SimulationResult,
  SimulationStep,
  VerificationProperty,
} from '@/types'
import { api } from '@/api/client'
import { useResource } from '@/hooks/useResource'
import { mock } from '@/data/mock'
import { buildSimulation, scenarioDurationMs } from '@/lib/simulation'
import type { DataSource } from '@/types'

/* ==========================================================================
   Settings
   ========================================================================== */

export interface AppSettings {
  /* Detection & response */
  realtimeMonitoring: boolean
  autoIsolate: boolean
  verifyOnDetect: boolean
  sensitivity: 'Conservative' | 'Balanced' | 'Aggressive'
  detectionThreshold: number

  /* Interface */
  animations: boolean
  liveEventStream: boolean
  compactDensity: boolean
  showDemoBanner: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  realtimeMonitoring: true,
  autoIsolate: true,
  verifyOnDetect: true,
  sensitivity: 'Balanced',
  detectionThreshold: 78,
  animations: true,
  liveEventStream: true,
  compactDensity: false,
  showDemoBanner: true,
}

/* ==========================================================================
   Simulation runtime state
   ========================================================================== */

export type SimulationStatus = 'idle' | 'running' | 'complete'

export interface SimulationRuntime {
  status: SimulationStatus
  scenario: ScenarioId | null
  /** 0-100 across the scenario's scripted duration. */
  progress: number
  /** Steps emitted so far — the run log animates off this array. */
  emitted: SimulationStep[]
  /** The complete result; available as soon as the run starts. */
  result: SimulationResult | null
  /** Where the scripted result came from. */
  source: DataSource
}

const IDLE_RUNTIME: SimulationRuntime = {
  status: 'idle',
  scenario: null,
  progress: 0,
  emitted: [],
  result: null,
  source: 'demo',
}

/* ==========================================================================
   Context value
   ========================================================================== */

interface AppStateValue {
  /* Shared datasets, with simulation effects already applied. */
  devices: Device[]
  alerts: Alert[]
  devicesSource: DataSource
  alertsSource: DataSource
  devicesLoading: boolean
  alertsLoading: boolean

  /* Simulation-derived overrides — null until a run has happened. */
  verificationOverride: VerificationProperty[] | null
  resilienceOverride: ResilienceState | null

  simulation: SimulationRuntime
  startSimulation: (scenario: ScenarioId) => void
  resetSimulation: () => void

  settings: AppSettings
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  resetSettings: () => void
}

const AppStateContext = createContext<AppStateValue | null>(null)

/* ==========================================================================
   Provider
   ========================================================================== */

/** Playback tick. Fine enough to feel continuous, coarse enough to be cheap. */
const TICK_MS = 100

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [simulation, setSimulation] = useState<SimulationRuntime>(IDLE_RUNTIME)

  // Base datasets. Both fall back to the bundled dataset automatically.
  const devicesRes = useResource<Device[]>(
    (signal) => api.devices({}, signal),
    mock.devices,
  )
  const alertsRes = useResource<Alert[]>(
    (signal) => api.alerts({}, signal),
    mock.alerts,
  )

  /* ---- Simulation playback ---------------------------------------------- */

  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  /**
   * Drive one run. The complete result is resolved first (from the API when
   * it is reachable, locally otherwise), then replayed against the wall clock
   * so every consumer observes the same ordering.
   */
  const startSimulation = useCallback(
    (scenario: ScenarioId) => {
      clearTimer()

      const startedAt = Date.now()
      startedAtRef.current = startedAt
      const duration = scenarioDurationMs(scenario)

      // Local build is immediate, so the UI never waits on the network to
      // begin animating; a live result replaces it if one arrives.
      const localResult = buildSimulation(scenario, devicesRes.data, startedAt)

      setSimulation({
        status: 'running',
        scenario,
        progress: 0,
        emitted: [],
        result: localResult,
        source: 'demo',
      })

      const controller = new AbortController()
      api
        .startSimulation(scenario, controller.signal)
        .then((served) => {
          // Only adopt the served result while this run is still the active
          // one — a reset or a second run must not be overwritten.
          setSimulation((prev) =>
            prev.scenario === scenario && prev.status === 'running'
              ? { ...prev, result: served, source: 'live' }
              : prev,
          )
        })
        .catch(() => {
          /* Local script stands. */
        })

      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAt
        const progress = Math.min(100, (elapsed / duration) * 100)

        setSimulation((prev) => {
          if (prev.status !== 'running' || prev.scenario !== scenario) return prev

          const steps = prev.result?.steps ?? []
          const emitted = steps.filter((s) => s.atOffsetMs <= elapsed)

          if (progress >= 100) {
            clearTimer()
            return {
              ...prev,
              status: 'complete',
              progress: 100,
              emitted: steps,
            }
          }

          return { ...prev, progress, emitted }
        })
      }, TICK_MS)
    },
    [clearTimer, devicesRes.data],
  )

  const resetSimulation = useCallback(() => {
    clearTimer()
    setSimulation(IDLE_RUNTIME)

    // Best-effort: tell the backend to drop its in-memory run too.
    api.resetSimulation().catch(() => {
      /* Nothing to reset when the backend is absent. */
    })
  }, [clearTimer])

  /* ---- Overlay application ---------------------------------------------- */

  /**
   * Device statuses follow the run: compromised once the execution step has
   * fired, isolated after the isolation step, recovering after recovery. That
   * progression is what makes the inventory table visibly react while the
   * scenario is still playing.
   */
  const devices = useMemo<Device[]>(() => {
    const { result, emitted, status } = simulation
    if (!result || result.affectedDeviceIds.length === 0) return devicesRes.data

    const affected = new Set(result.affectedDeviceIds)
    const reached = new Set(emitted.map((s) => s.phase))

    const nextStatus: Device['status'] | null = reached.has('Recovery')
      ? 'Recovering'
      : reached.has('Isolation')
        ? 'Isolated'
        : reached.has('Execution')
          ? 'Compromised'
          : null

    if (!nextStatus && status !== 'complete') return devicesRes.data

    const family = result.alerts[0]?.malwareFamily

    return devicesRes.data.map((device) => {
      if (!affected.has(device.id)) return device
      const applied = nextStatus ?? 'Recovering'
      return {
        ...device,
        status: applied,
        risk:
          applied === 'Compromised'
            ? ('Critical' as const)
            : applied === 'Isolated'
              ? ('High' as const)
              : ('Medium' as const),
        health:
          applied === 'Compromised'
            ? Math.min(device.health, 24)
            : applied === 'Isolated'
              ? Math.min(device.health, 38)
              : Math.min(Math.max(device.health, 55), 68),
        infectedBy: family ?? device.infectedBy,
        lastActivity: new Date().toISOString(),
      }
    })
  }, [devicesRes.data, simulation])

  /**
   * Simulation alerts are prepended so they lead the triage queue.
   *
   * The base list is de-duplicated against them: when the backend is live it
   * prepends its own copy of the run's alerts to `/alerts`, so a naive
   * concatenation would show each one twice and collide on React keys.
   */
  const alerts = useMemo<Alert[]>(() => {
    const { result, emitted } = simulation
    if (!result || result.alerts.length === 0) return alertsRes.data

    const detectionReached = emitted.some((s) => s.phase === 'Detection')
    if (!detectionReached) return alertsRes.data

    const injected = new Set(result.alerts.map((a) => a.id))
    return [...result.alerts, ...alertsRes.data.filter((a) => !injected.has(a.id))]
  }, [alertsRes.data, simulation])

  const verificationOverride = useMemo<VerificationProperty[] | null>(() => {
    const { result, emitted } = simulation
    if (!result) return null
    // Verdicts appear only once the verification step has actually fired.
    return emitted.some((s) => s.phase === 'Verification') ? result.verification : null
  }, [simulation])

  const resilienceOverride = useMemo<ResilienceState | null>(() => {
    const { result, emitted } = simulation
    if (!result) return null
    return emitted.some((s) => s.phase === 'Isolation' || s.phase === 'Recovery')
      ? result.resilience
      : null
  }, [simulation])

  /* ---- Settings ---------------------------------------------------------- */

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const resetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), [])

  /* ---- Reduced-motion honouring ------------------------------------------ */

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (query.matches) {
      setSettings((prev) => ({ ...prev, animations: false }))
    }
  }, [])

  const value = useMemo<AppStateValue>(
    () => ({
      devices,
      alerts,
      devicesSource: devicesRes.source,
      alertsSource: alertsRes.source,
      devicesLoading: devicesRes.loading,
      alertsLoading: alertsRes.loading,
      verificationOverride,
      resilienceOverride,
      simulation,
      startSimulation,
      resetSimulation,
      settings,
      updateSetting,
      resetSettings,
    }),
    [
      devices,
      alerts,
      devicesRes.source,
      devicesRes.loading,
      alertsRes.source,
      alertsRes.loading,
      verificationOverride,
      resilienceOverride,
      simulation,
      startSimulation,
      resetSimulation,
      settings,
      updateSetting,
      resetSettings,
    ],
  )

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  )
}

/* ==========================================================================
   Consumers
   ========================================================================== */

// eslint-disable-next-line react-refresh/only-export-components
export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext)
  if (!ctx) {
    throw new Error('useAppState must be used inside <AppStateProvider>')
  }
  return ctx
}

/** Narrow selector for the top-bar bell, which only needs the feed. */
// eslint-disable-next-line react-refresh/only-export-components
export function useAlertFeed(): { alerts: Alert[]; source: DataSource } {
  const { alerts, alertsSource } = useAppState()
  return { alerts, source: alertsSource }
}

/** Narrow selector for the simulation controls and their observers. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSimulation() {
  const { simulation, startSimulation, resetSimulation } = useAppState()
  return { simulation, startSimulation, resetSimulation }
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  const { settings, updateSetting, resetSettings } = useAppState()
  return { settings, updateSetting, resetSettings }
}
