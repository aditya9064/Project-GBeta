import { StrictMode, useEffect, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import { AgentProvider } from './contexts/AgentContext'
import { PageLoader } from './components/ui/LoadingSpinner'

// Lazy load main components for code splitting
const LandingPage = lazy(() => 
  import('./components/landing/LandingPage').then(m => ({ default: m.LandingPage }))
);

const CrewOSDashboard = lazy(() => 
  import('./components/crewos/CrewOSDashboard').then(m => ({ default: m.CrewOSDashboard }))
);

function AppRouter() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const root = document.getElementById('root')!;
    if (location.pathname === '/') {
      document.body.classList.remove('dashboard-active');
      root.classList.remove('dashboard-active');
    } else {
      document.body.classList.add('dashboard-active');
      root.classList.add('dashboard-active');
    }
  }, [location.pathname]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={
          <ErrorBoundary>
            <LandingPage onGetStarted={() => navigate('/dashboard')} />
          </ErrorBoundary>
        } />
        <Route path="/*" element={
          <ErrorBoundary>
            <CrewOSDashboard />
          </ErrorBoundary>
        } />
      </Routes>
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AgentProvider>
            <AppRouter />
          </AgentProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
