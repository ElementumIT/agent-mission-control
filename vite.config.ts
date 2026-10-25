import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Keep GitHub Pages' subpath build by default; Cloudflare uses the root path.
  base: mode === 'cloudflare' ? '/' : '/agent-mission-control/',
  plugins: [react()],
}))
