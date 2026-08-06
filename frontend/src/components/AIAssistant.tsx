/**
 * AI Security Assistant.
 *
 * A scripted co-pilot drawer. Answers are pre-written but assembled against
 * live application state — the current simulation, the failed properties, the
 * compromised device count — so what it says matches what is on screen rather
 * than reading as canned filler.
 *
 * DEMO NOTE: there is no model behind this. Responses are deterministic
 * templates, and the drawer says so.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen,
  Bot,
  CornerDownLeft,
  Gauge,
  Lightbulb,
  Send,
  ShieldQuestion,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useAppState } from '@/context/AppState'
import { mock } from '@/data/mock'
import { cn, formatClock } from '@/lib/utils'
import type { AssistantMessage } from '@/types'
import { Button } from './ui'

/* ==========================================================================
   Answer generation
   ========================================================================== */

type PromptKey =
  | 'explain'
  | 'why-failed'
  | 'mitigation'
  | 'summarize'
  | 'resilience'

interface SuggestedPrompt {
  key: PromptKey
  question: string
  icon: typeof Bot
}

const PROMPTS: SuggestedPrompt[] = [
  { key: 'explain', question: 'Explain this attack.', icon: BookOpen },
  { key: 'why-failed', question: 'Why did verification fail?', icon: ShieldQuestion },
  { key: 'mitigation', question: 'Suggest mitigation.', icon: Lightbulb },
  { key: 'summarize', question: 'Summarize the incident.', icon: Sparkles },
  { key: 'resilience', question: 'How resilient is the system?', icon: Gauge },
]

/** Loose keyword routing so free-typed questions land on a sensible answer. */
function routeQuestion(text: string): PromptKey {
  const q = text.toLowerCase()
  if (/(why|fail|verif|property|counterexample|ctl|ltl)/.test(q)) return 'why-failed'
  if (/(mitigat|fix|remediat|recommend|harden|patch)/.test(q)) return 'mitigation'
  if (/(summar|report|incident|overview|what happened)/.test(q)) return 'summarize'
  if (/(resilien|recover|stability|contain|posture)/.test(q)) return 'resilience'
  return 'explain'
}

interface AnswerContext {
  scenarioLabel: string | null
  outcome: string | null
  affected: number
  compromised: number
  failedProps: { name: string; reason: string; recommendation: string }[]
  containment: number
  recovery: number
  stability: number
  riskReduction: number
  mttdSec: number
  mttcSec: number
}

function buildAnswer(key: PromptKey, ctx: AnswerContext): { content: string; refs: string[] } {
  const failed = ctx.failedProps
  const scenario = ctx.scenarioLabel

  switch (key) {
    case 'explain': {
      if (!scenario) {
        return {
          content: [
            'No scenario has been run yet, so there is no active attack to explain.',
            '',
            'The baseline model currently carries two known violations — Malware Containment and Data Leakage Prevention — which are structural properties of the Coloured Petri Net rather than the consequence of any particular intrusion.',
            '',
            'Launch a scenario from Threat Detection and ask again: I will walk through that run\'s kill chain step by step.',
          ].join('\n'),
          refs: ['Threat Detection', 'Formal Verification'],
        }
      }
      return {
        content: [
          `**${scenario}** — kill chain as observed in this run.`,
          '',
          '1. **Reconnaissance.** The attacker enumerated the estate looking for an exposed management surface. Nothing is compromised at this stage; the traffic is only anomalous in shape, not content.',
          '2. **Initial access.** Credentials or a known firmware vulnerability got a session on the device. This is the point where posture — patch level and whether factory credentials were ever rotated — decides the outcome.',
          '3. **Execution.** A payload ran on the endpoint. The implant then removed its own artefacts and suppressed the watchdog so the device could not reboot itself clean.',
          '4. **Detection.** Three independent indicators correlated above the confidence threshold, which is what triggered the automatic response rather than a single noisy signal.',
          '5. **Containment.** Affected endpoints were moved to the quarantine VLAN and their egress blackholed.',
          '',
          `This run touched **${ctx.affected} device${ctx.affected === 1 ? '' : 's'}**.`,
          ctx.outcome ? `\n**Outcome:** ${ctx.outcome}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        refs: ['Threat Detection', 'Network Activity', 'Malware Analysis'],
      }
    }

    case 'why-failed': {
      if (failed.length === 0) {
        return {
          content: [
            'Nothing is failing right now — all six properties are satisfied against the current marking.',
            '',
            'Worth being precise about what that means: the two properties that fail in the baseline model, Malware Containment and Data Leakage Prevention, are *vacuously* satisfied here because no token has reached Malware Execution. The violation has not been fixed; this run simply never visits the marking that exposes it.',
          ].join('\n'),
          refs: ['Formal Verification'],
        }
      }
      return {
        content: [
          `${failed.length} propert${failed.length === 1 ? 'y is' : 'ies are'} violated against the current marking.`,
          '',
          ...failed.flatMap((p) => [
            `**${p.name}**`,
            p.reason,
            '',
          ]),
          'The distinction that matters for the thesis: these are not detector failures. The detector worked — containment happened in practice. What the model checker is telling you is that containment is *possible*, not *inevitable*. A scheduler that keeps choosing the analysis branch can defer isolation indefinitely, and no amount of testing would surface that, because it is a property of the state space rather than of any single execution.',
        ].join('\n'),
        refs: ['Formal Verification', 'Coloured Petri Nets'],
      }
    }

    case 'mitigation': {
      const recs = failed.map((p) => p.recommendation)
      return {
        content: [
          '**Recommended remediation, highest leverage first.**',
          '',
          ...(recs.length > 0
            ? recs.map((r, i) => `${i + 1}. *Model correction* — ${r}`)
            : ['1. *Model* — no structural correction is outstanding for the current marking.']),
          `${recs.length + 1}. *Credentials* — reject vendor defaults at enrolment and force rotation at first boot. The majority of the intrusions modelled here begin with a credential that was never changed.`,
          `${recs.length + 2}. *Segmentation* — deny Telnet (23/2323) inbound at every segment boundary and block DHT bootstrap egress from device VLANs. This removes both the primary entry vector and the peer-to-peer control channel.`,
          `${recs.length + 3}. *Firmware* — ${ctx.compromised > 0 ? `reflash the ${ctx.compromised} compromised endpoint${ctx.compromised === 1 ? '' : 's'} from a verified vendor image rather than attempting in-place cleanup; memory-resident stages do not survive a reflash but do survive a reboot.` : 'keep verified offline images for every model in the estate so recovery never depends on vendor availability.'}`,
          '',
          'Order matters: the model correction is what converts containment from a hopeful outcome into a guaranteed one. The rest reduce how often you need it.',
        ].join('\n'),
        refs: ['Formal Verification', 'Resilience Center', 'Malware Analysis'],
      }
    }

    case 'summarize': {
      return {
        content: [
          '**Incident summary**',
          '',
          scenario
            ? `A **${scenario}** scenario was executed against the modelled estate.`
            : 'No scenario has been executed in this session; the figures below describe the standing baseline.',
          '',
          `- **Devices affected:** ${ctx.affected}`,
          `- **Currently compromised:** ${ctx.compromised}`,
          `- **Mean time to detect:** ${ctx.mttdSec}s`,
          `- **Mean time to contain:** ${ctx.mttcSec}s`,
          `- **Properties violated:** ${failed.length} of 6`,
          '',
          ctx.outcome ?? 'The estate is at its baseline posture.',
          '',
          'The full assessment — affected assets, timeline, verification table and recommendations — is available under Incident Reports, and exports to PDF.',
        ].join('\n'),
        refs: ['Incident Reports', 'Resilience Center'],
      }
    }

    case 'resilience': {
      const verdict =
        ctx.stability >= 85
          ? 'The system is holding well.'
          : ctx.stability >= 65
            ? 'The system is degraded but stable.'
            : 'The system is under meaningful strain.'
      return {
        content: [
          `**${verdict}**`,
          '',
          `- **Containment:** ${ctx.containment}%`,
          `- **Recovery:** ${ctx.recovery}%`,
          `- **Risk reduction:** ${ctx.riskReduction}%`,
          `- **Stability:** ${ctx.stability}%`,
          '',
          ctx.containment >= 85
            ? 'Containment is strong: affected devices reach quarantine quickly and the blast radius stays bounded.'
            : 'Containment is the weak link. Where control is peer-to-peer rather than centralised there is no single choke point to close, so isolation has to be applied across the whole segment at once — which is slower and costlier.',
          '',
          `Detection at ${ctx.mttdSec}s and containment at ${ctx.mttcSec}s are both inside the response envelope. The honest caveat is the one the model checker raises: fast containment in these runs is a property of the observed schedules, not a guarantee. Until the priority guard is added, resilience here is empirical rather than proven.`,
        ].join('\n'),
        refs: ['Resilience Center', 'Formal Verification'],
      }
    }
  }
}

/* ==========================================================================
   Markdown-lite rendering
   ========================================================================== */

/** Renders **bold**, *italic*, list items and blank lines. Nothing more. */
function RichText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.trim() === '') return <div key={i} className="h-1.5" />

        const isBullet = /^[-*]\s/.test(line.trim())
        const isNumbered = /^\d+\.\s/.test(line.trim())
        const content = isBullet ? line.trim().slice(2) : line

        const parts = content.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean)

        const rendered = parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={j} className="font-semibold text-ink-100">
                {part.slice(2, -2)}
              </strong>
            )
          }
          if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return (
              <em key={j} className="text-brand-200 not-italic">
                {part.slice(1, -1)}
              </em>
            )
          }
          return <span key={j}>{part}</span>
        })

        return (
          <p
            key={i}
            className={cn(
              'text-[13px] leading-relaxed text-ink-300',
              (isBullet || isNumbered) && 'pl-3',
            )}
          >
            {isBullet && <span className="mr-1.5 text-brand-400">▪</span>}
            {rendered}
          </p>
        )
      })}
    </div>
  )
}

/* ==========================================================================
   Drawer
   ========================================================================== */

const GREETING: AssistantMessage = {
  id: 'greeting',
  role: 'assistant',
  content: [
    "I'm the IoTShield security co-pilot. I can read the current fleet posture, the active simulation, and the formal-verification results.",
    '',
    'Try one of the questions below, or ask your own.',
  ].join('\n'),
  at: new Date().toISOString(),
}

export function AIAssistant({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { simulation, devices, verificationOverride, resilienceOverride } = useAppState()
  const [messages, setMessages] = useState<AssistantMessage[]>([GREETING])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  /** Assemble the state the answers are written against. */
  const context = useMemo<AnswerContext>(() => {
    const properties = verificationOverride ?? mock.verification.properties
    const resilience = resilienceOverride ?? mock.resilience
    const result = simulation.result

    return {
      scenarioLabel:
        simulation.status === 'idle' ? null : (result?.scenarioLabel ?? null),
      outcome: simulation.status === 'complete' ? (result?.outcome ?? null) : null,
      affected: result?.affectedDeviceIds.length ?? 0,
      compromised: devices.filter((d) => d.status === 'Compromised').length,
      failedProps: properties
        .filter((p) => p.status === 'Failed')
        .map((p) => ({
          name: p.name,
          reason: p.reason,
          recommendation: p.recommendation,
        })),
      containment: resilience.containment,
      recovery: resilience.recovery,
      stability: resilience.stability,
      riskReduction: resilience.riskReduction,
      mttdSec: resilience.mttdSec,
      mttcSec: resilience.mttcSec,
    }
  }, [simulation, devices, verificationOverride, resilienceOverride])

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, thinking])

  // Escape closes the drawer.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const ask = (question: string) => {
    if (!question.trim() || thinking) return

    const userMessage: AssistantMessage = {
      id: `m-${++seq.current}`,
      role: 'user',
      content: question.trim(),
      at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])
    setDraft('')
    setThinking(true)

    // A short, deliberate delay — instantaneous replies read as canned.
    window.setTimeout(() => {
      const { content, refs } = buildAnswer(routeQuestion(question), context)
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${++seq.current}`,
          role: 'assistant',
          content,
          refs,
          at: new Date().toISOString(),
        },
      ])
      setThinking(false)
    }, 620)
  }

  return (
    <>
      {/* Floating launcher — always available, hidden while the drawer is open. */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            onClick={() => onOpenChange(true)}
            aria-label="Open AI security assistant"
            className="no-print fixed bottom-6 right-6 z-40 grid size-13 place-items-center rounded-2xl border border-violet-400/35 bg-gradient-to-br from-violet-500/30 to-brand-500/25 text-violet-200 shadow-raise backdrop-blur-xl transition hover:scale-105 hover:border-violet-300/50"
            style={{ width: 52, height: 52 }}
          >
            <Sparkles className="size-5" aria-hidden />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onOpenChange(false)}
              className="no-print fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm"
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 38 }}
              role="dialog"
              aria-label="AI security assistant"
              className="no-print fixed inset-y-0 right-0 z-50 flex w-[min(100vw,30rem)] flex-col border-l border-white/[0.08] bg-navy-880/95 backdrop-blur-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl border border-violet-400/30 bg-violet-500/15 text-violet-300">
                    <Bot className="size-[18px]" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-ink-100">
                      Security Assistant
                    </p>
                    <p className="text-[11px] text-ink-500">
                      Scripted responses · no live model
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setMessages([GREETING])}
                    aria-label="Clear conversation"
                    className="grid size-8 place-items-center rounded-lg text-ink-500 transition hover:bg-white/[0.06] hover:text-ink-100"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                  <button
                    onClick={() => onOpenChange(false)}
                    aria-label="Close assistant"
                    className="grid size-8 place-items-center rounded-lg text-ink-500 transition hover:bg-white/[0.06] hover:text-ink-100"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              </div>

              {/* Conversation */}
              <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      'flex',
                      m.role === 'user' ? 'justify-end' : 'justify-start',
                    )}
                  >
                    {m.role === 'user' ? (
                      <div className="max-w-[85%] rounded-2xl rounded-br-md border border-brand-400/30 bg-brand-500/15 px-3.5 py-2.5">
                        <p className="text-[13px] leading-relaxed text-ink-100">
                          {m.content}
                        </p>
                        <p className="mt-1 text-right text-[10px] text-ink-500">
                          {formatClock(m.at)}
                        </p>
                      </div>
                    ) : (
                      <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                        <RichText text={m.content} />
                        {m.refs && m.refs.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[0.05] pt-2.5">
                            {m.refs.map((r) => (
                              <span
                                key={r}
                                className="rounded-md border border-violet-400/25 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-300"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}

                {thinking && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/[0.07] bg-white/[0.03] px-4 py-3"
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="size-1.5 rounded-full bg-violet-300"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 1.1,
                          repeat: Infinity,
                          delay: i * 0.18,
                        }}
                      />
                    ))}
                    <span className="ml-1 text-[11px] text-ink-500">
                      Correlating current state…
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Suggested prompts */}
              <div className="border-t border-white/[0.06] px-5 py-3">
                <p className="eyebrow pb-2">Suggested</p>
                <div className="flex flex-wrap gap-1.5">
                  {PROMPTS.map((p) => {
                    const Icon = p.icon
                    return (
                      <button
                        key={p.key}
                        onClick={() => ask(p.question)}
                        disabled={thinking}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-ink-300 transition hover:border-violet-400/35 hover:bg-violet-500/10 hover:text-violet-200 disabled:opacity-40"
                      >
                        <Icon className="size-3.5" aria-hidden />
                        {p.question}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Composer */}
              <div className="border-t border-white/[0.06] p-4">
                <div className="flex items-end gap-2">
                  <div className="relative flex-1">
                    <textarea
                      value={draft}
                      rows={1}
                      placeholder="Ask about the current state…"
                      aria-label="Ask the assistant"
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          ask(draft)
                        }
                      }}
                      className="w-full resize-none rounded-xl border border-white/8 bg-navy-850/70 px-3 py-2.5 pr-9 text-[13px] text-ink-100 placeholder:text-ink-700 transition focus:border-violet-400/45 focus:outline-none"
                    />
                    <CornerDownLeft
                      className="pointer-events-none absolute right-3 top-3 size-3.5 text-ink-700"
                      aria-hidden
                    />
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => ask(draft)}
                    disabled={!draft.trim() || thinking}
                    aria-label="Send question"
                    className="!px-3 !py-2.5"
                  >
                    <Send className="size-4" aria-hidden />
                  </Button>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-ink-700">
                  Responses are deterministic templates assembled from on-screen
                  state — this demonstration does not call a language model.
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
