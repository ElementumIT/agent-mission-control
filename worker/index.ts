// Public-only foundation. No GitHub token or private data bindings are used here.
import { validatePublicSnapshot } from '../src/data/publicSnapshot'

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  PUBLIC_SNAPSHOT: { get(key: string): Promise<string | null> }
}

const json = (body: unknown, status: number, cacheControl = 'no-store') =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    },
  })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/public/snapshot') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
      try {
        const raw = await env.PUBLIC_SNAPSHOT.get('current')
        if (!raw) return json({ error: 'Snapshot unavailable' }, 503)
        const snapshot = validatePublicSnapshot(JSON.parse(raw) as unknown)
        return json(snapshot, 200, 'public, max-age=60')
      } catch {
        // Never expose storage contents or fall back to fictional values.
        return json({ error: 'Snapshot unavailable' }, 503)
      }
    }
    if (url.pathname.startsWith('/api/private/') || url.pathname === '/app' || url.pathname.startsWith('/app/')) {
      // Fail closed until GitHub OAuth and authorization are implemented.
      return json({ error: 'Authentication not configured' }, 401)
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404)
    return env.ASSETS.fetch(request)
  },
}
