import { buildPublicSnapshot } from '../src/data/publicSnapshot.ts'

export const DEFAULT_SOURCE_REPOSITORY = 'ElementumIT/el-ai-agent-workspace'
const TASK_STATES = ['pending', 'in-progress', 'completed']

const failClosed = (message) => {
  throw new Error(`Snapshot collection failed closed: ${message}`)
}

const requireNonEmpty = (value, name) => {
  if (typeof value !== 'string' || value.trim() === '') failClosed(`${name} is missing`)
  return value.trim()
}

const parseRegisteredAgentCount = (registryText) => {
  if (typeof registryText !== 'string') failClosed('registry is not text')
  const ids = [...registryText.matchAll(/^\s*- id:\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\s*$/gm)]
    .map((match) => match[1] ?? match[2] ?? match[3])
  if (ids.length === 0 || new Set(ids).size !== ids.length) failClosed('registry has no unique registered agents')
  return ids.length
}

const taskCount = (tree, state) => {
  const prefix = `tasks/${state}/`
  return tree.filter((entry) => entry.type === 'blob' && entry.path.startsWith(prefix) && entry.path.endsWith('.md') && !entry.path.endsWith('/.gitkeep')).length
}

/**
 * Convert private GitHub metadata into the public DTO. The input is deliberately
 * limited to a tree listing and registry text; raw GitHub objects never leave
 * this function and are not returned in errors or logs.
 */
export function buildSnapshotFromPrivateMetadata({ registryText, tree, generatedAt }) {
  if (!Array.isArray(tree)) failClosed('repository tree is incomplete')
  if (!TASK_STATES.every((state) => tree.some((entry) => entry?.path?.startsWith(`tasks/${state}/`)))) {
    failClosed('required task state directory is missing')
  }
  const counts = Object.fromEntries(TASK_STATES.map((state) => [state, taskCount(tree, state)]))
  try {
    return buildPublicSnapshot({
      registeredAgentCount: parseRegisteredAgentCount(registryText),
      generatedAt,
      taskCounts: {
        pending: counts.pending,
        inProgress: counts['in-progress'],
        completed: counts.completed,
      },
    })
  } catch (error) {
    failClosed(error instanceof Error ? error.message : 'snapshot validation failed')
  }
}

const githubRequest = async (path, token, fetcher) => {
  const response = await fetcher(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'agent-mission-control-snapshot-collector',
    },
  })
  if (!response.ok) failClosed(`GitHub request failed (${response.status})`)
  return response.json()
}

const readRegistry = async (repo, branch, token, fetcher) => {
  const content = await githubRequest(`/repos/${repo}/contents/agents/registry.yaml?ref=${encodeURIComponent(branch)}`, token, fetcher)
  if (content?.type !== 'file' || typeof content.content !== 'string' || content.encoding !== 'base64') failClosed('registry response is not a base64 file')
  return Buffer.from(content.content.replaceAll('\n', ''), 'base64').toString('utf8')
}

export async function collectPublicSnapshot({
  token = process.env.GITHUB_TOKEN,
  repository = process.env.PRIVATE_SOURCE_REPOSITORY ?? DEFAULT_SOURCE_REPOSITORY,
  branch = process.env.PRIVATE_SOURCE_BRANCH ?? 'main',
  generatedAt = new Date().toISOString(),
  fetcher = fetch,
} = {}) {
  requireNonEmpty(token, 'GITHUB_TOKEN')
  requireNonEmpty(repository, 'PRIVATE_SOURCE_REPOSITORY')
  requireNonEmpty(branch, 'PRIVATE_SOURCE_BRANCH')
  const encodedBranch = encodeURIComponent(branch)
  const [treeResponse, registryText] = await Promise.all([
    githubRequest(`/repos/${repository}/git/trees/${encodedBranch}?recursive=1`, token, fetcher),
    readRegistry(repository, branch, token, fetcher),
  ])
  if (treeResponse?.truncated || !Array.isArray(treeResponse?.tree)) failClosed('repository tree is truncated or missing')
  return buildSnapshotFromPrivateMetadata({ registryText, tree: treeResponse.tree, generatedAt })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  collectPublicSnapshot().then((snapshot) => {
    process.stdout.write(`${JSON.stringify(snapshot)}\n`)
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
