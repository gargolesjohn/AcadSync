import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';
import api from '../api/client';
import { getTodayName, toast } from '../utils';
import { Modal } from './Modal';

interface Activity {
  id: string;
  type: 'user' | 'announcement' | 'message' | 'submission' | 'grade';
  title: string;
  subtitle: string;
  time: string;
  icon: string;
  color: string;
}

export function OverviewView({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [classesToday, setClassesToday] = useState<any[]>([]);
  const [dueThisWeek, setDueThisWeek] = useState<any[]>([]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);
  
  // Student Specific Stats
  const [attStatus, setAttStatus] = useState({ checked_in_today: false, percentage: 0, total_present: 0 });
  const [studentStats, setStudentStats] = useState({ performance: 0, pending_assignments: 0, average_grade: 0 });
  const [attHistory, setAttHistory] = useState<string[]>([]);
  const [showAttModal, setShowAttModal] = useState(false);

  const isProf = user?.role === 'instructor' || user?.role === 'program_head';
  const isStudent = user?.role === 'student';
  const isManager = user?.role === 'admin' || user?.role === 'registrar';

  useEffect(() => {
    if (isManager) {
      api.get('/admin/dashboard/stats').then(r => setStats(r.data.data)).catch(() => {});
      fetchAdminActivities();
      setLoading(false);
    } else if (isProf) {
      fetchProfData();
      fetchProfActivities();
    } else if (isStudent) {
      fetchStudentData();
    } else {
      setLoading(false);
    }

    const savedTasks = localStorage.getItem(`tasks_${user?.id}`);
    if (savedTasks) setTasks(JSON.parse(savedTasks));
  }, [user, isProf, isStudent, isManager]);

  useEffect(() => {
    const handleGradeUpdate = () => {
      if (isProf) {
        fetchProfActivities();
      } else if (isStudent) {
        fetchStudentData();
      }
    };
    window.addEventListener('grade-updated', handleGradeUpdate);
    return () => window.removeEventListener('grade-updated', handleGradeUpdate);
  }, [isProf, isStudent]);

  useEffect(() => {
    const handleAssignmentUpdate = () => {
      if (isProf) {
        fetchProfData();
        fetchProfActivities();
      } else if (isStudent) {
        fetchStudentData();
      }
    };

    window.addEventListener('assignment-updated', handleAssignmentUpdate);
    return () => window.removeEventListener('assignment-updated', handleAssignmentUpdate);
  }, [isProf, isStudent]);

  const fetchAdminActivities = async () => {
    try {
      const [usersRes, annRes] = await Promise.all([
        api.get('/users'),
        api.get('/announcements')
      ]);
      const recentUsers = (usersRes.data.data || []).slice(0, 3).map((u: any) => ({
        id: `u-${u.id}`,
        type: 'user',
        title: 'New User Registered',
        subtitle: `${u.name} joined as ${u.role}`,
        time: 'Just now',
        icon: 'fa-user-plus',
        color: 'var(--accent)'
      }));
      const recentAnn = (annRes.data.data || []).slice(0, 2).map((a: any) => ({
        id: `a-${a.id}`,
        type: 'announcement',
        title: 'New Announcement',
        subtitle: a.title,
        time: 'Today',
        icon: 'fa-bullhorn',
        color: '#ec4899'
      }));
      setActivities([...recentUsers, ...recentAnn]);
    } catch (e) {}
  };

  const fetchProfActivities = async () => {
    try {
      const [gradesRes, subRes] = await Promise.all([
        api.get('/grades'),
        api.get('/assignments') // Submissions are nested or separate? Usually separate
      ]);
      // For now, mockup some relevant teaching activity
      const recentGrades = (gradesRes.data.data || []).slice(0, 3).map((g: any) => ({
        id: `g-${g.id}`,
        type: 'grade',
        title: 'Grade Updated',
        subtitle: `Updated ${g.subject} for ${g.student_name}`,
        time: 'Today',
        icon: 'fa-star',
        color: '#f59e0b'
      }));
      setActivities([...recentGrades]);
    } catch (e) {}
  };

  const fetchProfData = async () => {
    setLoading(true);
    try {
      const [unreadRes, schedRes, assignRes] = await Promise.all([
        api.get('/messages/unread-count'),
        api.get('/schedules'),
        api.get('/assignments')
      ]);
      setUnreadCount(unreadRes.data.data.unread_count);
      const today = getTodayName();
      setClassesToday(schedRes.data.data.filter((s: any) => s.day_of_week === today));
      const now = new Date();
      const endOfWeek = new Date();
      endOfWeek.setDate(now.getDate() + 7);
      const allAssignments = assignRes.data.data.items || [];
      setDueThisWeek(allAssignments.filter((a: any) => {
        const dueDate = new Date(a.due_date);
        return dueDate >= now && dueDate <= endOfWeek;
      }));
    } catch (e) {} finally { setLoading(false); }
  };

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const [attRes, gradesRes, assignRes] = await Promise.all([
        api.get('/attendance/status'),
        api.get('/grades'),
        api.get('/assignments')
      ]);
      setAttStatus(attRes.data.data);
      const pendingCount = (assignRes.data.data.items || []).filter((a: any) => !a.is_submitted).length;
      const grades = gradesRes.data.data || [];
      const validGrades = grades.filter((g: any) => g.final_grade > 0);
      
      const totalUnits = validGrades.reduce((acc: any, curr: any) => acc + (curr.subject_units || 3), 0);
      const totalWeighted = validGrades.reduce((acc: any, curr: any) => acc + (curr.final_grade * (curr.subject_units || 3)), 0);
      const avg = totalUnits > 0 ? totalWeighted / totalUnits : 0;
      
      const perf = validGrades.length > 0 ? validGrades.reduce((acc: any, curr: any) => acc + curr.percentage_score, 0) / validGrades.length : 0;
      setStudentStats({
        performance: Math.round(perf),
        pending_assignments: pendingCount,
        average_grade: Number(avg.toFixed(3))
      });
    } catch (e) {} finally { setLoading(false); }
  };

  const handleCheckIn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTab('attendance');
  };

  const openHistory = async () => {
    try {
      const { data } = await api.get('/attendance/history');
      setAttHistory(data.data || []);
      setShowAttModal(true);
    } catch (e) {
      toast('Failed to load history', 'error', 'fa-times-circle');
    }
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    const updated = [...tasks, newTask.trim()];
    setTasks(updated);
    localStorage.setItem(`tasks_${user?.id}`, JSON.stringify(updated));
    setNewTask('');
  };

  const removeTask = (index: number) => {
    const updated = tasks.filter((_, i) => i !== index);
    setTasks(updated);
    localStorage.setItem(`tasks_${user?.id}`, JSON.stringify(updated));
  };

  if (!user) return null;
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  const MetricCard = ({ label, value, change, positive, icon, color, subtext, onClick }: { label: string; value: string | number; change?: string; positive?: boolean; icon: string; color?: string; subtext?: string; onClick?: () => void }) => (
    <div className="card stat-card white" style={{ cursor: onClick ? 'pointer' : 'default', transition: 'all 0.2s', position: 'relative' }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color || 'var(--accent)'}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`fas ${icon}`} style={{ color: color || 'var(--accent)', fontSize: '14px' }}></i>
        </div>
      </div>
      <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.03em', lineHeight: 1 }}>{value}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
        {change && (
          <div style={{ fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', color: positive ? '#10b981' : '#ef4444' }}>
            <i className={`fas fa-arrow-${positive ? 'up' : 'down'}`} style={{ fontSize: '9px' }}></i> {change}
          </div>
        )}
        {subtext && <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>{subtext}</div>}
      </div>
    </div>
  );

  const ActivityItem = ({ activity }: { activity: Activity }) => (
    <div style={{ display: 'flex', gap: '16px', padding: '16px', borderBottom: '1px solid var(--border)', transition: 'all 0.2s' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: `${activity.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`fas ${activity.icon}`} style={{ color: activity.color, fontSize: '16px' }}></i>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{activity.title}</div>
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>{activity.time}</div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {activity.subtitle}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>{dateStr}</div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-.02em' }}>
          {isProf ? `Good day, ${user.name?.split(' ')[0] || ''}!` : `Welcome back, ${user.name?.split(' ')[0] || ''}!`}
        </h2>
        {isStudent && (
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{user.department_section}</span>
            <span style={{ width: 1, height: 12, background: 'var(--border)', alignSelf: 'center' }}></span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: user.enrollment_status === 'Regular' ? '#16a34a' : user.enrollment_status === 'Irregular' ? '#d97706' : '#dc2626' }}>
              {user.enrollment_status} Student
            </span>
          </div>
        )}
      </div>

      {(user.role === 'admin' || user.role === 'registrar') ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>System Overview</div>
          </div>
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {stats ? (<>
              <MetricCard label="Total Users" value={stats.total_users} change="+18%" positive icon="fa-users" color="var(--accent)" onClick={() => setActiveTab('user-management')} />
              <MetricCard label="Announcements" value={stats.total_announcements} change="+7%" positive icon="fa-bullhorn" color="#ec4899" onClick={() => setActiveTab('announcements')} />
              <MetricCard label="Messages" value={stats.unread_messages} change="-3%" positive={false} icon="fa-envelope" color="#f59e0b" onClick={() => setActiveTab('inbox')} />
              <MetricCard label="System Status" value="Online" change="+13%" positive icon="fa-server" color="#10b981" onClick={() => setActiveTab('settings')} />
            </>) : <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Loading system stats...</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fas fa-history" style={{ color: 'var(--accent)' }}></i> Recent System Activity
                </h3>
              </div>
              <div>
                {activities.length > 0 ? (
                  activities.map(a => <ActivityItem key={a.id} activity={a} />)
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <i className="fas fa-stream" style={{ fontSize: '24px', opacity: 0.2, marginBottom: '12px' }}></i>
                    <div style={{ fontSize: '13px' }}>No recent activity to show</div>
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-bolt" style={{ color: '#f59e0b' }}></i> Quick Actions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="btn-secondary" style={{ justifyContent: 'flex-start', padding: '14px' }} onClick={() => setActiveTab('user-management')}><i className="fas fa-user-plus" style={{ marginRight: '12px', color: 'var(--accent)' }}></i> Add New User</button>
                <button className="btn-secondary" style={{ justifyContent: 'flex-start', padding: '14px' }} onClick={() => setActiveTab('announcements')}><i className="fas fa-bullhorn" style={{ marginRight: '12px', color: '#ec4899' }}></i> Post Announcement</button>
                <button className="btn-secondary" style={{ justifyContent: 'flex-start', padding: '14px' }} onClick={() => setActiveTab('sections')}><i className="fas fa-layer-group" style={{ marginRight: '12px', color: '#10b981' }}></i> Manage Sections</button>
              </div>
            </div>
          </div>
        </>
      ) : isProf ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          <div className="card" style={{ padding: '24px', cursor: 'pointer' }} onClick={() => setActiveTab('inbox')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-envelope" style={{ color: 'var(--accent)', fontSize: '18px' }}></i>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unread Messages</div>
                <div style={{ fontSize: '28px', fontWeight: 800 }}>{unreadCount}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-history" style={{ color: '#f59e0b' }}></i> Teaching Activity
              </h3>
            </div>
            <div>
              {activities.length > 0 ? (
                activities.map(a => <ActivityItem key={a.id} activity={a} />)
              ) : (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '12px' }}>No recent teaching activity</div>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fas fa-calendar-day" style={{ color: '#ec4899' }}></i> Classes Today
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {classesToday.length > 0 ? classesToday.map((c, i) => (
                <div key={i} style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 800, fontSize: '14px' }}>{c.course_label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{c.course_code} · {c.start_time}-{c.end_time} · {c.room_location}</div>
                </div>
              )) : <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No classes scheduled for today</div>}
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fas fa-clock" style={{ color: '#f59e0b' }}></i> Due This Week
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dueThisWeek.length > 0 ? dueThisWeek.map((a, i) => (
                <div key={i} style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 800, fontSize: '14px' }}>{a.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{a.course_code} · Due {new Date(a.due_date).toLocaleDateString()}</div>
                </div>
              )) : <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No assignments due this week</div>}
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fas fa-check-square" style={{ color: '#10b981' }}></i> Task Reminder
            </h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <input className="input" style={{ fontSize: '13px', padding: '10px 14px' }} placeholder="Add a quick task..." value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} />
              <button className="btn-primary" style={{ padding: '10px 14px' }} onClick={addTask}><i className="fas fa-plus"></i></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {tasks.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: '8px', fontSize: '13px' }}>
                  <span>{t}</span>
                  <button onClick={() => removeTask(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><i className="fas fa-trash-alt"></i></button>
                </div>
              ))}
              {tasks.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>Your task list is empty</div>}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <MetricCard label="Overall Performance" value={`${studentStats.performance}%`} change="+18%" positive icon="fa-chart-line" color="var(--accent)" subtext="Semester Avg" />
            
            <div className="card stat-card white" 
              style={{ transition: 'all 0.2s', border: attStatus.checked_in_today ? '1px solid #10b981' : '1px solid var(--border)', cursor: 'pointer' }}
              onClick={openHistory}
              title="Click to view history"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Class Attendance</div>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(236, 72, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-user-check" style={{ color: '#ec4899', fontSize: '14px' }}></i>
                </div>
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text_primary)', letterSpacing: '-.03em', lineHeight: 1 }}>{attStatus.percentage}%</div>
              <div style={{ marginTop: '16px' }}>
                  <button className="btn-primary" style={{ width: '100%', padding: '8px', fontSize: '11px', background: '#ec4899', border: 'none' }} onClick={handleCheckIn}>
                    Manage Check-Ins
                  </button>
              </div>
            </div>

            <MetricCard 
              label="Assignments Status" 
              value={studentStats.pending_assignments > 0 ? "Pending" : "Complete"} 
              change={studentStats.pending_assignments > 0 ? `-${studentStats.pending_assignments}` : "0"} 
              positive={studentStats.pending_assignments === 0} 
              icon="fa-tasks" 
              color="#10b981" 
              subtext={`${studentStats.pending_assignments} Unfinished`}
              onClick={() => setActiveTab('assignments')}
            />

            <MetricCard 
              label="Average Grades" 
              value={studentStats.average_grade || "0.0"} 
              change="+13%" 
              positive 
              icon="fa-star" 
              color="#f59e0b" 
              subtext="Numerical Grade" 
              onClick={() => setActiveTab('grades')}
            />
          </div>

          <div className="overview-grid-bottom" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '20px' }}>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fas fa-history" style={{ color: 'var(--accent)', fontSize: '14px' }}></i> Recent Academic Activity
                </h3>
              </div>
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'color-mix(in srgb, var(--accent) 06%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <i className="fas fa-chart-bar" style={{ fontSize: '20px', opacity: .4 }}></i>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>No recent records</div>
                <div style={{ fontSize: '11px', marginTop: '6px', color: 'var(--text-muted)' }}>Your grades and submissions will appear here.</div>
              </div>
            </div>

            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-bolt" style={{ color: '#fbbf24', fontSize: '14px' }}></i> Quick Tools
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button className="btn-secondary" style={{ justifyContent: 'flex-start', padding: '12px' }} onClick={() => setActiveTab('schedule')}><i className="fas fa-calendar-alt" style={{ marginRight: '10px', color: 'var(--accent)' }}></i> My Class Schedule</button>
                <button className="btn-secondary" style={{ justifyContent: 'flex-start', padding: '12px' }} onClick={() => setActiveTab('inbox')}><i className="fas fa-paper-plane" style={{ marginRight: '10px', color: '#10b981' }}></i> Contact Instructor</button>
                <button className="btn-secondary" style={{ justifyContent: 'flex-start', padding: '12px' }} onClick={() => setActiveTab('settings')}><i className="fas fa-shield-alt" style={{ marginRight: '10px', color: '#ec4899' }}></i> Account Security</button>
              </div>
            </div>
          </div>
        </>
      )}

      {showAttModal && (
        <Modal onClose={() => setShowAttModal(false)} title="Attendance History" icon="fa-history" width={400}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Days Present</div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: '#ec4899' }}>{attHistory.length}</div>
          </div>
          
          <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px' }}>
            {attHistory.map((date, idx) => (
              <div key={idx} style={{ 
                padding: '12px 16px', 
                background: 'var(--bg-surface)', 
                borderRadius: '10px', 
                border: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-check" style={{ fontSize: '12px' }}></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Marked Successfully</div>
                  </div>
                </div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: '12px' }}>PRESENT</div>
              </div>
            ))}
            {attHistory.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <i className="fas fa-calendar-times" style={{ fontSize: '24px', opacity: 0.2, marginBottom: '10px' }}></i>
                <div style={{ fontSize: '12px' }}>No attendance records found</div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
