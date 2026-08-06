/**
 * Landing page.
 *
 * Deliberately thin: it composes the sections in order and owns nothing else.
 * Each section is self-contained in `components/landing/`, so this file reads
 * as the page outline.
 *
 * Rendered outside the console shell — no sidebar, no top bar — so the hero is
 * full-bleed and the page reads as a product entry point rather than another
 * module.
 */

import { useEffect } from 'react'
import { Capabilities } from '@/components/landing/Capabilities'
import { CoreModules } from '@/components/landing/CoreModules'
import { Hero } from '@/components/landing/Hero'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingNav } from '@/components/landing/LandingNav'
import { ResearchOverview } from '@/components/landing/ResearchOverview'
import { ResearchWorkflow } from '@/components/landing/ResearchWorkflow'
import { WhyFormalVerification } from '@/components/landing/WhyFormalVerification'
import { PRODUCT_NAME, RESEARCH_TITLE } from '@/lib/research'

export default function Landing() {
  useEffect(() => {
    document.title = `${PRODUCT_NAME} — ${RESEARCH_TITLE}`

    // Arriving from an in-app link would otherwise preserve the console's
    // scroll offset and drop the viewer into the middle of the page.
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  return (
    <div className="relative min-h-svh bg-navy-900">
      <LandingNav />

      <main>
        <Hero />
        <ResearchOverview />
        <CoreModules />
        <ResearchWorkflow />
        <Capabilities />
        <WhyFormalVerification />
      </main>

      <LandingFooter />
    </div>
  )
}
