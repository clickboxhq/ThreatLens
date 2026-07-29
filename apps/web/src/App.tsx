import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppLayout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { CatalogPage } from './pages/CatalogPage';
import { SessionDashboardPage } from './pages/SessionDashboardPage';
import { IdentityPortalPage } from './pages/IdentityPortalPage';
import { EmailPortalPage } from './pages/EmailPortalPage';
import { IncidentsListPage } from './pages/IncidentsListPage';
import { IncidentWorkspacePage } from './pages/IncidentWorkspacePage';
import { ResultsPage } from './pages/ResultsPage';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/sessions/:sessionId/dashboard" element={<SessionDashboardPage />} />
        <Route path="/sessions/:sessionId/identities" element={<IdentityPortalPage />} />
        <Route path="/sessions/:sessionId/emails" element={<EmailPortalPage />} />
        <Route path="/sessions/:sessionId/incidents" element={<IncidentsListPage />} />
        <Route path="/sessions/:sessionId/incidents/:incidentId" element={<IncidentWorkspacePage />} />
        <Route path="/sessions/:sessionId/results" element={<ResultsPage />} />
        <Route path="/" element={<Navigate to="/catalog" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/catalog" replace />} />
    </Routes>
  );
}
