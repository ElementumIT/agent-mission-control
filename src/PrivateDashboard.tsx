import { useEffect, useState } from 'react'

type Overview = {
  generatedAt: string
  agents: Array<{ id: string, runtime: string, role: string }>
  tasks: Array<{ id: string, title: string, owner: string, status: string }>
  activity: Array<{ timestamp: string, revision: string }>
}

export default function PrivateDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch('/api/private/overview').then(async (response) => {
      if (!response.ok) throw new Error('Private data is unavailable.')
      return response.json() as Promise<Overview>
    }).then(setOverview).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Private data is unavailable.'))
  }, [])
  if (error) return <main className="private-overview"><h1>Private Mission Control</h1><p role="alert">{error}</p></main>
  if (!overview) return <main className="private-overview"><h1>Private Mission Control</h1><p>Loading approved workspace data…</p></main>
  return <main className="private-overview"><header><div><h1>Private Mission Control</h1><p>Approved read-only workspace data</p></div><time>Updated {new Date(overview.generatedAt).toLocaleString()}</time></header><section><h2>Agents</h2><ul>{overview.agents.map((agent) => <li key={agent.id}><strong>{agent.id}</strong><span>{agent.runtime} · {agent.role}</span></li>)}</ul></section><section><h2>Tasks</h2><ul>{overview.tasks.map((task) => <li key={task.id}><strong>{task.id}: {task.title}</strong><span>{task.status} · owner: {task.owner}</span></li>)}</ul></section><section><h2>Recent task updates</h2><ul>{overview.activity.map((entry) => <li key={entry.revision}><strong>{entry.revision}</strong><span>{new Date(entry.timestamp).toLocaleString()}</span></li>)}</ul></section></main>
}
