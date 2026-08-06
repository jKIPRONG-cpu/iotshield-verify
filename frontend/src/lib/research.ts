/**
 * Canonical research metadata.
 *
 * The official title is defined here exactly once and imported everywhere it
 * appears — the hero headline, the landing navigation, the footer, the console
 * footer, and the document title. Retyping it in each component is how a title
 * quietly drifts between screens; a single exported constant makes that
 * impossible.
 *
 * Do not reword, shorten, or reformat RESEARCH_TITLE.
 */

/** The official research title. Reproduced verbatim wherever it appears. */
export const RESEARCH_TITLE =
  'A Formal Verification Approach to IoT Malware Analysis, Detection, and Resilience' as const

/** The subtitle shown beneath the title in the hero. */
export const RESEARCH_SUBTITLE =
  'An interactive web-based platform for IoT malware analysis, formal verification, cyber threat detection, and resilience evaluation using realistic simulation environments.' as const

/** Product name, used for the console chrome and the browser tab. */
export const PRODUCT_NAME = 'IoTShield Verify' as const

/** Short descriptor used under the product name in navigation. */
export const PRODUCT_TAGLINE = 'Formal Verification Platform' as const
