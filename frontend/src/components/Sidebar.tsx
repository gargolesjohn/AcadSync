import { useAuth } from '../store/auth';
import { useNotifications } from '../store/notifications';

interface SidebarProps { activeTab: string; setActiveTab: (tab: string) => void; isOpen: boolean; onClose: () => void; }

export function Sidebar({ activeTab, setActiveTab, isOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  if (!user) return null;

  const Link = ({ id, icon, text }: { id: string; icon: string; text: string }) => (
    <button className={`sidebar-link ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <i className={`fas ${icon} icon`}></i> {text}
      </span>
      {id === 'inbox' && unreadCount > 0 && (
        <span className="sidebar-badge">{unreadCount}</span>
      )}
    </button>
  );

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <button className="sidebar-close-btn" onClick={onClose}><i className="fas fa-times"></i></button>

      {/* Logo */}
      <div style={{ padding: '22px 18px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '36px', height: '36px', background: 'var(--accent)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className="fas fa-comments" style={{ color: 'white', fontSize: '15px' }}></i>
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'white', letterSpacing: '-.01em' }}>AcadSync</div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,.25)', fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase' }}>Communication Hub</div>
        </div>
      </div>

      {/* Role */}
      <div style={{ padding: '0 18px 14px' }}>
        {user.role === 'admin' ? <span className="role-chip chip-admin"><i className="fas fa-shield-alt"></i> Administrator</span> :
         user.role === 'registrar' ? <span className="role-chip chip-registrar"><i className="fas fa-id-card"></i> Registrar</span> :
         (user.role === 'instructor' || user.role === 'program_head') ? <span className="role-chip chip-instructor"><i className="fas fa-chalkboard-teacher"></i> {user.role === 'program_head' ? 'Program Head' : 'Instructor'}</span> :
         <span className="role-chip chip-student"><i className="fas fa-user-graduate"></i> Student</span>}
        {user.role === 'student' && user.enrollment_status && (
          <div style={{ marginTop: '6px' }}>
            <span style={{ 
              background: user.enrollment_status === 'Regular' ? 'rgba(22,163,74,0.15)' : user.enrollment_status === 'Irregular' ? 'rgba(217,119,6,0.15)' : 'rgba(220,38,38,0.15)',
              color: user.enrollment_status === 'Regular' ? '#4ade80' : user.enrollment_status === 'Irregular' ? '#fbbf24' : '#f87171',
              padding: '2px 8px', borderRadius: '12px', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em'
            }}>
              {user.enrollment_status}
            </span>
          </div>
        )}
      </div>

      <div style={{ margin: '0 18px', height: '1px', background: 'rgba(255,255,255,.04)' }}></div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        <div style={{ fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,.2)', textTransform: 'uppercase', letterSpacing: '.12em', padding: '12px 18px 6px' }}>Main</div>
        <Link id="overview" icon="fa-home" text="Dashboard" />
        <Link id="announcements" icon="fa-bullhorn" text="Announcements" />
        <Link id="inbox" icon="fa-envelope" text="Messages" />
        
        {(user.role !== 'admin' && user.role !== 'registrar') && (<>
          <div style={{ fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,.2)', textTransform: 'uppercase', letterSpacing: '.12em', padding: '20px 18px 6px' }}>Academic</div>
          <Link id="schedule" icon="fa-calendar-alt" text="Schedule" />
          <Link id="attendance" icon="fa-user-check" text="Attendance" />
          <Link id="assignments" icon="fa-tasks" text="Assignments" />
          {(user.role === 'instructor' || user.role === 'program_head') && <Link id="grades" icon="fa-star" text="Grades" />}
        </>)}

        {(user.role === 'admin' || user.role === 'registrar') && (<>
          <div style={{ fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,.2)', textTransform: 'uppercase', letterSpacing: '.12em', padding: '20px 18px 6px' }}>Management</div>
          <Link id="user-management" icon="fa-users-cog" text="Users" />
          <Link id="sections" icon="fa-layer-group" text="Sections" />
          <Link id="courses" icon="fa-book" text="Courses" />
          <Link id="grades" icon="fa-star" text="Grades" />
        </>)}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,.04)' }}>
        <Link id="settings" icon="fa-cog" text="Settings" />
      </div>
    </div>
  );
}
