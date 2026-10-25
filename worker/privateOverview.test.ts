import assert from 'node:assert/strict'
import { test } from 'node:test'
import { collectPrivateOverview } from './privateOverview.ts'

const encoded = (value: string) => Buffer.from(value).toString('base64')
const registry = 'agents:\n  - id: CodexLenovo\n    runtime: codex\n    role: coordinator\n    inbox: inbox/private\n'
const task = '---\nid: "0005"\ntitle: Private overview\nowner: CodexLenovo\nstatus: pending\n---\n# Goal\nPrivate details must not leak.\n'

test('collects only the approved private overview fields', async () => {
  const fetcher = async (input: string | URL | Request) => {
    const url = String(input)
    if (url.includes('/git/trees/')) return Response.json({ tree: [{ type: 'blob', path: 'tasks/pending/0005.md' }] })
    if (url.includes('agents/registry.yaml')) return Response.json({ type: 'file', encoding: 'base64', content: encoded(registry) })
    if (url.includes('tasks/pending/0005.md')) return Response.json({ type: 'file', encoding: 'base64', content: encoded(task) })
    if (url.includes('/commits?')) return Response.json([{ sha: '123456789abcdef', commit: { author: { date: '2026-10-25T00:00:00.000Z' } } }])
    return new Response(null, { status: 404 })
  }
  const overview = await collectPrivateOverview({ token: 'fictional-token', repository: 'fictional/private-repo', fetcher: fetcher as typeof fetch, generatedAt: '2026-10-25T01:00:00.000Z' })
  assert.deepEqual(overview, { generatedAt: '2026-10-25T01:00:00.000Z', agents: [{ id: 'CodexLenovo', runtime: 'codex', role: 'coordinator' }], tasks: [{ id: '0005', title: 'Private overview', owner: 'CodexLenovo', status: 'pending' }], activity: [{ timestamp: '2026-10-25T00:00:00.000Z', revision: '1234567' }] })
  assert.equal(JSON.stringify(overview).includes('inbox'), false)
  assert.equal(JSON.stringify(overview).includes('Private details'), false)
})

test('fails closed on an incomplete task record', async () => {
  const fetcher = async (input: string | URL | Request) => {
    const url = String(input)
    if (url.includes('/git/trees/')) return Response.json({ tree: [{ type: 'blob', path: 'tasks/pending/0005.md' }] })
    if (url.includes('agents/registry.yaml')) return Response.json({ type: 'file', encoding: 'base64', content: encoded(registry) })
    if (url.includes('tasks/pending/0005.md')) return Response.json({ type: 'file', encoding: 'base64', content: encoded('---\nid: 0005\n---') })
    if (url.includes('/commits?')) return Response.json([])
    return new Response(null, { status: 404 })
  }
  await assert.rejects(() => collectPrivateOverview({ token: 'fictional-token', fetcher: fetcher as typeof fetch }), /Private overview unavailable/)
})

test('fails closed when a task status disagrees with its directory', async () => {
  const fetcher = async (input: string | URL | Request) => {
    const url = String(input)
    if (url.includes('/git/trees/')) return Response.json({ tree: [{ type: 'blob', path: 'tasks/pending/0005.md' }] })
    if (url.includes('agents/registry.yaml')) return Response.json({ type: 'file', encoding: 'base64', content: encoded(registry) })
    if (url.includes('tasks/pending/0005.md')) return Response.json({ type: 'file', encoding: 'base64', content: encoded(task.replace('status: pending', 'status: completed')) })
    if (url.includes('/commits?')) return Response.json([])
    return new Response(null, { status: 404 })
  }
  await assert.rejects(() => collectPrivateOverview({ token: 'fictional-token', fetcher: fetcher as typeof fetch }), /Private overview unavailable/)
})
