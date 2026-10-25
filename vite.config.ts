import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Keep GitHub Pages' subpath build by default; Cloudflare uses the root path.
  base: process.env.CLOUDFLARE_BUILD === '1' ? '/' : '/agent-mission-control/',
  plugins: [react()],
})
