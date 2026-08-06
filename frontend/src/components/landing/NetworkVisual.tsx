/**
 * Animated IoT network visualisation for the hero.
 *
 * Pure inline SVG — no images, no canvas, no external assets — so it renders
 * identically with no network access, which matters for a defence on unknown
 * hardware.
 *
 * The node layout is a fixed table rather than randomised, matching the
 * determinism the rest of the application is built on: the graphic looks the
 * same on every load.
 *
 * What it depicts is deliberate rather than decorative. Edge traffic flows
 * inward to a verification core; one endpoint is marked compromised and a
 * containment ring closes around it. That is the platform's actual argument in
 * miniature: detect, verify, contain.
 */

import { motion, useReducedMotion } from 'framer-motion'

/* ==========================================================================
   Layout
   ========================================================================== */

const VIEW = { w: 520, h: 470 }
const CORE = { x: 260, y: 232 }

interface NodeSpec {
  id: string
  x: number
  y: number
  /** Radius of the node dot. */
  r: number
  /** Seconds to offset this node's pulse, so they do not throb in unison. */
  phase: number
  /** The one endpoint the story compromises. */
  hostile?: boolean
}

/**
 * Three loose rings around the core. Positions are hand-placed rather than
 * computed so the mesh reads as a network diagram instead of a perfect
 * geometric flower.
 */
const NODES: NodeSpec[] = [
  { id: 'n1', x: 260, y: 74, r: 6, phase: 0 },
  { id: 'n2', x: 390, y: 112, r: 5, phase: 0.7 },
  { id: 'n3', x: 452, y: 224, r: 6.5, phase: 1.4 },
  { id: 'n4', x: 408, y: 344, r: 5, phase: 2.1 },
  { id: 'n5', x: 292, y: 402, r: 6, phase: 0.35, hostile: true },
  { id: 'n6', x: 158, y: 392, r: 5, phase: 1.05 },
  { id: 'n7', x: 74, y: 288, r: 6.5, phase: 1.75 },
  { id: 'n8', x: 88, y: 158, r: 5, phase: 2.45 },
  { id: 'n9', x: 176, y: 148, r: 4, phase: 0.9 },
  { id: 'n10', x: 348, y: 196, r: 4, phase: 1.6 },
  { id: 'n11', x: 336, y: 300, r: 4, phase: 2.3 },
  { id: 'n12', x: 178, y: 300, r: 4, phase: 0.5 },
]

/** Node-to-node links, drawn under the spokes to suggest a mesh. */
const MESH: [string, string][] = [
  ['n1', 'n2'],
  ['n2', 'n3'],
  ['n3', 'n4'],
  ['n4', 'n5'],
  ['n5', 'n6'],
  ['n6', 'n7'],
  ['n7', 'n8'],
  ['n8', 'n1'],
  ['n9', 'n10'],
  ['n11', 'n12'],
]

const byId = new Map(NODES.map((n) => [n.id, n]))

/* ==========================================================================
   Component
   ========================================================================== */

export function NetworkVisual() {
  const reduced = useReducedMotion()

  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      {/* Ambient glow behind the graphic. Non-interactive. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 blur-3xl"
        style={{
          background:
            'radial-gradient(closest-side, rgba(59,130,246,0.20), transparent 72%)',
        }}
      />

      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label="Animated diagram: IoT endpoints exchanging traffic with a central formal-verification core, with one compromised endpoint being isolated."
      >
        <defs>
          <linearGradient id="nv-edge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.25" />
          </linearGradient>

          <radialGradient id="nv-core">
            <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#3B82F6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </radialGradient>

          <filter id="nv-glow" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ---- Orbit rings ------------------------------------------------ */}
        {[188, 132, 76].map((r, i) => (
          <motion.circle
            key={r}
            cx={CORE.x}
            cy={CORE.y}
            r={r}
            fill="none"
            stroke="#1C2C48"
            strokeWidth="1"
            strokeDasharray="3 7"
            animate={reduced ? undefined : { rotate: i % 2 === 0 ? 360 : -360 }}
            transition={{ duration: 90 + i * 30, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: `${CORE.x}px ${CORE.y}px` }}
          />
        ))}

        {/* ---- Mesh links -------------------------------------------------- */}
        <g stroke="#1C2C48" strokeWidth="1" fill="none">
          {MESH.map(([a, b]) => {
            const from = byId.get(a)!
            const to = byId.get(b)!
            return (
              <line key={`${a}-${b}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            )
          })}
        </g>

        {/* ---- Spokes with traffic flowing inward -------------------------- */}
        <g fill="none">
          {NODES.map((node, i) => (
            <g key={`spoke-${node.id}`}>
              <line
                x1={node.x}
                y1={node.y}
                x2={CORE.x}
                y2={CORE.y}
                stroke="url(#nv-edge)"
                strokeWidth={node.hostile ? 1.6 : 1.1}
              />
              {/* A short dash travelling toward the core reads as a packet in
                  flight without needing per-frame JavaScript. */}
              {!reduced && (
                <motion.line
                  x1={node.x}
                  y1={node.y}
                  x2={CORE.x}
                  y2={CORE.y}
                  stroke={node.hostile ? '#F04438' : '#22D3EE'}
                  strokeWidth={node.hostile ? 2 : 1.5}
                  strokeLinecap="round"
                  strokeDasharray="14 300"
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: -314 }}
                  transition={{
                    duration: 2.6,
                    repeat: Infinity,
                    ease: 'linear',
                    delay: (i % 6) * 0.45,
                  }}
                  opacity={0.9}
                />
              )}
            </g>
          ))}
        </g>

        {/* ---- Endpoint nodes ---------------------------------------------- */}
        {NODES.map((node) => (
          <g key={node.id}>
            {/* Soft halo */}
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={node.r + 6}
              fill={node.hostile ? '#F04438' : '#3B82F6'}
              opacity={0.14}
              animate={reduced ? undefined : { scale: [1, 1.35, 1], opacity: [0.14, 0.05, 0.14] }}
              transition={{
                duration: 3.4,
                repeat: Infinity,
                delay: node.phase,
                ease: 'easeInOut',
              }}
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
            />
            <circle
              cx={node.x}
              cy={node.y}
              r={node.r}
              fill={node.hostile ? '#F04438' : '#93C5FD'}
              filter="url(#nv-glow)"
            />
          </g>
        ))}

        {/* ---- Containment ring around the compromised endpoint ------------ */}
        {!reduced &&
          (() => {
            const hostile = NODES.find((n) => n.hostile)!
            return (
              <motion.circle
                cx={hostile.x}
                cy={hostile.y}
                r={22}
                fill="none"
                stroke="#F04438"
                strokeWidth="1.6"
                strokeDasharray="4 5"
                animate={{ opacity: [0, 0.95, 0.95, 0], scale: [0.55, 1, 1, 1.25] }}
                transition={{
                  duration: 5,
                  times: [0, 0.25, 0.75, 1],
                  repeat: Infinity,
                  repeatDelay: 1.6,
                  ease: 'easeOut',
                }}
                style={{ transformOrigin: `${hostile.x}px ${hostile.y}px` }}
              />
            )
          })()}

        {/* ---- Radar sweep --------------------------------------------------
            Scaled rather than animated on the `r` attribute: Framer Motion can
            emit `r="undefined"` mid-transition on SVG geometry attributes, and
            a transform is cheaper to composite than a geometry change. */}
        {!reduced && (
          <motion.circle
            cx={CORE.x}
            cy={CORE.y}
            r={40}
            fill="none"
            stroke="#22D3EE"
            strokeWidth="1.2"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: [1, 4.9], opacity: [0.5, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeOut' }}
            style={{ transformOrigin: `${CORE.x}px ${CORE.y}px` }}
          />
        )}

        {/* ---- Verification core -------------------------------------------- */}
        <circle cx={CORE.x} cy={CORE.y} r={62} fill="url(#nv-core)" />
        <circle
          cx={CORE.x}
          cy={CORE.y}
          r={40}
          fill="#0B1524"
          stroke="#3B82F6"
          strokeWidth="1.4"
        />
        <motion.circle
          cx={CORE.x}
          cy={CORE.y}
          r={48}
          fill="none"
          stroke="#22D3EE"
          strokeWidth="1"
          strokeDasharray="60 220"
          animate={reduced ? undefined : { rotate: 360 }}
          transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: `${CORE.x}px ${CORE.y}px` }}
        />

        {/* Shield glyph, drawn rather than imported so it needs no icon font. */}
        <g
          transform={`translate(${CORE.x - 15} ${CORE.y - 17})`}
          fill="none"
          stroke="#BFDBFE"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 1 29 6v11c0 8.5-6 13.5-14 16-8-2.5-14-7.5-14-16V6L15 1Z" />
          <path d="m8.5 17 4.5 4.6L22 12.4" strokeWidth="2.4" />
        </g>
      </svg>

      {/* Floating captions anchor the graphic to real capability rather than
          leaving it as abstract decoration. */}
      <FloatingChip
        className="left-0 top-6"
        tone="ok"
        label="38 endpoints monitored"
      />
      <FloatingChip
        className="right-0 top-1/3"
        tone="brand"
        label="6 properties model-checked"
      />
      <FloatingChip
        className="bottom-8 left-4"
        tone="bad"
        label="1 endpoint contained"
      />
    </div>
  )
}

/* ==========================================================================
   Floating chip
   ========================================================================== */

const CHIP_TONE = {
  ok: 'border-ok/30 bg-ok/10 text-ok',
  brand: 'border-brand-400/30 bg-brand-500/12 text-brand-200',
  bad: 'border-bad/35 bg-bad/12 text-bad',
} as const

function FloatingChip({
  label,
  tone,
  className,
}: {
  label: string
  tone: keyof typeof CHIP_TONE
  className?: string
}) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`absolute hidden rounded-full border px-3 py-1.5 text-[11px] font-medium backdrop-blur-md lg:inline-flex ${CHIP_TONE[tone]} ${className ?? ''}`}
    >
      {label}
    </motion.span>
  )
}
