import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PublicSummary from './PublicSummary.tsx'
import PrivateLogout from './PrivateLogout.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PublicSummary />
    <PrivateLogout />
    <App />
  </StrictMode>,
)
