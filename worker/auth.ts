/**
 * GitHub OAuth helpers for Cloudflare Workers.
 * Does not expose access tokens to the browser or bundle secrets in static assets.
 */
export interface OAuthEnv {
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  GITHUB_ALLOWED_USER_IDS: string
  SESSION_SECRET: string
  PUBLIC_ORIGIN: string
  SESSION_STORE: {
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
    get(key: string): Promise<string | null>
    delete(key: string): Promise<void>
  }
}

const encoder = new TextEncoder()
const hex = (bytes: Uint8Array) => [...bytes].map((v) => v.toString(16).padStart(2, '0')).join('')
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)))
const json = (data: unknown, status: number) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
})
const cookie = (name: string, value: string, maxAge: number) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
const parseCookie = (request: Request, name: string) =>
  request.headers.get('Cookie')?.split(';').map((x) => x.trim()).find((x) => x.startsWith(`${name}=`))?.slice(name.length + 1)

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function login(request: Request, env: OAuthEnv): Promise<Response> {
  const state = randomToken()
  const verifier = randomToken() + randomToken()
  const callback = new URL('/auth/callback', env.PUBLIC_ORIGIN).toString()
  await env.SESSION_STORE.put(`oauth:${state}`, JSON.stringify({ verifier, callback }), { expirationTtl: 600 })
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID, redirect_uri: callback, state,
    code_challenge: await sha256(verifier), code_challenge_method: 'S256',
  })
  const response = Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302)
  response.headers.set('Set-Cookie', cookie('oauth_state', state, 600))
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function callback(request: Request, env: OAuthEnv): Promise<Response> {
  const url = new URL(request.url)
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  if (!state || !code || !/^[a-f0-9]{64}$/.test(state) || parseCookie(request, 'oauth_state') !== state) {
    return json({ error: 'Invalid OAuth state' }, 400)
  }
  const key = `oauth:${state}`
  const transaction = await env.SESSION_STORE.get(key)
  if (!transaction) return json({ error: 'OAuth transaction expired' }, 400)
  await env.SESSION_STORE.delete(key)
  const { verifier, callback: redirectUri } = JSON.parse(transaction) as { verifier: string; callback: string }
  const exchange = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET,
      code, redirect_uri: redirectUri, code_verifier: verifier,
    }),
  })
  if (!exchange.ok) return json({ error: 'OAuth exchange failed' }, 502)
  const tokenResult = await exchange.json() as { access_token?: string }
  if (!tokenResult.access_token) return json({ error: 'OAuth token unavailable' }, 401)
  const profile = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenResult.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'agent-mission-control' },
  })
  if (!profile.ok) return json({ error: 'GitHub profile unavailable' }, 502)
  const user = await profile.json() as { id?: number }
  const allowed = env.GITHUB_ALLOWED_USER_IDS.split(',').map((x) => x.trim()).filter(Boolean)
  if (!user.id || !allowed.includes(String(user.id))) return json({ error: 'Not authorized' }, 403)
  const sessionId = randomToken()
  // Store only verified identity; never retain the OAuth access token.
  await env.SESSION_STORE.put(`session:${await sha256(sessionId)}`, String(user.id), { expirationTtl: 28800 })
  const response = Response.redirect(new URL('/app', env.PUBLIC_ORIGIN).toString(), 302)
  response.headers.append('Set-Cookie', cookie('oauth_state', '', 0))
  response.headers.append('Set-Cookie', cookie('mission_session', sessionId, 28800))
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function authorizedUser(request: Request, env: OAuthEnv): Promise<string | null> {
  const session = parseCookie(request, 'mission_session')
  if (!session || !/^[a-f0-9]{64}$/.test(session)) return null
  const userId = await env.SESSION_STORE.get(`session:${await sha256(session)}`)
  if (!userId) return null
  return env.GITHUB_ALLOWED_USER_IDS.split(',').map((x) => x.trim()).includes(userId) ? userId : null
}

export async function logout(request: Request, env: OAuthEnv): Promise<Response> {
  const session = parseCookie(request, 'mission_session')
  if (session && /^[a-f0-9]{64}$/.test(session)) {
    await env.SESSION_STORE.delete(`session:${await sha256(session)}`)
  }
  const response = Response.redirect(new URL('/', env.PUBLIC_ORIGIN).toString(), 303)
  response.headers.set('Set-Cookie', cookie('mission_session', '', 0))
  response.headers.set('Cache-Control', 'no-store')
  return response
}
