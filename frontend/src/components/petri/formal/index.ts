/**
 * Formal model — public surface.
 *
 * Re-exports the colour set, the executable net, the checker and the property
 * set so both the application and `tools/verify_model.mjs` import from one
 * place.
 */

export * from './colour'
export * from './net'
export * from './check'
export * from './properties'
export * from './scenarios'
