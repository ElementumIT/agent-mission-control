import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSnapshotFromPrivateMetadata, collectPublicSnapshot } from './collect-public-snapshot.mjs'

const registry = `agents:\n  - id: agent-a\n  - id: HermesMinisforum\n  - id: CodexLenovo\n`
const tree = [
  { type: 'tree', path: 'tasks/pending' },
  { type: 'tree', path: 'tasks/in-progress' },
  { type: 'tree', path: 'tasks/completed' },
  { type: 'blob', path: 'tasks/pending/0005.md' },
  { type: 'blob', path: 'tasks/pending/.gitkeep' },
  { type: 'blob', path: 'tasks/in-progress/0006.md' },
  { type: 'blob', path: 'tasks/completed/0001.md' },
  { type: 'blob', path: 'tasks/completed/0002.md' },
  { type: 'blob', path: 'inbox/HermesMinisforum/private-message.md' },
]

test('builds only the strict aggregate snapshot from fictional metadata', () => {
  const snapshot = buildSnapshotFromPrivateMetadata({
    registryText: registry,
    tree,
    generatedAt: '2026-10-25T10:00:00.000Z',
  })
  assert.deepEqual(snapshot, {
    schemaVersion: 1,
    generatedAt: '2026-10-25T10:00:00.000Z',
    registeredAgentCount: 3,
    taskCounts: { pending: 1, inProgress: 1, completed: 2 },
  })
  assert.deepEqual(Object.keys(snapshot).sort(), ['generatedAt', 'registeredAgentCount', 'schemaVersion', 'taskCounts'])
  assert.deepEqual(Object.keys(snapshot.taskCounts).sort(), ['completed', 'inProgress', 'pending'])
  assert.equal(JSON.stringify(snapshot).includes('private-message'), false)
})

test('fails closed when metadata is incomplete or ambiguous', () => {
  assert.throws(() => buildSnapshotFromPrivateMetadata({ registryText: registry, tree: tree.filter((entry) => !entry.path.startsWith('tasks/completed/')) }), /failed closed/)
  assert.throws(() => buildSnapshotFromPrivateMetadata({ registryText: 'agents:\n', tree }), /failed closed/)
  assert.throws(() => buildSnapshotFromPrivateMetadata({ registryText: registry, tree, generatedAt: 'not-a-timestamp' }), /failed closed/)
})

test('collector requests only the registry file and recursive tree', async () => {
  const requests = []
  const fetcher = async (url) => {
    requests.push(url)
    if (url.includes('/contents/agents/registry.yaml')) {
      return new Response(JSON.stringify({ type: 'file', encoding: 'base64', content: Buffer.from(registry).toString('base64') }), { status: 200 })
    }
    return new Response(JSON.stringify({ truncated: false, tree }), { status: 200 })
  }
  const snapshot = await collectPublicSnapshot({ token: 'fictional-token', repository: 'fictional/private-repo', fetcher, generatedAt: '2026-10-25T10:00:00.000Z' })
  assert.equal(snapshot.registeredAgentCount, 3)
  assert.equal(requests.length, 2)
  assert.equal(requests.some((url) => url.includes('/git/trees/main?recursive=1')), true)
  assert.equal(requests.some((url) => url.includes('/contents/agents/registry.yaml?ref=main')), true)
})

test('collector fails closed on an incomplete GitHub response', async () => {
  const fetcher = async () => new Response(JSON.stringify({ truncated: true, tree: [] }), { status: 200 })
  await assert.rejects(() => collectPublicSnapshot({ token: 'fictional-token', repository: 'fictional/private-repo', fetcher }), /failed closed/)
})
