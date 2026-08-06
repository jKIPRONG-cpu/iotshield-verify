/**
 * Settings.
 *
 * Detection/response tuning, interface preferences, and the API connection
 * status. Settings are held in memory for the session only — there is no
 * browser storage anywhere in this application, so a reload returns the
 * console to a known state, which is the behaviour you want before a defence.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  CheckCircle2,
  Cpu,
  Database,
  Gauge,
  Info,
  Palette,
  Plug,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useDataContext } from '@/api/DataContext'
import { useAppState } from '@/context/AppState'
import { mock } from '@/data/mock'
import {
  Button,
  GlassCard,
  PageHeader,
  SectionTitle,
  Select,
  Toggle,
} from '@/components/ui'
import { cn, formatStamp } from '@/lib/utils'

/* ==========================================================================
   Page
   ========================================================================== */

export default function Settings() {
  const { live, checking, apiBase, lastCheckedAt, refresh } = useDataContext()
  const { settings, updateSetting, resetSettings, resetSimulation } = useAppState()
  const [justReset, setJustReset] = useState(false)

  const handleReset = () => {
    resetSettings()
    resetSimulation()
    setJustReset(true)
    window.setTimeout(() => setJustReset(false), 2200)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Detection thresholds, interface preferences and backend connectivity"
        icon={<Sliders className="size-5" aria-hidden />}
        action={
          <Button
            variant="outline"
            size="sm"
            icon={
              justReset ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <RotateCcw className="size-3.5" />
              )
            }
            onClick={handleReset}
          >
            {justReset ? 'Restored' : 'Restore defaults'}
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* ---- Detection & response ------------------------------------------ */}
        <GlassCard className="p-6" lit>
          <SectionTitle
            title="Detection and response"
            subtitle="How the engine reacts to a confirmed threat"
            icon={<ShieldCheck className="size-[18px]" aria-hidden />}
          />

          <div className="mt-4 divide-y divide-white/[0.05]">
            <Toggle
              checked={settings.realtimeMonitoring}
              onChange={(v) => updateSetting('realtimeMonitoring', v)}
              label="Real-time monitoring"
              description="Continuously evaluate device telemetry against each class's behavioural baseline."
            />
            <Toggle
              checked={settings.autoIsolate}
              onChange={(v) => updateSetting('autoIsolate', v)}
              label="Automatic isolation"
              description="Move a device to the quarantine VLAN as soon as detection confidence crosses the threshold, without waiting for an operator."
            />
            <Toggle
              checked={settings.verifyOnDetect}
              onChange={(v) => updateSetting('verifyOnDetect', v)}
              label="Verify before responding"
              description="Re-check the Coloured Petri Net model against the current marking before committing a response action. This is the stage that distinguishes this approach from a conventional detector."
            />
          </div>

          <div className="mt-5 space-y-4 border-t border-white/[0.05] pt-5">
            <div>
              <label
                htmlFor="sensitivity"
                className="block text-sm font-medium text-ink-100"
              >
                Detector sensitivity
              </label>
              <p className="mb-2.5 mt-0.5 text-xs leading-relaxed text-ink-500">
                Aggressive catches more, at the cost of a higher false-positive
                rate. Conservative reduces noise but widens the detection window
                the leakage property already exploits.
              </p>
              <Select
                value={settings.sensitivity}
                onChange={(v) =>
                  updateSetting(
                    'sensitivity',
                    v as typeof settings.sensitivity,
                  )
                }
                label="Detector sensitivity"
                options={[
                  { value: 'Conservative', label: 'Conservative — fewer false positives' },
                  { value: 'Balanced', label: 'Balanced — recommended' },
                  { value: 'Aggressive', label: 'Aggressive — maximum recall' },
                ]}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <label
                  htmlFor="threshold"
                  className="block text-sm font-medium text-ink-100"
                >
                  Response threshold
                </label>
                <span className="tabular text-sm font-semibold text-brand-300">
                  {settings.detectionThreshold}%
                </span>
              </div>
              <p className="mb-3 mt-0.5 text-xs leading-relaxed text-ink-500">
                Confidence a detection must reach before automatic isolation
                fires.
              </p>
              <input
                id="threshold"
                type="range"
                min={50}
                max={99}
                value={settings.detectionThreshold}
                onChange={(e) =>
                  updateSetting('detectionThreshold', Number(e.target.value))
                }
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-navy-600 accent-brand-500"
                style={{
                  background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${
                    ((settings.detectionThreshold - 50) / 49) * 100
                  }%, #1C2C48 ${
                    ((settings.detectionThreshold - 50) / 49) * 100
                  }%, #1C2C48 100%)`,
                }}
              />
              <div className="mt-1.5 flex justify-between text-[10px] text-ink-700">
                <span>50% — permissive</span>
                <span>99% — strict</span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* ---- Interface ------------------------------------------------------- */}
        <GlassCard className="p-6" lit>
          <SectionTitle
            title="Interface"
            subtitle="Presentation preferences for this session"
            icon={<Palette className="size-[18px]" aria-hidden />}
          />

          <div className="mt-4 divide-y divide-white/[0.05]">
            <Toggle
              checked={settings.animations}
              onChange={(v) => updateSetting('animations', v)}
              label="Motion and transitions"
              description="Animated counters, page transitions and token movement. Automatically disabled when the system requests reduced motion."
            />
            <Toggle
              checked={settings.liveEventStream}
              onChange={(v) => updateSetting('liveEventStream', v)}
              label="Live event stream"
              description="Reveal network events progressively on the Network Activity timeline rather than showing the full log at once."
            />
            <Toggle
              checked={settings.compactDensity}
              onChange={(v) => updateSetting('compactDensity', v)}
              label="Compact density"
              description="Tighten row heights and padding across tables. Useful on a projector where vertical space is scarce."
            />
            <Toggle
              checked={settings.showDemoBanner}
              onChange={(v) => updateSetting('showDemoBanner', v)}
              label="Demonstration notice"
              description="Keep the synthetic-data notice visible in the sidebar. Recommended when presenting to an audience unfamiliar with the project."
            />
          </div>
        </GlassCard>

        {/* ---- Connectivity ---------------------------------------------------- */}
        <GlassCard className="p-6" lit>
          <SectionTitle
            title="Backend connection"
            subtitle="Where the console is sourcing its data"
            icon={<Plug className="size-[18px]" aria-hidden />}
            action={
              <Button
                variant="outline"
                size="sm"
                loading={checking}
                icon={<Activity className="size-3.5" />}
                onClick={refresh}
              >
                Test connection
              </Button>
            }
          />

          <div
            className={cn(
              'mt-4 flex items-start gap-3.5 rounded-xl border p-4',
              live
                ? 'border-ok/30 bg-ok/[0.07]'
                : 'border-brand-400/25 bg-brand-500/[0.07]',
            )}
          >
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-xl border',
                live
                  ? 'border-ok/35 bg-ok/12 text-ok'
                  : 'border-brand-400/30 bg-brand-500/12 text-brand-300',
              )}
            >
              {live ? (
                <Wifi className="size-4" aria-hidden />
              ) : (
                <WifiOff className="size-4" aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink-100">
                {checking
                  ? 'Probing the API…'
                  : live
                    ? 'Live API connected'
                    : 'Running on bundled demonstration data'}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-300">
                {live
                  ? 'Pages are served by the FastAPI backend. Simulation runs are scripted server-side and the ReportLab PDF export is available.'
                  : 'The backend is unreachable, so every page is rendering the bundled dataset. All modules remain fully functional — this is the supported offline mode, and it is what makes the console safe to present without a network.'}
              </p>
            </div>
          </div>

          <dl className="mt-4 space-y-0">
            {[
              { label: 'API base URL', value: apiBase, mono: true },
              {
                label: 'Last probed',
                value: lastCheckedAt ? formatStamp(lastCheckedAt) : 'not yet',
              },
              {
                label: 'Override',
                value: 'frontend/.env → VITE_API_BASE',
                mono: true,
              },
            ].map((d) => (
              <div
                key={d.label}
                className="flex items-baseline justify-between gap-4 border-b border-white/[0.04] py-2.5 last:border-0"
              >
                <dt className="shrink-0 text-xs text-ink-500">{d.label}</dt>
                <dd
                  className={cn(
                    'min-w-0 truncate text-right text-xs text-ink-100',
                    d.mono && 'font-mono',
                  )}
                >
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>
        </GlassCard>

        {/* ---- About ------------------------------------------------------------ */}
        <GlassCard className="p-6" lit>
          <SectionTitle
            title="About IoTShield Verify"
            subtitle="Build and dataset information"
            icon={<Info className="size-[18px]" aria-hidden />}
          />

          <div className="mt-4 flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-brand-400/30 bg-gradient-to-br from-brand-500/25 to-ice-500/15 shadow-glow">
              <ShieldCheck className="size-6 text-brand-200" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink-100">
                IoTShield <span className="text-brand-300">Verify</span>
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
                A Formal Verification Approach to IoT Malware Analysis,
                Detection, and Resilience. MSc research demonstration console.
              </p>
            </div>
          </div>

          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Version', value: '1.0.0', icon: Sparkles },
              { label: 'CPN model', value: mock.verification.model, icon: Cpu },
              {
                label: 'Devices in dataset',
                value: String(mock.devices.length),
                icon: Database,
              },
              {
                label: 'Network events',
                value: String(mock.events.length),
                icon: Activity,
              },
              {
                label: 'Security alerts',
                value: String(mock.alerts.length),
                icon: Gauge,
              },
              {
                label: 'Malware families',
                value: String(mock.malware.length),
                icon: Database,
              },
            ].map((d) => (
              <div key={d.label} className="glass-sunken px-3.5 py-2.5">
                <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.11em] text-ink-500">
                  <d.icon className="size-3" aria-hidden />
                  {d.label}
                </dt>
                <dd className="tabular mt-1 text-[13px] font-medium text-ink-100">
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-5 rounded-xl border border-warn/20 bg-warn/[0.06] p-4"
          >
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-warn">
              <Sparkles className="size-3.5" aria-hidden />
              Demonstration build
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-300">
              This application models no real hardware and processes no live
              network traffic. The device inventory, telemetry, alert corpus and
              verification statistics are generated by a seeded pseudo-random
              function and are identical on every load. Malware tradecraft is
              summarised from public reporting; all quantitative figures are
              illustrative and must not be cited as experimental results.
            </p>
          </motion.div>
        </GlassCard>
      </div>
    </div>
  )
}
