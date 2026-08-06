/**
 * Typed HTTP client for the IoTShield Verify API.
 *
 * Every call is bounded by an AbortController timeout, so a backend that is
 * absent or hung degrades to the bundled demo dataset in a predictable amount
 * of time rather than leaving a page spinning. That fallback path is the
 * reason the console can be presented with no network at all.
 */

import type {
  Alert,
  Analytics,
  Device,
  MalwareFamily,
  NetworkEvent,
  ReportPayload,
  ResilienceState,
  ScenarioId,
  SimulationResult,
  Summary,
  VerificationRun,
} from '@/types'

/** Overridable at build time via frontend/.env — see .env.example. */
export const API_BASE: string =
  import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

/** Health probes must fail fast; data calls get a longer leash. */
const DEFAULT_TIMEOUT_MS = 6000
const PROBE_TIMEOUT_MS = 2500

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface RequestOptions {
  timeoutMs?: number
  signal?: AbortSignal
  method?: 'GET' | 'POST'
  body?: unknown
}

/**
 * Perform one JSON request against the API.
 *
 * The caller's signal and the internal timeout are both honoured: whichever
 * fires first aborts the request.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    method = 'GET',
    body,
  } = options

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  // Bridge an externally supplied signal into our controller.
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      signal: controller.signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      throw new ApiError(
        `${method} ${path} failed with ${response.status}`,
        response.status,
      )
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Build a query string, omitting empty and undefined values. */
function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== '' && v !== null,
  )
  if (entries.length === 0) return ''
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
}

/* ==========================================================================
   Endpoints
   ========================================================================== */

export const api = {
  /** Liveness probe used by DataContext to pick live vs demo data. */
  async health(signal?: AbortSignal): Promise<{ status: string }> {
    return request('/health', { signal, timeoutMs: PROBE_TIMEOUT_MS })
  },

  summary: (signal?: AbortSignal): Promise<Summary> =>
    request('/summary', { signal }),

  devices: (
    params: { status?: string; q?: string } = {},
    signal?: AbortSignal,
  ): Promise<Device[]> => request(`/devices${qs(params)}`, { signal }),

  device: (id: string, signal?: AbortSignal): Promise<Device> =>
    request(`/devices/${encodeURIComponent(id)}`, { signal }),

  events: (
    params: { limit?: number } = {},
    signal?: AbortSignal,
  ): Promise<NetworkEvent[]> => request(`/events${qs(params)}`, { signal }),

  alerts: (
    params: { severity?: string; q?: string; sort?: string } = {},
    signal?: AbortSignal,
  ): Promise<Alert[]> => request(`/alerts${qs(params)}`, { signal }),

  malware: (signal?: AbortSignal): Promise<MalwareFamily[]> =>
    request('/malware', { signal }),

  verification: (signal?: AbortSignal): Promise<VerificationRun> =>
    request('/verification', { signal }),

  resilience: (signal?: AbortSignal): Promise<ResilienceState> =>
    request('/resilience', { signal }),

  analytics: (signal?: AbortSignal): Promise<Analytics> =>
    request('/analytics', { signal }),

  reports: (signal?: AbortSignal): Promise<ReportPayload> =>
    request('/reports', { signal }),

  /** Absolute URL to the ReportLab-rendered PDF. */
  reportPdfUrl: (): string => `${API_BASE}/reports/pdf`,

  startSimulation: (
    scenario: ScenarioId,
    signal?: AbortSignal,
  ): Promise<SimulationResult> =>
    request('/simulation/start', {
      method: 'POST',
      body: { scenario },
      signal,
      timeoutMs: 12_000,
    }),

  resetSimulation: (signal?: AbortSignal): Promise<{ status: string }> =>
    request('/simulation/reset', { method: 'POST', body: {}, signal }),
}

export type Api = typeof api
