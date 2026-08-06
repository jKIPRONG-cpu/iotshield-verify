"""
IoTShield Verify — synthetic dataset generator.

This is a faithful port of ``frontend/src/data/mock.ts``: the same linear
congruential PRNG, the same seed, the same reference tables, and — critically —
the same *order* of random draws. That is what makes the API and the frontend's
offline fallback agree field-for-field rather than merely looking similar.

If you change a generator here, change its counterpart there, and keep the
sequence of ``rng`` calls identical. The parity check in ``tools/check_parity.py``
compares the two datasets and will fail loudly if they drift.

DEMO NOTE: everything produced here is synthetic. No real device, capture, or
experimental measurement is modelled.
"""

from __future__ import annotations

import math
import time
from datetime import datetime, timezone
from typing import Any, Callable, Sequence, TypeVar

T = TypeVar("T")

SEED = 20260317

HOUR_MS = 3_600_000
DAY_MS = 86_400_000

EVENT_COUNT = 500
ALERT_COUNT = 150


# ==========================================================================
# Deterministic PRNG
# ==========================================================================


class Rng:
    """Numerical Recipes LCG — identical arithmetic to the TypeScript version."""

    __slots__ = ("state",)

    def __init__(self, seed: int) -> None:
        self.state = seed & 0xFFFFFFFF

    def next(self) -> float:
        """Uniform float in [0, 1)."""
        self.state = (self.state * 1664525 + 1013904223) & 0xFFFFFFFF
        return self.state / 4294967296

    def int(self, lo: int, hi: int) -> int:
        """Inclusive integer in [lo, hi]."""
        return lo + int(self.next() * (hi - lo + 1))

    def float(self, lo: float, hi: float, dp: int = 1) -> float:
        """Float in [lo, hi] rounded to ``dp`` decimals, half-up like JS."""
        value = lo + self.next() * (hi - lo)
        factor = 10**dp
        return math.floor(value * factor + 0.5) / factor

    def pick(self, items: Sequence[T]) -> T:
        return items[int(self.next() * len(items))]

    def chance(self, p: float) -> bool:
        return self.next() < p

    def shuffle(self, items: list[T]) -> list[T]:
        """In-place Fisher-Yates, matching the JS loop direction exactly."""
        for i in range(len(items) - 1, 0, -1):
            j = int(self.next() * (i + 1))
            items[i], items[j] = items[j], items[i]
        return items


def js_round(value: float) -> int:
    """JavaScript ``Math.round`` — half away from zero for positives."""
    return math.floor(value + 0.5)


# ==========================================================================
# Time anchor
# ==========================================================================


def _anchor() -> int:
    """Top of the current hour, in milliseconds."""
    return (int(time.time() * 1000) // HOUR_MS) * HOUR_MS


ANCHOR = _anchor()


def iso_ago(ms: int) -> str:
    """ISO-8601 with milliseconds and a Z suffix, matching Date.toISOString()."""
    dt = datetime.fromtimestamp((ANCHOR - ms) / 1000, tz=timezone.utc)
    return f"{dt.strftime('%Y-%m-%dT%H:%M:%S')}.{dt.microsecond // 1000:03d}Z"


def day_label(days_ago: int) -> str:
    dt = datetime.fromtimestamp((ANCHOR - days_ago * DAY_MS) / 1000, tz=timezone.utc)
    return dt.strftime("%Y-%m-%d")


def pad(n: int, width: int = 3) -> str:
    return str(n).rjust(width, "0")


def clamp(n: float, lo: float, hi: float) -> float:
    return min(hi, max(lo, n))


# ==========================================================================
# Reference tables — must match the TypeScript source exactly
# ==========================================================================

ARCHETYPES: list[dict[str, Any]] = [
    {
        "category": "Smart Camera",
        "count": 8,
        "vendors": ["Hikvision", "Dahua", "Axis", "Reolink"],
        "stem": "cam",
        "protocol": "TCP",
        "ports": [80, 554, 8000],
        "firmware_prefix": "HV",
    },
    {
        "category": "Motion Sensor",
        "count": 6,
        "vendors": ["Aqara", "Bosch", "Honeywell"],
        "stem": "pir",
        "protocol": "MQTT",
        "ports": [1883],
        "firmware_prefix": "AQ",
    },
    {
        "category": "Smart Bulb",
        "count": 5,
        "vendors": ["Philips Hue", "TP-Link", "LIFX"],
        "stem": "bulb",
        "protocol": "CoAP",
        "ports": [5683],
        "firmware_prefix": "PH",
    },
    {
        "category": "Smart Lock",
        "count": 4,
        "vendors": ["Yale", "August", "Schlage"],
        "stem": "lock",
        "protocol": "MQTT",
        "ports": [1883, 8883],
        "firmware_prefix": "YL",
    },
    {
        "category": "Smart Thermostat",
        "count": 4,
        "vendors": ["Nest", "Ecobee", "Tado"],
        "stem": "therm",
        "protocol": "HTTPS",
        "ports": [443],
        "firmware_prefix": "NS",
    },
    {
        "category": "Gateway Router",
        "count": 3,
        "vendors": ["MikroTik", "Ubiquiti", "Cisco"],
        "stem": "gw",
        "protocol": "TCP",
        "ports": [22, 80, 443, 8291],
        "firmware_prefix": "RT",
    },
    {
        "category": "Medical Monitor",
        "count": 3,
        "vendors": ["Philips", "GE Healthcare", "Dräger"],
        "stem": "med",
        "protocol": "HTTPS",
        "ports": [443, 11073],
        "firmware_prefix": "MD",
    },
    {
        "category": "Weather Station",
        "count": 3,
        "vendors": ["Davis", "Netatmo", "Ambient"],
        "stem": "wx",
        "protocol": "MQTT",
        "ports": [1883],
        "firmware_prefix": "WX",
    },
    {
        "category": "Industrial PLC",
        "count": 2,
        "vendors": ["Siemens", "Allen-Bradley"],
        "stem": "plc",
        "protocol": "TCP",
        "ports": [102, 502],
        "firmware_prefix": "PL",
    },
    {
        "category": "Smart Speaker",
        "count": 2,
        "vendors": ["Sonos", "Amazon"],
        "stem": "spk",
        "protocol": "HTTPS",
        "ports": [443, 1400],
        "firmware_prefix": "SP",
    },
]

LOCATIONS = [
    "Building A — Lobby",
    "Building A — Floor 2",
    "Building B — Server Room",
    "Building B — Clinic Wing",
    "Building C — Warehouse",
    "Perimeter — North Gate",
    "Perimeter — Car Park",
    "Plant Room — Level 0",
]

VENDOR_OUI = {
    "Hikvision": "44:19:B6",
    "Dahua": "3C:EF:8C",
    "Axis": "00:40:8C",
    "Reolink": "EC:71:DB",
    "Aqara": "54:EF:44",
    "Bosch": "00:1B:C5",
    "Honeywell": "00:D0:2D",
    "Philips Hue": "00:17:88",
    "TP-Link": "B0:4E:26",
    "LIFX": "D0:73:D5",
    "Yale": "00:1E:C0",
    "August": "D8:E3:5E",
    "Schlage": "00:26:6C",
    "Nest": "18:B4:30",
    "Ecobee": "44:61:32",
    "Tado": "5C:CF:7F",
    "MikroTik": "4C:5E:0C",
    "Ubiquiti": "24:A4:3C",
    "Cisco": "00:1A:A1",
    "Philips": "00:04:F3",
    "GE Healthcare": "00:16:3E",
    "Dräger": "00:0E:8F",
    "Davis": "00:20:4A",
    "Netatmo": "70:EE:50",
    "Ambient": "C8:2B:96",
    "Siemens": "00:1B:1B",
    "Allen-Bradley": "00:00:BC",
    "Sonos": "5C:AA:FD",
    "Amazon": "FC:65:DE",
}

STATUS_PLAN: list[str] = (
    ["Healthy"] * 24
    + ["At Risk"] * 6
    + ["Compromised"] * 5
    + ["Isolated"] * 2
    + ["Recovering"] * 2
    + ["Offline"] * 1
)

HEALTH_BAND = {
    "Healthy": (86, 99),
    "At Risk": (58, 78),
    "Compromised": (12, 38),
    "Isolated": (22, 44),
    "Recovering": (52, 71),
    "Offline": (0, 0),
}

EXTERNAL_IPS = [
    "185.244.25.171",
    "91.211.88.42",
    "203.0.113.44",
    "45.129.33.18",
    "198.51.100.77",
    "176.32.44.201",
    "193.201.224.9",
    "104.21.9.14",
    "52.94.236.248",
    "142.250.187.14",
]


# ==========================================================================
# Devices
# ==========================================================================


def risk_for(status: str, health: int) -> str:
    if status == "Compromised":
        return "Critical"
    if status == "Isolated":
        return "High"
    if status == "At Risk":
        return "High" if health < 66 else "Medium"
    if status == "Recovering":
        return "Medium"
    if status == "Offline":
        return "Medium"
    return "Low" if health >= 94 else "Medium"


def generate_devices(rng: Rng) -> list[dict[str, Any]]:
    statuses = rng.shuffle(list(STATUS_PLAN))
    devices: list[dict[str, Any]] = []
    index = 0

    for arch in ARCHETYPES:
        for n in range(1, arch["count"] + 1):
            status = statuses[index]
            vendor = rng.pick(arch["vendors"])
            location = rng.pick(LOCATIONS)
            subnet = 10 + LOCATIONS.index(location)

            lo, hi = HEALTH_BAND[status]
            health = 0 if status == "Offline" else rng.int(lo, hi)

            oui = VENDOR_OUI.get(vendor, "02:00:00")
            octets = [rng.int(0, 255) for _ in range(3)]
            mac = f"{oui}:{octets[0]:02x}:{octets[1]:02x}:{octets[2]:02x}".upper()

            major = rng.int(1, 4)
            minor = rng.int(0, 9)
            patch = rng.int(0, 24)

            outdated = (
                rng.chance(0.8)
                if status in ("Compromised", "At Risk")
                else rng.chance(0.18)
            )

            if status == "Offline":
                last_activity_ms = rng.int(6, 40) * HOUR_MS
            elif status == "Compromised":
                last_activity_ms = rng.int(20, 900) * 1000
            else:
                last_activity_ms = rng.int(30, 5400) * 1000

            extra_ports = (
                [rng.pick([23, 2323, 48101, 5555])] if status == "Compromised" else []
            )

            host = rng.int(4, 250)
            uptime = 0 if status == "Offline" else rng.int(6, 2200)

            devices.append(
                {
                    "id": f"DEV-{pad(index + 1)}",
                    "name": f"{arch['stem']}-{pad(n, 2)}.{arch['category'].split(' ')[0].lower()}.iot",
                    "category": arch["category"],
                    "vendor": vendor,
                    "ip": f"10.42.{subnet}.{host}",
                    "mac": mac,
                    "firmware": f"{arch['firmware_prefix']}-{major}.{minor}.{pad(patch, 2)}",
                    "firmwareOutdated": outdated,
                    "status": status,
                    "risk": risk_for(status, health),
                    "lastActivity": iso_ago(last_activity_ms),
                    "location": location,
                    "health": health,
                    "protocol": arch["protocol"],
                    "openPorts": list(arch["ports"]) + extra_ports,
                    "uptimeHours": uptime,
                    "infectedBy": None,
                }
            )
            index += 1

    return devices


# ==========================================================================
# Malware families
# ==========================================================================

FAMILY_SEEDS: list[dict[str, Any]] = [
    {
        "id": "MAL-01",
        "name": "Mirai",
        "aliases": ["Katana", "Okiru", "Satori"],
        "firstSeen": "2016-08",
        "category": "DDoS Botnet",
        "severity": "Critical",
        "prevalence": 31,
        "description": (
            "The archetypal IoT botnet. Mirai enumerates the internet for devices exposing "
            "Telnet and SSH, authenticates with a hard-coded credential table, and enrols the "
            "host into a DDoS swarm. Its source release in 2016 spawned a long tail of "
            "derivatives that still dominate IoT telemetry."
        ),
        "infectionMethod": (
            "Brute-force of Telnet (23/2323) and SSH using a built-in table of ~60 default "
            "vendor credentials, followed by staged download of an architecture-matched ELF payload."
        ),
        "propagation": (
            "Self-propagating: each infected node runs its own SYN scanner against randomised "
            "/8 ranges, excluding reserved and government blocks."
        ),
        "targetDevices": [
            "Smart Camera",
            "Gateway Router",
            "Network Video Recorder",
            "Smart Speaker",
        ],
        "behaviour": [
            "Kills competing binaries and disables the watchdog to prevent reboot",
            "Deletes its own executable and runs solely from memory",
            "Binds a local port to signal exclusive ownership of the host",
            "Maintains a persistent TCP session with the C2 for attack commands",
            "Executes UDP, SYN, ACK, GRE and HTTP flood primitives on demand",
        ],
        "mitigation": [
            "Disable Telnet entirely; permit SSH only with key-based authentication",
            "Force a credential change at first boot and reject vendor defaults",
            "Segment IoT assets onto a VLAN with no outbound port 23/2323",
            "Rate-limit egress and alert on sustained outbound SYN volume",
            "Power-cycle plus firmware reflash — memory-resident stages do not survive",
        ],
        "cveRefs": ["CVE-2017-17215", "CVE-2014-8361"],
        "iocs": [
            {"type": "IP", "value": "185.244.25.171", "note": "Loader / report server"},
            {"type": "Domain", "value": "cnc.botnet-relay.su", "note": "Primary C2"},
            {
                "type": "Hash",
                "value": "a2f4c1e9b7d3068f5a1c2e4b9d7f3061",
                "note": "ELF payload, MIPS build",
            },
            {"type": "Port", "value": "48101", "note": "Ownership-lock bind port"},
            {"type": "Path", "value": "/tmp/.mirai", "note": "Staging path before unlink"},
        ],
    },
    {
        "id": "MAL-02",
        "name": "Gafgyt",
        "aliases": ["Bashlite", "Qbot", "Lizkebab"],
        "firstSeen": "2014-03",
        "category": "DDoS Botnet",
        "severity": "High",
        "prevalence": 17,
        "description": (
            "A pre-Mirai botnet family that remains widely forked. Gafgyt favours shell-command "
            "injection over credential brute force and communicates with its controller over "
            "plain IRC, which makes it noisy but resilient."
        ),
        "infectionMethod": (
            "Command injection against unauthenticated CGI and SOAP endpoints, plus opportunistic "
            "Telnet brute force using a smaller credential set than Mirai."
        ),
        "propagation": (
            "Controller-driven: scanning targets are pushed from the C2 rather than chosen by the bot."
        ),
        "targetDevices": ["Gateway Router", "Smart Camera", "DVR", "Weather Station"],
        "behaviour": [
            "Joins an IRC channel and awaits plaintext operator commands",
            "Downloads architecture-specific payloads via wget or tftp",
            "Enumerates and terminates rival botnet processes",
            "Provides UDP, TCP and HTTP flood modules",
            "Rewrites init scripts for persistence across reboot",
        ],
        "mitigation": [
            "Patch CGI and SOAP handlers exposed on the LAN interface",
            "Block outbound IRC ports (6667, 6697) at the segment boundary",
            "Deny wget/tftp egress from device VLANs",
            "Monitor for init-script modification on managed endpoints",
        ],
        "cveRefs": ["CVE-2017-5638", "CVE-2018-10561"],
        "iocs": [
            {"type": "IP", "value": "91.211.88.42", "note": "IRC controller"},
            {"type": "Domain", "value": "irc.gafgyt-node.top", "note": "Fallback C2"},
            {
                "type": "Hash",
                "value": "d41f9c7a3e2b8054c6f1a9d3b7e50218",
                "note": "ELF dropper, ARMv7",
            },
            {"type": "Port", "value": "6667", "note": "IRC control channel"},
        ],
    },
    {
        "id": "MAL-03",
        "name": "Mozi",
        "aliases": ["Mozi.m", "Mozi.a"],
        "firstSeen": "2019-09",
        "category": "P2P Botnet",
        "severity": "Critical",
        "prevalence": 14,
        "description": (
            "Mozi abandons centralised control for a DHT-based peer-to-peer network, making "
            "takedown substantially harder. Nodes exchange signed configuration blobs, so seizing "
            "any single host yields no controller to sinkhole."
        ),
        "infectionMethod": (
            "Exploitation of known router and DVR vulnerabilities combined with weak Telnet "
            "passwords; the payload registers itself as a DHT node on join."
        ),
        "propagation": (
            "Peer-to-peer over a modified BitTorrent DHT; configuration is distributed and signed "
            "rather than fetched from a server."
        ),
        "targetDevices": ["Gateway Router", "Smart Camera", "Industrial PLC"],
        "behaviour": [
            "Bootstraps into the public DHT and announces on a fixed info-hash",
            "Verifies configuration blobs against an embedded ECDSA public key",
            "Supports DDoS, command execution and payload update tasks",
            "Hijacks HTTP sessions to inject content on the local segment",
            "Persists via /etc/rc.local or an equivalent boot hook",
        ],
        "mitigation": [
            "Block outbound UDP DHT bootstrap traffic from device VLANs",
            "Patch the router and DVR CVEs used for initial access",
            "Alert on unexpected UDP peer fan-out from a single IoT host",
            "Reflash affected firmware — in-place cleanup is unreliable",
        ],
        "cveRefs": ["CVE-2018-10561", "CVE-2017-17215", "CVE-2014-8361"],
        "iocs": [
            {
                "type": "Hash",
                "value": "b7e2419fd3a86c05e1b4f7d29a3c6180",
                "note": "Mozi.m payload",
            },
            {"type": "Port", "value": "6881", "note": "DHT bootstrap"},
            {"type": "Path", "value": "/etc/rc.local", "note": "Persistence hook"},
            {"type": "Mutex", "value": "mozi-lock-0x7f", "note": "Single-instance guard"},
        ],
    },
    {
        "id": "MAL-04",
        "name": "VPNFilter",
        "aliases": ["Fancy Bear implant"],
        "firstSeen": "2018-05",
        "category": "Modular Implant",
        "severity": "Critical",
        "prevalence": 9,
        "description": (
            "A staged, state-associated implant targeting small-office routers and NAS devices. "
            "Stage 1 survives reboot and exists only to retrieve Stage 2; later stages add "
            "credential capture, SCADA protocol inspection, and a destructive firmware-wipe capability."
        ),
        "infectionMethod": (
            "Exploitation of known router vulnerabilities and default credentials; Stage 1 locates "
            "its Stage 2 server through EXIF metadata in images fetched from a public photo host."
        ),
        "propagation": "Not self-propagating — operators select and infect targets deliberately.",
        "targetDevices": ["Gateway Router", "NAS", "Industrial PLC"],
        "behaviour": [
            "Stage 1 achieves reboot persistence via cron and awaits Stage 2",
            "Stage 2 provides file collection, command execution and device bricking",
            "Stage 3 plugins sniff credentials and parse Modbus SCADA traffic",
            "Downgrades HTTPS to HTTP to expose session content",
            "Overwrites the first megabyte of flash on a kill command",
        ],
        "mitigation": [
            "Factory-reset and reflash affected routers, then rotate all credentials",
            "Disable remote administration on the WAN interface",
            "Terminate TLS at a trusted gateway to detect downgrade attempts",
            "Inspect Modbus/502 traffic crossing the OT boundary",
        ],
        "cveRefs": ["CVE-2018-7445", "CVE-2016-6277"],
        "iocs": [
            {"type": "IP", "value": "203.0.113.44", "note": "Stage 2 distribution host"},
            {"type": "Domain", "value": "photobucket-cdn.link", "note": "EXIF beacon host"},
            {
                "type": "Hash",
                "value": "c3a9017e5f2b4d86091c7e3a5b8d2f41",
                "note": "Stage 1 loader",
            },
            {"type": "Path", "value": "/var/run/vpnfilterw", "note": "Stage 2 working dir"},
        ],
    },
    {
        "id": "MAL-05",
        "name": "Hajime",
        "aliases": ["Hajime worm"],
        "firstSeen": "2016-10",
        "category": "Vigilante Worm",
        "severity": "Medium",
        "prevalence": 7,
        "description": (
            "A technically sophisticated worm with no observed offensive payload. Hajime closes "
            "the very ports Mirai abuses and displays a signed message claiming benign intent — "
            "but it retains a full remote-execution channel, so the host is compromised regardless "
            "of stated motive."
        ),
        "infectionMethod": (
            "Telnet brute force with a compact credential list, plus exploitation of the TR-064 "
            "management interface."
        ),
        "propagation": (
            "Peer-to-peer over a BitTorrent DHT overlay with signed module distribution."
        ),
        "targetDevices": ["Gateway Router", "Smart Camera", "Motion Sensor"],
        "behaviour": [
            "Blocks ports 23, 7547, 5555 and 5358 after taking the host",
            "Displays a signed operator message on the console every ten minutes",
            "Holds an unused but fully functional remote-execution channel",
            "Runs entirely from memory with no on-disk persistence",
            "Updates modules over the P2P overlay with signature verification",
        ],
        "mitigation": [
            "Treat as a full compromise despite the absence of a hostile payload",
            "Reboot to clear the memory-resident implant, then patch before reconnect",
            "Close TR-064 (7547) at the network edge",
            "Replace default Telnet credentials prior to returning the host to service",
        ],
        "cveRefs": ["CVE-2016-10372"],
        "iocs": [
            {"type": "Port", "value": "7547", "note": "TR-064 entry vector"},
            {"type": "Mutex", "value": ".hajime-run", "note": "Instance guard"},
            {
                "type": "Hash",
                "value": "f18d3b72c4e9506a1d8f2b3c7e405916",
                "note": "Stage 1, MIPS build",
            },
        ],
    },
    {
        "id": "MAL-06",
        "name": "BrickerBot",
        "aliases": ["PDoS bot"],
        "firstSeen": "2017-03",
        "category": "Destructive / PDoS",
        "severity": "Critical",
        "prevalence": 5,
        "description": (
            "A permanent denial-of-service agent. BrickerBot makes no attempt at persistence or "
            "control; on gaining access it corrupts flash storage, wipes routing configuration, "
            "and renders the device unrecoverable without hardware reflashing."
        ),
        "infectionMethod": (
            "Telnet brute force with default credentials, followed immediately by destructive "
            "shell commands."
        ),
        "propagation": (
            "Non-persistent: executes and exits. Reinfection requires a fresh compromise."
        ),
        "targetDevices": ["Gateway Router", "Smart Camera", "Smart Bulb"],
        "behaviour": [
            "Overwrites block devices with dd from /dev/urandom",
            "Removes the default route and flushes iptables rules",
            "Sets kernel parameters that disable further network use",
            "Truncates critical filesystem paths before rebooting",
            "Leaves no C2 channel and no persistence artefacts",
        ],
        "mitigation": [
            "Prevent access at the network edge — post-execution recovery is impossible",
            "Maintain verified offline firmware images for every device model",
            "Deny Telnet inbound at every segment boundary without exception",
            "Keep spare provisioned hardware for critical-path assets",
        ],
        "cveRefs": [],
        "iocs": [
            {
                "type": "IP",
                "value": "198.51.100.77",
                "note": "Observed source of PDoS attempts",
            },
            {"type": "Path", "value": "/dev/mtdblock0", "note": "Primary overwrite target"},
            {"type": "User-Agent", "value": "busybox-wget/1.29", "note": "Staging fetch"},
        ],
    },
    {
        "id": "MAL-07",
        "name": "Torii",
        "aliases": ["Torii botnet"],
        "firstSeen": "2018-09",
        "category": "Stealth Implant",
        "severity": "High",
        "prevalence": 6,
        "description": (
            "An unusually sophisticated IoT implant supporting a wide range of CPU architectures. "
            "Torii layers six independent persistence mechanisms, encrypts its exfiltration channel, "
            "and prioritises data collection over DDoS capacity."
        ),
        "infectionMethod": (
            "Telnet brute force delivering an architecture-detecting shell dropper that selects the "
            "matching second-stage binary."
        ),
        "propagation": "Operator-directed rather than self-spreading.",
        "targetDevices": ["Gateway Router", "Smart Camera", "Medical Monitor"],
        "behaviour": [
            "Installs six parallel persistence mechanisms including systemd and rc scripts",
            "Fingerprints hostname, MAC, CPU and installed packages on first run",
            "Encrypts all C2 traffic with AES-128 over TCP/443",
            "Polls for arbitrary command and payload execution",
            "Deliberately avoids DDoS activity to stay below volumetric detection",
        ],
        "mitigation": [
            "Audit every persistence surface — removing one mechanism is not enough",
            "Inspect TLS on egress from device VLANs to spot non-conforming sessions",
            "Reflash from a known-good image rather than attempting cleanup",
            "Baseline outbound connection patterns per device class",
        ],
        "cveRefs": ["CVE-2018-14847"],
        "iocs": [
            {"type": "Domain", "value": "top.haddns.net", "note": "Encrypted C2"},
            {
                "type": "Path",
                "value": "/etc/systemd/system/torii.service",
                "note": "Persistence unit",
            },
            {
                "type": "Hash",
                "value": "0e7c4a19b3d82f560a1e9c4b7d3f2085",
                "note": "Second-stage binary",
            },
            {"type": "Port", "value": "443", "note": "AES-wrapped C2 over TLS port"},
        ],
    },
    {
        "id": "MAL-08",
        "name": "Dark Nexus",
        "aliases": ["DarkNexus"],
        "firstSeen": "2020-04",
        "category": "DDoS Botnet",
        "severity": "High",
        "prevalence": 4,
        "description": (
            "A commercially operated botnet sold as a DDoS service. Dark Nexus borrows from Mirai "
            "and Qbot but adds a scoring system that ranks processes by likelihood of being a "
            "competing implant and terminates them selectively."
        ),
        "infectionMethod": (
            "Telnet credential stuffing plus exploitation of a rotating set of router vulnerabilities."
        ),
        "propagation": "Self-propagating with a controller-supplied target list.",
        "targetDevices": ["Gateway Router", "Smart Camera", "Smart Thermostat"],
        "behaviour": [
            "Scores running processes and kills suspected rival implants",
            "Disguises flood traffic as legitimate browser requests",
            "Maintains reboot persistence by hooking the init sequence",
            "Blocks device restart by suspending the watchdog daemon",
            "Fetches payloads for twelve distinct CPU architectures",
        ],
        "mitigation": [
            "Enforce credential rotation and lock out repeated failed logins",
            "Apply vendor patches for the exploited router models",
            "Alert on watchdog daemon suspension as a tamper signal",
            "Filter HTTP floods on request-signature rather than volume alone",
        ],
        "cveRefs": ["CVE-2019-16920"],
        "iocs": [
            {"type": "IP", "value": "45.129.33.18", "note": "Command server"},
            {
                "type": "User-Agent",
                "value": "Mozilla/5.0 (compatible; dnx/1.2)",
                "note": "Flood signature",
            },
            {
                "type": "Hash",
                "value": "5b1e8c3a7f2d4906b3e1a8c5d2f70943",
                "note": "ARM payload",
            },
        ],
    },
    {
        "id": "MAL-09",
        "name": "Meris",
        "aliases": ["Mēris"],
        "firstSeen": "2021-06",
        "category": "HTTP Flood Botnet",
        "severity": "Critical",
        "prevalence": 4,
        "description": (
            "A botnet built from compromised networking appliances that set records for HTTP "
            "request-per-second volume. Meris exploits HTTP pipelining and SOCKS proxying on "
            "high-bandwidth devices rather than assembling large numbers of low-capacity hosts."
        ),
        "infectionMethod": (
            "Exploitation of an authentication-bypass flaw in unpatched router management interfaces."
        ),
        "propagation": (
            "Operator-managed fleet; infected devices are proxied rather than re-scanned."
        ),
        "targetDevices": ["Gateway Router", "Industrial PLC"],
        "behaviour": [
            "Opens a SOCKS4 proxy on the compromised appliance",
            "Uses HTTP pipelining to multiply request volume per connection",
            "Rotates source devices per attack wave to defeat blocklists",
            "Preserves the device management interface to avoid operator suspicion",
            "Tunnels control traffic through the proxy layer itself",
        ],
        "mitigation": [
            "Patch router management interfaces and disable WAN-side administration",
            "Audit for unexpected SOCKS listeners on network appliances",
            "Rate-limit pipelined HTTP requests at the edge",
            "Rotate appliance credentials after any suspected exposure",
        ],
        "cveRefs": ["CVE-2018-14847"],
        "iocs": [
            {"type": "Port", "value": "5678", "note": "SOCKS4 proxy listener"},
            {"type": "IP", "value": "193.201.224.9", "note": "Proxy coordinator"},
            {"type": "Domain", "value": "meris-relay.icu", "note": "Control endpoint"},
        ],
    },
    {
        "id": "MAL-10",
        "name": "Reaper",
        "aliases": ["IoTroop"],
        "firstSeen": "2017-10",
        "category": "Exploit Botnet",
        "severity": "High",
        "prevalence": 3,
        "description": (
            "An evolution of the Mirai model that replaces credential guessing with an embedded "
            "exploit toolkit. Reaper carries a Lua execution environment, letting operators push "
            "new attack modules without redeploying the implant."
        ),
        "infectionMethod": (
            "Chained exploitation of nine or more known vulnerabilities across camera, router and "
            "NVR firmware."
        ),
        "propagation": (
            "Self-propagating; scanning is throttled deliberately to stay below detection thresholds."
        ),
        "targetDevices": ["Smart Camera", "Gateway Router", "Weather Station"],
        "behaviour": [
            "Embeds a Lua interpreter for hot-loadable attack modules",
            "Throttles scan rate to avoid volumetric detection",
            "Maintains a queue of vulnerable hosts pending exploitation",
            "Updates its exploit set from the controller on demand",
            "Reports detailed device fingerprints back to the operator",
        ],
        "mitigation": [
            "Prioritise firmware patching — credential hygiene alone is insufficient",
            "Deploy IPS signatures for the bundled exploit set",
            "Restrict device-to-device traffic within the IoT VLAN",
            "Watch for low-and-slow scan patterns, not just bursts",
        ],
        "cveRefs": ["CVE-2017-17215", "CVE-2014-8361", "CVE-2017-8225"],
        "iocs": [
            {"type": "IP", "value": "176.32.44.201", "note": "Module distribution host"},
            {"type": "Path", "value": "/tmp/.reaper.lua", "note": "Module cache"},
            {
                "type": "Hash",
                "value": "9a3f5c1e7b2d80461f3a9c5e2b7d0184",
                "note": "Loader, MIPSEL build",
            },
        ],
    },
]


def generate_malware(rng: Rng, devices: list[dict[str, Any]]) -> list[dict[str, Any]]:
    infected = [
        d for d in devices if d["status"] in ("Compromised", "Isolated", "Recovering")
    ]

    assignments: dict[str, list[str]] = {seed["id"]: [] for seed in FAMILY_SEEDS}

    weighted: list[str] = []
    for seed in FAMILY_SEEDS:
        weighted.extend([seed["id"]] * seed["prevalence"])

    by_id = {seed["id"]: seed for seed in FAMILY_SEEDS}

    for device in infected:
        family_id = rng.pick(weighted)
        assignments[family_id].append(device["id"])
        device["infectedBy"] = by_id[family_id]["name"]

    families: list[dict[str, Any]] = []
    for seed in FAMILY_SEEDS:
        family = {k: v for k, v in seed.items()}
        family["aliases"] = list(seed["aliases"])
        family["targetDevices"] = list(seed["targetDevices"])
        family["behaviour"] = list(seed["behaviour"])
        family["mitigation"] = list(seed["mitigation"])
        family["cveRefs"] = list(seed["cveRefs"])
        family["iocs"] = [dict(i) for i in seed["iocs"]]
        family["infectedDeviceIds"] = assignments[seed["id"]]
        families.append(family)

    return families


# ==========================================================================
# Network events
# ==========================================================================


def _detail_telemetry(d: dict[str, Any], r: Rng) -> str:
    return f"Scheduled telemetry batch published to broker from {d['name']}"


def _detail_auth(d: dict[str, Any], r: Rng) -> str:
    kind = r.pick(["certificate", "token", "PSK"])
    return f"Successful {kind} authentication for {d['name']}"


def _detail_dns(d: dict[str, Any], r: Rng) -> str:
    host = r.pick(["ntp.pool.org", "api.vendor-cloud.net", "ota.updates.io"])
    return f"Resolved {host}"


def _detail_boot(d: dict[str, Any], r: Rng) -> str:
    return f"{d['vendor']} {d['category']} completed boot sequence on {d['firmware']}"


def _detail_firmware(d: dict[str, Any], r: Rng) -> str:
    return f"Signed OTA image verified and staged for {d['name']}"


def _detail_scan(d: dict[str, Any], r: Rng) -> str:
    return f"Sequential SYN sweep across {r.int(180, 4200)} ports originating from {d['ip']}"


def _detail_login(d: dict[str, Any], r: Rng) -> str:
    return (
        f"{r.int(24, 640)} failed Telnet attempts against {d['name']} "
        "using default credential list"
    )


def _detail_download(d: dict[str, Any], r: Rng) -> str:
    path = r.pick(["/tmp", "/var/run", "/dev/shm"])
    return f"Unsigned ELF binary retrieved to {path} on {d['name']}"


def _detail_c2(d: dict[str, Any], r: Rng) -> str:
    return (
        f"Persistent beacon from {d['name']} every {r.int(20, 180)}s "
        "to known C2 infrastructure"
    )


def _detail_exfil(d: dict[str, Any], r: Rng) -> str:
    return (
        f"{r.int(2, 94)} MB transferred from {d['name']} "
        "to an unrecognised external endpoint"
    )


EventDetail = Callable[[dict[str, Any], Rng], str]
EventPort = Callable[[Rng], int]

EVENT_PROFILES: list[dict[str, Any]] = [
    {
        "kind": "Telemetry Sync",
        "verdict": "Benign",
        "severity": "Low",
        "benign": 34,
        "hostile": 4,
        "detail": _detail_telemetry,
        "port": lambda r: r.pick([1883, 8883, 443]),
    },
    {
        "kind": "Authentication",
        "verdict": "Benign",
        "severity": "Low",
        "benign": 22,
        "hostile": 5,
        "detail": _detail_auth,
        "port": lambda r: r.pick([443, 8883]),
    },
    {
        "kind": "DNS Query",
        "verdict": "Benign",
        "severity": "Low",
        "benign": 18,
        "hostile": 6,
        "detail": _detail_dns,
        "port": lambda r: 53,
    },
    {
        "kind": "Device Boot",
        "verdict": "Benign",
        "severity": "Low",
        "benign": 8,
        "hostile": 3,
        "detail": _detail_boot,
        "port": lambda r: 0,
    },
    {
        "kind": "Firmware Update",
        "verdict": "Benign",
        "severity": "Low",
        "benign": 5,
        "hostile": 1,
        "detail": _detail_firmware,
        "port": lambda r: 443,
    },
    {
        "kind": "Port Scan",
        "verdict": "Suspicious",
        "severity": "Medium",
        "benign": 4,
        "hostile": 22,
        "detail": _detail_scan,
        "port": lambda r: r.pick([23, 2323, 22, 80]),
    },
    {
        "kind": "Suspicious Login",
        "verdict": "Suspicious",
        "severity": "High",
        "benign": 3,
        "hostile": 18,
        "detail": _detail_login,
        "port": lambda r: r.pick([23, 2323]),
    },
    {
        "kind": "Malware Download",
        "verdict": "Malicious",
        "severity": "Critical",
        "benign": 0,
        "hostile": 14,
        "detail": _detail_download,
        "port": lambda r: r.pick([80, 8080, 69]),
    },
    {
        "kind": "Command & Control",
        "verdict": "Malicious",
        "severity": "Critical",
        "benign": 0,
        "hostile": 17,
        "detail": _detail_c2,
        "port": lambda r: r.pick([6667, 443, 48101]),
    },
    {
        "kind": "Data Exfiltration",
        "verdict": "Malicious",
        "severity": "Critical",
        "benign": 0,
        "hostile": 10,
        "detail": _detail_exfil,
        "port": lambda r: r.pick([443, 21, 8443]),
    },
]


def generate_events(rng: Rng, devices: list[dict[str, Any]]) -> list[dict[str, Any]]:
    benign_pool: list[dict[str, Any]] = []
    hostile_pool: list[dict[str, Any]] = []
    for profile in EVENT_PROFILES:
        benign_pool.extend([profile] * profile["benign"])
        hostile_pool.extend([profile] * profile["hostile"])

    events: list[dict[str, Any]] = []

    for i in range(EVENT_COUNT):
        device = rng.pick(devices)

        # Short-circuit order matters: the chance() draw only happens for
        # "At Risk" devices, exactly as in the TypeScript expression.
        if device["status"] in ("Compromised", "Isolated"):
            hostile = True
        elif device["status"] == "At Risk":
            hostile = rng.chance(0.45)
        else:
            hostile = False

        profile = rng.pick(hostile_pool if hostile else benign_pool)

        if profile["verdict"] != "Benign":
            external = rng.pick(EXTERNAL_IPS)
        else:
            external = f"10.42.0.{rng.int(2, 20)}"

        age_ms = rng.int(30, 86_100) * 1000

        dest_port = profile["port"](rng)
        if profile["kind"] == "Data Exfiltration":
            byte_count = rng.int(2_000_000, 94_000_000)
        else:
            byte_count = rng.int(180, 48_000)
        detail = profile["detail"](device, rng)

        malicious = profile["verdict"] == "Malicious"

        events.append(
            {
                "id": f"EVT-{pad(i + 1, 4)}",
                "timestamp": iso_ago(age_ms),
                "deviceId": device["id"],
                "deviceName": device["name"],
                "kind": profile["kind"],
                "sourceIp": external if malicious else device["ip"],
                "destIp": device["ip"] if malicious else external,
                "destPort": dest_port,
                "protocol": device["protocol"],
                "bytes": byte_count,
                "verdict": profile["verdict"],
                "severity": profile["severity"],
                "detail": detail,
            }
        )

    events.sort(key=lambda e: e["timestamp"], reverse=True)
    return events


# ==========================================================================
# Alerts
# ==========================================================================

THREAT_TEMPLATES: list[dict[str, str]] = [
    {
        "threat": "Telnet Credential Brute Force",
        "severity": "High",
        "tactic": "Credential Access",
        "technique": "T1110.001 — Password Guessing",
        "action": "Disable Telnet on the device and rotate the administrative credential.",
        "description": (
            "A sustained sequence of failed Telnet authentications matched the Mirai "
            "default-credential table. The source completed the sequence with a successful login."
        ),
    },
    {
        "threat": "Command & Control Beacon",
        "severity": "Critical",
        "tactic": "Command and Control",
        "technique": "T1071.001 — Application Layer Protocol",
        "action": "Isolate the device immediately and blackhole the destination at the edge.",
        "description": (
            "The device is maintaining a regular outbound beacon to infrastructure matching a "
            "known IoT botnet controller. Interval jitter is consistent with an automated implant."
        ),
    },
    {
        "threat": "Unsigned Firmware Payload Retrieved",
        "severity": "Critical",
        "tactic": "Execution",
        "technique": "T1059.004 — Unix Shell",
        "action": "Quarantine the device and reflash from a verified vendor image.",
        "description": (
            "An ELF binary without a valid vendor signature was written to a world-writable path "
            "and marked executable within the same session."
        ),
    },
    {
        "threat": "Lateral Port Sweep",
        "severity": "Medium",
        "tactic": "Discovery",
        "technique": "T1046 — Network Service Discovery",
        "action": "Apply segment ACLs to block device-to-device scanning within the VLAN.",
        "description": (
            "A single host enumerated service ports across the local subnet in a sequential "
            "pattern inconsistent with its normal traffic profile."
        ),
    },
    {
        "threat": "Outbound Data Exfiltration",
        "severity": "Critical",
        "tactic": "Exfiltration",
        "technique": "T1041 — Exfiltration Over C2 Channel",
        "action": "Sever the session, capture the flow for analysis, and isolate the host.",
        "description": (
            "Outbound volume from this device exceeded its 30-day baseline by more than two "
            "orders of magnitude, directed at an endpoint with no prior history."
        ),
    },
    {
        "threat": "Firmware Downgrade Attempt",
        "severity": "High",
        "tactic": "Defense Evasion",
        "technique": "T1562.001 — Impair Defenses",
        "action": "Reject the image, enable rollback protection, and audit the update channel.",
        "description": (
            "An OTA request attempted to install a firmware build older than the currently "
            "installed version, a common route to reintroduce a patched vulnerability."
        ),
    },
    {
        "threat": "Anomalous Authentication Pattern",
        "severity": "Medium",
        "tactic": "Initial Access",
        "technique": "T1078 — Valid Accounts",
        "action": "Force re-enrolment of the device certificate and review the access log.",
        "description": (
            "Authentication succeeded from a source address and at an hour that fall outside "
            "this device class established behavioural envelope."
        ),
    },
    {
        "threat": "Watchdog Tamper Detected",
        "severity": "High",
        "tactic": "Persistence",
        "technique": "T1543 — Create or Modify System Process",
        "action": "Treat as active compromise; power-cycle and reflash the device.",
        "description": (
            "The hardware watchdog daemon was suspended, a technique used to prevent an infected "
            "device from rebooting itself out of a memory-resident implant."
        ),
    },
    {
        "threat": "Rogue DHT Peer Activity",
        "severity": "High",
        "tactic": "Command and Control",
        "technique": "T1090 — Proxy",
        "action": "Block UDP DHT bootstrap egress and quarantine the participating host.",
        "description": (
            "The device announced itself on a public distributed hash table, behaviour associated "
            "with peer-to-peer IoT botnets that lack a central controller."
        ),
    },
    {
        "threat": "Destructive Flash Write Attempt",
        "severity": "Critical",
        "tactic": "Impact",
        "technique": "T1485 — Data Destruction",
        "action": "Cut network access at the switch port and preserve the device for forensics.",
        "description": (
            "A shell session issued raw block-device writes against the firmware partition, "
            "matching the permanent-denial-of-service pattern used by BrickerBot."
        ),
    },
]


def generate_alerts(rng: Rng, devices: list[dict[str, Any]]) -> list[dict[str, Any]]:
    risky = [d for d in devices if d["status"] not in ("Healthy", "Offline")]
    healthy = [d for d in devices if d["status"] == "Healthy"]

    alerts: list[dict[str, Any]] = []

    for i in range(ALERT_COUNT):
        use_risky = rng.chance(0.78)
        pool = risky if (use_risky and len(risky) > 0) else healthy
        device = rng.pick(pool)
        template = rng.pick(THREAT_TEMPLATES)

        status_value = device["status"]
        if status_value == "Compromised":
            status = rng.pick(["Open", "Investigating", "Open"])
        elif status_value == "Isolated":
            status = "Contained"
        elif status_value == "Recovering":
            status = rng.pick(["Contained", "Resolved"])
        else:
            status = rng.pick(["Resolved", "Resolved", "Investigating"])

        timestamp = iso_ago(rng.int(60, 259_000) * 1000)
        confidence = rng.int(62, 99)
        source_ip = rng.pick(EXTERNAL_IPS) if rng.chance(0.6) else device["ip"]

        alerts.append(
            {
                "id": f"ALT-{pad(i + 1, 4)}",
                "timestamp": timestamp,
                "deviceId": device["id"],
                "deviceName": device["name"],
                "threat": template["threat"],
                "malwareFamily": device.get("infectedBy"),
                "severity": template["severity"],
                "status": status,
                "action": template["action"],
                "description": template["description"],
                "mitreTactic": template["tactic"],
                "mitreTechnique": template["technique"],
                "confidence": confidence,
                "sourceIp": source_ip,
            }
        )

    alerts.sort(key=lambda a: a["timestamp"], reverse=True)
    return alerts


# ==========================================================================
# Formal verification
# ==========================================================================

VERIFICATION_SEEDS: list[dict[str, Any]] = [
    {
        "id": "VP-01",
        "name": "Authentication Integrity",
        "formula": "AG (MalwareExecution → EF Authenticated)",
        "logic": "CTL",
        "status": "Verified",
        "category": "Security",
        "description": (
            "No token may reach the Malware Execution place without first passing through the "
            "Authenticate transition — the model admits no path that bypasses identity establishment."
        ),
        "reason": (
            "Exhaustive exploration of the reachability graph found no firing sequence in which a "
            "token enters Malware Execution with an unauthenticated colour. The Authenticate "
            "transition is a cut vertex on every such path."
        ),
        "recommendation": (
            "Hold this invariant when extending the model. Any new transition writing into Malware "
            "Execution must consume from Authentication, or the property will regress."
        ),
        "counterexample": None,
    },
    {
        "id": "VP-02",
        "name": "Safe State Reachability",
        "formula": "AG (EF (Idle ∨ Recovery))",
        "logic": "CTL",
        "status": "Verified",
        "category": "Reachability",
        "description": (
            "From every reachable state the system retains a path back to a safe state — either "
            "Idle or Recovery. No compromise is terminal within the model."
        ),
        "reason": (
            "All 18,432 reachable markings were checked; each retains at least one firing sequence "
            "terminating in a safe marking. The longest such path is 14 transitions from deep in "
            "the Malware Execution subnet."
        ),
        "recommendation": (
            "Recovery capacity is what makes this hold. If the Recover Device transition is ever "
            "gated on an external dependency, re-verify — the property is sensitive to that edge."
        ),
        "counterexample": None,
    },
    {
        "id": "VP-03",
        "name": "Deadlock Freedom",
        "formula": "AG (EX true)",
        "logic": "CTL",
        "status": "Verified",
        "category": "Liveness",
        "description": (
            "The net contains no dead marking: from every reachable state at least one transition "
            "remains enabled, so the model can never wedge."
        ),
        "reason": (
            "No terminal markings were found in the full state space. Every place with outgoing "
            "arcs retains an enabled successor under all reachable colour bindings."
        ),
        "recommendation": (
            "Preserve the token-recycling arc from Recovery back to Idle. Removing it introduces "
            "terminal markings and this property fails immediately."
        ),
        "counterexample": None,
    },
    {
        "id": "VP-04",
        "name": "Isolation Successful",
        "formula": "AG (Isolated → AX ¬Transmitting)",
        "logic": "CTL",
        "status": "Verified",
        "category": "Safety",
        "description": (
            "Once a device token enters the Isolation place, no subsequent state permits it to "
            "emit network traffic until Recovery completes."
        ),
        "reason": (
            "The Isolate Device transition consumes the device colour and re-emits it under an "
            "isolated binding for which no transmission transition has a matching guard. The "
            "restriction holds across all 2,164 isolation-reachable markings."
        ),
        "recommendation": (
            "The guarantee rests on guard correctness. Add a regression check on the isolation "
            "guard whenever the colour set is extended."
        ),
        "counterexample": None,
    },
    {
        "id": "VP-05",
        "name": "Malware Containment",
        "formula": "AG (MalwareExecution → AF Isolated)",
        "logic": "CTL",
        "status": "Failed",
        "category": "Safety",
        "description": (
            "Every token entering Malware Execution should inevitably reach Isolation. This "
            "property does not hold."
        ),
        "reason": (
            "A counterexample exists: when Detect Malware and Analyse Behaviour are concurrently "
            "enabled on the same device colour, the scheduler may fire Analyse Behaviour first, "
            "returning the token to Suspicious Behaviour. The resulting cycle can repeat "
            "indefinitely, so isolation is possible but not inevitable. In 3.1% of sampled runs "
            "the token remained in the loop past the detection deadline."
        ),
        "recommendation": (
            "Add a priority guard so Detect Malware pre-empts Analyse Behaviour once the suspicion "
            "counter crosses its threshold, or introduce a bounded retry colour that forces "
            "isolation after k analysis cycles. Either change makes the eventuality unconditional."
        ),
        "counterexample": [
            "PacketReceived → Authenticate",
            "Authentication → AnalyseBehaviour",
            "SuspiciousBehaviour → DetectMalware",
            "MalwareExecution → AnalyseBehaviour  ⟲ (cycle re-entered)",
            "SuspiciousBehaviour → AnalyseBehaviour  ⟲ (no progress toward Isolation)",
        ],
    },
    {
        "id": "VP-06",
        "name": "Data Leakage Prevention",
        "formula": "G ¬(Exfiltrating ∧ ¬Detected)",
        "logic": "LTL",
        "status": "Failed",
        "category": "Security",
        "description": (
            "No execution should contain a state in which data leaves the device before detection "
            "has fired. This property does not hold."
        ),
        "reason": (
            "The Detect Malware transition requires two consecutive suspicious observations before "
            "firing, which leaves a one-observation window during which the exfiltration arc is "
            "already enabled. The model checker produced a trace in which 1 of 12 exfiltration "
            "events precedes detection — a mean exposure of roughly 4.2 seconds at the sampled "
            "observation rate."
        ),
        "recommendation": (
            "Introduce an egress-volume guard that fires on the first observation when transferred "
            "bytes exceed the device baseline, rather than waiting for a second behavioural sample. "
            "Alternatively, gate the exfiltration arc on a detection token so the two cannot be "
            "concurrently enabled."
        ),
        "counterexample": [
            "MalwareExecution → EstablishC2",
            "C2Established → BeginTransfer   (exfiltration arc enabled)",
            "Transferring → ObserveBehaviour (first suspicious observation)",
            "Transferring → ObserveBehaviour (second observation — detection fires, too late)",
            "DetectMalware → Isolate         (bytes already left the device)",
        ],
    },
]


def generate_verification(rng: Rng) -> dict[str, Any]:
    properties: list[dict[str, Any]] = []
    for seed in VERIFICATION_SEEDS:
        prop = {k: v for k, v in seed.items()}
        prop["counterexample"] = (
            list(seed["counterexample"]) if seed["counterexample"] else None
        )
        prop["statesExplored"] = rng.int(4_200, 18_600)
        prop["transitionsFired"] = rng.int(9_800, 54_000)
        prop["durationMs"] = rng.int(180, 3_400)
        properties.append(prop)

    passed = sum(1 for p in properties if p["status"] == "Verified")
    failed = len(properties) - passed
    started_at = iso_ago(rng.int(400, 5_000) * 1000)

    return {
        "id": "VRUN-001",
        "model": "CPN-IoT-Defence-v3.2",
        "startedAt": started_at,
        "properties": properties,
        "passed": passed,
        "failed": failed,
        "successRate": js_round((passed / len(properties)) * 1000) / 10,
        "stateSpaceSize": 18_432,
        "deadlockFree": True,
    }


# ==========================================================================
# Resilience
# ==========================================================================


def generate_resilience(rng: Rng, devices: list[dict[str, Any]]) -> dict[str, Any]:
    isolated = sum(1 for d in devices if d["status"] == "Isolated")
    recovering = sum(1 for d in devices if d["status"] == "Recovering")
    compromised = sum(1 for d in devices if d["status"] == "Compromised")

    workflow = [
        {
            "id": "RS-1",
            "label": "Threat Confirmed",
            "description": (
                "Detection engine correlated three independent indicators and raised confidence "
                "above the automatic-response threshold."
            ),
            "status": "Complete",
            "at": iso_ago(1_020_000),
            "durationSec": 4,
            "automated": True,
        },
        {
            "id": "RS-2",
            "label": "Automatic Isolation",
            "description": (
                "Affected devices were moved to the quarantine VLAN and their switch ports placed "
                "in a restricted policy group."
            ),
            "status": "Complete",
            "at": iso_ago(1_008_000),
            "durationSec": 12,
            "automated": True,
        },
        {
            "id": "RS-3",
            "label": "Formal Re-verification",
            "description": (
                "The Coloured Petri Net model was re-checked against the post-isolation marking to "
                "confirm the containment invariant."
            ),
            "status": "Complete",
            "at": iso_ago(960_000),
            "durationSec": 48,
            "automated": True,
        },
        {
            "id": "RS-4",
            "label": "Credential Rotation",
            "description": (
                "Device certificates and administrative credentials were reissued for every "
                "quarantined asset."
            ),
            "status": "Complete",
            "at": iso_ago(870_000),
            "durationSec": 90,
            "automated": True,
        },
        {
            "id": "RS-5",
            "label": "Firmware Reflash",
            "description": (
                "Verified vendor images are being written to quarantined devices; memory-resident "
                "stages do not survive the reflash."
            ),
            "status": "Active",
            "at": iso_ago(420_000),
            "durationSec": 0,
            "automated": True,
        },
        {
            "id": "RS-6",
            "label": "Post-Recovery Validation",
            "description": (
                "Behavioural baseline is re-established and the device is re-admitted only after a "
                "clean observation window."
            ),
            "status": "Pending",
            "at": None,
            "durationSec": 0,
            "automated": True,
        },
        {
            "id": "RS-7",
            "label": "Segment Policy Update",
            "description": (
                "Blocked the C2 destinations and DHT bootstrap egress identified during the "
                "incident across all IoT VLANs."
            ),
            "status": "Pending",
            "at": None,
            "durationSec": 0,
            "automated": False,
        },
    ]

    shape = [96, 91, 74, 58, 47, 52, 63, 74, 82, 88, 91, 93]
    timeline = []
    for i, stability in enumerate(shape):
        t = iso_ago((len(shape) - 1 - i) * 900_000)
        timeline.append(
            {
                "t": t,
                "stability": int(clamp(stability + rng.int(-2, 2), 0, 100)),
                "risk": int(clamp(100 - stability + rng.int(-3, 3), 0, 100)),
            }
        )

    return {
        "containment": 82,
        "recovery": 64,
        "riskReduction": 71,
        "stability": 88,
        "devicesIsolated": isolated + compromised,
        "devicesRecovered": recovering,
        "devicesPendingRecovery": compromised,
        "mttdSec": 42,
        "mttcSec": 118,
        "mttrSec": 1_640,
        "workflow": workflow,
        "timeline": timeline,
    }


# ==========================================================================
# Summary
# ==========================================================================


def generate_summary(
    rng: Rng,
    devices: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    verification: dict[str, Any],
) -> dict[str, Any]:
    def count(status: str) -> int:
        return sum(1 for d in devices if d["status"] == status)

    healthy = count("Healthy")
    compromised = count("Compromised")
    at_risk = count("At Risk")
    isolated = count("Isolated")

    active_threats = sum(
        1 for a in alerts if a["status"] in ("Open", "Investigating")
    )
    avg_health = sum(d["health"] for d in devices) / max(len(devices), 1)

    threat_trend = []
    for i in range(14):
        days_ago = 13 - i
        detected = rng.int(8, 46)
        blocked = js_round(detected * rng.float(0.72, 0.94, 2))
        verified = js_round(detected * rng.float(0.6, 0.88, 2))
        threat_trend.append(
            {
                "date": day_label(days_ago),
                "detected": detected,
                "blocked": blocked,
                "verified": verified,
            }
        )

    accuracy_trend = []
    for i in range(14):
        accuracy_trend.append(
            {
                "date": day_label(13 - i),
                "accuracy": rng.float(91.2, 98.4, 1),
                "precision": rng.float(88.6, 97.1, 1),
                "recall": rng.float(87.4, 96.8, 1),
            }
        )

    verification_trend = [
        {"date": day_label(13 - i), "rate": rng.float(58, 92, 1)} for i in range(14)
    ]

    attack_distribution = [
        {"name": "DDoS Botnet", "value": 38},
        {"name": "Credential Attack", "value": 24},
        {"name": "C2 Beaconing", "value": 17},
        {"name": "Exfiltration", "value": 11},
        {"name": "Destructive", "value": 6},
        {"name": "Reconnaissance", "value": 4},
    ]

    device_health = [
        {"name": "Healthy", "value": healthy},
        {"name": "At Risk", "value": at_risk},
        {"name": "Compromised", "value": compromised},
        {"name": "Isolated", "value": isolated},
        {"name": "Recovering", "value": count("Recovering")},
        {"name": "Offline", "value": count("Offline")},
    ]

    security_score = js_round(
        clamp(
            avg_health * 0.5
            + verification["successRate"] * 0.25
            + (100 - (compromised / max(len(devices), 1)) * 400) * 0.25,
            0,
            100,
        )
    )

    return {
        "connectedDevices": sum(1 for d in devices if d["status"] != "Offline"),
        "healthyDevices": healthy,
        "compromisedDevices": compromised,
        "atRiskDevices": at_risk,
        "isolatedDevices": isolated,
        "activeThreats": active_threats,
        "verificationRate": verification["successRate"],
        "verificationPassed": verification["passed"],
        "verificationFailed": verification["failed"],
        "networkHealth": js_round(avg_health),
        "securityScore": security_score,
        "detectionAccuracy": 96.4,
        "meanResponseSec": 118,
        "deltas": {"devices": 2, "threats": -14, "health": 3, "verification": -8},
        "threatTrend": threat_trend,
        "deviceHealth": device_health,
        "attackDistribution": attack_distribution,
        "accuracyTrend": accuracy_trend,
        "verificationTrend": verification_trend,
    }


# ==========================================================================
# Analytics
# ==========================================================================


def generate_analytics(
    rng: Rng,
    devices: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    malware: list[dict[str, Any]],
) -> dict[str, Any]:
    def count_by(items: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
        """Insertion-ordered tally, then a stable descending sort by count.

        Python's ``sort`` and JavaScript's ``Array.sort`` are both stable, and
        dict iteration preserves insertion order as JS Map does, so the two
        implementations agree on ties.
        """
        tally: dict[str, int] = {}
        for item in items:
            value = item.get(key)
            if value is None:
                continue
            tally[value] = tally.get(value, 0) + 1
        rows = [{"name": name, "value": value} for name, value in tally.items()]
        rows.sort(key=lambda r: r["value"], reverse=True)
        return rows

    device_by_id = {d["id"]: d for d in devices}

    severity_by_category = []
    for arch in ARCHETYPES:
        in_cat = [
            a
            for a in alerts
            if device_by_id.get(a["deviceId"], {}).get("category") == arch["category"]
        ]
        severity_by_category.append(
            {
                "category": arch["category"],
                "Low": sum(1 for a in in_cat if a["severity"] == "Low"),
                "Medium": sum(1 for a in in_cat if a["severity"] == "Medium"),
                "High": sum(1 for a in in_cat if a["severity"] == "High"),
                "Critical": sum(1 for a in in_cat if a["severity"] == "Critical"),
            }
        )

    malware_categories = []
    for row in count_by(malware, "category"):
        total = sum(m["prevalence"] for m in malware if m["category"] == row["name"])
        malware_categories.append({"name": row["name"], "value": total})

    recovery_success = [
        {
            "date": day_label(13 - i),
            "recovered": rng.int(3, 17),
            "failed": rng.int(0, 4),
        }
        for i in range(14)
    ]

    network_health_series = [
        {"date": day_label(13 - i), "health": rng.int(72, 97), "load": rng.int(31, 88)}
        for i in range(14)
    ]

    return {
        "threatFrequency": count_by(alerts, "threat")[:8],
        "malwareCategories": malware_categories,
        "deviceRisk": count_by(devices, "risk"),
        "verificationOutcomes": [
            {"name": "Verified", "value": 4},
            {"name": "Failed", "value": 2},
        ],
        "recoverySuccess": recovery_success,
        "networkHealthSeries": network_health_series,
        "severityByCategory": severity_by_category,
    }


# ==========================================================================
# Scenarios
# ==========================================================================

SCENARIOS: list[dict[str, Any]] = [
    {
        "id": "normal",
        "label": "Normal Traffic",
        "description": (
            "Baseline operation. Telemetry, authentication and scheduled updates only — "
            "establishes the behavioural envelope the detectors compare against."
        ),
        "severity": "Low",
        "familyId": None,
        "expectedDetectionMs": 0,
    },
    {
        "id": "mirai",
        "label": "Mirai Attack",
        "description": (
            "Telnet brute force from an external scanner, followed by payload staging and "
            "enrolment into a DDoS swarm."
        ),
        "severity": "Critical",
        "familyId": "MAL-01",
        "expectedDetectionMs": 2_400,
    },
    {
        "id": "botnet",
        "label": "Botnet Infection",
        "description": (
            "Peer-to-peer botnet propagation across the segment, with DHT announcement and signed "
            "configuration exchange."
        ),
        "severity": "Critical",
        "familyId": "MAL-03",
        "expectedDetectionMs": 3_100,
    },
    {
        "id": "credential",
        "label": "Credential Attack",
        "description": (
            "Distributed credential stuffing against device management interfaces using leaked "
            "vendor default pairs."
        ),
        "severity": "High",
        "familyId": "MAL-08",
        "expectedDetectionMs": 1_800,
    },
    {
        "id": "ransomware",
        "label": "Ransomware Behaviour",
        "description": (
            "Destructive sequence: configuration wipe and firmware-partition overwrite consistent "
            "with permanent denial of service."
        ),
        "severity": "Critical",
        "familyId": "MAL-06",
        "expectedDetectionMs": 2_900,
    },
]


# ==========================================================================
# Assembly
# ==========================================================================


def build_dataset() -> dict[str, Any]:
    """Generate the complete dataset. Deterministic for a fixed hour."""
    rng = Rng(SEED)

    devices = generate_devices(rng)
    malware = generate_malware(rng, devices)
    events = generate_events(rng, devices)
    alerts = generate_alerts(rng, devices)
    verification = generate_verification(rng)
    resilience = generate_resilience(rng, devices)
    summary = generate_summary(rng, devices, alerts, verification)
    analytics = generate_analytics(rng, devices, alerts, malware)

    return {
        "devices": devices,
        "malware": malware,
        "events": events,
        "alerts": alerts,
        "verification": verification,
        "resilience": resilience,
        "summary": summary,
        "analytics": analytics,
        "scenarios": SCENARIOS,
    }
