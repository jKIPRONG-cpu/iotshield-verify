/**
 * Runs the explicit-state model checker over both net variants and reports the
 * results.
 *
 * This is the script that produces every verification figure the application
 * displays. Nothing downstream is authored: state counts, verdicts and
 * counterexample traces all come from the run below.
 *
 * Usage:
 *   node tools/verify_model.mjs                 # human-readable report
 *   node tools/verify_model.mjs --json          # machine-readable, to stdout
 *   node tools/verify_model.mjs --write         # update the generated files
 *   node tools/verify_model.mjs --max 800000    # raise the state cap
 */

import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const doWrite = args.includes('--write')
const maxIdx = args.indexOf('--max')
const maxStates = maxIdx >= 0 ? Number(args[maxIdx + 1]) : 400_000

/* ---- Bundle the TypeScript model so Node can execute it ----------------- */

const scratch = mkdtempSync(resolve(tmpdir(), 'iotshield-verify-'))
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

const { runCheck, makeConfig, propertySpecs, VERIFIED_DEVICES, DEFAULT_PARAMETERS } = mod

/* ---- Run both variants -------------------------------------------------- */

const specs = propertySpecs(VERIFIED_DEVICES)
const baseline = runCheck(makeConfig('baseline'), specs, { maxStates })
const hardened = runCheck(makeConfig('hardened'), specs, { maxStates })

const report = {
  generatedBy: 'tools/verify_model.mjs',
  semantics: 'interleaving; exhaustive up to the state cap',
  maxStates,
  parameters: DEFAULT_PARAMETERS,
  devices: VERIFIED_DEVICES,
  baseline,
  hardened,
}

if (asJson) {
  process.stdout.write(JSON.stringify(report, null, 2))
  process.exit(0)
}

/* ---- Human-readable report ---------------------------------------------- */

const G = '\x1b[32m'
const R = '\x1b[31m'
const D = '\x1b[2m'
const B = '\x1b[1m'
const X = '\x1b[0m'

function summarise(run, title) {
  console.log(`\n${B}${title}${X}`)
  console.log(
    `  ${D}states${X} ${run.states.toLocaleString()}   ` +
      `${D}transitions${X} ${run.transitions.toLocaleString()}   ` +
      `${D}terminal${X} ${run.terminalStates}   ` +
      `${D}explored in${X} ${run.exploreMs}ms` +
      (run.truncated ? `   ${R}TRUNCATED${X}` : ''),
  )
  console.log()
  for (const r of run.results) {
    const mark = r.status === 'Verified' ? `${G}PASS${X}` : `${R}FAIL${X}`
    const viol = r.violatingStates > 0 ? ` ${D}(${r.violatingStates} violating states)${X}` : ''
    console.log(`  ${mark}  ${r.id} ${r.name}${viol}`)
  }
  console.log(`\n  ${B}${run.passed}/${run.results.length} properties satisfied${X}`)
}

summarise(baseline, 'BASELINE MODEL')
summarise(hardened, 'HARDENED MODEL')

/* ---- Counterexamples ---------------------------------------------------- */

const failures = baseline.results.filter((r) => r.status === 'Failed')
if (failures.length > 0) {
  console.log(`\n${B}BASELINE COUNTEREXAMPLES${X}`)
  for (const f of failures) {
    console.log(`\n  ${R}${f.id} ${f.name}${X}`)
    console.log(`  ${D}${f.formula}${X}`)
    ;(f.counterexample ?? []).forEach((step, i) => {
      const loop = f.counterexampleLoopFrom !== undefined && i >= f.counterexampleLoopFrom
      console.log(`    ${String(i + 1).padStart(2)}. ${loop ? '↻ ' : '   '}${step}`)
    })
  }
}

const stillFailing = hardened.results.filter((r) => r.status === 'Failed')
if (stillFailing.length > 0) {
  console.log(`\n${B}${R}HARDENED — REMAINING FAILURES${X}`)
  for (const f of stillFailing) {
    console.log(`\n  ${R}${f.id} ${f.name}${X}`)
    ;(f.counterexample ?? []).forEach((step, i) => {
      console.log(`    ${String(i + 1).padStart(2)}. ${step}`)
    })
  }
} else {
  console.log(`\n${G}Hardened model: all properties satisfied.${X}`)
}

/* ---- Delta -------------------------------------------------------------- */

console.log(`\n${B}DELTA${X}`)
for (const b of baseline.results) {
  const h = hardened.results.find((r) => r.id === b.id)
  if (b.status !== h.status) {
    console.log(`  ${b.id} ${b.name}: ${R}${b.status}${X} -> ${G}${h.status}${X}`)
  }
}
const growth = ((hardened.states / baseline.states - 1) * 100).toFixed(1)
console.log(
  `  state space: ${baseline.states.toLocaleString()} -> ${hardened.states.toLocaleString()} (${growth > 0 ? '+' : ''}${growth}%)`,
)

if (doWrite) {
  const target = resolve(root, 'frontend/src/data/verification-results.json')
  writeFileSync(target, JSON.stringify(report, null, 2) + '\n')
  console.log(`\n${D}written: ${target}${X}`)
}

process.exit(0)
