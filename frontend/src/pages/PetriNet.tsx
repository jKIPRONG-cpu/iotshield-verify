/**
 * Coloured Petri Net — the core module.
 *
 * An interactive, executable model of the detection-and-recovery pipeline.
 * Tokens carry a colour; transition guards test it; the same structure routes
 * benign and malicious traffic differently on colour alone.
 *
 * The module exists to make one argument visible: Analyse Behaviour and Detect
 * Malware compete for tokens in the hazardous place, so isolation is
 * *reachable* without being *inevitable*. Let it run and the deferral counter
 * climbs — that counter is the containment counterexample, observed rather
 * than asserted.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  ChevronRight,
  CircleDot,
  GitBranch,
  Info,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Timer,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { useAppState } from '@/context/AppState'
import {
  ARCS,
  COLOUR_ORDER,
  COLOURS,
  PLACES,
  TRANSITIONS,
  placeById,
  transitionById,
  type TokenColour,
} from '@/components/petri/model'
import {
  initialState,
  inject,
  markingOf,
  step as fireStep,
  type NetState,
} from '@/components/petri/engine'
import {
  nodeTypes,
  type PlaceNodeData,
  type TransitionNodeData,
} from '@/components/petri/nodes'
import {
  Button,
  GlassCard,
  PageHeader,
  SectionTitle,
  Tabs,
} from '@/components/ui'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Playback
   ========================================================================== */

type Speed = 'slow' | 'normal' | 'fast'

const SPEED_MS: Record<Speed, number> = {
  slow: 1500,
  normal: 850,
  fast: 380,
}

/* ==========================================================================
   Inspector
   ========================================================================== */

function Inspector({
  selectedId,
  net,
}: {
  selectedId: string | null
  net: NetState
}) {
  const place = selectedId ? placeById.get(selectedId) : undefined
  const transition = selectedId ? transitionById.get(selectedId) : undefined

  if (!place && !transition) {
    return (
      <div className="px-1 py-6 text-center">
        <CircleDot className="mx-auto size-6 text-ink-700" aria-hidden />
        <p className="mt-3 text-[13px] font-medium text-ink-300">
          Select a place or transition
        </p>
        <p className="mx-auto mt-1 max-w-[24ch] text-[11px] leading-relaxed text-ink-500">
          The inspector shows its role in the model, its guard, and what it
          means for the verification results.
        </p>
      </div>
    )
  }

  if (place) {
    const marking = markingOf(net.tokens).get(place.id)
    const total = marking
      ? [...marking.values()].reduce((a, b) => a + b, 0)
      : 0

    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-brand-400/30 bg-brand-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-brand-300">
              Place
            </span>
            {place.hazard && (
              <span className="rounded-md border border-bad/35 bg-bad/12 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-bad">
                Hazardous
              </span>
            )}
            {place.safe && (
              <span className="rounded-md border border-ok/30 bg-ok/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ok">
                Safe
              </span>
            )}
          </div>
          <h3 className="mt-2 text-[15px] font-semibold text-ink-100">
            {place.label}
          </h3>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-300">
            {place.description}
          </p>
        </div>

        <div className="glass-sunken p-3">
          <p className="eyebrow">Current marking</p>
          {total === 0 ? (
            <p className="mt-1.5 font-mono text-[12px] text-ink-500">empty</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {[...(marking?.entries() ?? [])].map(([colour, count]) => (
                <li key={colour} className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: COLOURS[colour].hex }}
                    aria-hidden
                  />
                  <span className="font-mono text-[12px] text-ink-100">
                    {count}`{colour}
                  </span>
                  <span className="ml-auto text-[10.5px] text-ink-500">
                    {COLOURS[colour].label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  const t = transition!
  const isEnabled = net.enabled.includes(t.id)

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-violet-400/30 bg-violet-500/12 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-violet-300">
            Transition
          </span>
          <span
            className={cn(
              'rounded-md border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em]',
              isEnabled
                ? 'border-ok/30 bg-ok/10 text-ok'
                : 'border-white/10 bg-white/5 text-ink-500',
            )}
          >
            {isEnabled ? 'Enabled' : 'Not enabled'}
          </span>
        </div>
        <h3 className="mt-2 text-[15px] font-semibold text-ink-100">{t.label}</h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-300">
          {t.description}
        </p>
      </div>

      <div className="glass-sunken p-3">
        <p className="eyebrow">Guard</p>
        <code className="mt-1.5 block font-mono text-[12px] text-brand-200">
          {t.guard}
        </code>
      </div>

      <div className="glass-sunken p-3">
        <p className="eyebrow">Arcs</p>
        <ul className="mt-2 space-y-1 font-mono text-[11px] text-ink-300">
          {t.input.map((i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="text-ink-500">{placeById.get(i)?.label}</span>
              <ChevronRight className="size-3 text-brand-400" aria-hidden />
              <span>{t.label}</span>
            </li>
          ))}
          {[...new Set(t.outcomes.map((o) => o.to))].map((o) => (
            <li key={o} className="flex items-center gap-1.5">
              <span>{t.label}</span>
              <ChevronRight className="size-3 text-brand-400" aria-hidden />
              <span className="text-ink-500">{placeById.get(o)?.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ==========================================================================
   Canvas
   ========================================================================== */

function NetCanvas({
  net,
  selectedId,
  onSelect,
}: {
  net: NetState
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const marking = useMemo(() => markingOf(net.tokens), [net.tokens])

  const firingTransitions = useMemo(
    () => new Set(net.lastFirings.map((f) => f.transition)),
    [net.lastFirings],
  )

  const touchedPlaces = useMemo(() => {
    const s = new Set<string>()
    for (const f of net.lastFirings) {
      s.add(f.from)
      s.add(f.to)
    }
    return s
  }, [net.lastFirings])

  /**
   * Nodes are created with fully-formed data rather than an empty object:
   * React Flow paints them once before the marking effect below runs, so a
   * partially-populated `data` would fault on that first render.
   */
  const initialNodes = useMemo<Node[]>(
    () => [
      ...PLACES.map((p) => ({
        id: p.id,
        type: 'place',
        position: { x: p.x, y: p.y },
        data: {
          label: p.label,
          marking: [],
          total: 0,
          hazard: p.hazard,
          safe: p.safe,
          selected: false,
          active: false,
        } satisfies PlaceNodeData as PlaceNodeData,
        draggable: false,
      })),
      ...TRANSITIONS.map((t) => ({
        id: t.id,
        type: 'transition',
        position: { x: t.x, y: t.y },
        data: {
          label: t.label,
          guard: t.guard,
          enabled: false,
          firing: false,
          selected: false,
        } satisfies TransitionNodeData as TransitionNodeData,
        draggable: false,
      })),
    ],
    [],
  )

  const initialEdges = useMemo<Edge[]>(
    () =>
      ARCS.map((arc) => ({
        id: arc.id,
        source: arc.source,
        target: arc.target,
        type: 'smoothstep',
        animated: false,
        label: arc.label,
        labelStyle: { fill: '#43506B', fontSize: 9, fontFamily: 'monospace' },
        labelBgStyle: { fill: 'transparent' },
        style: { stroke: '#1C2C48', strokeWidth: 1.4 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#1C2C48', width: 14, height: 14 },
      })),
    [],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Push engine state into node data on every step.
  useEffect(() => {
    setNodes((current) =>
      current.map((node) => {
        if (node.type === 'place') {
          const spec = placeById.get(node.id)!
          const byColour = marking.get(node.id)
          const entries = COLOUR_ORDER.filter((c) => byColour?.get(c))
            .map((c) => [c, byColour!.get(c)!] as [TokenColour, number])
          const total = entries.reduce((sum, [, n]) => sum + n, 0)

          return {
            ...node,
            data: {
              label: spec.label,
              marking: entries,
              total,
              hazard: spec.hazard,
              safe: spec.safe,
              selected: selectedId === node.id,
              active: touchedPlaces.has(node.id),
            } satisfies PlaceNodeData,
          }
        }

        const spec = transitionById.get(node.id)!
        return {
          ...node,
          data: {
            label: spec.label,
            guard: spec.guard,
            enabled: net.enabled.includes(node.id),
            firing: firingTransitions.has(node.id),
            selected: selectedId === node.id,
          } satisfies TransitionNodeData,
        }
      }),
    )
  }, [marking, net.enabled, firingTransitions, touchedPlaces, selectedId, setNodes])

  // Light up the arcs a token actually traversed this step.
  useEffect(() => {
    const active = new Set<string>()
    for (const f of net.lastFirings) {
      active.add(`${f.from}->${f.transition}`)
      active.add(`${f.transition}->${f.to}`)
    }

    setEdges((current) =>
      current.map((edge) => {
        const isActive = active.has(edge.id)
        const colour: TokenColour | null = isActive
          ? (net.lastFirings.find(
              (f) =>
                `${f.from}->${f.transition}` === edge.id ||
                `${f.transition}->${f.to}` === edge.id,
            )?.colourAfter ?? 'benign')
          : null

        const hex = colour ? COLOURS[colour].hex : '#1C2C48'

        return {
          ...edge,
          animated: isActive,
          style: {
            stroke: hex,
            strokeWidth: isActive ? 2.2 : 1.4,
            filter: isActive ? `drop-shadow(0 0 5px ${hex})` : undefined,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: hex,
            width: 14,
            height: 14,
          },
        }
      }),
    )
  }, [net.lastFirings, setEdges])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      fitView
      fitViewOptions={{ padding: 0.14 }}
      minZoom={0.3}
      maxZoom={1.6}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      elementsSelectable
      className="bg-transparent"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={22}
        size={1}
        color="#1C2C48"
      />
      <Controls
        showInteractive={false}
        className="!bottom-4 !left-4 overflow-hidden rounded-lg !border !border-white/10 !shadow-lg"
      />
    </ReactFlow>
  )
}

/* ==========================================================================
   Page
   ========================================================================== */

export default function PetriNet() {
  const { simulation } = useAppState()

  const [net, setNet] = useState<NetState>(() => initialState())
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>('normal')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const timerRef = useRef<number | null>(null)

  const doStep = useCallback(() => {
    setNet((current) => fireStep(current))
  }, [])

  const reset = useCallback(() => {
    setPlaying(false)
    setNet(initialState())
    setSelectedId(null)
  }, [])

  /* ---- Playback loop ---------------------------------------------------- */
  useEffect(() => {
    if (!playing) {
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
      return
    }
    timerRef.current = window.setInterval(doStep, SPEED_MS[speed])
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [playing, speed, doStep])

  /* ---- Simulation coupling ----------------------------------------------
     A scenario running in Threat Detection injects tokens into the places its
     script names, so the net advances in step with the run log rather than
     independently of it. */
  const injectedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (simulation.status === 'idle') {
      injectedRef.current.clear()
      return
    }

    const colourFor = (place: string): TokenColour =>
      place === 'malware'
        ? 'malicious'
        : place === 'suspicious'
          ? 'suspect'
          : place === 'verify'
            ? 'verified'
            : place === 'isolate' || place === 'recover'
              ? 'contained'
              : 'benign'

    for (const emitted of simulation.emitted) {
      if (!emitted.place || injectedRef.current.has(emitted.id)) continue
      injectedRef.current.add(emitted.id)
      const place = emitted.place
      setNet((current) => inject(current, place, colourFor(place)))
    }
  }, [simulation.emitted, simulation.status])

  const stats = net.stats
  const hazardTokens = net.tokens.filter((t) => t.place === 'malware').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coloured Petri Net"
        subtitle="An executable model of the detection and recovery pipeline — ten places, eight transitions, five token colours"
        icon={<GitBranch className="size-5" aria-hidden />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={speed}
              onChange={setSpeed}
              options={[
                { value: 'slow', label: 'Slow' },
                { value: 'normal', label: 'Normal' },
                { value: 'fast', label: 'Fast' },
              ]}
            />
          </div>
        }
      />

      {/* ---- Transport controls --------------------------------------------- */}
      <GlassCard className="flex flex-wrap items-center gap-3 p-4">
        <Button
          variant={playing ? 'subtle' : 'primary'}
          icon={playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Button
          variant="outline"
          icon={<SkipForward className="size-4" />}
          onClick={doStep}
          disabled={playing}
        >
          Step
        </Button>
        <Button
          variant="outline"
          icon={<RotateCcw className="size-4" />}
          onClick={reset}
        >
          Reset
        </Button>

        <div className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-2">
          {[
            { label: 'Step', value: net.step, icon: Timer },
            { label: 'Firings', value: stats.fired, icon: Zap },
            { label: 'Detections', value: stats.detections, icon: Activity },
            { label: 'Isolations', value: stats.isolations, icon: Sparkles },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <s.icon className="size-3.5 text-ink-500" aria-hidden />
              <span className="text-[11px] text-ink-500">{s.label}</span>
              <span className="tabular text-sm font-semibold text-ink-100">
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ---- The containment counterexample, counted live ------------------- */}
      <AnimatePresence>
        {stats.containmentDeferrals > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-wrap items-start gap-3 rounded-2xl border border-bad/30 bg-bad/[0.08] px-4 py-3.5"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink-100">
                Containment deferred {stats.containmentDeferrals} time
                {stats.containmentDeferrals === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-300">
                A token left Malware Execution back to Suspicious Behaviour
                instead of progressing to Detection. Each occurrence is one
                witness to{' '}
                <code className="font-mono text-bad">
                  AG (MalwareExecution → AF Isolated)
                </code>{' '}
                failing: isolation stays reachable, but the scheduler is free to
                keep choosing the analysis branch, so it is never guaranteed.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Canvas + inspector ---------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <GlassCard className="overflow-hidden" lit>
          <div
            className="w-full"
            style={{ height: 'clamp(420px, 58vh, 620px)' }}
          >
            <ReactFlowProvider>
              <NetCanvas
                net={net}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </ReactFlowProvider>
          </div>

          {/* Legend — every colour is named, so identity is never hue alone. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.06] px-5 py-3">
            <span className="eyebrow">Token colours</span>
            {COLOUR_ORDER.map((c) => (
              <span
                key={c}
                className="flex items-center gap-1.5"
                title={COLOURS[c].description}
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{
                    background: COLOURS[c].hex,
                    boxShadow: `0 0 6px ${COLOURS[c].hex}88`,
                  }}
                  aria-hidden
                />
                <span className="text-[11px] text-ink-300">
                  {COLOURS[c].label}
                </span>
              </span>
            ))}
            {hazardTokens > 0 && (
              <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-bad">
                <TriangleAlert className="size-3.5" aria-hidden />
                {hazardTokens} token{hazardTokens === 1 ? '' : 's'} in the
                hazardous place
              </span>
            )}
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="p-5" lit>
            <SectionTitle
              title="Inspector"
              icon={<Info className="size-[18px]" aria-hidden />}
            />
            <div className="mt-4">
              <Inspector selectedId={selectedId} net={net} />
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <SectionTitle
              title="Colour set"
              subtitle="What makes this net coloured"
              icon={<CircleDot className="size-[18px]" aria-hidden />}
            />
            <pre className="glass-sunken mt-3.5 overflow-x-auto p-3 font-mono text-[10.5px] leading-relaxed text-ink-300">
{`colset TRUST  = with unknown
              | authenticated
              | quarantined;
colset THREAT = with none
              | suspected
              | confirmed;
colset DEVICE = record
   id     : STRING
 * trust  : TRUST
 * threat : THREAT;

var d : DEVICE;`}
            </pre>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
              Guards test the token's colour, so one structure routes benign and
              malicious traffic down different paths without duplicating the
              net. That is the economy a coloured net buys over a plain
              place/transition model.
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
