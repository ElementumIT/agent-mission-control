export const DEFAULT_PRIVATE_SOURCE_REPOSITORY = 'ElementumIT/el-ai-agent-workspace'

export type PrivateOverview = {
  generatedAt: string
  agents: Array<{ id: string, runtime: string, role: string }>
  tasks: Array<{ id: string, title: string, owner: string, status: string }>
  activity: Array<{ timestamp: string, revision: string }>
}

const failClosed = () => { throw new Error('Private overview unavailable') }
const scalar = (value: string) => value.trim().replace(/^(?:"([^"]*)"|'([^']*)')$/, '$1$2')

const decodeContent = (content: unknown) => {
  if (typeof content !== 'string') failClosed()
  try {
    const binary = atob(content.replaceAll(/\s/g, ''))
    return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
  } catch {
    failClosed()
  }
}

const parseAgents = (text: string) => {
  const agents: PrivateOverview['agents'] = []
  let current: Partial<PrivateOverview['agents'][number]> | undefined
  for (const line of text.split(/\r?\n/)) {
    const id = line.match(/^\s*- id:\s*(.+)$/)
    if (id) {
      if (current) agents.push(requireAgent(current))
      current = { id: scalar(id[1]) }
      continue
    }
    const field = line.match(/^\s{4}(runtime|role):\s*(.+)$/)
    if (current && field) current[field[1] as 'runtime' | 'role'] = scalar(field[2])
  }
  if (current) agents.push(requireAgent(current))
  if (!agents.length || new Set(agents.map((agent) => agent.id)).size !== agents.length) failClosed()
  return agents
}

const requireAgent = (agent: Partial<PrivateOverview['agents'][number]>) => {
  if (!agent.id || !agent.runtime || !agent.role) failClosed()
  return agent as PrivateOverview['agents'][number]
}

const parseTask = (text: string, state: string) => {
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!frontmatter) failClosed()
  const fields = Object.fromEntries(frontmatter[1].split(/\r?\n/).map((line) => {
    const match = line.match(/^([A-Za-z_]+):\s*(.+)$/)
    return match ? [match[1], scalar(match[2])] : []
  }).filter((entry) => entry.length))
  if (typeof fields.id !== 'string' || typeof fields.title !== 'string' || typeof fields.owner !== 'string' || fields.status !== state) failClosed()
  return { id: fields.id, title: fields.title, owner: fields.owner, status: state }
}

const githubRequest = async (path: string, token: string, fetcher: typeof fetch) => {
  const response = await fetcher(`https://api.github.com${path}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'agent-mission-control-private-overview' },
  })
  if (!response.ok) failClosed()
  return response.json() as Promise<unknown>
}

const readText = async (repository: string, branch: string, path: string, token: string, fetcher: typeof fetch) => {
  const response = await githubRequest(`/repos/${repository}/contents/${path}?ref=${encodeURIComponent(branch)}`, token, fetcher) as { type?: string, encoding?: string, content?: unknown }
  if (response.type !== 'file' || response.encoding !== 'base64') failClosed()
  return decodeContent(response.content)
}

export async function collectPrivateOverview({
  token,
  repository = DEFAULT_PRIVATE_SOURCE_REPOSITORY,
  branch = 'main',
  fetcher = fetch,
  generatedAt = new Date().toISOString(),
}: { token?: string, repository?: string, branch?: string, fetcher?: typeof fetch, generatedAt?: string } = {}): Promise<PrivateOverview> {
  if (!token?.trim() || !repository.trim() || !branch.trim()) failClosed()
  const encodedBranch = encodeURIComponent(branch)
  const [treeResponse, registryText, commitResponse] = await Promise.all([
    githubRequest(`/repos/${repository}/git/trees/${encodedBranch}?recursive=1`, token, fetcher),
    readText(repository, branch, 'agents/registry.yaml', token, fetcher),
    githubRequest(`/repos/${repository}/commits?path=tasks&sha=${encodedBranch}&per_page=10`, token, fetcher),
  ])
  const tree = (treeResponse as { truncated?: boolean, tree?: Array<{ type?: string, path?: string }> }).tree
  if ((treeResponse as { truncated?: boolean }).truncated || !Array.isArray(tree)) failClosed()
  const tasks = tree.filter((entry) => entry.type === 'blob' && /^tasks\/(pending|in-progress|completed)\/[^/]+\.md$/.test(entry.path ?? '')).sort((a, b) => (a.path ?? '').localeCompare(b.path ?? ''))
  const parsedTasks = await Promise.all(tasks.map(async (entry) => {
    const [, state] = (entry.path ?? '').match(/^tasks\/([^/]+)\//) ?? []
    if (!state || !entry.path) failClosed()
    return parseTask(await readText(repository, branch, entry.path, token, fetcher), state)
  }))
  const commits = commitResponse as Array<{ sha?: string, commit?: { author?: { date?: string } } }>
  if (!Array.isArray(commits) || commits.some((commit) => typeof commit.sha !== 'string' || typeof commit.commit?.author?.date !== 'string')) failClosed()
  return {
    generatedAt,
    agents: parseAgents(registryText),
    tasks: parsedTasks,
    activity: commits.map((commit) => ({ timestamp: new Date(commit.commit!.author!.date!).toISOString(), revision: commit.sha!.slice(0, 7) })),
  }
}
