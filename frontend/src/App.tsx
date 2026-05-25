import { useEffect } from 'react';
import { useAuth } from './store/auth';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import './index.css';

export default function App() {
  const { user, token, loading, refreshUser } = useAuth();

  useEffect(() => {
    if (token) refreshUser();
    else useAuth.setState({ loading: false });
  }, [refreshUser, token]);

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0f172a,#1e1b4b,#0f172a)' }}>
      <div style={{ color: 'white', fontSize: '18px', fontWeight: 700 }}>Loading...</div>
    </div>
  );

  if (!user) return <LoginPage />;

  // Ensure hash exists when dashboard first loads to anchor the history
  if (!window.location.hash) {
    window.history.replaceState(null, '', '#overview');
  }

  return <Dashboard />;
}
