import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppLayout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { CatalogPage } from './pages/CatalogPage';
import { SessionDashboardPage } from './pages/SessionDashboardPage';
import { IdentityPortalPage } from './pages/IdentityPortalPage';
import { DevicePortalPage } from './pages/DevicePortalPage';
import { EmailPortalPage } from './pages/EmailPortalPage';
import { IncidentsListPage } from './pages/IncidentsListPage';
import { IncidentWorkspacePage } from './pages/IncidentWorkspacePage';
import { ResultsPage } from './pages/ResultsPage';
import { InstructorCohortsPage } from './pages/InstructorCohortsPage';
import { CohortDetailPage } from './pages/CohortDetailPage';
import { ReviewQueuePage } from './pages/ReviewQueuePage';
import { SessionReviewPage } from './pages/SessionReviewPage';
import { JoinCohortPage } from './pages/JoinCohortPage';
import { ProgressPage } from './pages/ProgressPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { LearningPathsPage } from './pages/LearningPathsPage';
import { LearningPathDetailPage } from './pages/LearningPathDetailPage';
import { CertificateVerifyPage } from './pages/CertificateVerifyPage';
import { SettingsPage } from './pages/SettingsPage';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// §17.1: route guards are a UX convenience only — the real authorization boundary is
// server-side (§15.2), enforced independently by RolesGuard on every /instructor/* route.
function InstructorRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'instructor') return <Navigate to="/catalog" replace />;
  return <>{children}</>;
}

function RoleHome() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'instructor' ? '/instructor' : '/catalog'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify/:certificateId" element={<CertificateVerifyPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/paths" element={<LearningPathsPage />} />
        <Route path="/paths/:pathId" element={<LearningPathDetailPage />} />
        <Route path="/sessions/:sessionId/dashboard" element={<SessionDashboardPage />} />
        <Route path="/sessions/:sessionId/identities" element={<IdentityPortalPage />} />
        <Route path="/sessions/:sessionId/devices" element={<DevicePortalPage />} />
        <Route path="/sessions/:sessionId/emails" element={<EmailPortalPage />} />
        <Route path="/sessions/:sessionId/incidents" element={<IncidentsListPage />} />
        <Route path="/sessions/:sessionId/incidents/:incidentId" element={<IncidentWorkspacePage />} />
        <Route path="/sessions/:sessionId/results" element={<ResultsPage />} />
        <Route path="/cohorts/join" element={<JoinCohortPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route
          path="/instructor"
          element={
            <InstructorRoute>
              <InstructorCohortsPage />
            </InstructorRoute>
          }
        />
        <Route
          path="/instructor/cohorts/:cohortId"
          element={
            <InstructorRoute>
              <CohortDetailPage />
            </InstructorRoute>
          }
        />
        <Route
          path="/instructor/cohorts/:cohortId/review"
          element={
            <InstructorRoute>
              <ReviewQueuePage />
            </InstructorRoute>
          }
        />
        <Route
          path="/instructor/sessions/:sessionId/review"
          element={
            <InstructorRoute>
              <SessionReviewPage />
            </InstructorRoute>
          }
        />
        <Route path="/" element={<RoleHome />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
