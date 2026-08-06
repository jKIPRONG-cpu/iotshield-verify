/**
 * Formal Verification.
 *
 * The results of model-checking the Coloured Petri Net against six temporal
 * properties — four CTL, two LTL. Four hold; two are violated.
 *
 * The two failures carry the argument of the thesis, so the page treats them
 * as the main content rather than as errors to be minimised: each failed
 * property shows the reason, the firing sequence that witnesses the violation,
 * and the concrete model change that would make it hold.
 *
 * When a scenario has been run, its verdicts replace the baseline — including
 * the case where a baseline failure is *vacuously* satisfied because the run
 * never reaches the offending marking. That distinction is stated explicitly
 * rather than quietly rendered as a pass.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Binary,
  CheckCircle2,
  ChevronRight,
  CircuitBoard,
  FlaskConical,
  GitBranch,
  Lightbulb,
  ListTree,
  Radar,
  ShieldCheck,
  Sigma,
  Timer,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { api } from '@/api/client'
import { useResource } from '@/hooks/useResource'
import { useAppState } from '@/context/AppState'
import { mock } from '@/data/mock'
import type { VerificationProperty, VerificationRun } from '@/types'
import { DonutChart, ChartCard } from '@/components/charts'
import {
  AnimatedNumber,
  Button,
  GlassCard,
  PageHeader,
  SectionTitle,
  Skeleton,
  SourceBadge,
  StatTile,
  Tabs,
  VerificationBadge,
} from '@/components/ui'
import { cn, formatNumber } from '@/lib/utils'

/* ==========================================================================
   Property card
   ========================================================================== */

const CATEGORY_ICON: Record<VerificationProperty['category'], typeof ShieldCheck> = {
  Safety: ShieldCheck,
  Liveness: Timer,
  Reachability: GitBranch,
  Security: CircuitBoard,
}

function PropertyCard({
  property,
  index,
  expanded,
  onToggle,
}: {
  property: VerificationProperty
  index: number
  expanded: boolean
  onToggle: () => void
}) {
  const failed = property.status === 'Failed'
  const Icon = CATEGORY_ICON[property.category]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard
        className={cn(
          'overflow-hidden transition',
          failed ? 'border-bad/30' : 'border-ok/20',
        )}
        lit
      >
        {/* Status rail across the top — shape, not just colour. */}
        <div
          className={cn('h-[3px] w-full', failed ? 'bg-bad/70' : 'bg-ok/60')}
          aria-hidden
        />

        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-xl border',
                  failed
                    ? 'border-bad/35 bg-bad/12 text-bad'
                    : 'border-ok/30 bg-ok/10 text-ok',
                )}
              >
                {failed ? (
                  <XCircle className="size-[18px]" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-[18px]" aria-hidden />
                )}
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-ink-100">
                  {property.name}
                </h3>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
                  <span className="inline-flex items-center gap-1">
                    <Icon className="size-3" aria-hidden />
                    {property.category}
                  </span>
                  <span className="text-ink-700">·</span>
                  <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-px font-mono text-[10px]">
                    {property.logic}
                  </span>
                  <span className="text-ink-700">·</span>
                  <span className="font-mono">{property.id}</span>
                </p>
              </div>
            </div>
            <VerificationBadge status={property.status} />
          </div>

          {/* Formula */}
          <div className="glass-sunken mt-4 overflow-x-auto px-3.5 py-2.5">
            <code className="whitespace-nowrap font-mono text-[12.5px] text-brand-200">
              {property.formula}
            </code>
          </div>

          <p className="mt-3.5 text-[13px] leading-relaxed text-ink-300">
            {property.description}
          </p>

          {/* Model-checking statistics */}
          <dl className="mt-4 grid grid-cols-3 gap-2.5">
            {[
              { label: 'States explored', value: formatNumber(property.statesExplored) },
              { label: 'Transitions fired', value: formatNumber(property.transitionsFired) },
              { label: 'Duration', value: `${property.durationMs} ms` },
            ].map((s) => (
              <div key={s.label} className="glass-sunken px-3 py-2">
                <dt className="text-[9.5px] uppercase tracking-[0.1em] text-ink-500">
                  {s.label}
                </dt>
                <dd className="tabular mt-1 text-[13px] font-medium text-ink-100">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>

          <button
            onClick={onToggle}
            aria-expanded={expanded}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-brand-300 transition hover:text-brand-200"
          >
            <ChevronRight
              className={cn(
                'size-3.5 transition-transform duration-200',
                expanded && 'rotate-90',
              )}
              aria-hidden
            />
            {expanded ? 'Hide analysis' : 'Reason, counterexample and recommendation'}
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-4 border-t border-white/[0.06] pt-4">
                  <section>
                    <h4 className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                      <Sigma className="size-3 text-brand-400" aria-hidden />
                      Reason
                    </h4>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-300">
                      {property.reason}
                    </p>
                  </section>

                  {property.counterexample && property.counterexample.length > 0 && (
                    <section>
                      <h4 className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                        <ListTree className="size-3 text-bad" aria-hidden />
                        Counterexample — witnessing firing sequence
                      </h4>
                      <ol className="mt-2 space-y-1">
                        {property.counterexample.map((line, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2.5 rounded-lg border border-bad/20 bg-bad/[0.06] px-3 py-1.5"
                          >
                            <span className="tabular mt-px shrink-0 font-mono text-[10px] text-bad/70">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <code className="min-w-0 font-mono text-[11.5px] leading-relaxed text-ink-200">
                              {line}
                            </code>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}

                  <section
                    className={cn(
                      'rounded-xl border p-3.5',
                      failed
                        ? 'border-brand-400/25 bg-brand-500/[0.08]'
                        : 'border-white/[0.06] bg-white/[0.02]',
                    )}
                  >
                    <h4 className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-brand-300">
                      <Lightbulb className="size-3" aria-hidden />
                      Recommendation
                    </h4>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-200">
                      {property.recommendation}
                    </p>
                  </section>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassCard>
    </motion.div>
  )
}

/* ==========================================================================
   Page
   ========================================================================== */

type Filter = 'all' | 'failed' | 'verified'

export default function Verification() {
  const { verificationOverride, simulation } = useAppState()
  const runRes = useResource<VerificationRun>(
    (signal) => api.verification(signal),
    mock.verification,
  )

  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['VP-05', 'VP-06']))

  /** A completed run's verdicts take precedence over the baseline. */
  const properties = verificationOverride ?? runRes.data.properties
  const usingRunResults = verificationOverride !== null

  const passed = properties.filter((p) => p.status === 'Verified').length
  const failed = properties.length - passed
  const rate = Math.round((passed / Math.max(properties.length, 1)) * 1000) / 10

  const visible = useMemo(
    () =>
      properties.filter((p) =>
        filter === 'all'
          ? true
          : filter === 'failed'
            ? p.status === 'Failed'
            : p.status === 'Verified',
      ),
    [properties, filter],
  )

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const outcomeData = [
    { name: 'Verified', value: passed },
    { name: 'Failed', value: failed },
  ].filter((d) => d.value > 0)

  if (runRes.source === 'loading') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Formal Verification"
          subtitle="Temporal-logic properties checked against the Coloured Petri Net"
          icon={<ShieldCheck className="size-5" aria-hidden />}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Formal Verification"
        subtitle={`${properties.length} temporal-logic properties checked against ${runRes.data.model} — ${passed} satisfied, ${failed} violated`}
        icon={<ShieldCheck className="size-5" aria-hidden />}
        action={
          <div className="flex items-center gap-2">
            <SourceBadge source={runRes.source} />
            <Link to="/petri-net">
              <Button
                variant="outline"
                size="sm"
                icon={<GitBranch className="size-3.5" />}
              >
                Open the model
              </Button>
            </Link>
          </div>
        }
      />

      {/* Context banner when a scenario has replaced the baseline results. */}
      {usingRunResults && simulation.result && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-start gap-3 rounded-2xl border border-brand-400/30 bg-brand-500/[0.08] px-4 py-3.5"
        >
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink-100">
              Showing results for the {simulation.result.scenarioLabel} run
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-300">
              These verdicts were computed against the markings this scenario
              actually reached. Where a baseline failure now reads as satisfied,
              it is <em className="not-italic text-brand-200">vacuously</em> so —
              the run never visited the marking that exposes it. The underlying
              violation has not been fixed.
            </p>
          </div>
          <Link to="/detection">
            <Button variant="subtle" size="sm">
              View run
            </Button>
          </Link>
        </motion.div>
      )}

      {/* ---- Summary ---------------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Properties satisfied"
          value={passed}
          icon={<CheckCircle2 className="size-4" aria-hidden />}
          tone={failed === 0 ? 'good' : 'warn'}
          hint={`of ${properties.length} checked`}
        />
        <StatTile
          label="Properties violated"
          value={failed}
          icon={<XCircle className="size-4" aria-hidden />}
          tone={failed > 0 ? 'bad' : 'good'}
          hint={failed > 0 ? 'Counterexamples available' : 'No violations found'}
        />
        <StatTile
          label="Success rate"
          value={rate}
          suffix="%"
          decimals={1}
          icon={<Sigma className="size-4" aria-hidden />}
          tone={rate >= 80 ? 'good' : 'warn'}
          hint="Share of the property set that holds"
        />
        <StatTile
          label="State space"
          value={runRes.data.stateSpaceSize}
          icon={<Binary className="size-4" aria-hidden />}
          hint={runRes.data.deadlockFree ? 'Deadlock free' : 'Terminal markings found'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Verification outcomes"
          subtitle="Satisfied versus violated"
          icon={<Sigma className="size-[18px]" aria-hidden />}
          height={230}
          footnote="Both slices are named in the legend and the centre carries the count, so the split does not rest on colour."
        >
          <DonutChart
            data={outcomeData}
            colors={['#22C55E', '#F04438']}
            centerValue={`${rate}%`}
            centerLabel="satisfied"
          />
        </ChartCard>

        <GlassCard className="p-5 xl:col-span-2" lit>
          <SectionTitle
            title="What the two failures mean"
            subtitle="The finding this project exists to demonstrate"
            icon={<TriangleAlert className="size-[18px]" aria-hidden />}
          />
          <div className="mt-4 space-y-3.5 text-[13px] leading-relaxed text-ink-300">
            <p>
              Neither failure is a detector fault. In every simulated run the
              response works: the threat is caught and the device is quarantined.
              What the model checker reports is subtler and more useful —
              containment is <strong className="font-semibold text-ink-100">reachable</strong>{' '}
              but not <strong className="font-semibold text-ink-100">inevitable</strong>.
            </p>
            <p>
              Because Analyse Behaviour and Detect Malware are concurrently
              enabled on the same token, a scheduler is free to keep choosing the
              analysis branch. No amount of testing would surface that: it is a
              property of the state space, not of any single execution. This is
              exactly the class of defect formal methods exist to find, and the
              reason a verification stage sits between detection and response in
              the model rather than after it.
            </p>
            <p className="text-ink-500">
              Both failures come with a concrete, bounded model change — a
              priority guard and an egress-volume guard — that converts the
              eventuality from possible to guaranteed.
            </p>
          </div>
        </GlassCard>
      </div>

      {/* ---- Properties -------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle
          title="Property results"
          subtitle="Select a property to see its reason, counterexample and recommendation"
          icon={<ListTree className="size-[18px]" aria-hidden />}
        />
        <div className="flex items-center gap-2">
          <Tabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `All (${properties.length})` },
              { value: 'failed', label: `Violated (${failed})` },
              { value: 'verified', label: `Satisfied (${passed})` },
            ]}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setExpanded((prev) =>
                prev.size === properties.length
                  ? new Set()
                  : new Set(properties.map((p) => p.id)),
              )
            }
          >
            {expanded.size === properties.length ? 'Collapse all' : 'Expand all'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {visible.map((property, i) => (
            <PropertyCard
              key={property.id}
              property={property}
              index={i}
              expanded={expanded.has(property.id)}
              onToggle={() => toggle(property.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* ---- Run metadata ------------------------------------------------------ */}
      <GlassCard className="p-5">
        <SectionTitle
          title="Model-checking run"
          icon={<Radar className="size-[18px]" aria-hidden />}
        />
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Model', value: runRes.data.model, mono: true },
            {
              label: 'Reachable markings',
              value: formatNumber(runRes.data.stateSpaceSize),
            },
            {
              label: 'Deadlock freedom',
              value: runRes.data.deadlockFree ? 'Holds' : 'Violated',
            },
            {
              label: 'Total states explored',
              value: formatNumber(
                properties.reduce((sum, p) => sum + p.statesExplored, 0),
              ),
            },
          ].map((d) => (
            <div key={d.label} className="glass-sunken px-3.5 py-2.5">
              <dt className="text-[10px] uppercase tracking-[0.1em] text-ink-500">
                {d.label}
              </dt>
              <dd
                className={cn(
                  'mt-1 text-[13px] font-medium text-ink-100',
                  d.mono && 'font-mono',
                )}
              >
                {d.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 border-t border-white/[0.05] pt-3 text-[11px] leading-relaxed text-ink-700">
          Model-checking statistics are synthetic and illustrative. They are
          shaped to be plausible for a net of this size; they are not measured
          results from a model checker.
        </p>
      </GlassCard>

      {/* Total properties satisfied, for screen readers scanning the page. */}
      <p className="sr-only">
        <AnimatedNumber value={passed} /> of {properties.length} properties
        satisfied.
      </p>
    </div>
  )
}
