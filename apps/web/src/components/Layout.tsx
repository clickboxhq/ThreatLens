import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function AppLayout() {
  const { user, logout } = useAuth();
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#1e293b' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 20px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <strong>SOCVerse</strong>
        {user && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>{user.displayName}</span>
            <button onClick={logout}>Log out</button>
          </div>
        )}
      </header>
      <main style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

export function SessionNav() {
  const { sessionId } = useParams();
  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    marginRight: 16,
    fontWeight: isActive ? 700 : 400,
    textDecoration: 'none',
    color: isActive ? '#1d4ed8' : '#334155',
  });

  return (
    <nav style={{ marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
      <NavLink to={`/sessions/${sessionId}/dashboard`} style={linkStyle}>
        Alert Dashboard
      </NavLink>
      <NavLink to={`/sessions/${sessionId}/incidents`} style={linkStyle}>
        Incidents
      </NavLink>
      <NavLink to={`/sessions/${sessionId}/identities`} style={linkStyle}>
        Identities
      </NavLink>
      <NavLink to={`/sessions/${sessionId}/devices`} style={linkStyle}>
        Devices
      </NavLink>
      <NavLink to={`/sessions/${sessionId}/emails`} style={linkStyle}>
        Emails
      </NavLink>
    </nav>
  );
}
