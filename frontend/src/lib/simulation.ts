/**
 * Attack simulation engine (client side).
 *
 * Builds a complete, scripted `SimulationResult` for a scenario: the ordered
 * steps, the alerts they raise, the devices they touch, the formal-verification
 * verdicts that follow, and the resulting resilience posture.
 *
 * The backend implements the same scripts in `backend/app/main.py`, so a run
 * looks identical whether it was served or produced locally. Building the whole
 * result up front (rather than emitting it as the clock advances) means the
 * playback layer only has to schedule what already exists — which keeps the
 * timeline, the Petri net, and the verification panel in step with each other.
 */

import type {
  Alert,
  Device,
  RecoveryStep,
  ResilienceState,
  ScenarioId,
  Severity,
  SimulationMetrics,
  SimulationResult,
  SimulationStep,
  VerificationProperty,
} from '@/types'
import { mock, SCENARIOS } from '@/data/mock'
import { clamp } from './utils'

/* ==========================================================================
   Step scripts
   --------------------------------------------------------------------------
   `place` names map onto Petri-net places so the CPN view can advance tokens
   from the same script that drives the run log.
   ========================================================================== */

type StepSeed = Omit<SimulationStep, 'id' | 'order'>

const NORMAL_SCRIPT: StepSeed[] = [
  {
    phase: 'Reconnaissance',
    label: 'Baseline capture started',
    detail:
      'Passive observation of the device estate begins. No active probing is performed.',
    severity: 'Low',
    atOffsetMs: 0,
    place: 'idle',
  },
  {
    phase: 'Intrusion',
    label: 'Telemetry received',
    detail:
      'Scheduled MQTT telemetry batches arrive from 34 endpoints within the expected publication window.',
    severity: 'Low',
    atOffsetMs: 900,
    place: 'packet',
  },
  {
    phase: 'Execution',
    label: 'Mutual authentication succeeded',
    detail:
      'All sessions presented valid device certificates. No fallback to password authentication was observed.',
    severity: 'Low',
    atOffsetMs: 1900,
    place: 'auth',
  },
  {
    phase: 'Detection',
    label: 'Behaviour within envelope',
    detail:
      'Traffic volume, destination entropy and inter-packet timing all fall inside the 30-day baseline for each device class.',
    severity: 'Low',
    atOffsetMs: 3000,
    place: 'normal',
  },
  {
    phase: 'Verification',
    label: 'Model re-checked — all properties hold',
    detail:
      'The Coloured Petri Net was re-verified against the current marking. Six of six properties are satisfied, including malware containment, which fails only once an execution token is present.',
    severity: 'Low',
    atOffsetMs: 4200,
    place: 'verify',
  },
  {
    phase: 'Recovery',
    label: 'Baseline established',
    detail:
      'The observation window closed clean. This profile becomes the reference the attack scenarios are compared against.',
    severity: 'Low',
    atOffsetMs: 5200,
    place: 'idle',
  },
]

const MIRAI_SCRIPT: StepSeed[] = [
  {
    phase: 'Reconnaissance',
    label: 'External SYN sweep detected',
    detail:
      'An external host enumerated TCP/23 and TCP/2323 across the 10.42.0.0/16 range at roughly 1,400 packets per second.',
    severity: 'Medium',
    atOffsetMs: 0,
    place: 'packet',
  },
  {
    phase: 'Intrusion',
    label: 'Default-credential brute force',
    detail:
      'Sequential Telnet authentication attempts matched the Mirai built-in credential table. 412 attempts preceded the first success.',
    severity: 'High',
    atOffsetMs: 1100,
    place: 'auth',
  },
  {
    phase: 'Intrusion',
    label: 'Shell session established',
    detail:
      'A busybox shell was opened on the target. The session immediately queried /proc/cpuinfo to select a matching payload architecture.',
    severity: 'High',
    atOffsetMs: 2000,
    place: 'suspicious',
  },
  {
    phase: 'Execution',
    label: 'Unsigned ELF payload staged',
    detail:
      'A MIPS-build binary was written to /tmp/.mirai, marked executable, and launched. The dropper then unlinked its own file.',
    severity: 'Critical',
    atOffsetMs: 3100,
    place: 'malware',
  },
  {
    phase: 'Execution',
    label: 'Watchdog suspended, port 48101 bound',
    detail:
      'The implant disabled the hardware watchdog to prevent reboot and bound its ownership-lock port, signalling exclusive control of the host.',
    severity: 'Critical',
    atOffsetMs: 4000,
    place: 'malware',
  },
  {
    phase: 'Detection',
    label: 'Behavioural detector fired',
    detail:
      'Three independent indicators correlated — credential-stuffing pattern, unsigned binary execution, and a new outbound beacon — pushing confidence to 97%.',
    severity: 'Critical',
    atOffsetMs: 5200,
    place: 'detect',
  },
  {
    phase: 'Verification',
    label: 'Containment property violated',
    detail:
      'AG (MalwareExecution → AF Isolated) failed. Detect Malware and Analyse Behaviour were concurrently enabled, so isolation is reachable but not inevitable.',
    severity: 'Critical',
    atOffsetMs: 6300,
    place: 'verify',
  },
  {
    phase: 'Isolation',
    label: 'Devices moved to quarantine VLAN',
    detail:
      'Switch ports for the affected endpoints were placed in a restricted policy group. Egress to the C2 address was blackholed at the edge.',
    severity: 'High',
    atOffsetMs: 7400,
    place: 'isolate',
  },
  {
    phase: 'Recovery',
    label: 'Reflash and credential rotation underway',
    detail:
      'Verified vendor firmware is being written to each quarantined device and administrative credentials reissued. Memory-resident stages do not survive the reflash.',
    severity: 'Medium',
    atOffsetMs: 8600,
    place: 'recover',
  },
]

const BOTNET_SCRIPT: StepSeed[] = [
  {
    phase: 'Reconnaissance',
    label: 'DHT bootstrap traffic observed',
    detail:
      'An internal host began announcing on a public distributed hash table over UDP/6881 — behaviour with no legitimate analogue for this device class.',
    severity: 'Medium',
    atOffsetMs: 0,
    place: 'packet',
  },
  {
    phase: 'Intrusion',
    label: 'Router CVE chain exploited',
    detail:
      'A chained request against the gateway management interface achieved unauthenticated command execution, matching the Mozi entry pattern.',
    severity: 'High',
    atOffsetMs: 1200,
    place: 'auth',
  },
  {
    phase: 'Execution',
    label: 'Signed configuration blob accepted',
    detail:
      'The implant retrieved a peer-distributed configuration and validated it against an embedded ECDSA key. No central controller was contacted.',
    severity: 'Critical',
    atOffsetMs: 2400,
    place: 'malware',
  },
  {
    phase: 'Execution',
    label: 'Lateral propagation to three peers',
    detail:
      'The infected node scanned the local segment and successfully exploited three further devices, each of which joined the overlay.',
    severity: 'Critical',
    atOffsetMs: 3600,
    place: 'malware',
  },
  {
    phase: 'Detection',
    label: 'Peer fan-out anomaly raised',
    detail:
      'Outbound UDP peer count for a single endpoint exceeded its baseline by 40x. Correlation with the exploitation attempts confirmed the detection.',
    severity: 'Critical',
    atOffsetMs: 4900,
    place: 'detect',
  },
  {
    phase: 'Verification',
    label: 'Containment and leakage properties violated',
    detail:
      'Both AG (MalwareExecution → AF Isolated) and G ¬(Exfiltrating ∧ ¬Detected) failed. Peer-to-peer control removes the single choke point isolation relies on.',
    severity: 'Critical',
    atOffsetMs: 6100,
    place: 'verify',
  },
  {
    phase: 'Isolation',
    label: 'Segment-wide DHT egress blocked',
    detail:
      'UDP DHT bootstrap was denied across all IoT VLANs and the four participating hosts were quarantined together to prevent re-seeding.',
    severity: 'High',
    atOffsetMs: 7300,
    place: 'isolate',
  },
  {
    phase: 'Recovery',
    label: 'Coordinated reflash scheduled',
    detail:
      'Because the overlay re-infects any host returned to service early, all four devices are held in quarantine until every reflash completes.',
    severity: 'Medium',
    atOffsetMs: 8500,
    place: 'recover',
  },
]

const CREDENTIAL_SCRIPT: StepSeed[] = [
  {
    phase: 'Reconnaissance',
    label: 'Distributed login attempts detected',
    detail:
      'Authentication requests arrived from 47 distinct source addresses, each attempting a small number of logins to stay below per-source thresholds.',
    severity: 'Medium',
    atOffsetMs: 0,
    place: 'packet',
  },
  {
    phase: 'Intrusion',
    label: 'Vendor default pair succeeded',
    detail:
      'A leaked vendor default credential authenticated successfully against two management interfaces that had never been rotated from factory settings.',
    severity: 'High',
    atOffsetMs: 1300,
    place: 'auth',
  },
  {
    phase: 'Execution',
    label: 'Administrative session opened',
    detail:
      'The session enumerated device configuration and attempted to add a secondary administrative account for persistence.',
    severity: 'High',
    atOffsetMs: 2500,
    place: 'suspicious',
  },
  {
    phase: 'Detection',
    label: 'Credential-stuffing pattern confirmed',
    detail:
      'Low-and-slow distribution defeated per-source rate limits but was caught by aggregate failure-ratio analysis across the management VLAN.',
    severity: 'High',
    atOffsetMs: 3700,
    place: 'detect',
  },
  {
    phase: 'Verification',
    label: 'Authentication integrity holds',
    detail:
      'AG (MalwareExecution → EF Authenticated) is satisfied: no execution path bypassed identity establishment. The weakness is credential strength, not model structure.',
    severity: 'Medium',
    atOffsetMs: 4900,
    place: 'verify',
  },
  {
    phase: 'Isolation',
    label: 'Sessions terminated, accounts locked',
    detail:
      'Active sessions were severed, the injected account removed, and the two affected devices placed in quarantine pending credential rotation.',
    severity: 'Medium',
    atOffsetMs: 6000,
    place: 'isolate',
  },
  {
    phase: 'Recovery',
    label: 'Fleet-wide credential rotation',
    detail:
      'Certificates were reissued for both devices and a policy check flagged nine further endpoints still running factory credentials.',
    severity: 'Low',
    atOffsetMs: 7100,
    place: 'recover',
  },
]

const RANSOMWARE_SCRIPT: StepSeed[] = [
  {
    phase: 'Reconnaissance',
    label: 'Telnet probe from known PDoS source',
    detail:
      'An address previously associated with permanent-denial-of-service activity opened a Telnet session against a perimeter camera.',
    severity: 'High',
    atOffsetMs: 0,
    place: 'packet',
  },
  {
    phase: 'Intrusion',
    label: 'Default credential accepted',
    detail:
      'Authentication succeeded on the second attempt. No payload was staged — the session moved directly to shell commands.',
    severity: 'High',
    atOffsetMs: 1000,
    place: 'auth',
  },
  {
    phase: 'Execution',
    label: 'Configuration wipe initiated',
    detail:
      'The session flushed iptables rules, removed the default route, and began writing /dev/urandom over the configuration partition.',
    severity: 'Critical',
    atOffsetMs: 2100,
    place: 'malware',
  },
  {
    phase: 'Execution',
    label: 'Firmware partition overwrite attempted',
    detail:
      'A raw block write was issued against /dev/mtdblock0. Completing this write renders the device unrecoverable without hardware reflashing.',
    severity: 'Critical',
    atOffsetMs: 3000,
    place: 'malware',
  },
  {
    phase: 'Detection',
    label: 'Destructive write blocked',
    detail:
      'The flash-write guard fired 1.4 seconds into the overwrite and cut the switch port before the firmware partition was fully corrupted.',
    severity: 'Critical',
    atOffsetMs: 3900,
    place: 'detect',
  },
  {
    phase: 'Verification',
    label: 'Data-leakage property violated',
    detail:
      'G ¬(Exfiltrating ∧ ¬Detected) failed: the configuration read preceding the wipe completed before the second behavioural observation triggered detection.',
    severity: 'Critical',
    atOffsetMs: 5100,
    place: 'verify',
  },
  {
    phase: 'Isolation',
    label: 'Port shut, device preserved',
    detail:
      'The switch port was administratively shut and the device left powered for forensic imaging rather than being rebooted.',
    severity: 'High',
    atOffsetMs: 6200,
    place: 'isolate',
  },
  {
    phase: 'Recovery',
    label: 'Restored from verified image',
    detail:
      'Configuration was rebuilt from the last verified backup. One device required physical reflashing; the partition damage was partial but not repairable in place.',
    severity: 'Medium',
    atOffsetMs: 7400,
    place: 'recover',
  },
]

const SCRIPTS: Record<ScenarioId, StepSeed[]> = {
  normal: NORMAL_SCRIPT,
  mirai: MIRAI_SCRIPT,
  botnet: BOTNET_SCRIPT,
  credential: CREDENTIAL_SCRIPT,
  ransomware: RANSOMWARE_SCRIPT,
}

/* ==========================================================================
   Scenario tuning
   ========================================================================== */

interface ScenarioProfile {
  /** How many devices the scenario compromises. */
  deviceCount: number
  /** Property ids the scenario causes to fail. */
  violates: string[]
  outcome: string
  outcomeLevel: SimulationResult['outcomeLevel']
  severity: Severity
  threat: string
  eventsProcessed: number
  accuracy: number
  falsePositives: number
  detectionLatencyMs: number
  containmentLatencyMs: number
  containment: number
  recovery: number
  riskReduction: number
  stability: number
}

const PROFILES: Record<ScenarioId, ScenarioProfile> = {
  normal: {
    deviceCount: 0,
    violates: [],
    outcome:
      'Baseline clean. All six formal properties hold and no device deviated from its behavioural envelope.',
    outcomeLevel: 'clean',
    severity: 'Low',
    threat: 'No threat detected',
    eventsProcessed: 1_284,
    accuracy: 99.1,
    falsePositives: 0,
    detectionLatencyMs: 0,
    containmentLatencyMs: 0,
    containment: 100,
    recovery: 100,
    riskReduction: 0,
    stability: 98,
  },
  mirai: {
    deviceCount: 3,
    violates: ['VP-05'],
    outcome:
      'Threat contained. Three devices were compromised and quarantined 2.2 seconds after detection, but the containment property could not be formally guaranteed.',
    outcomeLevel: 'contained',
    severity: 'Critical',
    threat: 'Mirai botnet enrolment',
    eventsProcessed: 3_842,
    accuracy: 97.2,
    falsePositives: 2,
    detectionLatencyMs: 2_400,
    containmentLatencyMs: 2_200,
    containment: 86,
    recovery: 71,
    riskReduction: 74,
    stability: 82,
  },
  botnet: {
    deviceCount: 4,
    violates: ['VP-05', 'VP-06'],
    outcome:
      'Partial containment. Peer-to-peer control removed the single choke point isolation depends on; two formal properties were violated before quarantine completed.',
    outcomeLevel: 'partial',
    severity: 'Critical',
    threat: 'Mozi peer-to-peer propagation',
    eventsProcessed: 4_517,
    accuracy: 94.8,
    falsePositives: 5,
    detectionLatencyMs: 3_100,
    containmentLatencyMs: 3_400,
    containment: 68,
    recovery: 54,
    riskReduction: 61,
    stability: 69,
  },
  credential: {
    deviceCount: 2,
    violates: [],
    outcome:
      'Threat contained. Authentication integrity held throughout — the exposure was credential strength, not a structural weakness in the model.',
    outcomeLevel: 'contained',
    severity: 'High',
    threat: 'Distributed credential stuffing',
    eventsProcessed: 2_106,
    accuracy: 98.3,
    falsePositives: 1,
    detectionLatencyMs: 1_800,
    containmentLatencyMs: 1_500,
    containment: 94,
    recovery: 88,
    riskReduction: 79,
    stability: 91,
  },
  ransomware: {
    deviceCount: 2,
    violates: ['VP-06'],
    outcome:
      'Damage limited. The destructive write was cut 1.4 seconds in; one device required physical reflashing and the leakage property was violated.',
    outcomeLevel: 'partial',
    severity: 'Critical',
    threat: 'BrickerBot destructive sequence',
    eventsProcessed: 1_938,
    accuracy: 96.1,
    falsePositives: 1,
    detectionLatencyMs: 2_900,
    containmentLatencyMs: 900,
    containment: 78,
    recovery: 46,
    riskReduction: 66,
    stability: 74,
  },
}

/* ==========================================================================
   Verification outcomes per scenario
   ========================================================================== */

/**
 * Re-derive the property table for a scenario.
 *
 * The baseline dataset already fails VP-05 and VP-06; a scenario narrows that
 * to exactly the properties its behaviour actually exercises. `normal` passes
 * everything, because with no execution token present the containment premise
 * is vacuously satisfied.
 */
function verificationFor(scenario: ScenarioId): VerificationProperty[] {
  const violates = new Set(PROFILES[scenario].violates)

  return mock.verification.properties.map((property) => {
    const shouldFail = violates.has(property.id)

    if (shouldFail) {
      return { ...property, status: 'Failed' as const }
    }

    if (property.status === 'Failed') {
      // The property fails in the baseline model but this scenario does not
      // reach the offending marking — say so rather than silently flipping it.
      return {
        ...property,
        status: 'Verified' as const,
        reason:
          scenario === 'normal'
            ? `Not exercised by this scenario. With no token in Malware Execution the premise is vacuously satisfied, so the violation present in the baseline model cannot be reached from any state visited during this run.`
            : `Satisfied for this run. The firing sequence that violates this property in the baseline model was not reachable from any marking visited during the ${scenario} scenario.`,
        counterexample: undefined,
      }
    }

    return { ...property }
  })
}

/* ==========================================================================
   Derived artefacts
   ========================================================================== */

/** Pick the devices a scenario hits, preferring plausible targets. */
function selectTargets(scenario: ScenarioId, devices: Device[]): Device[] {
  const profile = PROFILES[scenario]
  if (profile.deviceCount === 0) return []

  const preferred: Record<ScenarioId, string[]> = {
    normal: [],
    mirai: ['Smart Camera', 'Gateway Router'],
    botnet: ['Gateway Router', 'Smart Camera', 'Industrial PLC'],
    credential: ['Gateway Router', 'Smart Lock', 'Medical Monitor'],
    ransomware: ['Smart Camera', 'Smart Bulb'],
  }

  const wanted = preferred[scenario]
  const ranked = [...devices].sort((a, b) => {
    const aPref = wanted.includes(a.category) ? 0 : 1
    const bPref = wanted.includes(b.category) ? 0 : 1
    if (aPref !== bPref) return aPref - bPref
    // Within the preferred class, weakest posture first.
    return a.health - b.health
  })

  return ranked.slice(0, profile.deviceCount)
}

function alertsFor(
  scenario: ScenarioId,
  targets: Device[],
  startedAt: number,
): Alert[] {
  const profile = PROFILES[scenario]
  if (targets.length === 0) return []

  const family = SCENARIOS.find((s) => s.id === scenario)?.familyId
  const familyName = mock.malware.find((m) => m.id === family)?.name

  const templates: Record<
    ScenarioId,
    { threat: string; tactic: string; technique: string; action: string; description: string }
  > = {
    normal: {
      threat: '',
      tactic: '',
      technique: '',
      action: '',
      description: '',
    },
    mirai: {
      threat: 'Mirai Payload Execution',
      tactic: 'Execution',
      technique: 'T1059.004 — Unix Shell',
      action: 'Quarantine the device and reflash from a verified vendor image.',
      description:
        'An unsigned MIPS ELF was staged to /tmp and executed following a successful default-credential login. The watchdog was suspended and the ownership-lock port bound.',
    },
    botnet: {
      threat: 'Peer-to-Peer Botnet Enrolment',
      tactic: 'Command and Control',
      technique: 'T1090 — Proxy',
      action: 'Block DHT egress segment-wide and quarantine all participating hosts together.',
      description:
        'The device joined a distributed hash table overlay and accepted a signed configuration blob from a peer. No central controller was contacted.',
    },
    credential: {
      threat: 'Credential Stuffing Success',
      tactic: 'Credential Access',
      technique: 'T1110.004 — Credential Stuffing',
      action: 'Terminate sessions, remove injected accounts, and rotate device credentials.',
      description:
        'A leaked vendor default pair authenticated against a management interface that had never been rotated from factory settings.',
    },
    ransomware: {
      threat: 'Destructive Flash Write',
      tactic: 'Impact',
      technique: 'T1485 — Data Destruction',
      action: 'Shut the switch port and preserve the device powered for forensic imaging.',
      description:
        'Raw block writes were issued against the firmware partition following a configuration wipe, matching the permanent-denial-of-service pattern.',
    },
  }

  const t = templates[scenario]

  return targets.map((device, i) => ({
    id: `ALT-SIM-${scenario.toUpperCase()}-${i + 1}`,
    timestamp: new Date(startedAt + profile.detectionLatencyMs + i * 400).toISOString(),
    deviceId: device.id,
    deviceName: device.name,
    threat: t.threat,
    malwareFamily: familyName,
    severity: profile.severity,
    status: 'Open' as const,
    action: t.action,
    description: t.description,
    mitreTactic: t.tactic,
    mitreTechnique: t.technique,
    confidence: clamp(Math.round(profile.accuracy) - i, 60, 99),
    sourceIp: device.ip,
  }))
}

function resilienceFor(
  scenario: ScenarioId,
  targets: Device[],
  startedAt: number,
): ResilienceState {
  const profile = PROFILES[scenario]
  const clean = scenario === 'normal'

  const workflow: RecoveryStep[] = clean
    ? [
        {
          id: 'RS-N1',
          label: 'Baseline observation complete',
          description:
            'A full observation window closed with no deviation from the behavioural envelope. No response action was required.',
          status: 'Complete',
          at: new Date(startedAt + 5_200).toISOString(),
          durationSec: 5,
          automated: true,
        },
      ]
    : [
        {
          id: 'RS-S1',
          label: 'Threat confirmed',
          description: `Detection fired at ${(profile.detectionLatencyMs / 1000).toFixed(1)}s with ${profile.accuracy}% confidence after correlating three independent indicators.`,
          status: 'Complete',
          at: new Date(startedAt + profile.detectionLatencyMs).toISOString(),
          durationSec: Math.round(profile.detectionLatencyMs / 1000),
          automated: true,
        },
        {
          id: 'RS-S2',
          label: 'Automatic isolation',
          description: `${targets.length} device${targets.length === 1 ? '' : 's'} moved to the quarantine VLAN and C2 destinations blackholed at the edge.`,
          status: 'Complete',
          at: new Date(
            startedAt + profile.detectionLatencyMs + profile.containmentLatencyMs,
          ).toISOString(),
          durationSec: Math.round(profile.containmentLatencyMs / 1000),
          automated: true,
        },
        {
          id: 'RS-S3',
          label: 'Formal re-verification',
          description:
            profile.violates.length > 0
              ? `Re-check against the post-isolation marking returned ${profile.violates.length} violated propert${profile.violates.length === 1 ? 'y' : 'ies'}. Containment held in practice but is not guaranteed by the model.`
              : 'Re-check against the post-isolation marking confirmed all six properties hold.',
          status: profile.violates.length > 0 ? 'Failed' : 'Complete',
          at: new Date(startedAt + 6_300).toISOString(),
          durationSec: 48,
          automated: true,
        },
        {
          id: 'RS-S4',
          label: 'Credential rotation',
          description:
            'Device certificates and administrative credentials reissued for every quarantined asset.',
          status: 'Complete',
          at: new Date(startedAt + 7_400).toISOString(),
          durationSec: 90,
          automated: true,
        },
        {
          id: 'RS-S5',
          label: 'Firmware reflash',
          description:
            'Verified vendor images are being written to the quarantined devices. Memory-resident stages do not survive the reflash.',
          status: 'Active',
          at: new Date(startedAt + 8_600).toISOString(),
          durationSec: 0,
          automated: true,
        },
        {
          id: 'RS-S6',
          label: 'Post-recovery validation',
          description:
            'Behavioural baseline is re-established and each device re-admitted only after a clean observation window.',
          status: 'Pending',
          durationSec: 0,
          automated: true,
        },
        {
          id: 'RS-S7',
          label: 'Model remediation',
          description:
            profile.violates.length > 0
              ? 'Apply the priority guard recommended by the failed property so the containment eventuality becomes unconditional, then re-verify.'
              : 'No model change required — every property held for this run.',
          status: profile.violates.length > 0 ? 'Pending' : 'Complete',
          durationSec: 0,
          automated: false,
        },
      ]

  // Stability dips through the incident, then recovers toward the profile value.
  const shape = clean
    ? [98, 98, 99, 98, 99, 98, 99, 98, 99, 98, 99, 98]
    : [96, 92, 78, 61, 44, 39, 48, 60, 71, 79, 84, profile.stability]

  const timeline = shape.map((stability, i) => ({
    t: new Date(startedAt + i * 800).toISOString(),
    stability,
    risk: clamp(100 - stability, 0, 100),
  }))

  return {
    containment: profile.containment,
    recovery: profile.recovery,
    riskReduction: profile.riskReduction,
    stability: profile.stability,
    devicesIsolated: targets.length,
    devicesRecovered: clean ? 0 : Math.max(0, targets.length - 1),
    devicesPendingRecovery: clean ? 0 : 1,
    mttdSec: Math.round(profile.detectionLatencyMs / 1000),
    mttcSec: Math.round(
      (profile.detectionLatencyMs + profile.containmentLatencyMs) / 1000,
    ),
    mttrSec: clean ? 0 : 1_640,
    workflow,
    timeline,
  }
}

/* ==========================================================================
   Entry point
   ========================================================================== */

/**
 * Build the complete result for one scenario run.
 *
 * `devices` is the current inventory so targets are chosen from what the
 * operator is actually looking at rather than a fixed list.
 */
export function buildSimulation(
  scenario: ScenarioId,
  devices: Device[],
  startedAtMs: number = Date.now(),
): SimulationResult {
  const profile = PROFILES[scenario]
  const definition = SCENARIOS.find((s) => s.id === scenario)
  const targets = selectTargets(scenario, devices)
  const verification = verificationFor(scenario)

  const steps: SimulationStep[] = SCRIPTS[scenario].map((seed, i) => ({
    ...seed,
    id: `SIM-${scenario}-${i + 1}`,
    order: i,
  }))

  const metrics: SimulationMetrics = {
    eventsProcessed: profile.eventsProcessed,
    threatsDetected: targets.length,
    detectionAccuracy: profile.accuracy,
    falsePositives: profile.falsePositives,
    devicesAffected: targets.length,
    devicesIsolated: targets.length,
    devicesRecovered: scenario === 'normal' ? 0 : Math.max(0, targets.length - 1),
    detectionLatencyMs: profile.detectionLatencyMs,
    containmentLatencyMs: profile.containmentLatencyMs,
    propertiesChecked: verification.length,
    propertiesViolated: profile.violates.length,
  }

  return {
    id: `SIM-${scenario}-${startedAtMs}`,
    scenario,
    scenarioLabel: definition?.label ?? scenario,
    startedAt: new Date(startedAtMs).toISOString(),
    outcome: profile.outcome,
    outcomeLevel: profile.outcomeLevel,
    severity: profile.severity,
    steps,
    metrics,
    affectedDeviceIds: targets.map((d) => d.id),
    verification,
    alerts: alertsFor(scenario, targets, startedAtMs),
    resilience: resilienceFor(scenario, targets, startedAtMs),
  }
}

/** Total wall-clock duration of a scenario's script, in milliseconds. */
export function scenarioDurationMs(scenario: ScenarioId): number {
  const script = SCRIPTS[scenario]
  return script[script.length - 1].atOffsetMs + 1_200
}

export { PROFILES as SCENARIO_PROFILES }
