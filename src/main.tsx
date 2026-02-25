import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AgentProvider } from './contexts/AgentContext'
import { CrewOSDashboard } from './components/crewos/CrewOSDashboard'
import { LandingPage } from './components/landing/LandingPage'

function AppRouter() {
  const navigate = useNavigate();
  const location = useLocation();

  // Manage body overflow based on route
  useEffect(() => {
    const root = document.getElementById('root')!;
    if (location.pathname === '/') {
      // Landing page - allow body scroll
      document.body.classList.remove('dashboard-active');
      root.classList.remove('dashboard-active');
    } else {
      // Dashboard - prevent body scroll and use flex layout
      document.body.classList.add('dashboard-active');
      root.classList.add('dashboard-active');
    }
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage onGetStarted={() => navigate('/dashboard')} />} />
      <Route path="/*" element={<CrewOSDashboard />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AgentProvider>
          <AppRouter />
        </AgentProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
