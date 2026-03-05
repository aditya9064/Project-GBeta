import { StrictMode, useEffect, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import { AgentProvider } from './contexts/AgentContext'
import { PageLoader } from './components/ui/LoadingSpinner'
import { NotFound } from './components/ui/NotFound'

const LandingPage = lazy(() => 
  import('./components/landing/LandingPage').then(m => ({ default: m.LandingPage }))
);

const CrewOSDashboard = lazy(() => 
  import('./components/crewos/CrewOSDashboard').then(m => ({ default: m.CrewOSDashboard }))
);

const DASHBOARD_PATHS = [
  '/dashboard', '/agents', '/comms', '/docai', '/sales',
  '/workflow', '/logs', '/marketplace',
  '/settings', '/teams', '/docs',
  '/integrations', '/webhooks', '/knowledge',
];

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

  const dashboardElement = (
    <ErrorBoundary>
      <CrewOSDashboard />
    </ErrorBoundary>
  );

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={
          <ErrorBoundary>
            <LandingPage onGetStarted={() => navigate('/agents')} />
          </ErrorBoundary>
        } />
        {DASHBOARD_PATHS.map(path => (
          <Route key={path} path={path} element={dashboardElement} />
        ))}
        <Route path="/automation-builder/:id" element={dashboardElement} />
        <Route path="*" element={<NotFound />} />
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
