import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PublicSummary from './PublicSummary.tsx'
import PrivateLogout from './PrivateLogout.tsx'
import PrivateDashboard from './PrivateDashboard.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname.startsWith('/app') ? <><PrivateLogout /><PrivateDashboard /></> : <><PublicSummary /><App /></>}
  </StrictMode>,
)
