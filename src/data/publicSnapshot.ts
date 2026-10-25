/**
 * The only data shape that may cross the public API boundary.
 *
 * Keep this deliberately small: the public dashboard needs aggregate counts and
 * freshness only. Private GitHub records must be read and rendered server-side.
 */
export const PUBLIC_SNAPSHOT_SCHEMA_VERSION = 1 as const

const SNAPSHOT_KEYS = [
  'schemaVersion',
  'generatedAt',
  'registeredAgentCount',
  'taskCounts',
] as const

const TASK_COUNT_KEYS = ['pending', 'inProgress', 'completed'] as const

export type TaskCounts = {
  pending: number
  inProgress: number
  completed: number
}

export type PublicSnapshot = {
  schemaVersion: typeof PUBLIC_SNAPSHOT_SCHEMA_VERSION
  generatedAt: string
  registeredAgentCount: number
  taskCounts: TaskCounts
}

export type PublicSnapshotSource = {
  registeredAgentCount: number
  taskCounts: TaskCounts
  generatedAt?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

const isIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false
  }

  const parsed = new Date(value)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value
}

/**
 * Validate untrusted JSON before returning it from the public API.
 * Extra fields are rejected so a future private field cannot silently leak.
 */
export function validatePublicSnapshot(value: unknown): PublicSnapshot {
  if (!isRecord(value) || !hasExactKeys(value, SNAPSHOT_KEYS)) {
    throw new Error('Invalid public snapshot shape')
  }

  if (value.schemaVersion !== PUBLIC_SNAPSHOT_SCHEMA_VERSION || !isIsoTimestamp(value.generatedAt)) {
    throw new Error('Invalid public snapshot metadata')
  }

  if (!isNonNegativeInteger(value.registeredAgentCount) || !isRecord(value.taskCounts)) {
    throw new Error('Invalid public snapshot counts')
  }

  const taskCounts = value.taskCounts as TaskCounts
  if (!hasExactKeys(taskCounts, TASK_COUNT_KEYS) || !TASK_COUNT_KEYS.every((key) => isNonNegativeInteger(taskCounts[key]))) {
    throw new Error('Invalid public snapshot task counts')
  }

  return {
    schemaVersion: PUBLIC_SNAPSHOT_SCHEMA_VERSION,
    generatedAt: value.generatedAt,
    registeredAgentCount: value.registeredAgentCount,
    taskCounts: {
      pending: taskCounts.pending,
      inProgress: taskCounts.inProgress,
      completed: taskCounts.completed,
    },
  }
}

/**
 * Build the allowlisted public payload from already-aggregated private data.
 * Callers should aggregate GitHub/workspace records before invoking this.
 */
export function buildPublicSnapshot(source: PublicSnapshotSource): PublicSnapshot {
  return validatePublicSnapshot({
    schemaVersion: PUBLIC_SNAPSHOT_SCHEMA_VERSION,
    generatedAt: source.generatedAt ?? new Date().toISOString(),
    registeredAgentCount: source.registeredAgentCount,
    taskCounts: source.taskCounts,
  })
}

/**
 * Fetch and validate the public snapshot. This endpoint must never proxy
 * arbitrary GitHub objects or accept a caller-selected resource path.
 */
export async function fetchPublicSnapshot(endpoint = '/api/public/snapshot', fetcher: typeof fetch = fetch): Promise<PublicSnapshot> {
  const response = await fetcher(endpoint, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`Public snapshot request failed (${response.status})`)
  }
  return validatePublicSnapshot(await response.json())
}
