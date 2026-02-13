import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AgentProvider } from './contexts/AgentContext'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AgentProvider>
          <App />
        </AgentProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
