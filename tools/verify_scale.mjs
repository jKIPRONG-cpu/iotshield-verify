/**
 * Scalability runs: the same model checker as tools/verify_model.mjs, on
 * configurations with devices added in a fixed, pre-declared order.
 *
 *   3 devices  GW-1, TH-1, PLC-1        (the verified configuration)
 *   4 devices  + SN-1  sensor,  building, hardening 1, internal
 *   5 devices  + MON-1 monitor, clinical, hardening 0, internal
 *
 * Verdicts are reported only for explorations that completed below the state
 * cap. A truncated run reports its size and time and nothing else, because a
 * property checked on a partial graph means nothing.
 *
 * Usage:
 *   node --max-old-space-size=6000 tools/verify_scale.mjs            # 3, 4, 5 devices
 *   node --max-old-space-size=6000 tools/verify_scale.mjs --max 3000000 --devices 3,4
 */

import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir, totalmem, cpus } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const maxStates = Number(opt('--max', '3000000'))
const sizes = opt('--devices', '3,4,5').split(',').map(Number)

const scratch = mkdtempSync(resolve(tmpdir(), 'iotshield-scale-'))
const outfile = resolve(scratch, 'formal.mjs')
let mod
try {
  await build({
    entryPoints: [resolve(root, 'frontend/src/components/petri/formal/index.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'error',
    alias: { '@': resolve(root, 'frontend/src') },
  })
  mod = await import(pathToFileURL(outfile).href)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

const { makeConfig, propertySpecs, explore, checkProperty, VERIFIED_DEVICES, DEFAULT_PARAMETERS } = mod

/** Devices added in this order, declared before any run. */
const ADDED = [
  { id: 'SN-1', cls: 'sensor', zone: 'building', hard: 1, exposed: false },
  { id: 'MON-1', cls: 'monitor', zone: 'clinical', hard: 0, exposed: false },
]

const mb = (bytes) => Math.round(bytes / 1024 / 1024)

console.log(`IoTShield Verify — scalability runs`)
console.log(`node ${process.version} · ${cpus()[0]?.model ?? 'cpu'} · ${mb(totalmem())} MB RAM · state cap ${maxStates.toLocaleString()}`)

for (const n of sizes) {
  const devices = [...VERIFIED_DEVICES, ...ADDED].slice(0, n)
  if (devices.length !== n) {
    console.log(`\n${n} devices: not defined (at most ${VERIFIED_DEVICES.length + ADDED.length})`)
    continue
  }
  console.log(`\n${n} DEVICES: ${devices.map((d) => d.id).join(', ')}`)
  const specs = propertySpecs(devices)

  for (const variant of ['baseline', 'hardened']) {
    const graph = explore(makeConfig(variant, DEFAULT_PARAMETERS, devices), { maxStates })
    const peak = mb(process.memoryUsage().rss)
    const head =
      `  ${variant.padEnd(8)}  states ${graph.states.length.toLocaleString().padStart(10)}` +
      `  transitions ${graph.edgeCount.toLocaleString().padStart(11)}` +
      `  explored in ${(graph.elapsedMs / 1000).toFixed(1)} s  rss ${peak} MB`
    if (graph.truncated) {
      console.log(`${head}  INCOMPLETE (state cap reached) — no verdicts`)
      continue
    }
    console.log(`${head}  complete, terminal ${graph.terminal.length}`)
    for (const spec of specs) {
      const r = checkProperty(graph, spec)
      const fair = r.statusUnderFairness ? `  [weak fairness: ${r.statusUnderFairness}]` : ''
      const viol = r.status === 'Verified' ? '' : ` (${(r.violatingStates ?? 0).toLocaleString()} violating)`
      console.log(`    ${r.id}  ${r.status}${viol}${fair}`)
    }
  }
}
