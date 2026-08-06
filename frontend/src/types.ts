/**
 * IoTShield Verify — domain model.
 *
 * These interfaces are the contract between the FastAPI service and the SPA.
 * The backend's Pydantic schemas in `backend/app/schemas.py` mirror them
 * field-for-field; when one side changes, change both.
 *
 * DEMO NOTE: every value the app renders is synthetic. Nothing here models a
 * real device, a real capture, or a measured experimental result.
 */

/* ==========================================================================
   Shared vocabulary
   ========================================================================== */

/** Ordered low -> critical. Drives the reserved status palette. */
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical'

export type RiskLevel = Severity

export type DeviceStatus =
  | 'Healthy'
  | 'At Risk'
  | 'Compromised'
  | 'Isolated'
  | 'Recovering'
  | 'Offline'

/** Verdict assigned to a single observed network event. */
export type EventVerdict = 'Benign' | 'Suspicious' | 'Malicious'

/** Lifecycle of a security alert. */
export type AlertStatus = 'Open' | 'Investigating' | 'Contained' | 'Resolved'

/** Outcome of checking one temporal-logic property against the model. */
export type VerificationStatus = 'Verified' | 'Failed' | 'Warning'

/* ==========================================================================
   Assets
   ========================================================================== */

/** Transport a device speaks. Shared with NetworkEvent so the two agree. */
export type Protocol = 'TCP' | 'UDP' | 'MQTT' | 'CoAP' | 'HTTPS'

export type DeviceCategory =
  | 'Smart Camera'
  | 'Gateway Router'
  | 'Smart Lock'
  | 'Motion Sensor'
  | 'Smart Bulb'
  | 'Medical Monitor'
  | 'Smart Thermostat'
  | 'Weather Station'
  | 'Industrial PLC'
  | 'Smart Speaker'

export interface Device {
  id: string
  name: string
  category: DeviceCategory
  vendor: string
  ip: string
  mac: string
  firmware: string
  /** True when a newer firmware build exists for this model. */
  firmwareOutdated: boolean
  status: DeviceStatus
  risk: RiskLevel
  /** ISO-8601 timestamp of the most recent observed activity. */
  lastActivity: string
  location: string
  /** Composite 0-100 posture score: patch level, exposure, and behaviour. */
  health: number
  protocol: Protocol
  openPorts: number[]
  uptimeHours: number
  /** Populated when the device is attributed to a malware family. */
  infectedBy?: string
}

/* ==========================================================================
   Telemetry
   ========================================================================== */

export type EventKind =
  | 'Device Boot'
  | 'Authentication'
  | 'Firmware Update'
  | 'Telemetry Sync'
  | 'DNS Query'
  | 'Port Scan'
  | 'Suspicious Login'
  | 'Malware Download'
  | 'Command & Control'
  | 'Data Exfiltration'

export interface NetworkEvent {
  id: string
  timestamp: string
  deviceId: string
  deviceName: string
  kind: EventKind
  sourceIp: string
  destIp: string
  destPort: number
  protocol: Protocol
  bytes: number
  verdict: EventVerdict
  severity: Severity
  detail: string
}

/* ==========================================================================
   Detections
   ========================================================================== */

export interface Alert {
  id: string
  timestamp: string
  deviceId: string
  deviceName: string
  threat: string
  malwareFamily?: string
  severity: Severity
  status: AlertStatus
  /** Operator-facing next step. */
  action: string
  description: string
  /** MITRE ATT&CK for ICS/Enterprise tactic name (illustrative mapping). */
  mitreTactic: string
  mitreTechnique: string
  /** Detector confidence, 0-100. */
  confidence: number
  sourceIp: string
}

export interface IndicatorOfCompromise {
  type: 'IP' | 'Domain' | 'Hash' | 'Path' | 'Port' | 'User-Agent' | 'Mutex'
  value: string
  note: string
}

export interface MalwareFamily {
  id: string
  name: string
  aliases: string[]
  firstSeen: string
  category: string
  description: string
  infectionMethod: string
  targetDevices: string[]
  behaviour: string[]
  iocs: IndicatorOfCompromise[]
  severity: Severity
  mitigation: string[]
  /** Share of simulated infections attributed to this family, 0-100. */
  prevalence: number
  /** Illustrative CVE references associated with the family's entry vector. */
  cveRefs: string[]
  propagation: string
  /** Devices in the current inventory attributed to this family. */
  infectedDeviceIds: string[]
}

/* ==========================================================================
   Formal verification
   ========================================================================== */

export interface VerificationProperty {
  id: string
  name: string
  /** Temporal-logic formula checked against the CPN reachability graph. */
  formula: string
  logic: 'CTL' | 'LTL'
  status: VerificationStatus
  description: string
  /** Why the model checker returned this verdict. */
  reason: string
  recommendation: string
  /** Model-checking statistics (synthetic). */
  statesExplored: number
  transitionsFired: number
  durationMs: number
  /** Firing sequence witnessing a violation, when status is Failed. */
  counterexample?: string[]
  category: 'Safety' | 'Liveness' | 'Reachability' | 'Security'
}

export interface VerificationRun {
  id: string
  model: string
  startedAt: string
  properties: VerificationProperty[]
  passed: number
  failed: number
  /** Percentage of properties satisfied, 0-100. */
  successRate: number
  stateSpaceSize: number
  deadlockFree: boolean
}

/* ==========================================================================
   Resilience
   ========================================================================== */

export type RecoveryStepStatus = 'Complete' | 'Active' | 'Pending' | 'Failed'

export interface RecoveryStep {
  id: string
  label: string
  description: string
  status: RecoveryStepStatus
  /** ISO timestamp, or undefined while pending. */
  at?: string
  durationSec: number
  automated: boolean
}

export interface ResilienceState {
  /** Four headline ratios, each 0-100. */
  containment: number
  recovery: number
  riskReduction: number
  stability: number
  devicesIsolated: number
  devicesRecovered: number
  devicesPendingRecovery: number
  /** Mean time to detect / contain / recover, in seconds. */
  mttdSec: number
  mttcSec: number
  mttrSec: number
  workflow: RecoveryStep[]
  /** Stability trace sampled across the incident window. */
  timeline: { t: string; stability: number; risk: number }[]
}

/* ==========================================================================
   Simulation
   ========================================================================== */

export type ScenarioId =
  | 'normal'
  | 'mirai'
  | 'botnet'
  | 'credential'
  | 'ransomware'

export interface Scenario {
  id: ScenarioId
  label: string
  description: string
  severity: Severity
  /** Malware family id this scenario exercises, when applicable. */
  familyId?: string
  expectedDetectionMs: number
}

export type SimulationPhase =
  | 'Reconnaissance'
  | 'Intrusion'
  | 'Execution'
  | 'Detection'
  | 'Verification'
  | 'Isolation'
  | 'Recovery'

export interface SimulationStep {
  id: string
  order: number
  phase: SimulationPhase
  label: string
  detail: string
  severity: Severity
  /** Milliseconds after simulation start at which this step fires. */
  atOffsetMs: number
  /** Petri-net place this step drops a token into, if any. */
  place?: string
}

export interface SimulationMetrics {
  eventsProcessed: number
  threatsDetected: number
  detectionAccuracy: number
  falsePositives: number
  devicesAffected: number
  devicesIsolated: number
  devicesRecovered: number
  detectionLatencyMs: number
  containmentLatencyMs: number
  propertiesChecked: number
  propertiesViolated: number
}

export interface SimulationResult {
  id: string
  scenario: ScenarioId
  scenarioLabel: string
  startedAt: string
  /** One-line verdict shown at the top of the run log. */
  outcome: string
  /** 'contained' | 'partial' | 'clean' — drives the outcome badge colour. */
  outcomeLevel: 'clean' | 'contained' | 'partial'
  severity: Severity
  steps: SimulationStep[]
  metrics: SimulationMetrics
  affectedDeviceIds: string[]
  verification: VerificationProperty[]
  alerts: Alert[]
  resilience: ResilienceState
}

/* ==========================================================================
   Dashboard aggregates & analytics
   ========================================================================== */

export interface TrendPoint {
  date: string
  detected: number
  blocked: number
  verified: number
}

export interface AccuracyPoint {
  date: string
  accuracy: number
  precision: number
  recall: number
}

export interface NamedValue {
  name: string
  value: number
}

export interface Summary {
  connectedDevices: number
  healthyDevices: number
  compromisedDevices: number
  atRiskDevices: number
  isolatedDevices: number
  activeThreats: number
  /** Percentage of formal properties currently satisfied, 0-100. */
  verificationRate: number
  verificationPassed: number
  verificationFailed: number
  networkHealth: number
  securityScore: number
  detectionAccuracy: number
  meanResponseSec: number
  /** Deltas versus the previous 24h window, in percentage points. */
  deltas: {
    devices: number
    threats: number
    health: number
    verification: number
  }
  threatTrend: TrendPoint[]
  deviceHealth: NamedValue[]
  attackDistribution: NamedValue[]
  accuracyTrend: AccuracyPoint[]
  verificationTrend: { date: string; rate: number }[]
}

export interface Analytics {
  threatFrequency: NamedValue[]
  malwareCategories: NamedValue[]
  deviceRisk: NamedValue[]
  verificationOutcomes: NamedValue[]
  recoverySuccess: { date: string; recovered: number; failed: number }[]
  networkHealthSeries: { date: string; health: number; load: number }[]
  severityByCategory: {
    category: string
    Low: number
    Medium: number
    High: number
    Critical: number
  }[]
}

/* ==========================================================================
   Reports
   ========================================================================== */

export interface ReportPayload {
  id: string
  title: string
  generatedAt: string
  classification: string
  author: string
  executiveSummary: string[]
  affectedDevices: Device[]
  timeline: { at: string; label: string; detail: string; severity: Severity }[]
  verification: VerificationProperty[]
  resilience: ResilienceState
  recommendations: { priority: Severity; title: string; detail: string }[]
  summary: Summary
}

/* ==========================================================================
   Client-side plumbing
   ========================================================================== */

/** Where a rendered dataset came from — surfaced by the SourceBadge. */
export type DataSource = 'live' | 'demo' | 'loading'

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** Optional structured citations rendered under the answer. */
  refs?: string[]
  at: string
}
