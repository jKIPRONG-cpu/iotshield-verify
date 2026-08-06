"""
Attack simulation engine (server side).

A port of ``frontend/src/lib/simulation.ts``. The frontend can build a run
locally so the UI starts animating immediately; when the backend is reachable
its result replaces the local one. Both must therefore produce the same script,
the same targets, and the same verdicts — otherwise a run would visibly change
shape mid-playback.

Everything here is scripted. Nothing is executed, probed, or captured.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from . import data_gen

# ==========================================================================
# Step scripts
# ==========================================================================

NORMAL_SCRIPT: list[dict[str, Any]] = [
    {
        "phase": "Reconnaissance",
        "label": "Baseline capture started",
        "detail": "Passive observation of the device estate begins. No active probing is performed.",
        "severity": "Low",
        "atOffsetMs": 0,
        "place": "idle",
    },
    {
        "phase": "Intrusion",
        "label": "Telemetry received",
        "detail": "Scheduled MQTT telemetry batches arrive from 34 endpoints within the expected publication window.",
        "severity": "Low",
        "atOffsetMs": 900,
        "place": "packet",
    },
    {
        "phase": "Execution",
        "label": "Mutual authentication succeeded",
        "detail": "All sessions presented valid device certificates. No fallback to password authentication was observed.",
        "severity": "Low",
        "atOffsetMs": 1900,
        "place": "auth",
    },
    {
        "phase": "Detection",
        "label": "Behaviour within envelope",
        "detail": "Traffic volume, destination entropy and inter-packet timing all fall inside the 30-day baseline for each device class.",
        "severity": "Low",
        "atOffsetMs": 3000,
        "place": "normal",
    },
    {
        "phase": "Verification",
        "label": "Model re-checked — all properties hold",
        "detail": "The Coloured Petri Net was re-verified against the current marking. Six of six properties are satisfied, including malware containment, which fails only once an execution token is present.",
        "severity": "Low",
        "atOffsetMs": 4200,
        "place": "verify",
    },
    {
        "phase": "Recovery",
        "label": "Baseline established",
        "detail": "The observation window closed clean. This profile becomes the reference the attack scenarios are compared against.",
        "severity": "Low",
        "atOffsetMs": 5200,
        "place": "idle",
    },
]

MIRAI_SCRIPT: list[dict[str, Any]] = [
    {
        "phase": "Reconnaissance",
        "label": "External SYN sweep detected",
        "detail": "An external host enumerated TCP/23 and TCP/2323 across the 10.42.0.0/16 range at roughly 1,400 packets per second.",
        "severity": "Medium",
        "atOffsetMs": 0,
        "place": "packet",
    },
    {
        "phase": "Intrusion",
        "label": "Default-credential brute force",
        "detail": "Sequential Telnet authentication attempts matched the Mirai built-in credential table. 412 attempts preceded the first success.",
        "severity": "High",
        "atOffsetMs": 1100,
        "place": "auth",
    },
    {
        "phase": "Intrusion",
        "label": "Shell session established",
        "detail": "A busybox shell was opened on the target. The session immediately queried /proc/cpuinfo to select a matching payload architecture.",
        "severity": "High",
        "atOffsetMs": 2000,
        "place": "suspicious",
    },
    {
        "phase": "Execution",
        "label": "Unsigned ELF payload staged",
        "detail": "A MIPS-build binary was written to /tmp/.mirai, marked executable, and launched. The dropper then unlinked its own file.",
        "severity": "Critical",
        "atOffsetMs": 3100,
        "place": "malware",
    },
    {
        "phase": "Execution",
        "label": "Watchdog suspended, port 48101 bound",
        "detail": "The implant disabled the hardware watchdog to prevent reboot and bound its ownership-lock port, signalling exclusive control of the host.",
        "severity": "Critical",
        "atOffsetMs": 4000,
        "place": "malware",
    },
    {
        "phase": "Detection",
        "label": "Behavioural detector fired",
        "detail": "Three independent indicators correlated — credential-stuffing pattern, unsigned binary execution, and a new outbound beacon — pushing confidence to 97%.",
        "severity": "Critical",
        "atOffsetMs": 5200,
        "place": "detect",
    },
    {
        "phase": "Verification",
        "label": "Containment property violated",
        "detail": "AG (MalwareExecution → AF Isolated) failed. Detect Malware and Analyse Behaviour were concurrently enabled, so isolation is reachable but not inevitable.",
        "severity": "Critical",
        "atOffsetMs": 6300,
        "place": "verify",
    },
    {
        "phase": "Isolation",
        "label": "Devices moved to quarantine VLAN",
        "detail": "Switch ports for the affected endpoints were placed in a restricted policy group. Egress to the C2 address was blackholed at the edge.",
        "severity": "High",
        "atOffsetMs": 7400,
        "place": "isolate",
    },
    {
        "phase": "Recovery",
        "label": "Reflash and credential rotation underway",
        "detail": "Verified vendor firmware is being written to each quarantined device and administrative credentials reissued. Memory-resident stages do not survive the reflash.",
        "severity": "Medium",
        "atOffsetMs": 8600,
        "place": "recover",
    },
]

BOTNET_SCRIPT: list[dict[str, Any]] = [
    {
        "phase": "Reconnaissance",
        "label": "DHT bootstrap traffic observed",
        "detail": "An internal host began announcing on a public distributed hash table over UDP/6881 — behaviour with no legitimate analogue for this device class.",
        "severity": "Medium",
        "atOffsetMs": 0,
        "place": "packet",
    },
    {
        "phase": "Intrusion",
        "label": "Router CVE chain exploited",
        "detail": "A chained request against the gateway management interface achieved unauthenticated command execution, matching the Mozi entry pattern.",
        "severity": "High",
        "atOffsetMs": 1200,
        "place": "auth",
    },
    {
        "phase": "Execution",
        "label": "Signed configuration blob accepted",
        "detail": "The implant retrieved a peer-distributed configuration and validated it against an embedded ECDSA key. No central controller was contacted.",
        "severity": "Critical",
        "atOffsetMs": 2400,
        "place": "malware",
    },
    {
        "phase": "Execution",
        "label": "Lateral propagation to three peers",
        "detail": "The infected node scanned the local segment and successfully exploited three further devices, each of which joined the overlay.",
        "severity": "Critical",
        "atOffsetMs": 3600,
        "place": "malware",
    },
    {
        "phase": "Detection",
        "label": "Peer fan-out anomaly raised",
        "detail": "Outbound UDP peer count for a single endpoint exceeded its baseline by 40x. Correlation with the exploitation attempts confirmed the detection.",
        "severity": "Critical",
        "atOffsetMs": 4900,
        "place": "detect",
    },
    {
        "phase": "Verification",
        "label": "Containment and leakage properties violated",
        "detail": "Both AG (MalwareExecution → AF Isolated) and G ¬(Exfiltrating ∧ ¬Detected) failed. Peer-to-peer control removes the single choke point isolation relies on.",
        "severity": "Critical",
        "atOffsetMs": 6100,
        "place": "verify",
    },
    {
        "phase": "Isolation",
        "label": "Segment-wide DHT egress blocked",
        "detail": "UDP DHT bootstrap was denied across all IoT VLANs and the four participating hosts were quarantined together to prevent re-seeding.",
        "severity": "High",
        "atOffsetMs": 7300,
        "place": "isolate",
    },
    {
        "phase": "Recovery",
        "label": "Coordinated reflash scheduled",
        "detail": "Because the overlay re-infects any host returned to service early, all four devices are held in quarantine until every reflash completes.",
        "severity": "Medium",
        "atOffsetMs": 8500,
        "place": "recover",
    },
]

CREDENTIAL_SCRIPT: list[dict[str, Any]] = [
    {
        "phase": "Reconnaissance",
        "label": "Distributed login attempts detected",
        "detail": "Authentication requests arrived from 47 distinct source addresses, each attempting a small number of logins to stay below per-source thresholds.",
        "severity": "Medium",
        "atOffsetMs": 0,
        "place": "packet",
    },
    {
        "phase": "Intrusion",
        "label": "Vendor default pair succeeded",
        "detail": "A leaked vendor default credential authenticated successfully against two management interfaces that had never been rotated from factory settings.",
        "severity": "High",
        "atOffsetMs": 1300,
        "place": "auth",
    },
    {
        "phase": "Execution",
        "label": "Administrative session opened",
        "detail": "The session enumerated device configuration and attempted to add a secondary administrative account for persistence.",
        "severity": "High",
        "atOffsetMs": 2500,
        "place": "suspicious",
    },
    {
        "phase": "Detection",
        "label": "Credential-stuffing pattern confirmed",
        "detail": "Low-and-slow distribution defeated per-source rate limits but was caught by aggregate failure-ratio analysis across the management VLAN.",
        "severity": "High",
        "atOffsetMs": 3700,
        "place": "detect",
    },
    {
        "phase": "Verification",
        "label": "Authentication integrity holds",
        "detail": "AG (MalwareExecution → EF Authenticated) is satisfied: no execution path bypassed identity establishment. The weakness is credential strength, not model structure.",
        "severity": "Medium",
        "atOffsetMs": 4900,
        "place": "verify",
    },
    {
        "phase": "Isolation",
        "label": "Sessions terminated, accounts locked",
        "detail": "Active sessions were severed, the injected account removed, and the two affected devices placed in quarantine pending credential rotation.",
        "severity": "Medium",
        "atOffsetMs": 6000,
        "place": "isolate",
    },
    {
        "phase": "Recovery",
        "label": "Fleet-wide credential rotation",
        "detail": "Certificates were reissued for both devices and a policy check flagged nine further endpoints still running factory credentials.",
        "severity": "Low",
        "atOffsetMs": 7100,
        "place": "recover",
    },
]

RANSOMWARE_SCRIPT: list[dict[str, Any]] = [
    {
        "phase": "Reconnaissance",
        "label": "Telnet probe from known PDoS source",
        "detail": "An address previously associated with permanent-denial-of-service activity opened a Telnet session against a perimeter camera.",
        "severity": "High",
        "atOffsetMs": 0,
        "place": "packet",
    },
    {
        "phase": "Intrusion",
        "label": "Default credential accepted",
        "detail": "Authentication succeeded on the second attempt. No payload was staged — the session moved directly to shell commands.",
        "severity": "High",
        "atOffsetMs": 1000,
        "place": "auth",
    },
    {
        "phase": "Execution",
        "label": "Configuration wipe initiated",
        "detail": "The session flushed iptables rules, removed the default route, and began writing /dev/urandom over the configuration partition.",
        "severity": "Critical",
        "atOffsetMs": 2100,
        "place": "malware",
    },
    {
        "phase": "Execution",
        "label": "Firmware partition overwrite attempted",
        "detail": "A raw block write was issued against /dev/mtdblock0. Completing this write renders the device unrecoverable without hardware reflashing.",
        "severity": "Critical",
        "atOffsetMs": 3000,
        "place": "malware",
    },
    {
        "phase": "Detection",
        "label": "Destructive write blocked",
        "detail": "The flash-write guard fired 1.4 seconds into the overwrite and cut the switch port before the firmware partition was fully corrupted.",
        "severity": "Critical",
        "atOffsetMs": 3900,
        "place": "detect",
    },
    {
        "phase": "Verification",
        "label": "Data-leakage property violated",
        "detail": "G ¬(Exfiltrating ∧ ¬Detected) failed: the configuration read preceding the wipe completed before the second behavioural observation triggered detection.",
        "severity": "Critical",
        "atOffsetMs": 5100,
        "place": "verify",
    },
    {
        "phase": "Isolation",
        "label": "Port shut, device preserved",
        "detail": "The switch port was administratively shut and the device left powered for forensic imaging rather than being rebooted.",
        "severity": "High",
        "atOffsetMs": 6200,
        "place": "isolate",
    },
    {
        "phase": "Recovery",
        "label": "Restored from verified image",
        "detail": "Configuration was rebuilt from the last verified backup. One device required physical reflashing; the partition damage was partial but not repairable in place.",
        "severity": "Medium",
        "atOffsetMs": 7400,
        "place": "recover",
    },
]

SCRIPTS = {
    "normal": NORMAL_SCRIPT,
    "mirai": MIRAI_SCRIPT,
    "botnet": BOTNET_SCRIPT,
    "credential": CREDENTIAL_SCRIPT,
    "ransomware": RANSOMWARE_SCRIPT,
}


# ==========================================================================
# Scenario tuning
# ==========================================================================

PROFILES: dict[str, dict[str, Any]] = {
    "normal": {
        "deviceCount": 0,
        "violates": [],
        "outcome": "Baseline clean. All six formal properties hold and no device deviated from its behavioural envelope.",
        "outcomeLevel": "clean",
        "severity": "Low",
        "eventsProcessed": 1_284,
        "accuracy": 99.1,
        "falsePositives": 0,
        "detectionLatencyMs": 0,
        "containmentLatencyMs": 0,
        "containment": 100,
        "recovery": 100,
        "riskReduction": 0,
        "stability": 98,
    },
    "mirai": {
        "deviceCount": 3,
        "violates": ["VP-05"],
        "outcome": "Threat contained. Three devices were compromised and quarantined 2.2 seconds after detection, but the containment property could not be formally guaranteed.",
        "outcomeLevel": "contained",
        "severity": "Critical",
        "eventsProcessed": 3_842,
        "accuracy": 97.2,
        "falsePositives": 2,
        "detectionLatencyMs": 2_400,
        "containmentLatencyMs": 2_200,
        "containment": 86,
        "recovery": 71,
        "riskReduction": 74,
        "stability": 82,
    },
    "botnet": {
        "deviceCount": 4,
        "violates": ["VP-05", "VP-06"],
        "outcome": "Partial containment. Peer-to-peer control removed the single choke point isolation depends on; two formal properties were violated before quarantine completed.",
        "outcomeLevel": "partial",
        "severity": "Critical",
        "eventsProcessed": 4_517,
        "accuracy": 94.8,
        "falsePositives": 5,
        "detectionLatencyMs": 3_100,
        "containmentLatencyMs": 3_400,
        "containment": 68,
        "recovery": 54,
        "riskReduction": 61,
        "stability": 69,
    },
    "credential": {
        "deviceCount": 2,
        "violates": [],
        "outcome": "Threat contained. Authentication integrity held throughout — the exposure was credential strength, not a structural weakness in the model.",
        "outcomeLevel": "contained",
        "severity": "High",
        "eventsProcessed": 2_106,
        "accuracy": 98.3,
        "falsePositives": 1,
        "detectionLatencyMs": 1_800,
        "containmentLatencyMs": 1_500,
        "containment": 94,
        "recovery": 88,
        "riskReduction": 79,
        "stability": 91,
    },
    "ransomware": {
        "deviceCount": 2,
        "violates": ["VP-06"],
        "outcome": "Damage limited. The destructive write was cut 1.4 seconds in; one device required physical reflashing and the leakage property was violated.",
        "outcomeLevel": "partial",
        "severity": "Critical",
        "eventsProcessed": 1_938,
        "accuracy": 96.1,
        "falsePositives": 1,
        "detectionLatencyMs": 2_900,
        "containmentLatencyMs": 900,
        "containment": 78,
        "recovery": 46,
        "riskReduction": 66,
        "stability": 74,
    },
}

PREFERRED_TARGETS: dict[str, list[str]] = {
    "normal": [],
    "mirai": ["Smart Camera", "Gateway Router"],
    "botnet": ["Gateway Router", "Smart Camera", "Industrial PLC"],
    "credential": ["Gateway Router", "Smart Lock", "Medical Monitor"],
    "ransomware": ["Smart Camera", "Smart Bulb"],
}

ALERT_TEMPLATES: dict[str, dict[str, str]] = {
    "mirai": {
        "threat": "Mirai Payload Execution",
        "tactic": "Execution",
        "technique": "T1059.004 — Unix Shell",
        "action": "Quarantine the device and reflash from a verified vendor image.",
        "description": "An unsigned MIPS ELF was staged to /tmp and executed following a successful default-credential login. The watchdog was suspended and the ownership-lock port bound.",
    },
    "botnet": {
        "threat": "Peer-to-Peer Botnet Enrolment",
        "tactic": "Command and Control",
        "technique": "T1090 — Proxy",
        "action": "Block DHT egress segment-wide and quarantine all participating hosts together.",
        "description": "The device joined a distributed hash table overlay and accepted a signed configuration blob from a peer. No central controller was contacted.",
    },
    "credential": {
        "threat": "Credential Stuffing Success",
        "tactic": "Credential Access",
        "technique": "T1110.004 — Credential Stuffing",
        "action": "Terminate sessions, remove injected accounts, and rotate device credentials.",
        "description": "A leaked vendor default pair authenticated against a management interface that had never been rotated from factory settings.",
    },
    "ransomware": {
        "threat": "Destructive Flash Write",
        "tactic": "Impact",
        "technique": "T1485 — Data Destruction",
        "action": "Shut the switch port and preserve the device powered for forensic imaging.",
        "description": "Raw block writes were issued against the firmware partition following a configuration wipe, matching the permanent-denial-of-service pattern.",
    },
}


def _iso(ms: float) -> str:
    dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return f"{dt.strftime('%Y-%m-%dT%H:%M:%S')}.{dt.microsecond // 1000:03d}Z"


def _clamp(n: float, lo: float, hi: float) -> float:
    return min(hi, max(lo, n))


# ==========================================================================
# Verification outcomes
# ==========================================================================


def verification_for(
    scenario: str, baseline: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """
    Re-derive the property table for one scenario.

    Where a baseline failure now reads as satisfied, the reason text says so
    explicitly: the run simply never reached the marking that exposes it. The
    violation has not been fixed, and the UI repeats that caveat.
    """
    violates = set(PROFILES[scenario]["violates"])
    out: list[dict[str, Any]] = []

    for prop in baseline:
        item = dict(prop)
        if prop["id"] in violates:
            item["status"] = "Failed"
        elif prop["status"] == "Failed":
            item["status"] = "Verified"
            item["counterexample"] = None
            if scenario == "normal":
                item["reason"] = (
                    "Not exercised by this scenario. With no token in Malware Execution "
                    "the premise is vacuously satisfied, so the violation present in the "
                    "baseline model cannot be reached from any state visited during this run."
                )
            else:
                item["reason"] = (
                    "Satisfied for this run. The firing sequence that violates this property "
                    f"in the baseline model was not reachable from any marking visited during "
                    f"the {scenario} scenario."
                )
        out.append(item)

    return out


# ==========================================================================
# Targets, alerts, resilience
# ==========================================================================


def select_targets(scenario: str, devices: list[dict[str, Any]]) -> list[dict[str, Any]]:
    count = PROFILES[scenario]["deviceCount"]
    if count == 0:
        return []

    wanted = PREFERRED_TARGETS[scenario]
    ranked = sorted(
        devices,
        key=lambda d: (0 if d["category"] in wanted else 1, d["health"]),
    )
    return ranked[:count]


def alerts_for(
    scenario: str,
    targets: list[dict[str, Any]],
    started_at_ms: float,
    malware: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not targets:
        return []

    profile = PROFILES[scenario]
    template = ALERT_TEMPLATES[scenario]

    family_id = next(
        (s["familyId"] for s in data_gen.SCENARIOS if s["id"] == scenario), None
    )
    family_name = next((m["name"] for m in malware if m["id"] == family_id), None)

    return [
        {
            "id": f"ALT-SIM-{scenario.upper()}-{i + 1}",
            "timestamp": _iso(
                started_at_ms + profile["detectionLatencyMs"] + i * 400
            ),
            "deviceId": device["id"],
            "deviceName": device["name"],
            "threat": template["threat"],
            "malwareFamily": family_name,
            "severity": profile["severity"],
            "status": "Open",
            "action": template["action"],
            "description": template["description"],
            "mitreTactic": template["tactic"],
            "mitreTechnique": template["technique"],
            "confidence": int(_clamp(round(profile["accuracy"]) - i, 60, 99)),
            "sourceIp": device["ip"],
        }
        for i, device in enumerate(targets)
    ]


def resilience_for(
    scenario: str, targets: list[dict[str, Any]], started_at_ms: float
) -> dict[str, Any]:
    profile = PROFILES[scenario]
    clean = scenario == "normal"
    violated = len(profile["violates"])

    if clean:
        workflow = [
            {
                "id": "RS-N1",
                "label": "Baseline observation complete",
                "description": "A full observation window closed with no deviation from the behavioural envelope. No response action was required.",
                "status": "Complete",
                "at": _iso(started_at_ms + 5_200),
                "durationSec": 5,
                "automated": True,
            }
        ]
    else:
        plural = "" if len(targets) == 1 else "s"
        workflow = [
            {
                "id": "RS-S1",
                "label": "Threat confirmed",
                "description": (
                    f"Detection fired at {profile['detectionLatencyMs'] / 1000:.1f}s with "
                    f"{profile['accuracy']}% confidence after correlating three independent indicators."
                ),
                "status": "Complete",
                "at": _iso(started_at_ms + profile["detectionLatencyMs"]),
                "durationSec": round(profile["detectionLatencyMs"] / 1000),
                "automated": True,
            },
            {
                "id": "RS-S2",
                "label": "Automatic isolation",
                "description": (
                    f"{len(targets)} device{plural} moved to the quarantine VLAN and C2 "
                    "destinations blackholed at the edge."
                ),
                "status": "Complete",
                "at": _iso(
                    started_at_ms
                    + profile["detectionLatencyMs"]
                    + profile["containmentLatencyMs"]
                ),
                "durationSec": round(profile["containmentLatencyMs"] / 1000),
                "automated": True,
            },
            {
                "id": "RS-S3",
                "label": "Formal re-verification",
                "description": (
                    (
                        f"Re-check against the post-isolation marking returned {violated} violated "
                        f"propert{'y' if violated == 1 else 'ies'}. Containment held in practice but "
                        "is not guaranteed by the model."
                    )
                    if violated
                    else "Re-check against the post-isolation marking confirmed all six properties hold."
                ),
                "status": "Failed" if violated else "Complete",
                "at": _iso(started_at_ms + 6_300),
                "durationSec": 48,
                "automated": True,
            },
            {
                "id": "RS-S4",
                "label": "Credential rotation",
                "description": "Device certificates and administrative credentials reissued for every quarantined asset.",
                "status": "Complete",
                "at": _iso(started_at_ms + 7_400),
                "durationSec": 90,
                "automated": True,
            },
            {
                "id": "RS-S5",
                "label": "Firmware reflash",
                "description": "Verified vendor images are being written to the quarantined devices. Memory-resident stages do not survive the reflash.",
                "status": "Active",
                "at": _iso(started_at_ms + 8_600),
                "durationSec": 0,
                "automated": True,
            },
            {
                "id": "RS-S6",
                "label": "Post-recovery validation",
                "description": "Behavioural baseline is re-established and each device re-admitted only after a clean observation window.",
                "status": "Pending",
                "at": None,
                "durationSec": 0,
                "automated": True,
            },
            {
                "id": "RS-S7",
                "label": "Model remediation",
                "description": (
                    "Apply the priority guard recommended by the failed property so the containment "
                    "eventuality becomes unconditional, then re-verify."
                    if violated
                    else "No model change required — every property held for this run."
                ),
                "status": "Pending" if violated else "Complete",
                "at": None,
                "durationSec": 0,
                "automated": False,
            },
        ]

    shape = (
        [98, 98, 99, 98, 99, 98, 99, 98, 99, 98, 99, 98]
        if clean
        else [96, 92, 78, 61, 44, 39, 48, 60, 71, 79, 84, profile["stability"]]
    )

    timeline = [
        {
            "t": _iso(started_at_ms + i * 800),
            "stability": stability,
            "risk": int(_clamp(100 - stability, 0, 100)),
        }
        for i, stability in enumerate(shape)
    ]

    return {
        "containment": profile["containment"],
        "recovery": profile["recovery"],
        "riskReduction": profile["riskReduction"],
        "stability": profile["stability"],
        "devicesIsolated": len(targets),
        "devicesRecovered": 0 if clean else max(0, len(targets) - 1),
        "devicesPendingRecovery": 0 if clean else 1,
        "mttdSec": round(profile["detectionLatencyMs"] / 1000),
        "mttcSec": round(
            (profile["detectionLatencyMs"] + profile["containmentLatencyMs"]) / 1000
        ),
        "mttrSec": 0 if clean else 1_640,
        "workflow": workflow,
        "timeline": timeline,
    }


# ==========================================================================
# Entry point
# ==========================================================================


def build_simulation(
    scenario: str,
    devices: list[dict[str, Any]],
    baseline_properties: list[dict[str, Any]],
    malware: list[dict[str, Any]],
    started_at_ms: float,
) -> dict[str, Any]:
    """Build the complete scripted result for one scenario run."""
    profile = PROFILES[scenario]
    definition = next((s for s in data_gen.SCENARIOS if s["id"] == scenario), None)

    targets = select_targets(scenario, devices)
    verification = verification_for(scenario, baseline_properties)

    steps = [
        {**seed, "id": f"SIM-{scenario}-{i + 1}", "order": i}
        for i, seed in enumerate(SCRIPTS[scenario])
    ]

    metrics = {
        "eventsProcessed": profile["eventsProcessed"],
        "threatsDetected": len(targets),
        "detectionAccuracy": profile["accuracy"],
        "falsePositives": profile["falsePositives"],
        "devicesAffected": len(targets),
        "devicesIsolated": len(targets),
        "devicesRecovered": 0 if scenario == "normal" else max(0, len(targets) - 1),
        "detectionLatencyMs": profile["detectionLatencyMs"],
        "containmentLatencyMs": profile["containmentLatencyMs"],
        "propertiesChecked": len(verification),
        "propertiesViolated": len(profile["violates"]),
    }

    return {
        "id": f"SIM-{scenario}-{int(started_at_ms)}",
        "scenario": scenario,
        "scenarioLabel": definition["label"] if definition else scenario,
        "startedAt": _iso(started_at_ms),
        "outcome": profile["outcome"],
        "outcomeLevel": profile["outcomeLevel"],
        "severity": profile["severity"],
        "steps": steps,
        "metrics": metrics,
        "affectedDeviceIds": [d["id"] for d in targets],
        "verification": verification,
        "alerts": alerts_for(scenario, targets, started_at_ms, malware),
        "resilience": resilience_for(scenario, targets, started_at_ms),
    }
