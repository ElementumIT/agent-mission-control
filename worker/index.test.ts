import assert from 'node:assert/strict'
import { test } from 'node:test'
import worker from './index.ts'

const configuredEnv = (snapshot = null) => ({
  ASSETS: { fetch: async () => new Response('<html>app</html>', { headers: { 'Content-Type': 'text/html' } }) },
  PUBLIC_SNAPSHOT: { get: async () => snapshot },
  SESSION_STORE: { put: async () => {}, get: async () => null, delete: async () => {} },
  GITHUB_CLIENT_ID: 'fictional-client-id',
  GITHUB_CLIENT_SECRET: 'fictional-client-secret',
  GITHUB_ALLOWED_USER_IDS: '12345',
  SESSION_SECRET: 'fictional-session-secret',
  PUBLIC_ORIGIN: 'https://preview.example.workers.dev',
})

test('public snapshot fails closed when KV is empty', async () => {
  const response = await worker.fetch(new Request('https://preview.example.workers.dev/api/public/snapshot'), configuredEnv())
  assert.equal(response.status, 503)
  assert.equal(await response.text(), JSON.stringify({ error: 'Snapshot unavailable' }))
})

test('public snapshot rejects invalid KV data without exposing it', async () => {
  const response = await worker.fetch(
    new Request('https://preview.example.workers.dev/api/public/snapshot'),
    configuredEnv(JSON.stringify({ schemaVersion: 1, privatePath: '/secret' })),
  )
  assert.equal(response.status, 503)
  assert.equal((await response.text()).includes('secret'), false)
})

test('private routes deny unauthenticated requests', async () => {
  for (const path of ['/app', '/app/dashboard', '/api/private/overview']) {
    const response = await worker.fetch(new Request(`https://preview.example.workers.dev${path}`), configuredEnv())
    assert.equal(response.status, 401, path)
  }
})

test('authentication routes fail closed when not configured', async () => {
  const env = configuredEnv()
  env.GITHUB_CLIENT_SECRET = ''
  const response = await worker.fetch(new Request('https://preview.example.workers.dev/login'), env)
  assert.equal(response.status, 503)
})

test('callback rejects missing state and code', async () => {
  const response = await worker.fetch(new Request('https://preview.example.workers.dev/auth/callback'), configuredEnv())
  assert.equal(response.status, 400)
})

test('logout accepts only a same-origin form post', async () => {
  const env = configuredEnv()
  const getResponse = await worker.fetch(new Request('https://preview.example.workers.dev/logout'), env)
  assert.equal(getResponse.status, 405)
  const postResponse = await worker.fetch(new Request('https://preview.example.workers.dev/logout', {
    method: 'POST', headers: { Origin: 'https://preview.example.workers.dev' },
  }), env)
  assert.equal(postResponse.status, 303)
  assert.equal(postResponse.headers.get('Location'), 'https://preview.example.workers.dev/')
})

test('login redirects with an OAuth state cookie', async () => {
  const response = await worker.fetch(new Request('https://preview.example.workers.dev/login'), configuredEnv())
  assert.equal(response.status, 302)
  assert.match(response.headers.get('Location') ?? '', /^https:\/\/github\.com\/login\/oauth\/authorize\?/)
  assert.match(response.headers.get('Set-Cookie') ?? '', /^oauth_state=[a-f0-9]{64};/)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
})
