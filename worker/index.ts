import { validatePublicSnapshot } from '../src/data/publicSnapshot'
import { login, callback, authorizedUser, logout } from './auth'
import type { OAuthEnv } from './auth'

interface Env extends OAuthEnv {
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

const isConfigured = (env: Env) =>
  Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_ALLOWED_USER_IDS && env.SESSION_STORE)

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    if (path === '/api/public/snapshot') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
      try {
        const raw = await env.PUBLIC_SNAPSHOT.get('current')
        if (!raw) return json({ error: 'Snapshot unavailable' }, 503)
        return json(validatePublicSnapshot(JSON.parse(raw) as unknown), 200, 'public, max-age=60')
      } catch {
        return json({ error: 'Snapshot unavailable' }, 503)
      }
    }
    if (path === '/login' || path === '/auth/callback' || path === '/logout') {
      if (!isConfigured(env)) return json({ error: 'Authentication not configured' }, 503)
      if (request.method !== 'GET' && path !== '/logout') return json({ error: 'Method not allowed' }, 405)
      if (path === '/login') return login(request, env)
      if (path === '/auth/callback') return callback(request, env)
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
      // A cross-origin form POST is not an authorized logout.
      if (request.headers.get('Origin') !== url.origin) return json({ error: 'Forbidden' }, 403)
      return logout(request, env)
    }
    if (path === '/app' || path.startsWith('/app/') || path.startsWith('/api/private/')) {
      if (!isConfigured(env)) return json({ error: 'Authentication not configured' }, 503)
      if (!await authorizedUser(request, env)) return json({ error: 'Unauthorized' }, 401)
      if (path.startsWith('/api/private/')) {
        // Do not serve private source data until the read-only adapter is implemented.
        return json({ error: 'Private data adapter not configured' }, 503)
      }
      // Authentication gates the route, but no private data is embedded in the static shell.
      const shell = new URL('/', request.url)
      const response = await env.ASSETS.fetch(new Request(shell, request))
      const headers = new Headers(response.headers)
      headers.set('Cache-Control', 'no-store')
      return new Response(response.body, { status: response.status, headers })
    }
    if (path.startsWith('/api/') || path.startsWith('/auth/')) return json({ error: 'Not found' }, 404)
    return env.ASSETS.fetch(request)
  },
}
