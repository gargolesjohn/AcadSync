import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../store/auth';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { OverviewView } from './OverviewView';
import { AnnouncementsView } from './AnnouncementsView';
import { MessagesView } from './MessagesView';
import { ScheduleView } from './ScheduleView';
import { AssignmentsView } from './AssignmentsView';
import { SettingsView } from './SettingsView';
import { UserManagementView } from './UserManagementView';
import { SectionsView } from './SectionsView';
import { CoursesView } from './CoursesView.tsx';
import { GradesView } from './GradesView.tsx';
import { AttendanceView } from './AttendanceView';
import { WebSocketListener } from './WebSocketListener';

export function Dashboard() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const getTabFromHash = useCallback(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || 'overview';
  }, []);
  
  const [activeTab, setActiveTab] = useState(getTabFromHash());

  // Handle browser Back/Forward buttons and refresh
  useEffect(() => {
    // 1. Force a hash if none exists to ensure we have a history entry
    if (!window.location.hash) {
      window.history.pushState(null, '', '#overview');
    }

    const onHashChange = () => {
      const newTab = getTabFromHash();
      setActiveTab(newTab);
    };

    const handlePopState = (e: PopStateEvent) => {
      // If we are about to leave the dashboard while logged in, push it back
      if (!window.location.hash || window.location.hash === '#') {
        window.history.pushState(null, '', '#overview');
        setActiveTab('overview');
      }
    };

    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', handlePopState);
    
    // 2. Initial sync to make sure state matches URL on load/refresh
    onHashChange();

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [getTabFromHash]);

  // Update URL hash when tab changes via UI
  const handleTabChange = (tab: string) => {
    if (tab !== activeTab) {
      // Use window.location.hash to ensure a history entry is created
      window.location.hash = tab;
      setActiveTab(tab);
    }
    setSidebarOpen(false);
  };

  // Close sidebar on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const renderContent = () => {
    const isManager = user?.role === 'admin' || user?.role === 'registrar';
    const isProf = user?.role === 'instructor' || user?.role === 'program_head';
    
    switch (activeTab) {
      case 'overview': return <OverviewView setActiveTab={handleTabChange} />;
      case 'announcements': return <AnnouncementsView />;
      case 'inbox': return <MessagesView />;
      case 'schedule': return <ScheduleView />;
      case 'attendance': return <AttendanceView />;
      case 'assignments': return <AssignmentsView />;
      case 'grades': return (isProf || isManager) ? <GradesView /> : <OverviewView setActiveTab={handleTabChange} />;
      case 'settings': return <SettingsView />;
      case 'user-management': return isManager ? <UserManagementView /> : <OverviewView setActiveTab={handleTabChange} />;
      case 'sections': return isManager ? <SectionsView /> : <OverviewView setActiveTab={handleTabChange} />;
      case 'courses': return (isManager || isProf) ? <CoursesView /> : <OverviewView setActiveTab={handleTabChange} />;
      default: return <OverviewView setActiveTab={handleTabChange} />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <WebSocketListener />
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="sidebar-backdrop visible" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Header activeTab={activeTab} setActiveTab={handleTabChange} onMenuClick={() => setSidebarOpen(true)} />
        <main className="main-content fade-in" style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {renderContent()}
        </main>
      </div>
      <div id="toast-container"></div>
    </div>
  );
}
