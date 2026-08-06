/**
 * Dumps the frontend's bundled dataset as JSON so it can be diffed against the
 * Python generator by tools/check_parity.py.
 *
 * The dataset lives in a TypeScript module that uses the `@/` path alias, so it
 * is bundled with esbuild in-process rather than imported directly.
 *
 * Usage:  node tools/dump_mock.mjs > /tmp/ts-mock.json
 */

import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const entry = resolve(root, 'frontend/src/data/mock.ts')

const scratch = mkdtempSync(resolve(tmpdir(), 'iotshield-parity-'))
const outfile = resolve(scratch, 'mock.mjs')

try {
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'error',
    // Mirror the alias declared in frontend/vite.config.ts.
    alias: { '@': resolve(root, 'frontend/src') },
  })

  const { mock } = await import(pathToFileURL(outfile).href)
  process.stdout.write(JSON.stringify(mock))
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
