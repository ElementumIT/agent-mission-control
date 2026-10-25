import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchPublicSnapshot, validatePublicSnapshot } from './publicSnapshot.ts'

const validSnapshot = () => ({
  schemaVersion: 1,
  generatedAt: '2026-10-25T08:00:00.000Z',
  registeredAgentCount: 3,
  taskCounts: { pending: 1, inProgress: 2, completed: 4 },
})

const assertInvalid = (mutate: (snapshot: Record<string, unknown>) => void) => {
  const snapshot = validSnapshot() as unknown as Record<string, unknown>
  mutate(snapshot)
  assert.throws(() => validatePublicSnapshot(snapshot), /Invalid public snapshot/)
}

test('accepts a valid canonical UTC snapshot', () => {
  assert.deepEqual(validatePublicSnapshot(validSnapshot()), validSnapshot())
})

test('rejects extra top-level and nested fields', () => {
  assertInvalid((snapshot) => { snapshot.extra = true })
  assertInvalid((snapshot) => {
    ;(snapshot.taskCounts as Record<string, unknown>).extra = 1
  })
})

test('rejects missing fields and invalid schema versions', () => {
  assertInvalid((snapshot) => { delete snapshot.generatedAt })
  assertInvalid((snapshot) => { snapshot.schemaVersion = 2 })
  assertInvalid((snapshot) => { delete (snapshot.taskCounts as Record<string, unknown>).completed })
})

test('rejects noncanonical, invalid, and normalized-over timestamps', () => {
  for (const timestamp of [
    '2026-10-25T08:00:00Z',
    '2026-10-25T08:00:00.00Z',
    '2026-10-25T08:00:00.000+00:00',
    '2026-02-30T08:00:00.000Z',
    '2026-10-25T25:00:00.000Z',
  ]) {
    assertInvalid((snapshot) => { snapshot.generatedAt = timestamp })
  }
})

test('rejects negative, fractional, unsafe, and nonnumeric counts', () => {
  for (const count of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '2']) {
    assertInvalid((snapshot) => { snapshot.registeredAgentCount = count })
  }
  assertInvalid((snapshot) => {
    ;(snapshot.taskCounts as Record<string, unknown>).pending = -1
  })
  assertInvalid((snapshot) => {
    ;(snapshot.taskCounts as Record<string, unknown>).inProgress = 1.5
  })
})

test('fetches only a validated public snapshot', async () => {
  const snapshot = await fetchPublicSnapshot('/api/public/snapshot', async () => new Response(JSON.stringify(validSnapshot())))
  assert.deepEqual(snapshot, validSnapshot())
})
