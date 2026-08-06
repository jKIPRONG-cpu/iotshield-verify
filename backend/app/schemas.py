"""
Pydantic response models.

These mirror ``frontend/src/types.ts`` field-for-field, using camelCase aliases
so the JSON the API emits is exactly what the TypeScript interfaces expect. When
one side changes, change both.

They exist as much for the generated OpenAPI documentation at ``/docs`` as for
validation — a reviewer can read the whole contract there without opening the
frontend.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["Low", "Medium", "High", "Critical"]
DeviceStatus = Literal[
    "Healthy", "At Risk", "Compromised", "Isolated", "Recovering", "Offline"
]
EventVerdict = Literal["Benign", "Suspicious", "Malicious"]
AlertStatus = Literal["Open", "Investigating", "Contained", "Resolved"]
VerificationStatus = Literal["Verified", "Failed", "Warning"]
Protocol = Literal["TCP", "UDP", "MQTT", "CoAP", "HTTPS"]
ScenarioId = Literal["normal", "mirai", "botnet", "credential", "ransomware"]


class Health(BaseModel):
    status: str = Field(examples=["ok"])
    service: str = "iotshield-verify"
    version: str = "1.0.0"


# ==========================================================================
# Assets
# ==========================================================================


class Device(BaseModel):
    id: str
    name: str
    category: str
    vendor: str
    ip: str
    mac: str
    firmware: str
    firmwareOutdated: bool
    status: DeviceStatus
    risk: Severity
    lastActivity: str
    location: str
    health: int
    protocol: Protocol
    openPorts: list[int]
    uptimeHours: int
    infectedBy: str | None = None


# ==========================================================================
# Telemetry
# ==========================================================================


class NetworkEvent(BaseModel):
    id: str
    timestamp: str
    deviceId: str
    deviceName: str
    kind: str
    sourceIp: str
    destIp: str
    destPort: int
    protocol: Protocol
    bytes: int
    verdict: EventVerdict
    severity: Severity
    detail: str


# ==========================================================================
# Detections
# ==========================================================================


class Alert(BaseModel):
    id: str
    timestamp: str
    deviceId: str
    deviceName: str
    threat: str
    malwareFamily: str | None = None
    severity: Severity
    status: AlertStatus
    action: str
    description: str
    mitreTactic: str
    mitreTechnique: str
    confidence: int
    sourceIp: str


class IndicatorOfCompromise(BaseModel):
    type: str
    value: str
    note: str


class MalwareFamily(BaseModel):
    id: str
    name: str
    aliases: list[str]
    firstSeen: str
    category: str
    description: str
    infectionMethod: str
    targetDevices: list[str]
    behaviour: list[str]
    iocs: list[IndicatorOfCompromise]
    severity: Severity
    mitigation: list[str]
    prevalence: int
    cveRefs: list[str]
    propagation: str
    infectedDeviceIds: list[str]


# ==========================================================================
# Formal verification
# ==========================================================================


class VerificationProperty(BaseModel):
    id: str
    name: str
    formula: str
    logic: Literal["CTL", "LTL"]
    status: VerificationStatus
    description: str
    reason: str
    recommendation: str
    statesExplored: int
    transitionsFired: int
    durationMs: int
    counterexample: list[str] | None = None
    category: Literal["Safety", "Liveness", "Reachability", "Security"]


class VerificationRun(BaseModel):
    id: str
    model: str
    startedAt: str
    properties: list[VerificationProperty]
    passed: int
    failed: int
    successRate: float
    stateSpaceSize: int
    deadlockFree: bool


# ==========================================================================
# Resilience
# ==========================================================================


class RecoveryStep(BaseModel):
    id: str
    label: str
    description: str
    status: Literal["Complete", "Active", "Pending", "Failed"]
    at: str | None = None
    durationSec: int
    automated: bool


class StabilityPoint(BaseModel):
    t: str
    stability: int
    risk: int


class ResilienceState(BaseModel):
    containment: int
    recovery: int
    riskReduction: int
    stability: int
    devicesIsolated: int
    devicesRecovered: int
    devicesPendingRecovery: int
    mttdSec: int
    mttcSec: int
    mttrSec: int
    workflow: list[RecoveryStep]
    timeline: list[StabilityPoint]


# ==========================================================================
# Dashboard & analytics
# ==========================================================================


class TrendPoint(BaseModel):
    date: str
    detected: int
    blocked: int
    verified: int


class AccuracyPoint(BaseModel):
    date: str
    accuracy: float
    precision: float
    recall: float


class RatePoint(BaseModel):
    date: str
    rate: float


class NamedValue(BaseModel):
    name: str
    value: float


class SummaryDeltas(BaseModel):
    devices: int
    threats: int
    health: int
    verification: int


class Summary(BaseModel):
    connectedDevices: int
    healthyDevices: int
    compromisedDevices: int
    atRiskDevices: int
    isolatedDevices: int
    activeThreats: int
    verificationRate: float
    verificationPassed: int
    verificationFailed: int
    networkHealth: int
    securityScore: int
    detectionAccuracy: float
    meanResponseSec: int
    deltas: SummaryDeltas
    threatTrend: list[TrendPoint]
    deviceHealth: list[NamedValue]
    attackDistribution: list[NamedValue]
    accuracyTrend: list[AccuracyPoint]
    verificationTrend: list[RatePoint]


class RecoveryPoint(BaseModel):
    date: str
    recovered: int
    failed: int


class NetworkHealthPoint(BaseModel):
    date: str
    health: int
    load: int


class SeverityByCategory(BaseModel):
    category: str
    Low: int
    Medium: int
    High: int
    Critical: int


class Analytics(BaseModel):
    threatFrequency: list[NamedValue]
    malwareCategories: list[NamedValue]
    deviceRisk: list[NamedValue]
    verificationOutcomes: list[NamedValue]
    recoverySuccess: list[RecoveryPoint]
    networkHealthSeries: list[NetworkHealthPoint]
    severityByCategory: list[SeverityByCategory]


# ==========================================================================
# Simulation
# ==========================================================================


class SimulationRequest(BaseModel):
    scenario: ScenarioId = Field(
        default="mirai",
        description="Which scripted scenario to execute.",
        examples=["mirai"],
    )


class SimulationStep(BaseModel):
    id: str
    order: int
    phase: str
    label: str
    detail: str
    severity: Severity
    atOffsetMs: int
    place: str | None = None


class SimulationMetrics(BaseModel):
    eventsProcessed: int
    threatsDetected: int
    detectionAccuracy: float
    falsePositives: int
    devicesAffected: int
    devicesIsolated: int
    devicesRecovered: int
    detectionLatencyMs: int
    containmentLatencyMs: int
    propertiesChecked: int
    propertiesViolated: int


class SimulationResult(BaseModel):
    id: str
    scenario: ScenarioId
    scenarioLabel: str
    startedAt: str
    outcome: str
    outcomeLevel: Literal["clean", "contained", "partial"]
    severity: Severity
    steps: list[SimulationStep]
    metrics: SimulationMetrics
    affectedDeviceIds: list[str]
    verification: list[VerificationProperty]
    alerts: list[Alert]
    resilience: ResilienceState


class ResetResponse(BaseModel):
    status: str
    message: str


# ==========================================================================
# Reports
# ==========================================================================


class TimelineEntry(BaseModel):
    at: str
    label: str
    detail: str
    severity: Severity


class Recommendation(BaseModel):
    priority: Severity
    title: str
    detail: str


class ReportPayload(BaseModel):
    id: str
    title: str
    generatedAt: str
    classification: str
    author: str
    executiveSummary: list[str]
    affectedDevices: list[Device]
    timeline: list[TimelineEntry]
    verification: list[VerificationProperty]
    resilience: ResilienceState
    recommendations: list[Recommendation]
    summary: Summary
