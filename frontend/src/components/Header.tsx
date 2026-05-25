import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../store/auth';
import { useNotifications } from '../store/notifications';
import { initials } from '../utils';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onMenuClick: () => void;
}

export function Header({ activeTab, setActiveTab, onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!user) return null;

  const tabLabels: Record<string, string> = {
    overview: 'Overview',
    announcements: 'Announcements',
    inbox: 'Messages',
    schedule: 'Class Schedule',
    assignments: 'Assignments',
    settings: 'Settings',
    'user-management': 'User Management',
  };

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
        {/* Hamburger — visible on mobile only via CSS */}
        <button className="hamburger-btn" onClick={onMenuClick} aria-label="Open menu">
          <i className="fas fa-bars"></i>
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tabLabels[activeTab] || 'Overview'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Welcome back, {user.name?.split(' ')[0] || ''}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button className="notif-bell" onClick={() => setActiveTab('inbox')} aria-label="Messages">
          <i className="fas fa-bell" style={{ fontSize: '17px' }}></i>
          {unreadCount > 0 && (
            <span className="notif-badge">{unreadCount}</span>
          )}
        </button>

        <div ref={profileRef} style={{ position: 'relative' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setProfileOpen(!profileOpen)}>
            <div className="profile-text-desktop" style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{user.name}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{user.id}</div>
            </div>
            <div className="avatar" style={{ width: '38px', height: '38px', fontSize: '13px', boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 25%, transparent)' }}>
              {user.avatar || initials(user.name)}
            </div>
          </button>

          {profileOpen && (
            <div style={{ position: 'absolute', top: '52px', right: '0', width: '230px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: '0 16px 40px rgba(0,0,0,0.15)', zIndex: 100, overflow: 'hidden', animation: 'popUp 0.2s ease' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>{user.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{user.email || user.id}</div>
              </div>
              <div style={{ padding: '8px 0' }}>
                <button className="profile-item" onClick={() => { setActiveTab('settings'); setProfileOpen(false); }}>
                  <i className="fas fa-user-circle" style={{ width: '16px', color: 'var(--accent)' }}></i> My Profile
                </button>
                <button className="profile-item" onClick={() => { setActiveTab('settings'); setProfileOpen(false); }}>
                  <i className="fas fa-cog" style={{ width: '16px', color: '#64748b' }}></i> Preferences
                </button>
                <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }}></div>
                <button className="profile-item" style={{ color: '#dc2626' }} onClick={logout}>
                  <i className="fas fa-sign-out-alt" style={{ width: '16px' }}></i> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
