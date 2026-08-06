/**
 * IoTShield Verify — bundled demonstration dataset.
 *
 * Everything here is synthetic. The generator is fully deterministic: a small
 * linear-congruential PRNG is seeded with a fixed constant and every draw is
 * taken in a fixed order, so the same inventory, the same telemetry, and the
 * same alerts appear on every reload — and, because `backend/app/data_gen.py`
 * implements the identical algorithm with the identical tables, the API and
 * the offline fallback agree field-for-field.
 *
 * Timestamps are the one intentional exception. They are anchored to the top
 * of the current hour rather than a frozen instant, so a demo never shows
 * stale "last seen" values while remaining stable within any given session.
 *
 * This dataset exists so the console is fully explorable with the backend
 * switched off — which is what makes it safe to present without a network.
 */

import type {
  Alert,
  AlertStatus,
  Analytics,
  Device,
  DeviceCategory,
  DeviceStatus,
  EventKind,
  IndicatorOfCompromise,
  MalwareFamily,
  NamedValue,
  NetworkEvent,
  RecoveryStep,
  ResilienceState,
  RiskLevel,
  Scenario,
  Severity,
  Summary,
  VerificationProperty,
  VerificationRun,
} from '@/types'

/* ==========================================================================
   Deterministic PRNG
   --------------------------------------------------------------------------
   Numerical Recipes LCG. Chosen over Math.random precisely because it is
   reproducible and trivially portable — the Python generator uses the same
   multiplier, increment, and modulus.
   ========================================================================== */

const SEED = 20260317

function createRng(seed: number) {
  let state = seed >>> 0

  /** Uniform float in [0, 1). */
  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }

  return {
    next,
    /** Inclusive integer in [min, max]. */
    int: (min: number, max: number): number =>
      min + Math.floor(next() * (max - min + 1)),
    /** Float in [min, max] rounded to `dp` decimals. */
    float: (min: number, max: number, dp = 1): number => {
      const v = min + next() * (max - min)
      const f = 10 ** dp
      return Math.round(v * f) / f
    },
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    chance: (p: number): boolean => next() < p,
    /** In-place Fisher-Yates; deterministic given the generator state. */
    shuffle: <T>(items: T[]): T[] => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[items[i], items[j]] = [items[j], items[i]]
      }
      return items
    },
  }
}

type Rng = ReturnType<typeof createRng>

/* ==========================================================================
   Time anchor
   ========================================================================== */

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/** Top of the current hour — the origin all synthetic timestamps hang from. */
const ANCHOR = Math.floor(Date.now() / HOUR_MS) * HOUR_MS

const isoAgo = (ms: number): string => new Date(ANCHOR - ms).toISOString()
const dayLabel = (daysAgo: number): string =>
  new Date(ANCHOR - daysAgo * DAY_MS).toISOString().slice(0, 10)

const pad = (n: number, width = 3): string => String(n).padStart(width, '0')
const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n))

/* ==========================================================================
   Static reference tables
   ========================================================================== */

interface Archetype {
  category: DeviceCategory
  count: number
  vendors: readonly string[]
  /** Hostname stem; index is appended. */
  stem: string
  protocol: NetworkEvent['protocol']
  ports: readonly number[]
  firmwarePrefix: string
}

/** 40 devices across ten archetypes — a plausible mid-size campus deployment. */
const ARCHETYPES: readonly Archetype[] = [
  {
    category: 'Smart Camera',
    count: 8,
    vendors: ['Hikvision', 'Dahua', 'Axis', 'Reolink'],
    stem: 'cam',
    protocol: 'TCP',
    ports: [80, 554, 8000],
    firmwarePrefix: 'HV',
  },
  {
    category: 'Motion Sensor',
    count: 6,
    vendors: ['Aqara', 'Bosch', 'Honeywell'],
    stem: 'pir',
    protocol: 'MQTT',
    ports: [1883],
    firmwarePrefix: 'AQ',
  },
  {
    category: 'Smart Bulb',
    count: 5,
    vendors: ['Philips Hue', 'TP-Link', 'LIFX'],
    stem: 'bulb',
    protocol: 'CoAP',
    ports: [5683],
    firmwarePrefix: 'PH',
  },
  {
    category: 'Smart Lock',
    count: 4,
    vendors: ['Yale', 'August', 'Schlage'],
    stem: 'lock',
    protocol: 'MQTT',
    ports: [1883, 8883],
    firmwarePrefix: 'YL',
  },
  {
    category: 'Smart Thermostat',
    count: 4,
    vendors: ['Nest', 'Ecobee', 'Tado'],
    stem: 'therm',
    protocol: 'HTTPS',
    ports: [443],
    firmwarePrefix: 'NS',
  },
  {
    category: 'Gateway Router',
    count: 3,
    vendors: ['MikroTik', 'Ubiquiti', 'Cisco'],
    stem: 'gw',
    protocol: 'TCP',
    ports: [22, 80, 443, 8291],
    firmwarePrefix: 'RT',
  },
  {
    category: 'Medical Monitor',
    count: 3,
    vendors: ['Philips', 'GE Healthcare', 'Dräger'],
    stem: 'med',
    protocol: 'HTTPS',
    ports: [443, 11073],
    firmwarePrefix: 'MD',
  },
  {
    category: 'Weather Station',
    count: 3,
    vendors: ['Davis', 'Netatmo', 'Ambient'],
    stem: 'wx',
    protocol: 'MQTT',
    ports: [1883],
    firmwarePrefix: 'WX',
  },
  {
    category: 'Industrial PLC',
    count: 2,
    vendors: ['Siemens', 'Allen-Bradley'],
    stem: 'plc',
    protocol: 'TCP',
    ports: [102, 502],
    firmwarePrefix: 'PL',
  },
  {
    category: 'Smart Speaker',
    count: 2,
    vendors: ['Sonos', 'Amazon'],
    stem: 'spk',
    protocol: 'HTTPS',
    ports: [443, 1400],
    firmwarePrefix: 'SP',
  },
] as const

const LOCATIONS: readonly string[] = [
  'Building A — Lobby',
  'Building A — Floor 2',
  'Building B — Server Room',
  'Building B — Clinic Wing',
  'Building C — Warehouse',
  'Perimeter — North Gate',
  'Perimeter — Car Park',
  'Plant Room — Level 0',
] as const

/** OUI prefixes keyed by vendor so a MAC is consistent with its maker. */
const VENDOR_OUI: Record<string, string> = {
  Hikvision: '44:19:B6',
  Dahua: '3C:EF:8C',
  Axis: '00:40:8C',
  Reolink: 'EC:71:DB',
  Aqara: '54:EF:44',
  Bosch: '00:1B:C5',
  Honeywell: '00:D0:2D',
  'Philips Hue': '00:17:88',
  'TP-Link': 'B0:4E:26',
  LIFX: 'D0:73:D5',
  Yale: '00:1E:C0',
  August: 'D8:E3:5E',
  Schlage: '00:26:6C',
  Nest: '18:B4:30',
  Ecobee: '44:61:32',
  Tado: '5C:CF:7F',
  MikroTik: '4C:5E:0C',
  Ubiquiti: '24:A4:3C',
  Cisco: '00:1A:A1',
  Philips: '00:04:F3',
  'GE Healthcare': '00:16:3E',
  Dräger: '00:0E:8F',
  Davis: '00:20:4A',
  Netatmo: '70:EE:50',
  Ambient: 'C8:2B:96',
  Siemens: '00:1B:1B',
  'Allen-Bradley': '00:00:BC',
  Sonos: '5C:AA:FD',
  Amazon: 'FC:65:DE',
}

/**
 * Fixed status plan for the 40-device fleet. Shuffled deterministically so the
 * compromised devices are scattered through the inventory rather than clumped
 * at the end, while the totals stay exactly as designed.
 */
const STATUS_PLAN: readonly DeviceStatus[] = [
  ...Array<DeviceStatus>(24).fill('Healthy'),
  ...Array<DeviceStatus>(6).fill('At Risk'),
  ...Array<DeviceStatus>(5).fill('Compromised'),
  ...Array<DeviceStatus>(2).fill('Isolated'),
  ...Array<DeviceStatus>(2).fill('Recovering'),
  ...Array<DeviceStatus>(1).fill('Offline'),
] as const

/* ==========================================================================
   Devices
   ========================================================================== */

/** Health band per status, so posture score and state never contradict. */
const HEALTH_BAND: Record<DeviceStatus, [number, number]> = {
  Healthy: [86, 99],
  'At Risk': [58, 78],
  Compromised: [12, 38],
  Isolated: [22, 44],
  Recovering: [52, 71],
  Offline: [0, 0],
}

function riskFor(status: DeviceStatus, health: number): RiskLevel {
  if (status === 'Compromised') return 'Critical'
  if (status === 'Isolated') return 'High'
  if (status === 'At Risk') return health < 66 ? 'High' : 'Medium'
  if (status === 'Recovering') return 'Medium'
  if (status === 'Offline') return 'Medium'
  return health >= 94 ? 'Low' : 'Medium'
}

function generateDevices(rng: Rng): Device[] {
  const statuses = rng.shuffle([...STATUS_PLAN])
  const devices: Device[] = []
  let index = 0

  for (const arch of ARCHETYPES) {
    for (let n = 1; n <= arch.count; n++) {
      const status = statuses[index]
      const vendor = rng.pick(arch.vendors)
      const location = rng.pick(LOCATIONS)
      const subnet = 10 + LOCATIONS.indexOf(location)
      const [lo, hi] = HEALTH_BAND[status]
      const health = status === 'Offline' ? 0 : rng.int(lo, hi)
      const oui = VENDOR_OUI[vendor] ?? '02:00:00'
      const mac = `${oui}:${rng
        .int(0, 255)
        .toString(16)
        .padStart(2, '0')}:${rng.int(0, 255).toString(16).padStart(2, '0')}:${rng
        .int(0, 255)
        .toString(16)
        .padStart(2, '0')}`.toUpperCase()

      const major = rng.int(1, 4)
      const minor = rng.int(0, 9)
      const patch = rng.int(0, 24)
      const outdated =
        status === 'Compromised' || status === 'At Risk'
          ? rng.chance(0.8)
          : rng.chance(0.18)

      // Compromised hosts show recent chatter; offline ones went quiet.
      const lastActivityMs =
        status === 'Offline'
          ? rng.int(6, 40) * HOUR_MS
          : status === 'Compromised'
            ? rng.int(20, 900) * 1000
            : rng.int(30, 5400) * 1000

      const extraPorts =
        status === 'Compromised'
          ? [rng.pick([23, 2323, 48101, 5555] as const)]
          : []

      devices.push({
        id: `DEV-${pad(index + 1)}`,
        name: `${arch.stem}-${pad(n, 2)}.${arch.category
          .split(' ')[0]
          .toLowerCase()}.iot`,
        category: arch.category,
        vendor,
        ip: `10.42.${subnet}.${rng.int(4, 250)}`,
        mac,
        firmware: `${arch.firmwarePrefix}-${major}.${minor}.${pad(patch, 2)}`,
        firmwareOutdated: outdated,
        status,
        risk: riskFor(status, health),
        lastActivity: isoAgo(lastActivityMs),
        location,
        health,
        protocol: arch.protocol,
        openPorts: [...arch.ports, ...extraPorts],
        uptimeHours: status === 'Offline' ? 0 : rng.int(6, 2200),
      })

      index++
    }
  }

  return devices
}

/* ==========================================================================
   Malware families
   ========================================================================== */

interface FamilySeed {
  id: string
  name: string
  aliases: string[]
  firstSeen: string
  category: string
  severity: Severity
  prevalence: number
  description: string
  infectionMethod: string
  propagation: string
  targetDevices: string[]
  behaviour: string[]
  mitigation: string[]
  cveRefs: string[]
  iocs: IndicatorOfCompromise[]
}

/**
 * Ten families whose real-world tradecraft is well documented. Descriptions
 * are drawn from public reporting; the infection counts, prevalence figures,
 * and IOC values below are synthetic and exist only to drive the demo.
 */
const FAMILY_SEEDS: readonly FamilySeed[] = [
  {
    id: 'MAL-01',
    name: 'Mirai',
    aliases: ['Katana', 'Okiru', 'Satori'],
    firstSeen: '2016-08',
    category: 'DDoS Botnet',
    severity: 'Critical',
    prevalence: 31,
    description:
      'The archetypal IoT botnet. Mirai enumerates the internet for devices exposing Telnet and SSH, authenticates with a hard-coded credential table, and enrols the host into a DDoS swarm. Its source release in 2016 spawned a long tail of derivatives that still dominate IoT telemetry.',
    infectionMethod:
      'Brute-force of Telnet (23/2323) and SSH using a built-in table of ~60 default vendor credentials, followed by staged download of an architecture-matched ELF payload.',
    propagation:
      'Self-propagating: each infected node runs its own SYN scanner against randomised /8 ranges, excluding reserved and government blocks.',
    targetDevices: [
      'Smart Camera',
      'Gateway Router',
      'Network Video Recorder',
      'Smart Speaker',
    ],
    behaviour: [
      'Kills competing binaries and disables the watchdog to prevent reboot',
      'Deletes its own executable and runs solely from memory',
      'Binds a local port to signal exclusive ownership of the host',
      'Maintains a persistent TCP session with the C2 for attack commands',
      'Executes UDP, SYN, ACK, GRE and HTTP flood primitives on demand',
    ],
    mitigation: [
      'Disable Telnet entirely; permit SSH only with key-based authentication',
      'Force a credential change at first boot and reject vendor defaults',
      'Segment IoT assets onto a VLAN with no outbound port 23/2323',
      'Rate-limit egress and alert on sustained outbound SYN volume',
      'Power-cycle plus firmware reflash — memory-resident stages do not survive',
    ],
    cveRefs: ['CVE-2017-17215', 'CVE-2014-8361'],
    iocs: [
      { type: 'IP', value: '185.244.25.171', note: 'Loader / report server' },
      { type: 'Domain', value: 'cnc.botnet-relay.su', note: 'Primary C2' },
      {
        type: 'Hash',
        value: 'a2f4c1e9b7d3068f5a1c2e4b9d7f3061',
        note: 'ELF payload, MIPS build',
      },
      { type: 'Port', value: '48101', note: 'Ownership-lock bind port' },
      { type: 'Path', value: '/tmp/.mirai', note: 'Staging path before unlink' },
    ],
  },
  {
    id: 'MAL-02',
    name: 'Gafgyt',
    aliases: ['Bashlite', 'Qbot', 'Lizkebab'],
    firstSeen: '2014-03',
    category: 'DDoS Botnet',
    severity: 'High',
    prevalence: 17,
    description:
      'A pre-Mirai botnet family that remains widely forked. Gafgyt favours shell-command injection over credential brute force and communicates with its controller over plain IRC, which makes it noisy but resilient.',
    infectionMethod:
      'Command injection against unauthenticated CGI and SOAP endpoints, plus opportunistic Telnet brute force using a smaller credential set than Mirai.',
    propagation:
      'Controller-driven: scanning targets are pushed from the C2 rather than chosen by the bot.',
    targetDevices: ['Gateway Router', 'Smart Camera', 'DVR', 'Weather Station'],
    behaviour: [
      'Joins an IRC channel and awaits plaintext operator commands',
      'Downloads architecture-specific payloads via wget or tftp',
      'Enumerates and terminates rival botnet processes',
      'Provides UDP, TCP and HTTP flood modules',
      'Rewrites init scripts for persistence across reboot',
    ],
    mitigation: [
      'Patch CGI and SOAP handlers exposed on the LAN interface',
      'Block outbound IRC ports (6667, 6697) at the segment boundary',
      'Deny wget/tftp egress from device VLANs',
      'Monitor for init-script modification on managed endpoints',
    ],
    cveRefs: ['CVE-2017-5638', 'CVE-2018-10561'],
    iocs: [
      { type: 'IP', value: '91.211.88.42', note: 'IRC controller' },
      { type: 'Domain', value: 'irc.gafgyt-node.top', note: 'Fallback C2' },
      {
        type: 'Hash',
        value: 'd41f9c7a3e2b8054c6f1a9d3b7e50218',
        note: 'ELF dropper, ARMv7',
      },
      { type: 'Port', value: '6667', note: 'IRC control channel' },
    ],
  },
  {
    id: 'MAL-03',
    name: 'Mozi',
    aliases: ['Mozi.m', 'Mozi.a'],
    firstSeen: '2019-09',
    category: 'P2P Botnet',
    severity: 'Critical',
    prevalence: 14,
    description:
      'Mozi abandons centralised control for a DHT-based peer-to-peer network, making takedown substantially harder. Nodes exchange signed configuration blobs, so seizing any single host yields no controller to sinkhole.',
    infectionMethod:
      'Exploitation of known router and DVR vulnerabilities combined with weak Telnet passwords; the payload registers itself as a DHT node on join.',
    propagation:
      'Peer-to-peer over a modified BitTorrent DHT; configuration is distributed and signed rather than fetched from a server.',
    targetDevices: ['Gateway Router', 'Smart Camera', 'Industrial PLC'],
    behaviour: [
      'Bootstraps into the public DHT and announces on a fixed info-hash',
      'Verifies configuration blobs against an embedded ECDSA public key',
      'Supports DDoS, command execution and payload update tasks',
      'Hijacks HTTP sessions to inject content on the local segment',
      'Persists via /etc/rc.local or an equivalent boot hook',
    ],
    mitigation: [
      'Block outbound UDP DHT bootstrap traffic from device VLANs',
      'Patch the router and DVR CVEs used for initial access',
      'Alert on unexpected UDP peer fan-out from a single IoT host',
      'Reflash affected firmware — in-place cleanup is unreliable',
    ],
    cveRefs: ['CVE-2018-10561', 'CVE-2017-17215', 'CVE-2014-8361'],
    iocs: [
      { type: 'Hash', value: 'b7e2419fd3a86c05e1b4f7d29a3c6180', note: 'Mozi.m payload' },
      { type: 'Port', value: '6881', note: 'DHT bootstrap' },
      { type: 'Path', value: '/etc/rc.local', note: 'Persistence hook' },
      { type: 'Mutex', value: 'mozi-lock-0x7f', note: 'Single-instance guard' },
    ],
  },
  {
    id: 'MAL-04',
    name: 'VPNFilter',
    aliases: ['Fancy Bear implant'],
    firstSeen: '2018-05',
    category: 'Modular Implant',
    severity: 'Critical',
    prevalence: 9,
    description:
      'A staged, state-associated implant targeting small-office routers and NAS devices. Stage 1 survives reboot and exists only to retrieve Stage 2; later stages add credential capture, SCADA protocol inspection, and a destructive firmware-wipe capability.',
    infectionMethod:
      'Exploitation of known router vulnerabilities and default credentials; Stage 1 locates its Stage 2 server through EXIF metadata in images fetched from a public photo host.',
    propagation:
      'Not self-propagating — operators select and infect targets deliberately.',
    targetDevices: ['Gateway Router', 'NAS', 'Industrial PLC'],
    behaviour: [
      'Stage 1 achieves reboot persistence via cron and awaits Stage 2',
      'Stage 2 provides file collection, command execution and device bricking',
      'Stage 3 plugins sniff credentials and parse Modbus SCADA traffic',
      'Downgrades HTTPS to HTTP to expose session content',
      'Overwrites the first megabyte of flash on a kill command',
    ],
    mitigation: [
      'Factory-reset and reflash affected routers, then rotate all credentials',
      'Disable remote administration on the WAN interface',
      'Terminate TLS at a trusted gateway to detect downgrade attempts',
      'Inspect Modbus/502 traffic crossing the OT boundary',
    ],
    cveRefs: ['CVE-2018-7445', 'CVE-2016-6277'],
    iocs: [
      { type: 'IP', value: '203.0.113.44', note: 'Stage 2 distribution host' },
      { type: 'Domain', value: 'photobucket-cdn.link', note: 'EXIF beacon host' },
      {
        type: 'Hash',
        value: 'c3a9017e5f2b4d86091c7e3a5b8d2f41',
        note: 'Stage 1 loader',
      },
      { type: 'Path', value: '/var/run/vpnfilterw', note: 'Stage 2 working dir' },
    ],
  },
  {
    id: 'MAL-05',
    name: 'Hajime',
    aliases: ['Hajime worm'],
    firstSeen: '2016-10',
    category: 'Vigilante Worm',
    severity: 'Medium',
    prevalence: 7,
    description:
      'A technically sophisticated worm with no observed offensive payload. Hajime closes the very ports Mirai abuses and displays a signed message claiming benign intent — but it retains a full remote-execution channel, so the host is compromised regardless of stated motive.',
    infectionMethod:
      'Telnet brute force with a compact credential list, plus exploitation of the TR-064 management interface.',
    propagation:
      'Peer-to-peer over a BitTorrent DHT overlay with signed module distribution.',
    targetDevices: ['Gateway Router', 'Smart Camera', 'Motion Sensor'],
    behaviour: [
      'Blocks ports 23, 7547, 5555 and 5358 after taking the host',
      'Displays a signed operator message on the console every ten minutes',
      'Holds an unused but fully functional remote-execution channel',
      'Runs entirely from memory with no on-disk persistence',
      'Updates modules over the P2P overlay with signature verification',
    ],
    mitigation: [
      'Treat as a full compromise despite the absence of a hostile payload',
      'Reboot to clear the memory-resident implant, then patch before reconnect',
      'Close TR-064 (7547) at the network edge',
      'Replace default Telnet credentials prior to returning the host to service',
    ],
    cveRefs: ['CVE-2016-10372'],
    iocs: [
      { type: 'Port', value: '7547', note: 'TR-064 entry vector' },
      { type: 'Mutex', value: '.hajime-run', note: 'Instance guard' },
      {
        type: 'Hash',
        value: 'f18d3b72c4e9506a1d8f2b3c7e405916',
        note: 'Stage 1, MIPS build',
      },
    ],
  },
  {
    id: 'MAL-06',
    name: 'BrickerBot',
    aliases: ['PDoS bot'],
    firstSeen: '2017-03',
    category: 'Destructive / PDoS',
    severity: 'Critical',
    prevalence: 5,
    description:
      'A permanent denial-of-service agent. BrickerBot makes no attempt at persistence or control; on gaining access it corrupts flash storage, wipes routing configuration, and renders the device unrecoverable without hardware reflashing.',
    infectionMethod:
      'Telnet brute force with default credentials, followed immediately by destructive shell commands.',
    propagation:
      'Non-persistent: executes and exits. Reinfection requires a fresh compromise.',
    targetDevices: ['Gateway Router', 'Smart Camera', 'Smart Bulb'],
    behaviour: [
      'Overwrites block devices with dd from /dev/urandom',
      'Removes the default route and flushes iptables rules',
      'Sets kernel parameters that disable further network use',
      'Truncates critical filesystem paths before rebooting',
      'Leaves no C2 channel and no persistence artefacts',
    ],
    mitigation: [
      'Prevent access at the network edge — post-execution recovery is impossible',
      'Maintain verified offline firmware images for every device model',
      'Deny Telnet inbound at every segment boundary without exception',
      'Keep spare provisioned hardware for critical-path assets',
    ],
    cveRefs: [],
    iocs: [
      { type: 'IP', value: '198.51.100.77', note: 'Observed source of PDoS attempts' },
      { type: 'Path', value: '/dev/mtdblock0', note: 'Primary overwrite target' },
      { type: 'User-Agent', value: 'busybox-wget/1.29', note: 'Staging fetch' },
    ],
  },
  {
    id: 'MAL-07',
    name: 'Torii',
    aliases: ['Torii botnet'],
    firstSeen: '2018-09',
    category: 'Stealth Implant',
    severity: 'High',
    prevalence: 6,
    description:
      'An unusually sophisticated IoT implant supporting a wide range of CPU architectures. Torii layers six independent persistence mechanisms, encrypts its exfiltration channel, and prioritises data collection over DDoS capacity.',
    infectionMethod:
      'Telnet brute force delivering an architecture-detecting shell dropper that selects the matching second-stage binary.',
    propagation:
      'Operator-directed rather than self-spreading.',
    targetDevices: ['Gateway Router', 'Smart Camera', 'Medical Monitor'],
    behaviour: [
      'Installs six parallel persistence mechanisms including systemd and rc scripts',
      'Fingerprints hostname, MAC, CPU and installed packages on first run',
      'Encrypts all C2 traffic with AES-128 over TCP/443',
      'Polls for arbitrary command and payload execution',
      'Deliberately avoids DDoS activity to stay below volumetric detection',
    ],
    mitigation: [
      'Audit every persistence surface — removing one mechanism is not enough',
      'Inspect TLS on egress from device VLANs to spot non-conforming sessions',
      'Reflash from a known-good image rather than attempting cleanup',
      'Baseline outbound connection patterns per device class',
    ],
    cveRefs: ['CVE-2018-14847'],
    iocs: [
      { type: 'Domain', value: 'top.haddns.net', note: 'Encrypted C2' },
      { type: 'Path', value: '/etc/systemd/system/torii.service', note: 'Persistence unit' },
      {
        type: 'Hash',
        value: '0e7c4a19b3d82f560a1e9c4b7d3f2085',
        note: 'Second-stage binary',
      },
      { type: 'Port', value: '443', note: 'AES-wrapped C2 over TLS port' },
    ],
  },
  {
    id: 'MAL-08',
    name: 'Dark Nexus',
    aliases: ['DarkNexus'],
    firstSeen: '2020-04',
    category: 'DDoS Botnet',
    severity: 'High',
    prevalence: 4,
    description:
      'A commercially operated botnet sold as a DDoS service. Dark Nexus borrows from Mirai and Qbot but adds a scoring system that ranks processes by likelihood of being a competing implant and terminates them selectively.',
    infectionMethod:
      'Telnet credential stuffing plus exploitation of a rotating set of router vulnerabilities.',
    propagation:
      'Self-propagating with a controller-supplied target list.',
    targetDevices: ['Gateway Router', 'Smart Camera', 'Smart Thermostat'],
    behaviour: [
      'Scores running processes and kills suspected rival implants',
      'Disguises flood traffic as legitimate browser requests',
      'Maintains reboot persistence by hooking the init sequence',
      'Blocks device restart by suspending the watchdog daemon',
      'Fetches payloads for twelve distinct CPU architectures',
    ],
    mitigation: [
      'Enforce credential rotation and lock out repeated failed logins',
      'Apply vendor patches for the exploited router models',
      'Alert on watchdog daemon suspension as a tamper signal',
      'Filter HTTP floods on request-signature rather than volume alone',
    ],
    cveRefs: ['CVE-2019-16920'],
    iocs: [
      { type: 'IP', value: '45.129.33.18', note: 'Command server' },
      { type: 'User-Agent', value: 'Mozilla/5.0 (compatible; dnx/1.2)', note: 'Flood signature' },
      {
        type: 'Hash',
        value: '5b1e8c3a7f2d4906b3e1a8c5d2f70943',
        note: 'ARM payload',
      },
    ],
  },
  {
    id: 'MAL-09',
    name: 'Meris',
    aliases: ['Mēris'],
    firstSeen: '2021-06',
    category: 'HTTP Flood Botnet',
    severity: 'Critical',
    prevalence: 4,
    description:
      'A botnet built from compromised networking appliances that set records for HTTP request-per-second volume. Meris exploits HTTP pipelining and SOCKS proxying on high-bandwidth devices rather than assembling large numbers of low-capacity hosts.',
    infectionMethod:
      'Exploitation of an authentication-bypass flaw in unpatched router management interfaces.',
    propagation:
      'Operator-managed fleet; infected devices are proxied rather than re-scanned.',
    targetDevices: ['Gateway Router', 'Industrial PLC'],
    behaviour: [
      'Opens a SOCKS4 proxy on the compromised appliance',
      'Uses HTTP pipelining to multiply request volume per connection',
      'Rotates source devices per attack wave to defeat blocklists',
      'Preserves the device management interface to avoid operator suspicion',
      'Tunnels control traffic through the proxy layer itself',
    ],
    mitigation: [
      'Patch router management interfaces and disable WAN-side administration',
      'Audit for unexpected SOCKS listeners on network appliances',
      'Rate-limit pipelined HTTP requests at the edge',
      'Rotate appliance credentials after any suspected exposure',
    ],
    cveRefs: ['CVE-2018-14847'],
    iocs: [
      { type: 'Port', value: '5678', note: 'SOCKS4 proxy listener' },
      { type: 'IP', value: '193.201.224.9', note: 'Proxy coordinator' },
      { type: 'Domain', value: 'meris-relay.icu', note: 'Control endpoint' },
    ],
  },
  {
    id: 'MAL-10',
    name: 'Reaper',
    aliases: ['IoTroop'],
    firstSeen: '2017-10',
    category: 'Exploit Botnet',
    severity: 'High',
    prevalence: 3,
    description:
      'An evolution of the Mirai model that replaces credential guessing with an embedded exploit toolkit. Reaper carries a Lua execution environment, letting operators push new attack modules without redeploying the implant.',
    infectionMethod:
      'Chained exploitation of nine or more known vulnerabilities across camera, router and NVR firmware.',
    propagation:
      'Self-propagating; scanning is throttled deliberately to stay below detection thresholds.',
    targetDevices: ['Smart Camera', 'Gateway Router', 'Weather Station'],
    behaviour: [
      'Embeds a Lua interpreter for hot-loadable attack modules',
      'Throttles scan rate to avoid volumetric detection',
      'Maintains a queue of vulnerable hosts pending exploitation',
      'Updates its exploit set from the controller on demand',
      'Reports detailed device fingerprints back to the operator',
    ],
    mitigation: [
      'Prioritise firmware patching — credential hygiene alone is insufficient',
      'Deploy IPS signatures for the bundled exploit set',
      'Restrict device-to-device traffic within the IoT VLAN',
      'Watch for low-and-slow scan patterns, not just bursts',
    ],
    cveRefs: ['CVE-2017-17215', 'CVE-2014-8361', 'CVE-2017-8225'],
    iocs: [
      { type: 'IP', value: '176.32.44.201', note: 'Module distribution host' },
      { type: 'Path', value: '/tmp/.reaper.lua', note: 'Module cache' },
      {
        type: 'Hash',
        value: '9a3f5c1e7b2d80461f3a9c5e2b7d0184',
        note: 'Loader, MIPSEL build',
      },
    ],
  },
] as const

function generateMalware(rng: Rng, devices: Device[]): MalwareFamily[] {
  // Attribute every non-healthy device to a family, weighted by prevalence.
  const infected = devices.filter(
    (d) =>
      d.status === 'Compromised' ||
      d.status === 'Isolated' ||
      d.status === 'Recovering',
  )

  const assignments: Record<string, string[]> = {}
  for (const seed of FAMILY_SEEDS) assignments[seed.id] = []

  // Weighted pick over the prevalence column.
  const weighted: string[] = []
  for (const seed of FAMILY_SEEDS) {
    for (let i = 0; i < seed.prevalence; i++) weighted.push(seed.id)
  }

  for (const device of infected) {
    const familyId = rng.pick(weighted)
    assignments[familyId].push(device.id)
    const family = FAMILY_SEEDS.find((f) => f.id === familyId)
    device.infectedBy = family?.name
  }

  return FAMILY_SEEDS.map((seed) => ({
    ...seed,
    aliases: [...seed.aliases],
    targetDevices: [...seed.targetDevices],
    behaviour: [...seed.behaviour],
    mitigation: [...seed.mitigation],
    cveRefs: [...seed.cveRefs],
    iocs: seed.iocs.map((i) => ({ ...i })),
    infectedDeviceIds: assignments[seed.id],
  }))
}

/* ==========================================================================
   Network events
   ========================================================================== */

interface EventProfile {
  kind: EventKind
  verdict: 'Benign' | 'Suspicious' | 'Malicious'
  severity: Severity
  /** Relative frequency for healthy hosts. */
  benignWeight: number
  /** Relative frequency for compromised hosts. */
  hostileWeight: number
  detail: (device: Device, rng: Rng) => string
  port: (rng: Rng) => number
}

const EVENT_PROFILES: readonly EventProfile[] = [
  {
    kind: 'Telemetry Sync',
    verdict: 'Benign',
    severity: 'Low',
    benignWeight: 34,
    hostileWeight: 4,
    detail: (d) => `Scheduled telemetry batch published to broker from ${d.name}`,
    port: (r) => r.pick([1883, 8883, 443] as const),
  },
  {
    kind: 'Authentication',
    verdict: 'Benign',
    severity: 'Low',
    benignWeight: 22,
    hostileWeight: 5,
    detail: (d, r) =>
      `Successful ${r.pick(['certificate', 'token', 'PSK'] as const)} authentication for ${d.name}`,
    port: (r) => r.pick([443, 8883] as const),
  },
  {
    kind: 'DNS Query',
    verdict: 'Benign',
    severity: 'Low',
    benignWeight: 18,
    hostileWeight: 6,
    detail: (_, r) =>
      `Resolved ${r.pick(['ntp.pool.org', 'api.vendor-cloud.net', 'ota.updates.io'] as const)}`,
    port: () => 53,
  },
  {
    kind: 'Device Boot',
    verdict: 'Benign',
    severity: 'Low',
    benignWeight: 8,
    hostileWeight: 3,
    detail: (d) => `${d.vendor} ${d.category} completed boot sequence on ${d.firmware}`,
    port: () => 0,
  },
  {
    kind: 'Firmware Update',
    verdict: 'Benign',
    severity: 'Low',
    benignWeight: 5,
    hostileWeight: 1,
    detail: (d) => `Signed OTA image verified and staged for ${d.name}`,
    port: () => 443,
  },
  {
    kind: 'Port Scan',
    verdict: 'Suspicious',
    severity: 'Medium',
    benignWeight: 4,
    hostileWeight: 22,
    detail: (d, r) =>
      `Sequential SYN sweep across ${r.int(180, 4200)} ports originating from ${d.ip}`,
    port: (r) => r.pick([23, 2323, 22, 80] as const),
  },
  {
    kind: 'Suspicious Login',
    verdict: 'Suspicious',
    severity: 'High',
    benignWeight: 3,
    hostileWeight: 18,
    detail: (d, r) =>
      `${r.int(24, 640)} failed Telnet attempts against ${d.name} using default credential list`,
    port: (r) => r.pick([23, 2323] as const),
  },
  {
    kind: 'Malware Download',
    verdict: 'Malicious',
    severity: 'Critical',
    benignWeight: 0,
    hostileWeight: 14,
    detail: (d, r) =>
      `Unsigned ELF binary retrieved to ${r.pick(['/tmp', '/var/run', '/dev/shm'] as const)} on ${d.name}`,
    port: (r) => r.pick([80, 8080, 69] as const),
  },
  {
    kind: 'Command & Control',
    verdict: 'Malicious',
    severity: 'Critical',
    benignWeight: 0,
    hostileWeight: 17,
    detail: (d, r) =>
      `Persistent beacon from ${d.name} every ${r.int(20, 180)}s to known C2 infrastructure`,
    port: (r) => r.pick([6667, 443, 48101] as const),
  },
  {
    kind: 'Data Exfiltration',
    verdict: 'Malicious',
    severity: 'Critical',
    benignWeight: 0,
    hostileWeight: 10,
    detail: (d, r) =>
      `${r.int(2, 94)} MB transferred from ${d.name} to an unrecognised external endpoint`,
    port: (r) => r.pick([443, 21, 8443] as const),
  },
] as const

const EXTERNAL_IPS = [
  '185.244.25.171',
  '91.211.88.42',
  '203.0.113.44',
  '45.129.33.18',
  '198.51.100.77',
  '176.32.44.201',
  '193.201.224.9',
  '104.21.9.14',
  '52.94.236.248',
  '142.250.187.14',
] as const

const EVENT_COUNT = 500

function generateEvents(rng: Rng, devices: Device[]): NetworkEvent[] {
  const events: NetworkEvent[] = []

  // Pre-build weighted profile pools so each draw is a single rng call.
  const benignPool: EventProfile[] = []
  const hostilePool: EventProfile[] = []
  for (const p of EVENT_PROFILES) {
    for (let i = 0; i < p.benignWeight; i++) benignPool.push(p)
    for (let i = 0; i < p.hostileWeight; i++) hostilePool.push(p)
  }

  for (let i = 0; i < EVENT_COUNT; i++) {
    const device = rng.pick(devices)
    const hostile =
      device.status === 'Compromised' ||
      device.status === 'Isolated' ||
      (device.status === 'At Risk' && rng.chance(0.45))

    const profile = rng.pick(hostile ? hostilePool : benignPool)
    const external =
      profile.verdict !== 'Benign' ? rng.pick(EXTERNAL_IPS) : `10.42.0.${rng.int(2, 20)}`

    // Events are spread across the last 24 hours, newest first after sorting.
    const ageMs = rng.int(30, 86_100) * 1000

    events.push({
      id: `EVT-${pad(i + 1, 4)}`,
      timestamp: isoAgo(ageMs),
      deviceId: device.id,
      deviceName: device.name,
      kind: profile.kind,
      sourceIp: profile.verdict === 'Malicious' ? external : device.ip,
      destIp: profile.verdict === 'Malicious' ? device.ip : external,
      destPort: profile.port(rng),
      protocol: device.protocol,
      bytes:
        profile.kind === 'Data Exfiltration'
          ? rng.int(2_000_000, 94_000_000)
          : rng.int(180, 48_000),
      verdict: profile.verdict,
      severity: profile.severity,
      detail: profile.detail(device, rng),
    })
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

/* ==========================================================================
   Alerts
   ========================================================================== */

interface ThreatTemplate {
  threat: string
  severity: Severity
  tactic: string
  technique: string
  action: string
  description: string
}

const THREAT_TEMPLATES: readonly ThreatTemplate[] = [
  {
    threat: 'Telnet Credential Brute Force',
    severity: 'High',
    tactic: 'Credential Access',
    technique: 'T1110.001 — Password Guessing',
    action: 'Disable Telnet on the device and rotate the administrative credential.',
    description:
      'A sustained sequence of failed Telnet authentications matched the Mirai default-credential table. The source completed the sequence with a successful login.',
  },
  {
    threat: 'Command & Control Beacon',
    severity: 'Critical',
    tactic: 'Command and Control',
    technique: 'T1071.001 — Application Layer Protocol',
    action: 'Isolate the device immediately and blackhole the destination at the edge.',
    description:
      'The device is maintaining a regular outbound beacon to infrastructure matching a known IoT botnet controller. Interval jitter is consistent with an automated implant.',
  },
  {
    threat: 'Unsigned Firmware Payload Retrieved',
    severity: 'Critical',
    tactic: 'Execution',
    technique: 'T1059.004 — Unix Shell',
    action: 'Quarantine the device and reflash from a verified vendor image.',
    description:
      'An ELF binary without a valid vendor signature was written to a world-writable path and marked executable within the same session.',
  },
  {
    threat: 'Lateral Port Sweep',
    severity: 'Medium',
    tactic: 'Discovery',
    technique: 'T1046 — Network Service Discovery',
    action: 'Apply segment ACLs to block device-to-device scanning within the VLAN.',
    description:
      'A single host enumerated service ports across the local subnet in a sequential pattern inconsistent with its normal traffic profile.',
  },
  {
    threat: 'Outbound Data Exfiltration',
    severity: 'Critical',
    tactic: 'Exfiltration',
    technique: 'T1041 — Exfiltration Over C2 Channel',
    action: 'Sever the session, capture the flow for analysis, and isolate the host.',
    description:
      'Outbound volume from this device exceeded its 30-day baseline by more than two orders of magnitude, directed at an endpoint with no prior history.',
  },
  {
    threat: 'Firmware Downgrade Attempt',
    severity: 'High',
    tactic: 'Defense Evasion',
    technique: 'T1562.001 — Impair Defenses',
    action: 'Reject the image, enable rollback protection, and audit the update channel.',
    description:
      'An OTA request attempted to install a firmware build older than the currently installed version, a common route to reintroduce a patched vulnerability.',
  },
  {
    threat: 'Anomalous Authentication Pattern',
    severity: 'Medium',
    tactic: 'Initial Access',
    technique: 'T1078 — Valid Accounts',
    action: 'Force re-enrolment of the device certificate and review the access log.',
    description:
      'Authentication succeeded from a source address and at an hour that fall outside this device class established behavioural envelope.',
  },
  {
    threat: 'Watchdog Tamper Detected',
    severity: 'High',
    tactic: 'Persistence',
    technique: 'T1543 — Create or Modify System Process',
    action: 'Treat as active compromise; power-cycle and reflash the device.',
    description:
      'The hardware watchdog daemon was suspended, a technique used to prevent an infected device from rebooting itself out of a memory-resident implant.',
  },
  {
    threat: 'Rogue DHT Peer Activity',
    severity: 'High',
    tactic: 'Command and Control',
    technique: 'T1090 — Proxy',
    action: 'Block UDP DHT bootstrap egress and quarantine the participating host.',
    description:
      'The device announced itself on a public distributed hash table, behaviour associated with peer-to-peer IoT botnets that lack a central controller.',
  },
  {
    threat: 'Destructive Flash Write Attempt',
    severity: 'Critical',
    tactic: 'Impact',
    technique: 'T1485 — Data Destruction',
    action: 'Cut network access at the switch port and preserve the device for forensics.',
    description:
      'A shell session issued raw block-device writes against the firmware partition, matching the permanent-denial-of-service pattern used by BrickerBot.',
  },
] as const

const ALERT_COUNT = 150

function generateAlerts(rng: Rng, devices: Device[]): Alert[] {
  const alerts: Alert[] = []

  const risky = devices.filter((d) => d.status !== 'Healthy' && d.status !== 'Offline')
  const healthy = devices.filter((d) => d.status === 'Healthy')

  for (let i = 0; i < ALERT_COUNT; i++) {
    // Most alerts land on devices that are actually in trouble; a minority fire
    // on healthy hosts, which is what makes the false-positive rate credible.
    const pool = rng.chance(0.78) && risky.length > 0 ? risky : healthy
    const device = rng.pick(pool)
    const template = rng.pick(THREAT_TEMPLATES)

    const status: AlertStatus =
      device.status === 'Compromised'
        ? rng.pick(['Open', 'Investigating', 'Open'] as const)
        : device.status === 'Isolated'
          ? 'Contained'
          : device.status === 'Recovering'
            ? rng.pick(['Contained', 'Resolved'] as const)
            : rng.pick(['Resolved', 'Resolved', 'Investigating'] as const)

    alerts.push({
      id: `ALT-${pad(i + 1, 4)}`,
      timestamp: isoAgo(rng.int(60, 259_000) * 1000),
      deviceId: device.id,
      deviceName: device.name,
      threat: template.threat,
      malwareFamily: device.infectedBy,
      severity: template.severity,
      status,
      action: template.action,
      description: template.description,
      mitreTactic: template.tactic,
      mitreTechnique: template.technique,
      confidence: rng.int(62, 99),
      sourceIp: rng.chance(0.6) ? rng.pick(EXTERNAL_IPS) : device.ip,
    })
  }

  return alerts.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

/* ==========================================================================
   Formal verification
   --------------------------------------------------------------------------
   Six properties checked against the Coloured Petri Net model: four hold, two
   are violated. The two failures are the pedagogically interesting cases and
   drive the Resilience Center's recommendations.
   ========================================================================== */

const VERIFICATION_SEEDS: readonly Omit<
  VerificationProperty,
  'statesExplored' | 'transitionsFired' | 'durationMs'
>[] = [
  {
    id: 'VP-01',
    name: 'Authentication Integrity',
    formula: 'AG (MalwareExecution → EF Authenticated)',
    logic: 'CTL',
    status: 'Verified',
    category: 'Security',
    description:
      'No token may reach the Malware Execution place without first passing through the Authenticate transition — the model admits no path that bypasses identity establishment.',
    reason:
      'Exhaustive exploration of the reachability graph found no firing sequence in which a token enters Malware Execution with an unauthenticated colour. The Authenticate transition is a cut vertex on every such path.',
    recommendation:
      'Hold this invariant when extending the model. Any new transition writing into Malware Execution must consume from Authentication, or the property will regress.',
  },
  {
    id: 'VP-02',
    name: 'Safe State Reachability',
    formula: 'AG (EF (Idle ∨ Recovery))',
    logic: 'CTL',
    status: 'Verified',
    category: 'Reachability',
    description:
      'From every reachable state the system retains a path back to a safe state — either Idle or Recovery. No compromise is terminal within the model.',
    reason:
      'All 18,432 reachable markings were checked; each retains at least one firing sequence terminating in a safe marking. The longest such path is 14 transitions from deep in the Malware Execution subnet.',
    recommendation:
      'Recovery capacity is what makes this hold. If the Recover Device transition is ever gated on an external dependency, re-verify — the property is sensitive to that edge.',
  },
  {
    id: 'VP-03',
    name: 'Deadlock Freedom',
    formula: 'AG (EX true)',
    logic: 'CTL',
    status: 'Verified',
    category: 'Liveness',
    description:
      'The net contains no dead marking: from every reachable state at least one transition remains enabled, so the model can never wedge.',
    reason:
      'No terminal markings were found in the full state space. Every place with outgoing arcs retains an enabled successor under all reachable colour bindings.',
    recommendation:
      'Preserve the token-recycling arc from Recovery back to Idle. Removing it introduces terminal markings and this property fails immediately.',
  },
  {
    id: 'VP-04',
    name: 'Isolation Successful',
    formula: 'AG (Isolated → AX ¬Transmitting)',
    logic: 'CTL',
    status: 'Verified',
    category: 'Safety',
    description:
      'Once a device token enters the Isolation place, no subsequent state permits it to emit network traffic until Recovery completes.',
    reason:
      'The Isolate Device transition consumes the device colour and re-emits it under an isolated binding for which no transmission transition has a matching guard. The restriction holds across all 2,164 isolation-reachable markings.',
    recommendation:
      'The guarantee rests on guard correctness. Add a regression check on the isolation guard whenever the colour set is extended.',
  },
  {
    id: 'VP-05',
    name: 'Malware Containment',
    formula: 'AG (MalwareExecution → AF Isolated)',
    logic: 'CTL',
    status: 'Failed',
    category: 'Safety',
    description:
      'Every token entering Malware Execution should inevitably reach Isolation. This property does not hold.',
    reason:
      'A counterexample exists: when Detect Malware and Analyse Behaviour are concurrently enabled on the same device colour, the scheduler may fire Analyse Behaviour first, returning the token to Suspicious Behaviour. The resulting cycle can repeat indefinitely, so isolation is possible but not inevitable. In 3.1% of sampled runs the token remained in the loop past the detection deadline.',
    recommendation:
      'Add a priority guard so Detect Malware pre-empts Analyse Behaviour once the suspicion counter crosses its threshold, or introduce a bounded retry colour that forces isolation after k analysis cycles. Either change makes the eventuality unconditional.',
    counterexample: [
      'PacketReceived → Authenticate',
      'Authentication → AnalyseBehaviour',
      'SuspiciousBehaviour → DetectMalware',
      'MalwareExecution → AnalyseBehaviour  ⟲ (cycle re-entered)',
      'SuspiciousBehaviour → AnalyseBehaviour  ⟲ (no progress toward Isolation)',
    ],
  },
  {
    id: 'VP-06',
    name: 'Data Leakage Prevention',
    formula: 'G ¬(Exfiltrating ∧ ¬Detected)',
    logic: 'LTL',
    status: 'Failed',
    category: 'Security',
    description:
      'No execution should contain a state in which data leaves the device before detection has fired. This property does not hold.',
    reason:
      'The Detect Malware transition requires two consecutive suspicious observations before firing, which leaves a one-observation window during which the exfiltration arc is already enabled. The model checker produced a trace in which 1 of 12 exfiltration events precedes detection — a mean exposure of roughly 4.2 seconds at the sampled observation rate.',
    recommendation:
      'Introduce an egress-volume guard that fires on the first observation when transferred bytes exceed the device baseline, rather than waiting for a second behavioural sample. Alternatively, gate the exfiltration arc on a detection token so the two cannot be concurrently enabled.',
    counterexample: [
      'MalwareExecution → EstablishC2',
      'C2Established → BeginTransfer   (exfiltration arc enabled)',
      'Transferring → ObserveBehaviour (first suspicious observation)',
      'Transferring → ObserveBehaviour (second observation — detection fires, too late)',
      'DetectMalware → Isolate         (bytes already left the device)',
    ],
  },
] as const

function generateVerification(rng: Rng): VerificationRun {
  const properties: VerificationProperty[] = VERIFICATION_SEEDS.map((seed) => ({
    ...seed,
    counterexample: seed.counterexample ? [...seed.counterexample] : undefined,
    statesExplored: rng.int(4_200, 18_600),
    transitionsFired: rng.int(9_800, 54_000),
    durationMs: rng.int(180, 3_400),
  }))

  const passed = properties.filter((p) => p.status === 'Verified').length
  const failed = properties.length - passed

  return {
    id: 'VRUN-001',
    model: 'CPN-IoT-Defence-v3.2',
    startedAt: isoAgo(rng.int(400, 5_000) * 1000),
    properties,
    passed,
    failed,
    successRate: Math.round((passed / properties.length) * 1000) / 10,
    stateSpaceSize: 18_432,
    deadlockFree: true,
  }
}

/* ==========================================================================
   Resilience
   ========================================================================== */

function generateResilience(rng: Rng, devices: Device[]): ResilienceState {
  const isolated = devices.filter((d) => d.status === 'Isolated').length
  const recovering = devices.filter((d) => d.status === 'Recovering').length
  const compromised = devices.filter((d) => d.status === 'Compromised').length

  const workflow: RecoveryStep[] = [
    {
      id: 'RS-1',
      label: 'Threat Confirmed',
      description:
        'Detection engine correlated three independent indicators and raised confidence above the automatic-response threshold.',
      status: 'Complete',
      at: isoAgo(1_020_000),
      durationSec: 4,
      automated: true,
    },
    {
      id: 'RS-2',
      label: 'Automatic Isolation',
      description:
        'Affected devices were moved to the quarantine VLAN and their switch ports placed in a restricted policy group.',
      status: 'Complete',
      at: isoAgo(1_008_000),
      durationSec: 12,
      automated: true,
    },
    {
      id: 'RS-3',
      label: 'Formal Re-verification',
      description:
        'The Coloured Petri Net model was re-checked against the post-isolation marking to confirm the containment invariant.',
      status: 'Complete',
      at: isoAgo(960_000),
      durationSec: 48,
      automated: true,
    },
    {
      id: 'RS-4',
      label: 'Credential Rotation',
      description:
        'Device certificates and administrative credentials were reissued for every quarantined asset.',
      status: 'Complete',
      at: isoAgo(870_000),
      durationSec: 90,
      automated: true,
    },
    {
      id: 'RS-5',
      label: 'Firmware Reflash',
      description:
        'Verified vendor images are being written to quarantined devices; memory-resident stages do not survive the reflash.',
      status: 'Active',
      at: isoAgo(420_000),
      durationSec: 0,
      automated: true,
    },
    {
      id: 'RS-6',
      label: 'Post-Recovery Validation',
      description:
        'Behavioural baseline is re-established and the device is re-admitted only after a clean observation window.',
      status: 'Pending',
      durationSec: 0,
      automated: true,
    },
    {
      id: 'RS-7',
      label: 'Segment Policy Update',
      description:
        'Blocked the C2 destinations and DHT bootstrap egress identified during the incident across all IoT VLANs.',
      status: 'Pending',
      durationSec: 0,
      automated: false,
    },
  ]

  // Stability dips as the incident develops, then climbs as recovery proceeds.
  const shape = [96, 91, 74, 58, 47, 52, 63, 74, 82, 88, 91, 93]
  const timeline = shape.map((stability, i) => ({
    t: isoAgo((shape.length - 1 - i) * 900_000),
    stability: clamp(stability + rng.int(-2, 2), 0, 100),
    risk: clamp(100 - stability + rng.int(-3, 3), 0, 100),
  }))

  return {
    containment: 82,
    recovery: 64,
    riskReduction: 71,
    stability: 88,
    devicesIsolated: isolated + compromised,
    devicesRecovered: recovering,
    devicesPendingRecovery: compromised,
    mttdSec: 42,
    mttcSec: 118,
    mttrSec: 1_640,
    workflow,
    timeline,
  }
}

/* ==========================================================================
   Dashboard aggregates
   ========================================================================== */

function generateSummary(
  rng: Rng,
  devices: Device[],
  alerts: Alert[],
  verification: VerificationRun,
): Summary {
  const healthy = devices.filter((d) => d.status === 'Healthy').length
  const compromised = devices.filter((d) => d.status === 'Compromised').length
  const atRisk = devices.filter((d) => d.status === 'At Risk').length
  const isolated = devices.filter((d) => d.status === 'Isolated').length
  const activeThreats = alerts.filter(
    (a) => a.status === 'Open' || a.status === 'Investigating',
  ).length

  const avgHealth =
    devices.reduce((sum, d) => sum + d.health, 0) / Math.max(devices.length, 1)

  // 14-day trend, most recent last.
  const threatTrend = Array.from({ length: 14 }, (_, i) => {
    const daysAgo = 13 - i
    const detected = rng.int(8, 46)
    return {
      date: dayLabel(daysAgo),
      detected,
      blocked: Math.round(detected * rng.float(0.72, 0.94, 2)),
      verified: Math.round(detected * rng.float(0.6, 0.88, 2)),
    }
  })

  const accuracyTrend = Array.from({ length: 14 }, (_, i) => ({
    date: dayLabel(13 - i),
    accuracy: rng.float(91.2, 98.4, 1),
    precision: rng.float(88.6, 97.1, 1),
    recall: rng.float(87.4, 96.8, 1),
  }))

  const verificationTrend = Array.from({ length: 14 }, (_, i) => ({
    date: dayLabel(13 - i),
    rate: rng.float(58, 92, 1),
  }))

  const attackDistribution: NamedValue[] = [
    { name: 'DDoS Botnet', value: 38 },
    { name: 'Credential Attack', value: 24 },
    { name: 'C2 Beaconing', value: 17 },
    { name: 'Exfiltration', value: 11 },
    { name: 'Destructive', value: 6 },
    { name: 'Reconnaissance', value: 4 },
  ]

  const deviceHealth: NamedValue[] = [
    { name: 'Healthy', value: healthy },
    { name: 'At Risk', value: atRisk },
    { name: 'Compromised', value: compromised },
    { name: 'Isolated', value: isolated },
    { name: 'Recovering', value: devices.filter((d) => d.status === 'Recovering').length },
    { name: 'Offline', value: devices.filter((d) => d.status === 'Offline').length },
  ]

  // Security score is a weighted blend, not a raw average, so a single
  // compromised device visibly moves the needle.
  const securityScore = Math.round(
    clamp(
      avgHealth * 0.5 +
        verification.successRate * 0.25 +
        (100 - (compromised / Math.max(devices.length, 1)) * 400) * 0.25,
      0,
      100,
    ),
  )

  return {
    connectedDevices: devices.filter((d) => d.status !== 'Offline').length,
    healthyDevices: healthy,
    compromisedDevices: compromised,
    atRiskDevices: atRisk,
    isolatedDevices: isolated,
    activeThreats,
    verificationRate: verification.successRate,
    verificationPassed: verification.passed,
    verificationFailed: verification.failed,
    networkHealth: Math.round(avgHealth),
    securityScore,
    detectionAccuracy: 96.4,
    meanResponseSec: 118,
    deltas: { devices: 2, threats: -14, health: 3, verification: -8 },
    threatTrend,
    deviceHealth,
    attackDistribution,
    accuracyTrend,
    verificationTrend,
  }
}

/* ==========================================================================
   Analytics
   ========================================================================== */

function generateAnalytics(
  rng: Rng,
  devices: Device[],
  alerts: Alert[],
  malware: MalwareFamily[],
): Analytics {
  const countBy = <T, K extends string>(
    items: T[],
    key: (item: T) => K,
  ): NamedValue[] => {
    const map = new Map<string, number>()
    for (const item of items) {
      const k = key(item)
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }

  const severityByCategory = ARCHETYPES.map((arch) => {
    const inCat = alerts.filter((a) => {
      const d = devices.find((dev) => dev.id === a.deviceId)
      return d?.category === arch.category
    })
    return {
      category: arch.category,
      Low: inCat.filter((a) => a.severity === 'Low').length,
      Medium: inCat.filter((a) => a.severity === 'Medium').length,
      High: inCat.filter((a) => a.severity === 'High').length,
      Critical: inCat.filter((a) => a.severity === 'Critical').length,
    }
  })

  return {
    threatFrequency: countBy(alerts, (a) => a.threat).slice(0, 8),
    malwareCategories: countBy(malware, (m) => m.category).map((c) => ({
      ...c,
      value: malware
        .filter((m) => m.category === c.name)
        .reduce((sum, m) => sum + m.prevalence, 0),
    })),
    deviceRisk: countBy(devices, (d) => d.risk),
    verificationOutcomes: [
      { name: 'Verified', value: 4 },
      { name: 'Failed', value: 2 },
    ],
    recoverySuccess: Array.from({ length: 14 }, (_, i) => ({
      date: dayLabel(13 - i),
      recovered: rng.int(3, 17),
      failed: rng.int(0, 4),
    })),
    networkHealthSeries: Array.from({ length: 14 }, (_, i) => ({
      date: dayLabel(13 - i),
      health: rng.int(72, 97),
      load: rng.int(31, 88),
    })),
    severityByCategory,
  }
}

/* ==========================================================================
   Scenarios
   ========================================================================== */

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'normal',
    label: 'Normal Traffic',
    description:
      'Baseline operation. Telemetry, authentication and scheduled updates only — establishes the behavioural envelope the detectors compare against.',
    severity: 'Low',
    expectedDetectionMs: 0,
  },
  {
    id: 'mirai',
    label: 'Mirai Attack',
    description:
      'Telnet brute force from an external scanner, followed by payload staging and enrolment into a DDoS swarm.',
    severity: 'Critical',
    familyId: 'MAL-01',
    expectedDetectionMs: 2_400,
  },
  {
    id: 'botnet',
    label: 'Botnet Infection',
    description:
      'Peer-to-peer botnet propagation across the segment, with DHT announcement and signed configuration exchange.',
    severity: 'Critical',
    familyId: 'MAL-03',
    expectedDetectionMs: 3_100,
  },
  {
    id: 'credential',
    label: 'Credential Attack',
    description:
      'Distributed credential stuffing against device management interfaces using leaked vendor default pairs.',
    severity: 'High',
    familyId: 'MAL-08',
    expectedDetectionMs: 1_800,
  },
  {
    id: 'ransomware',
    label: 'Ransomware Behaviour',
    description:
      'Destructive sequence: configuration wipe and firmware-partition overwrite consistent with permanent denial of service.',
    severity: 'Critical',
    familyId: 'MAL-06',
    expectedDetectionMs: 2_900,
  },
] as const

/* ==========================================================================
   Assembly
   ========================================================================== */

function build() {
  const rng = createRng(SEED)

  const devices = generateDevices(rng)
  const malware = generateMalware(rng, devices)
  const events = generateEvents(rng, devices)
  const alerts = generateAlerts(rng, devices)
  const verification = generateVerification(rng)
  const resilience = generateResilience(rng, devices)
  const summary = generateSummary(rng, devices, alerts, verification)
  const analytics = generateAnalytics(rng, devices, alerts, malware)

  return {
    devices,
    malware,
    events,
    alerts,
    verification,
    resilience,
    summary,
    analytics,
    scenarios: SCENARIOS,
  }
}

/**
 * The bundled dataset. Built once at module load — every consumer shares the
 * same object identity, which keeps referential-equality checks in React
 * cheap and prevents the fallback data from re-rendering the tree.
 */
export const mock = build()

export type MockDataset = ReturnType<typeof build>

/* Convenience re-exports for the pages that need a single slice. */
export const mockDevices = mock.devices
export const mockEvents = mock.events
export const mockAlerts = mock.alerts
export const mockMalware = mock.malware
export const mockVerification = mock.verification
export const mockResilience = mock.resilience
export const mockSummary = mock.summary
export const mockAnalytics = mock.analytics
