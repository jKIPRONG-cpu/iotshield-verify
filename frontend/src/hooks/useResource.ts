/**
 * useResource — fetch-with-fallback.
 *
 * The single data-loading primitive every page uses. It attempts the API and,
 * on any failure (backend down, timeout, bad payload), silently substitutes
 * the bundled demo dataset and reports which one you got via `source`.
 *
 * That contract is what lets the console be demonstrated offline: no page has
 * an empty state caused by a missing backend, and the SourceBadge keeps the
 * substitution honest rather than hidden.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DataSource } from '@/types'

type Fetcher<T> = (signal: AbortSignal) => Promise<T>

export interface ResourceState<T> {
  data: T
  loading: boolean
  source: DataSource
  /** Present when the live call failed; the UI still renders from fallback. */
  error: Error | null
  /** Re-run the fetcher. */
  reload: () => void
}

export function useResource<T>(
  fetcher: Fetcher<T>,
  fallback: T,
  /** Values that should trigger a refetch, as with useEffect deps. */
  deps: readonly unknown[] = [],
): ResourceState<T> {
  const [data, setData] = useState<T>(fallback)
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<DataSource>('loading')
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)

  // Keep the latest fetcher without making it a dependency — inline arrow
  // fetchers are re-created every render and would otherwise loop forever.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const fallbackRef = useRef(fallback)
  fallbackRef.current = fallback

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setLoading(true)
    setSource('loading')

    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (!active) return
        setData(result)
        setSource('live')
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return
        setData(fallbackRef.current)
        setSource('demo')
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { data, loading, source, error, reload }
}
