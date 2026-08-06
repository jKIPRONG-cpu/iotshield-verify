/**
 * Coloured Petri Net — custom React Flow nodes.
 *
 * Two node types, drawn to the usual CPN conventions:
 *
 *   Place      — a circle holding coloured tokens, with the marking beneath it.
 *   Transition — a filled bar, highlighted while enabled and flashed on firing.
 *
 * Both carry handles on all four sides so the hand-placed layout can route
 * arcs sensibly without React Flow guessing.
 */

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { motion } from 'framer-motion'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { COLOURS, type TokenColour } from './model'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Place
   ========================================================================== */

export interface PlaceNodeData extends Record<string, unknown> {
  label: string
  /** Token count per colour currently in this place. */
  marking: [TokenColour, number][]
  total: number
  hazard?: boolean
  safe?: boolean
  selected?: boolean
  /** True on the step a token entered or left, used for the pulse. */
  active?: boolean
}

const HANDLE_STYLE = { opacity: 0, width: 1, height: 1 } as const

function PlaceNodeImpl({ data }: NodeProps) {
  const d = data as PlaceNodeData
  // Defensive: React Flow can paint a node before the marking effect runs.
  const marking = d.marking ?? []
  const total = d.total ?? 0
  const dominant = marking[0]?.[0]
  const ring = dominant ? COLOURS[dominant].hex : '#1C2C48'

  return (
    <div className="relative flex w-[132px] flex-col items-center">
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} id="t" />
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} id="b" />

      <motion.div
        animate={
          d.active
            ? { scale: [1, 1.09, 1], transition: { duration: 0.5 } }
            : { scale: 1 }
        }
        className={cn(
          'relative grid size-[62px] place-items-center rounded-full border-2 transition-colors duration-300',
          d.selected ? 'border-brand-300' : 'border-navy-600',
        )}
        style={{
          background:
            total > 0
              ? `radial-gradient(circle at 50% 40%, ${ring}33, rgba(12,21,38,0.94))`
              : 'rgba(12,21,38,0.9)',
          borderColor: total > 0 ? ring : undefined,
          boxShadow: total > 0 ? `0 0 20px -4px ${ring}88` : undefined,
        }}
      >
        {/* Hazard / safe glyph sits behind the tokens as a state cue. */}
        {total === 0 && d.hazard && (
          <AlertTriangle className="size-4 text-bad/50" aria-hidden />
        )}
        {total === 0 && d.safe && (
          <ShieldCheck className="size-4 text-ok/45" aria-hidden />
        )}

        {/* Tokens. Up to five dots are drawn individually; beyond that the
            count badge below carries the number. */}
        <div className="flex max-w-[46px] flex-wrap items-center justify-center gap-[3px]">
          {marking.flatMap(([colour, count]) =>
            Array.from({ length: Math.min(count, 5) }, (_, i) => (
              <motion.span
                key={`${colour}-${i}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 480, damping: 26 }}
                className="size-[9px] rounded-full"
                style={{
                  background: COLOURS[colour].hex,
                  boxShadow: `0 0 6px ${COLOURS[colour].hex}`,
                }}
                title={COLOURS[colour].label}
              />
            )),
          )}
        </div>

        {total > 5 && (
          <span className="tabular absolute -right-1.5 -top-1.5 grid min-w-[20px] place-items-center rounded-full border border-navy-900 bg-navy-700 px-1 text-[10px] font-semibold text-ink-100">
            {total}
          </span>
        )}
      </motion.div>

      <p
        className={cn(
          'mt-2 text-center text-[11px] font-medium leading-tight',
          d.selected ? 'text-brand-200' : 'text-ink-300',
        )}
      >
        {d.label}
      </p>

      {/* Marking in CPN notation, e.g. 2`benign ++ 1`malicious */}
      {total > 0 && (
        <p className="mt-0.5 max-w-[124px] text-center font-mono text-[9.5px] leading-tight text-ink-500">
          {marking.map(([c, n]) => `${n}\`${c}`).join(' ++ ')}
        </p>
      )}
    </div>
  )
}

export const PlaceNode = memo(PlaceNodeImpl)

/* ==========================================================================
   Transition
   ========================================================================== */

export interface TransitionNodeData extends Record<string, unknown> {
  label: string
  guard: string
  enabled?: boolean
  firing?: boolean
  selected?: boolean
}

function TransitionNodeImpl({ data }: NodeProps) {
  const d = data as TransitionNodeData

  return (
    <div className="relative flex w-[124px] flex-col items-center">
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} id="t" />
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} id="b" />

      <motion.div
        animate={
          d.firing
            ? {
                scaleY: [1, 1.55, 1],
                transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
              }
            : { scaleY: 1 }
        }
        className={cn(
          'h-[26px] w-[15px] rounded-[3px] border transition-colors duration-200',
          d.firing
            ? 'border-brand-200 bg-brand-300'
            : d.enabled
              ? 'border-brand-400/70 bg-brand-500/70'
              : d.selected
                ? 'border-brand-300 bg-navy-600'
                : 'border-navy-500 bg-navy-600',
        )}
        style={
          d.firing
            ? { boxShadow: '0 0 20px 2px rgba(147,197,253,0.75)' }
            : d.enabled
              ? { boxShadow: '0 0 12px -2px rgba(59,130,246,0.7)' }
              : undefined
        }
      />

      <p
        className={cn(
          'mt-1.5 text-center text-[10.5px] font-semibold leading-tight',
          d.enabled || d.firing
            ? 'text-brand-200'
            : d.selected
              ? 'text-brand-200'
              : 'text-ink-500',
        )}
      >
        {d.label}
      </p>
      <p className="mt-0.5 text-center font-mono text-[9px] leading-tight text-ink-700">
        {d.guard}
      </p>
    </div>
  )
}

export const TransitionNode = memo(TransitionNodeImpl)

export const nodeTypes = {
  place: PlaceNode,
  transition: TransitionNode,
}
