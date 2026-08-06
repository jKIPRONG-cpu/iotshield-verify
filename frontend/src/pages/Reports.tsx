/**
 * Incident Reports.
 *
 * A formatted assessment assembled from whatever the console currently knows:
 * the live simulation if one has been run, the standing baseline otherwise.
 *
 * Two export paths, deliberately:
 *   - `window.print()` renders this page through the print stylesheet, so it
 *     works with the backend switched off.
 *   - The backend's ReportLab endpoint returns a branded PDF, which is the
 *     path a real deployment would use.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Gauge,
  ListChecks,
  Printer,
  ShieldCheck,
  Siren,
  Workflow,
  XCircle,
} from 'lucide-react'
import { api } from '@/api/client'
import { useDataContext } from '@/api/DataContext'
import { useAppState } from '@/context/AppState'
import { mock } from '@/data/mock'
import type { Severity } from '@/types'
import {
  Button,
  GlassCard,
  PageHeader,
  SectionTitle,
  SeverityBadge,
  SourceBadge,
  StatusBadge,
  VerificationBadge,
} from '@/components/ui'
import {
  cn,
  formatDuration,
  formatStamp,
  severityHex,
  SEVERITY_RANK,
} from '@/lib/utils'

/* ==========================================================================
   Report section shell
   ========================================================================== */

function ReportSection({
  index,
  title,
  icon,
  children,
}: {
  index: number
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="print-break"
    >
      <GlassCard className="p-6 print-plain" lit>
        <div className="flex items-center gap-3 border-b border-white/[0.07] pb-3.5">
          <span className="grid size-8 place-items-center rounded-lg border border-brand-400/25 bg-brand-500/10 text-brand-300">
            {icon}
          </span>
          <h2 className="text-[15px] font-semibold text-ink-100">
            <span className="tabular mr-2 text-ink-500">
              {String(index + 1).padStart(2, '0')}
            </span>
            {title}
          </h2>
        </div>
        <div className="mt-4">{children}</div>
      </GlassCard>
    </motion.section>
  )
}

/* ==========================================================================
   Page
   ========================================================================== */

export default function Reports() {
  const { live } = useDataContext()
  const {
    devices,
    alerts,
    simulation,
    verificationOverride,
    resilienceOverride,
  } = useAppState()

  const properties = verificationOverride ?? mock.verification.properties
  const resilience = resilienceOverride ?? mock.resilience
  const result = simulation.result

  const affected = useMemo(() => {
    if (result && result.affectedDeviceIds.length > 0) {
      return devices.filter((d) => result.affectedDeviceIds.includes(d.id))
    }
    return devices
      .filter((d) => d.status !== 'Healthy' && d.status !== 'Offline')
      .sort((a, b) => SEVERITY_RANK[b.risk] - SEVERITY_RANK[a.risk])
      .slice(0, 10)
  }, [devices, result])

  const failedProps = properties.filter((p) => p.status === 'Failed')
  const passedProps = properties.length - failedProps.length

  const activeAlerts = alerts.filter(
    (a) => a.status === 'Open' || a.status === 'Investigating',
  )
  const criticalAlerts = alerts.filter((a) => a.severity === 'Critical')

  const generatedAt = new Date().toISOString()

  /** Timeline is drawn from the simulation when present, the alert feed otherwise. */
  const timeline = useMemo(() => {
    if (result && simulation.emitted.length > 0) {
      const start = new Date(result.startedAt).getTime()
      return simulation.emitted.map((s) => ({
        at: new Date(start + s.atOffsetMs).toISOString(),
        label: `${s.phase} — ${s.label}`,
        detail: s.detail,
        severity: s.severity,
      }))
    }
    return alerts.slice(0, 8).map((a) => ({
      at: a.timestamp,
      label: a.threat,
      detail: `${a.deviceName} — ${a.description}`,
      severity: a.severity,
    }))
  }, [result, simulation.emitted, alerts])

  /** Recommendations are derived, not canned: failures drive the top entries. */
  const recommendations = useMemo(() => {
    const items: { priority: Severity; title: string; detail: string }[] = []

    for (const property of failedProps) {
      items.push({
        priority: 'Critical',
        title: `Remediate: ${property.name}`,
        detail: property.recommendation,
      })
    }

    const outdated = devices.filter((d) => d.firmwareOutdated).length
    if (outdated > 0) {
      items.push({
        priority: 'High',
        title: 'Close the firmware gap',
        detail: `${outdated} of ${devices.length} devices are running a build with a newer version available. Firmware patching, not credential hygiene alone, is what defeats the exploit-carrying families in this corpus.`,
      })
    }

    items.push({
      priority: 'High',
      title: 'Eliminate factory credentials at enrolment',
      detail:
        'Reject vendor defaults at provisioning and force a rotation at first boot. The majority of intrusions modelled here begin with a credential that was never changed.',
    })

    items.push({
      priority: 'Medium',
      title: 'Tighten segment egress policy',
      detail:
        'Deny Telnet (23/2323) inbound at every segment boundary and block DHT bootstrap egress from device VLANs. This removes both the primary entry vector and the peer-to-peer control channel used by the families with no central controller.',
    })

    items.push({
      priority: 'Medium',
      title: 'Maintain verified offline firmware images',
      detail:
        'Keep a known-good image for every device model in the estate. Destructive families leave physical reflashing as the only recovery path, and that path must not depend on vendor availability at the time of the incident.',
    })

    return items
  }, [failedProps, devices])

  const handlePrint = () => window.print()

  const summaryPoints = [
    result
      ? `A ${result.scenarioLabel} scenario was executed against the modelled estate of ${devices.length} devices. ${result.outcome}`
      : `No attack scenario has been executed in this session. This assessment describes the standing baseline across the modelled estate of ${devices.length} devices.`,
    `${affected.length} device${affected.length === 1 ? '' : 's'} require attention, with ${activeAlerts.length} alert${activeAlerts.length === 1 ? '' : 's'} open or under investigation and ${criticalAlerts.length} at critical severity.`,
    `Formal verification of the Coloured Petri Net model returned ${passedProps} of ${properties.length} properties satisfied. ${
      failedProps.length > 0
        ? `The ${failedProps.length} violated propert${failedProps.length === 1 ? 'y is' : 'ies are'} ${failedProps.map((p) => p.name).join(' and ')}.`
        : 'No violations were found against the markings reached.'
    }`,
    failedProps.length > 0
      ? 'The violations are not detector faults. In every observed run the response succeeded: threats were caught and devices quarantined. What model checking establishes is that containment is reachable but not inevitable — a class of defect testing cannot surface, because it is a property of the state space rather than of any single execution.'
      : 'Containment held across every marking visited. Note that this is a property of the runs performed, not a general guarantee; the baseline model retains violations that these runs did not reach.',
    `Containment currently stands at ${resilience.containment}%, recovery at ${resilience.recovery}%, and estate stability at ${resilience.stability}%. Mean time to detect is ${resilience.mttdSec}s and mean time to contain is ${resilience.mttcSec}s.`,
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incident Reports"
        subtitle="A formatted security assessment assembled from the current state of the console"
        icon={<FileText className="size-5" aria-hidden />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={live ? 'live' : 'demo'} />
            <Button
              variant="outline"
              size="sm"
              icon={<Printer className="size-3.5" />}
              onClick={handlePrint}
            >
              Print / Save as PDF
            </Button>
            <a
              href={api.reportPdfUrl()}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!live}
              onClick={(e) => {
                if (!live) e.preventDefault()
              }}
            >
              <Button
                variant="primary"
                size="sm"
                icon={<Download className="size-3.5" />}
                disabled={!live}
                title={
                  live
                    ? 'Download the ReportLab-rendered PDF from the backend'
                    : 'Requires the FastAPI backend — use Print / Save as PDF instead'
                }
              >
                Export PDF
              </Button>
            </a>
          </div>
        }
      />

      {!live && (
        <div className="no-print flex flex-wrap items-start gap-3 rounded-2xl border border-warn/25 bg-warn/[0.07] px-4 py-3.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
          <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink-300">
            The backend is not reachable, so the server-rendered ReportLab PDF is
            unavailable. <strong className="text-ink-100">Print / Save as PDF</strong>{' '}
            produces the same assessment through the browser and works entirely
            offline.
          </p>
        </div>
      )}

      {/* ---- Report masthead ------------------------------------------------- */}
      <GlassCard className="p-7 print-plain" lit>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="eyebrow">Security assessment</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-100">
              IoT Estate Incident Report
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-500">
              A Formal Verification Approach to IoT Malware Analysis, Detection,
              and Resilience — MSc research demonstration.
            </p>
          </div>

          <dl className="grid gap-x-8 gap-y-2 text-right sm:grid-cols-2">
            {[
              { label: 'Report ID', value: `IR-${new Date(generatedAt).getTime().toString(36).toUpperCase().slice(-8)}` },
              { label: 'Generated', value: formatStamp(generatedAt) },
              { label: 'Classification', value: 'Demonstration — synthetic' },
              { label: 'Prepared by', value: 'IoTShield Verify' },
            ].map((d) => (
              <div key={d.label}>
                <dt className="text-[10px] uppercase tracking-[0.11em] text-ink-500">
                  {d.label}
                </dt>
                <dd className="tabular mt-0.5 text-[12.5px] font-medium text-ink-100">
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6 grid gap-3 border-t border-white/[0.07] pt-5 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Devices assessed', value: devices.length, tone: 'text-ink-100' },
            {
              label: 'Requiring attention',
              value: affected.length,
              tone: affected.length > 0 ? 'text-warn' : 'text-ok',
            },
            {
              label: 'Active alerts',
              value: activeAlerts.length,
              tone: activeAlerts.length > 0 ? 'text-warn' : 'text-ok',
            },
            {
              label: 'Properties violated',
              value: failedProps.length,
              tone: failedProps.length > 0 ? 'text-bad' : 'text-ok',
            },
            {
              label: 'Stability score',
              value: `${resilience.stability}%`,
              tone: resilience.stability >= 80 ? 'text-ok' : 'text-warn',
            },
          ].map((k) => (
            <div key={k.label} className="glass-sunken px-3.5 py-3 print-plain">
              <p className="text-[10px] uppercase tracking-[0.11em] text-ink-500">
                {k.label}
              </p>
              <p className={cn('tabular mt-1 text-xl font-semibold', k.tone)}>
                {k.value}
              </p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ---- 1. Executive summary --------------------------------------------- */}
      <ReportSection
        index={0}
        title="Executive summary"
        icon={<FileText className="size-4" aria-hidden />}
      >
        <ul className="space-y-3">
          {summaryPoints.map((point, i) => (
            <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-ink-300">
              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
              {point}
            </li>
          ))}
        </ul>
      </ReportSection>

      {/* ---- 2. Affected devices ----------------------------------------------- */}
      <ReportSection
        index={1}
        title="Affected devices"
        icon={<Siren className="size-4" aria-hidden />}
      >
        {affected.length === 0 ? (
          <p className="text-[13px] text-ink-500">
            No devices currently require attention.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  {['Device', 'Address', 'Status', 'Risk', 'Health', 'Attribution'].map(
                    (h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {affected.map((d) => (
                  <tr key={d.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="font-mono text-[12px] text-ink-100">{d.name}</p>
                      <p className="text-[10.5px] text-ink-500">
                        {d.vendor} · {d.location}
                      </p>
                    </td>
                    <td className="tabular px-3 py-2.5 font-mono text-[11.5px] text-ink-300">
                      {d.ip}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <SeverityBadge severity={d.risk} />
                    </td>
                    <td className="tabular px-3 py-2.5 text-[12px] text-ink-100">
                      {d.health}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-ink-300">
                      {d.infectedBy ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportSection>

      {/* ---- 3. Threat timeline -------------------------------------------------- */}
      <ReportSection
        index={2}
        title="Threat timeline"
        icon={<ListChecks className="size-4" aria-hidden />}
      >
        <ol className="relative space-y-2.5 pl-6">
          <span
            className="absolute bottom-3 left-[7px] top-3 w-px bg-navy-600"
            aria-hidden
          />
          {timeline.map((entry, i) => (
            <li key={i} className="relative">
              <span
                className="absolute -left-[22px] top-2 size-2.5 rounded-full ring-2 ring-navy-900"
                style={{ background: severityHex[entry.severity] }}
                aria-hidden
              />
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-2.5 print-plain">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13px] font-medium text-ink-100">{entry.label}</p>
                  <span className="tabular font-mono text-[11px] text-ink-500">
                    {formatStamp(entry.at)}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-300">
                  {entry.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </ReportSection>

      {/* ---- 4. Verification results ---------------------------------------------- */}
      <ReportSection
        index={3}
        title="Formal verification results"
        icon={<ShieldCheck className="size-4" aria-hidden />}
      >
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 text-[13px] text-ink-300">
            <CheckCircle2 className="size-4 text-ok" aria-hidden />
            <span className="tabular font-semibold text-ink-100">{passedProps}</span>{' '}
            satisfied
          </span>
          <span className="inline-flex items-center gap-2 text-[13px] text-ink-300">
            <XCircle className="size-4 text-bad" aria-hidden />
            <span className="tabular font-semibold text-ink-100">
              {failedProps.length}
            </span>{' '}
            violated
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/[0.08]">
                {['Property', 'Logic', 'Formula', 'Result'].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-3 py-2.5">
                    <p className="text-[12.5px] font-medium text-ink-100">{p.name}</p>
                    <p className="text-[10.5px] text-ink-500">{p.category}</p>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-ink-300">
                    {p.logic}
                  </td>
                  <td className="px-3 py-2.5">
                    <code className="font-mono text-[11px] text-brand-200">
                      {p.formula}
                    </code>
                  </td>
                  <td className="px-3 py-2.5">
                    <VerificationBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {failedProps.length > 0 && (
          <div className="mt-5 space-y-3">
            {failedProps.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-bad/25 bg-bad/[0.06] p-4 print-plain"
              >
                <p className="text-[13px] font-semibold text-ink-100">{p.name}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-300">
                  {p.reason}
                </p>
              </div>
            ))}
          </div>
        )}
      </ReportSection>

      {/* ---- 5. Resilience assessment ---------------------------------------------- */}
      <ReportSection
        index={4}
        title="Resilience assessment"
        icon={<Gauge className="size-4" aria-hidden />}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Containment', value: `${resilience.containment}%` },
            { label: 'Recovery', value: `${resilience.recovery}%` },
            { label: 'Risk reduction', value: `${resilience.riskReduction}%` },
            { label: 'Stability', value: `${resilience.stability}%` },
            { label: 'Mean time to detect', value: formatDuration(resilience.mttdSec) },
            { label: 'Mean time to contain', value: formatDuration(resilience.mttcSec) },
            { label: 'Devices isolated', value: String(resilience.devicesIsolated) },
            { label: 'Devices recovered', value: String(resilience.devicesRecovered) },
          ].map((m) => (
            <div key={m.label} className="glass-sunken px-3.5 py-3 print-plain">
              <p className="text-[10px] uppercase tracking-[0.11em] text-ink-500">
                {m.label}
              </p>
              <p className="tabular mt-1 text-lg font-semibold text-ink-100">
                {m.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            <Workflow className="size-3.5 text-brand-400" aria-hidden />
            Recovery workflow
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {resilience.workflow.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.05] px-3 py-2 print-plain"
              >
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium text-ink-100">
                    {s.label}
                  </span>
                  <span className="block text-[11px] leading-relaxed text-ink-500">
                    {s.description}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium',
                    s.status === 'Complete'
                      ? 'border-ok/30 bg-ok/10 text-ok'
                      : s.status === 'Active'
                        ? 'border-brand-400/30 bg-brand-500/10 text-brand-300'
                        : s.status === 'Failed'
                          ? 'border-bad/30 bg-bad/10 text-bad'
                          : 'border-white/10 bg-white/5 text-ink-500',
                  )}
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </ReportSection>

      {/* ---- 6. Recommendations ------------------------------------------------------ */}
      <ReportSection
        index={5}
        title="Recommendations"
        icon={<ListChecks className="size-4" aria-hidden />}
      >
        <ol className="space-y-3">
          {recommendations.map((rec, i) => (
            <li
              key={i}
              className="flex gap-3.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 print-plain"
            >
              <span className="tabular grid size-7 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/[0.04] text-[12px] font-semibold text-ink-300">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-semibold text-ink-100">{rec.title}</p>
                  <SeverityBadge severity={rec.priority} />
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-300">
                  {rec.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </ReportSection>

      {/* ---- Footer ------------------------------------------------------------------ */}
      <GlassCard className="p-5 print-plain">
        <SectionTitle
          title="Report provenance"
          icon={<FileText className="size-[18px]" aria-hidden />}
        />
        <p className="mt-2.5 max-w-4xl text-[11.5px] leading-relaxed text-ink-500">
          This assessment was generated from the IoTShield Verify demonstration
          dataset. Every device, event, alert, verification verdict and metric it
          references is synthetic. Malware tradecraft descriptions are drawn from
          public reporting on real families; all quantitative values are
          illustrative and are not experimental results from the underlying
          research. The report is intended to demonstrate the reporting pipeline,
          not to document a real incident.
        </p>
        <div className="no-print mt-4 flex flex-wrap gap-2 border-t border-white/[0.05] pt-4">
          <Link to="/verification">
            <Button variant="outline" size="sm" icon={<ShieldCheck className="size-3.5" />}>
              Verification detail
            </Button>
          </Link>
          <Link to="/resilience">
            <Button variant="outline" size="sm" icon={<Gauge className="size-3.5" />}>
              Resilience detail
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            icon={<Printer className="size-3.5" />}
            onClick={handlePrint}
          >
            Print this report
          </Button>
        </div>
      </GlassCard>
    </div>
  )
}
