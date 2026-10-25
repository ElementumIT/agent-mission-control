import { useEffect, useState } from 'react'
import { fetchPublicSnapshot, type PublicSnapshot } from './data/publicSnapshot.ts'

export default function PublicSummary() {
  const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(null)

  useEffect(() => {
    let active = true
    void fetchPublicSnapshot().then((value) => active && setSnapshot(value)).catch(() => active && setSnapshot(null))
    return () => { active = false }
  }, [])

  const counts = snapshot?.taskCounts
  return <section className="public-summary" aria-live="polite">
    <strong>Live public snapshot</strong>
    {counts
      ? <span>{snapshot.registeredAgentCount} registered agents · {counts.pending} pending · {counts.inProgress} in progress · {counts.completed} completed · Updated {new Date(snapshot.generatedAt).toLocaleString()}</span>
      : <span>Public snapshot unavailable</span>}
  </section>
}
