/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built assets resolve correctly whether served from the
  // repo root or a GitHub Pages subpath (/padel-booking/) — no repo name hardcoded,
  // and no effect on local dev (npm run dev still serves from /).
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
