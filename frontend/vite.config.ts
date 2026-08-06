import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * IoTShield Verify — frontend build configuration.
 *
 * Tailwind is wired through PostCSS (see postcss.config.js) rather than a Vite
 * plugin, matching the Tailwind v3 toolchain. The app talks to the FastAPI
 * service directly over CORS using VITE_API_BASE, so no dev proxy is needed —
 * that keeps the built bundle host-agnostic, which is what HashRouter assumes.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        // Keep the heavy visualisation libraries out of the entry chunk so the
        // shell paints before React Flow / Recharts are parsed. Rolldown (the
        // bundler behind Vite 8) takes the function form only.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('@xyflow')) return 'flow'
          if (id.includes('framer-motion') || id.includes('motion-dom')) return 'motion'
          if (id.includes('react-router')) return 'router'
        },
      },
    },
  },
})
