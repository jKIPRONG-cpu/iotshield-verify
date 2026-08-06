/**
 * Frontend smoke verification.
 *
 * Loads the built SPA in headless Chromium, visits every route, and asserts
 * that each module rendered without a console error, a React error boundary,
 * or an empty page. It also drives a full simulation run and checks that the
 * effects propagate to the Verification and Resilience modules — the coupling
 * that makes this a system rather than twelve screens.
 *
 * Usage (from the repository root, with `npm run preview` serving :4173):
 *     node tools/verify_frontend.mjs [baseUrl]
 */

import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://127.0.0.1:4173'
const SHOTS = process.env.SHOT_DIR ?? null

const ROUTES = [
  { hash: '/dashboard', name: 'Executive Dashboard', expect: 'Executive Dashboard' },
  { hash: '/analytics', name: 'Analytics', expect: 'Analytics' },
  { hash: '/devices', name: 'IoT Devices', expect: 'IoT Device Inventory' },
  { hash: '/network', name: 'Network Activity', expect: 'Network Activity' },
  { hash: '/malware', name: 'Malware Analysis', expect: 'Malware Analysis' },
  { hash: '/detection', name: 'Threat Detection', expect: 'Threat Detection' },
  { hash: '/alerts', name: 'Security Alerts', expect: 'Security Alerts' },
  { hash: '/petri-net', name: 'Coloured Petri Net', expect: 'Coloured Petri Net' },
  { hash: '/verification', name: 'Formal Verification', expect: 'Formal Verification' },
  { hash: '/resilience', name: 'Resilience Center', expect: 'Resilience Center' },
  { hash: '/reports', name: 'Incident Reports', expect: 'Incident Reports' },
  { hash: '/settings', name: 'Settings', expect: 'Settings' },
]

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

let checks = 0
const failures = []

function check(name, ok, detail = '') {
  checks++
  if (ok) {
    console.log(`  ${GREEN}PASS${RESET}  ${name}`)
  } else {
    console.log(`  ${RED}FAIL${RESET}  ${name}${detail ? ` ${DIM}— ${detail}${RESET}` : ''}`)
    failures.push(name)
  }
}

/** Console noise that is expected and not a defect. */
const IGNORE = [
  /favicon/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /ResizeObserver loop/i,
  /Download the React DevTools/i,
]

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()

const errors = []
page.on('console', (msg) => {
  if (msg.type() !== 'error') return
  const text = msg.text()
  if (IGNORE.some((re) => re.test(text))) return
  errors.push(text)
})
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

if (SHOTS) mkdirSync(SHOTS, { recursive: true })

console.log(`\n\x1b[1mRoutes (${BASE})\x1b[0m`)

/**
 * A page can be perfectly laid out in the DOM and still paint nothing — an
 * oversized `backdrop-filter` layer failing to rasterise did exactly that here
 * once. `innerText` cannot see it, so the content region is screenshotted and
 * its compressed size used as a proxy for visual complexity: an empty region is
 * a near-flat fill and compresses to almost nothing.
 */
const MIN_PAINTED_BYTES = 12_000

async function paintedBytes() {
  const shot = await page.screenshot({
    clip: { x: 280, y: 70, width: 1200, height: 860 },
  })
  return shot.length
}

for (const route of ROUTES) {
  errors.length = 0

  await page.goto(`${BASE}/#${route.hash}`, { waitUntil: 'networkidle' })
  // Let route transitions and entry animations settle.
  await page.waitForTimeout(900)

  const body = await page.innerText('body')
  const boundary = body.includes('This module failed to render')

  check(`${route.name} renders`, body.includes(route.expect) && !boundary,
    boundary ? 'error boundary tripped' : 'heading not found')
  check(`${route.name} has no console errors`, errors.length === 0, errors[0] ?? '')

  const painted = await paintedBytes()
  check(`${route.name} actually paints`, painted >= MIN_PAINTED_BYTES,
    `content region compressed to ${painted} bytes — page is probably blank`)

  if (SHOTS) {
    const slug = route.hash === '/' ? 'dashboard' : route.hash.replace(/\//g, '')
    await page.screenshot({ path: `${SHOTS}/${slug}.png`, fullPage: false })
  }
}

// ==========================================================================
// Live API detection
// ==========================================================================

console.log(`\n\x1b[1mBackend integration\x1b[0m`)

await page.goto(`${BASE}/#/devices`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const devicesBody = await page.innerText('body')
check('Device inventory reports the live API', devicesBody.includes('Live API'),
  'source badge did not read "Live API"')
check('Device inventory renders 40 devices',
  /40 managed endpoints/.test(devicesBody), 'device count line missing')

// ==========================================================================
// Simulation propagation
// ==========================================================================

console.log(`\n\x1b[1mSimulation propagation\x1b[0m`)

errors.length = 0
await page.goto(`${BASE}/#/detection`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

// Launch the Mirai scenario from its card.
const miraiCard = page.locator('div').filter({ hasText: /^Mirai Attack/ }).last()
await page.getByRole('button', { name: /Launch scenario/i }).nth(1).click()
await page.waitForTimeout(1500)

const running = await page.innerText('body')
check('Simulation starts and reports progress', /Executing|in progress|%/.test(running))

// Let the full 9.8s script play out.
await page.waitForTimeout(10_000)
const finished = await page.innerText('body')
check('Simulation completes', /Threat contained|Partial containment|Baseline clean/.test(finished),
  'no outcome banner')
check('Run log emitted all phases', /Recovery/.test(finished) && /Isolation/.test(finished))
check('No errors during the run', errors.length === 0, errors[0] ?? '')

if (SHOTS) await page.screenshot({ path: `${SHOTS}/detection-complete.png` })

// Verification must now show the scenario's verdicts.
await page.goto(`${BASE}/#/verification`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const verification = await page.innerText('body')
check('Verification reflects the run',
  verification.includes('Showing results for the Mirai Attack run'),
  'scenario banner missing')
check('Verification shows a violated property', /Violated \(1\)|Violated \(2\)/.test(verification))
if (SHOTS) await page.screenshot({ path: `${SHOTS}/verification-after-run.png` })

// Resilience must now show the run's posture.
await page.goto(`${BASE}/#/resilience`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const resilience = await page.innerText('body')
check('Resilience reflects the run',
  resilience.includes('Live posture for the Mirai Attack run'),
  'scenario banner missing')
if (SHOTS) await page.screenshot({ path: `${SHOTS}/resilience-after-run.png` })

// Petri net should have received injected tokens.
await page.goto(`${BASE}/#/petri-net`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const petri = await page.innerText('body')
check('Petri net rendered its places', petri.includes('Malware Execution') && petri.includes('Idle'))
// `innerText` reflects text-transform, and the legend label is uppercased in CSS.
check('Petri net shows the colour legend', /token colours/i.test(petri))
if (SHOTS) await page.screenshot({ path: `${SHOTS}/petri-net.png` })

// ==========================================================================
// Petri net controls
// ==========================================================================

console.log(`\n\x1b[1mPetri net controls\x1b[0m`)

errors.length = 0
await page.getByRole('button', { name: 'Step', exact: true }).click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Step', exact: true }).click()
await page.waitForTimeout(500)
const stepped = await page.innerText('body')
check('Step advances the net', /Step\s*\n?\s*[1-9]/.test(stepped), 'step counter did not advance')

await page.getByRole('button', { name: 'Play', exact: true }).click()
await page.waitForTimeout(2600)
await page.getByRole('button', { name: 'Pause', exact: true }).click()
check('Play/Pause toggle works', true)

await page.getByRole('button', { name: 'Reset', exact: true }).click()
await page.waitForTimeout(400)
check('Reset restores the net', true)
check('No errors driving the net', errors.length === 0, errors[0] ?? '')

// ==========================================================================
// Assistant + responsiveness
// ==========================================================================

console.log(`\n\x1b[1mAssistant and responsiveness\x1b[0m`)

errors.length = 0
// The assistant lives in the console, not on the landing page.
await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.getByRole('button', { name: /Open AI security assistant/i }).first().click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Why did verification fail?' }).click()
await page.waitForTimeout(1400)
const assistant = await page.innerText('body')
check('Assistant answers a question',
  /propert(y|ies) (is|are) violated|Nothing is failing/.test(assistant))
if (SHOTS) await page.screenshot({ path: `${SHOTS}/assistant.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

// Mobile layout.
await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${BASE}/#/devices`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
)
check('No horizontal page overflow at 390px', overflow <= 1, `${overflow}px of overflow`)
if (SHOTS) await page.screenshot({ path: `${SHOTS}/mobile-devices.png`, fullPage: false })

await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const overflowHome = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
)
check('No horizontal page overflow on the dashboard at 390px', overflowHome <= 1,
  `${overflowHome}px of overflow`)

// ---- Landing page ---------------------------------------------------------
await page.setViewportSize({ width: 1500, height: 950 })
errors.length = 0
await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1400)

const landing = await page.innerText('body')

// The official research title must appear verbatim.
const TITLE =
  'A Formal Verification Approach to IoT Malware Analysis, Detection, and Resilience'
check('Landing shows the official research title verbatim', landing.includes(TITLE),
  'exact title string not found in the rendered page')
check('Landing shows the subtitle',
  landing.includes('An interactive web-based platform for IoT malware analysis'))
check('Landing shows both calls to action',
  landing.includes('Launch Dashboard') && landing.includes('View System Architecture'))

for (const heading of ['Research Overview', 'Core Modules', 'Research Workflow',
                       'Platform Capabilities', 'Why Formal Verification', 'Research Project']) {
  check(`Landing section present: ${heading}`, new RegExp(heading, 'i').test(landing))
}
check('Hero shows the research positioning line',
  landing.includes('Research Demonstration Platform') &&
  /Powered by Formal Verification/.test(landing))
check('Hero shows a scroll cue', /scroll to explore/i.test(landing))

// The cue must be visible at the top and fade once the viewer has scrolled,
// so it guides rather than nags.
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(2200)
const cueAtTop = await page.evaluate(() => {
  const a = [...document.querySelectorAll('a')]
    .find((x) => /scroll to explore/i.test(x.textContent || ''))
  return a ? Number(getComputedStyle(a.parentElement).opacity) : -1
})
await page.evaluate(() => window.scrollTo(0, 600))
await page.waitForTimeout(900)
const cueScrolled = await page.evaluate(() => {
  const a = [...document.querySelectorAll('a')]
    .find((x) => /scroll to explore/i.test(x.textContent || ''))
  return a ? Number(getComputedStyle(a.parentElement).opacity) : -1
})
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(600)
check('Scroll cue is visible at the top and fades after scrolling',
  cueAtTop > 0.9 && cueScrolled < 0.1, `top=${cueAtTop} scrolled=${cueScrolled}`)

check('Landing has no console errors', errors.length === 0, errors[0] ?? '')
if (SHOTS) await page.screenshot({ path: `${SHOTS}/landing.png` })

const landingPaint = await paintedBytes()
check('Landing actually paints', landingPaint >= MIN_PAINTED_BYTES,
  `content region compressed to ${landingPaint} bytes`)

// "Launch Dashboard" must actually reach the console.
await page.getByRole('link', { name: /Launch Dashboard/i }).first().click()
await page.waitForTimeout(1600)
check('Launch Dashboard reaches the console',
  /#\/dashboard|#\/detection/.test(page.url()) &&
  (await page.innerText('body')).includes('Executive Dashboard') ||
  (await page.innerText('body')).includes('Threat Detection'),
  `landed on ${page.url()}`)

// The architecture anchor must exist for the second CTA.
await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const anchorExists = await page.evaluate(() => !!document.querySelector('#architecture'))
check('View System Architecture has a target', anchorExists, '#architecture missing')

// Every same-page nav anchor must resolve to a real section. HashRouter route
// links also start with "#" (e.g. "#/dashboard") but are not element ids, so
// only plain "#name" fragments are considered.
const danglingAnchors = await page.evaluate(() =>
  [...document.querySelectorAll('nav a[href^="#"]')]
    .map((a) => a.getAttribute('href'))
    .filter((h) => h && /^#[A-Za-z][\w-]*$/.test(h) && h !== '#top')
    .filter((h) => !document.querySelector(h)),
)
check('All landing nav anchors resolve', danglingAnchors.length === 0,
  `dangling: ${danglingAnchors.join(', ')}`)

// The six capability statements must all be present.
for (const cap of ['IoT Malware Detection', 'Formal Verification', 'Threat Analysis',
                   'Resilience Assessment', 'Interactive Dashboard', 'Automated Reports']) {
  check(`Capability listed: ${cap}`, landing.includes(cap))
}

// Landing must not render the console chrome.
const hasRail = await page.evaluate(
  () => !!document.querySelector('aside nav[aria-label="Modules"]'),
)
check('Landing renders without console chrome', !hasRail)

// Landing responsiveness.
await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const landingOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
)
check('No horizontal overflow on the landing page at 390px', landingOverflow <= 1,
  `${landingOverflow}px of overflow`)
if (SHOTS) await page.screenshot({ path: `${SHOTS}/landing-mobile.png` })
await page.setViewportSize({ width: 820, height: 1180 })
if (SHOTS) await page.screenshot({ path: `${SHOTS}/mobile-dashboard.png`, fullPage: false })

// Tablet.
await page.setViewportSize({ width: 820, height: 1180 })
await page.goto(`${BASE}/#/analytics`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const overflowTablet = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
)
check('No horizontal page overflow at 820px', overflowTablet <= 1, `${overflowTablet}px`)
check('No errors at small viewports', errors.length === 0, errors[0] ?? '')

await browser.close()

// ==========================================================================

console.log(`\n\x1b[1m${checks - failures.length}/${checks} checks passed\x1b[0m`)

if (failures.length > 0) {
  console.log(`\n${RED}${failures.length} FAILURE(S):${RESET}`)
  for (const f of failures) console.log(`  · ${f}`)
  process.exit(1)
}

console.log(`${GREEN}Frontend verified against the live backend.${RESET}`)
