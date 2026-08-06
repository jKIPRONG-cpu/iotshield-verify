/**
 * Connectivity context.
 *
 * Probes `/health` once at startup and exposes the result to the whole tree.
 * Pages do not branch on this directly — `useResource` handles the fallback —
 * but the top bar surfaces it as a "Live API" / "Demo data" badge so an
 * audience always knows whether they are looking at served or bundled data.
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
import { api, API_BASE } from './client'

interface DataContextValue {
  /** True when the API answered the health probe. */
  live: boolean
  /** True while the probe is in flight. */
  checking: boolean
  /** Base URL the client is pointed at, shown in Settings. */
  apiBase: string
  /** Timestamp of the last completed probe. */
  lastCheckedAt: string | null
  /** Re-run the probe — wired to the Settings "Test connection" button. */
  refresh: () => void
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState(false)
  const [checking, setChecking] = useState(true)
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  // Guards against a state update after unmount when the probe resolves late.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setChecking(true)

    api
      .health(controller.signal)
      .then((res) => {
        if (mounted.current) setLive(res.status === 'ok')
      })
      .catch(() => {
        // An unreachable backend is an expected, supported state — the app
        // runs entirely on bundled data in that case.
        if (mounted.current) setLive(false)
      })
      .finally(() => {
        if (mounted.current) {
          setChecking(false)
          setLastCheckedAt(new Date().toISOString())
        }
      })

    return () => controller.abort()
  }, [nonce])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  const value = useMemo<DataContextValue>(
    () => ({ live, checking, apiBase: API_BASE, lastCheckedAt, refresh }),
    [live, checking, lastCheckedAt, refresh],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDataContext(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) {
    throw new Error('useDataContext must be used inside <DataProvider>')
  }
  return ctx
}
