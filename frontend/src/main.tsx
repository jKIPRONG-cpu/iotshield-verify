/**
 * Application entry point.
 *
 * Fonts are self-hosted through @fontsource so the console renders identically
 * with no network access — a demonstration should never depend on a CDN.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/inter'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@xyflow/react/dist/style.css'
import './index.css'

import { App } from './App'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root container #root is missing from index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
