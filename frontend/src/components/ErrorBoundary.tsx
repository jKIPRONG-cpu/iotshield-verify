/**
 * Route-level error boundary.
 *
 * A render fault in one module must not take the whole console down mid-demo,
 * so the boundary wraps the routed outlet and offers a local recovery path
 * before the user has to reload.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertOctagon, RotateCcw } from 'lucide-react'
import { Button, GlassCard } from './ui'

interface Props {
  children: ReactNode
  /** Changing this value resets the boundary — wired to the route path. */
  resetKey?: string
}

interface State {
  error: Error | null
  info: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In a production deployment this is where the telemetry hook would go.
    console.error('[IoTShield] Render fault contained by ErrorBoundary:', error, info)
    this.setState({ info })
  }

  componentDidUpdate(prev: Props): void {
    // Navigating away from a broken route clears the fault automatically.
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, info: null })
    }
  }

  private reset = () => this.setState({ error: null, info: null })

  render(): ReactNode {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <GlassCard className="max-w-lg p-7" lit>
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-bad/35 bg-bad/12 text-bad">
              <AlertOctagon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink-100">
                This module failed to render
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-300">
                The rest of the console is unaffected. You can retry this view,
                or navigate to another module from the sidebar.
              </p>

              <pre className="mt-4 max-h-40 overflow-auto rounded-xl border border-white/[0.06] bg-navy-950/60 p-3 font-mono text-[11px] leading-relaxed text-bad/90">
                {error.message}
                {info?.componentStack ? `\n${info.componentStack.trim()}` : ''}
              </pre>

              <div className="mt-4 flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<RotateCcw className="size-3.5" />}
                  onClick={this.reset}
                >
                  Retry module
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  Reload console
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    )
  }
}
