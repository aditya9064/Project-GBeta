import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import { CrewOSDashboard } from './components/crewos/CrewOSDashboard'
import { LandingPage } from './components/landing/LandingPage'
import { PlanSelectionPage } from './components/landing/PlanSelectionPage'
import './styles/globals.css'

function AppRouter() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const root = document.getElementById('root')!;

    // Landing & plans pages use normal body scroll; dashboard routes use fixed layout
    if (location.pathname === '/' || location.pathname === '/plans') {
      document.body.classList.remove('dashboard-active');
      root.classList.remove('dashboard-active');
    } else {
      document.body.classList.add('dashboard-active');
      root.classList.add('dashboard-active');
    }
  }, [location.pathname]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <ErrorBoundary>
            <LandingPage onGetStarted={() => navigate('/plans')} />
          </ErrorBoundary>
        }
      />
      <Route
        path="/plans"
        element={
          <ErrorBoundary>
            <PlanSelectionPage />
          </ErrorBoundary>
        }
      />
      <Route
        path="/*"
        element={
          <ErrorBoundary>
            <CrewOSDashboard />
          </ErrorBoundary>
        }
      />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
