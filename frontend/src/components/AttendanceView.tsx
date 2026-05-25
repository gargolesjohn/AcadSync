import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';
import api from '../api/client';
import { toast, getTodayName } from '../utils';
import { Modal } from './Modal';
import { AttendanceCalendar } from './AttendanceCalendar';

export function AttendanceView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [studentsStatus, setStudentsStatus] = useState<any[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [showCalendar, setShowCalendar] = useState<{scheduleId: number, studentId?: string, courseCode: string} | null>(null);

  
  // Date selection for professors to view attendance by date
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleString("en-CA", {timeZone: "Asia/Manila"}).split(',')[0]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getScheduleStatus = (startDt?: string, endDt?: string) => {
    try {
      if (!startDt || !endDt) return 'unknown';
      const now = currentTime.getTime();
      const start = new Date(startDt).getTime();
      const end = new Date(endDt).getTime();
      
      if (now < start) return 'future';
      if (now > end) return 'past';
      return 'active';
    } catch {
      return 'unknown';
    }
  };

  const isProf = user?.role === 'instructor' || user?.role === 'program_head';
  const isStudent = user?.role === 'student';

  useEffect(() => {
    fetchSchedules();
  }, [user, selectedDate]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/attendance/schedules?date_str=${selectedDate}`);
      setSchedules(data.data || []);
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Failed to load schedules', 'error', 'fa-times-circle');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (scheduleId: number) => {
    try {
      await api.post('/attendance/check-in', { schedule_id: scheduleId });
      toast('Check-in submitted. Waiting for instructor approval.', 'success', 'fa-clock');
      fetchSchedules();
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Check-in failed', 'error', 'fa-times-circle');
    }
  };

  const openStudentsList = async (sched: any) => {
    setSelectedSchedule(sched);
    setShowStudentsModal(true);
    setStatusLoading(true);
    try {
      const { data } = await api.get(`/attendance/students-status?schedule_id=${sched.schedule_id}&date_str=${selectedDate}`);
      setStudentsStatus(data.data || []);
    } catch (e: any) {
      toast('Failed to load students', 'error', 'fa-times-circle');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleApprove = async (attendanceId: number, newStatus: string) => {
    setProcessingId(attendanceId);
    try {
      await api.post('/attendance/approve', { attendance_id: attendanceId, status: newStatus });
      toast(`Attendance marked as ${newStatus}`, 'success', 'fa-check');
      // Refresh list
      const { data } = await api.get(`/attendance/students-status?schedule_id=${selectedSchedule.schedule_id}&date_str=${selectedDate}`);
      setStudentsStatus(data.data || []);
      fetchSchedules(); // Update pending counts
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Approval failed', 'error', 'fa-times-circle');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending': return <span style={{ background: '#fffbeb', color: '#f59e0b', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>PENDING APPROVAL</span>;
      case 'Approved': return <span style={{ background: '#ecfdf5', color: '#10b981', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>APPROVED</span>;
      case 'Absent': return <span style={{ background: '#fef2f2', color: '#ef4444', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>ABSENT</span>;
      case 'Late': return <span style={{ background: '#eff6ff', color: '#3b82f6', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>LATE</span>;
      default: return <span style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>NOT CHECKED IN</span>;
    }
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 900, margin: 0 }}>Attendance</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {isProf ? "Review and approve student check-ins for today's classes" : "Check in for your classes today"}
        </p>
      </div>

      <div style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-calendar-day" style={{ color: 'var(--accent)' }}></i>
          {selectedDate === new Date().toLocaleString("en-CA", {timeZone: "Asia/Manila"}).split(',')[0] ? `Today's Schedule (${getTodayName()})` : `Schedule for ${new Date(selectedDate).toLocaleDateString()}`}
        </div>
        {isProf && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Select Date:</label>
            <input 
              type="date" 
              className="input" 
              style={{ padding: '6px 12px', fontSize: '13px', width: 'auto', height: 'auto' }} 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)} 
            />
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <i className="fas fa-circle-notch fa-spin fa-2x" style={{ marginBottom: '12px' }}></i>
          <div>Loading schedules...</div>
        </div>
      ) : schedules.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <i className="fas fa-glass-cheers" style={{ fontSize: '48px', opacity: 0.2, marginBottom: '16px' }}></i>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>No classes today!</div>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>Enjoy your free time.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {schedules.map((s, idx) => {
            const schedStatus = getScheduleStatus(s.start_dt, s.end_dt);
            const isActive = schedStatus === 'active';
            const isPast = schedStatus === 'past';
            const isFuture = schedStatus === 'future';

            return (
            <div key={idx} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 800 }}>
                    {s.course_code}
                  </div>
                  {isStudent && getStatusBadge(s.status)}
                  {isProf && s.pending_count > 0 && (
                    <div style={{ background: '#f59e0b', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                      {s.pending_count} PENDING
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '12px', color: 'var(--text-primary)' }}>
                  {s.course_label}
                  {isActive && <span style={{ marginLeft: '8px', background: '#ec4899', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, verticalAlign: 'middle' }}>ACTIVE NOW</span>}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fas fa-clock"></i> {s.time}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fas fa-map-marker-alt"></i> {s.room}
                </div>
              </div>

              {isStudent && s.status === 'Not Checked In' && isActive && (
                <button className="btn-primary" style={{ width: '100%', padding: '12px', marginTop: 'auto' }} onClick={() => handleCheckIn(s.schedule_id)}>
                  <i className="fas fa-user-check" style={{ marginRight: '8px' }}></i> Check In Now
                </button>
              )}
              {isStudent && s.status === 'Not Checked In' && isFuture && (
                <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '10px', border: '1px dashed var(--border)' }}>
                  <i className="fas fa-lock" style={{ marginRight: '6px' }}></i> Class has not started yet
                </div>
              )}
              {isStudent && s.status === 'Not Checked In' && isPast && (
                <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', background: '#fef2f2', padding: '12px', borderRadius: '10px', border: '1px dashed #fca5a5' }}>
                  <i className="fas fa-lock" style={{ marginRight: '6px', color: '#ef4444' }}></i> <span style={{ color: '#ef4444' }}>Class has already ended</span>
                </div>
              )}

              {isStudent && (
                <button className="btn-secondary" style={{ width: '100%', padding: '10px', marginTop: s.status !== 'Not Checked In' ? 'auto' : '8px' }} onClick={() => setShowCalendar({ scheduleId: s.schedule_id, courseCode: s.course_code })}>
                  <i className="fas fa-calendar-alt" style={{ marginRight: '8px' }}></i> View Calendar
                </button>
              )}

              {isProf && (
                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    <span>Enrolled: <b>{s.total_enrolled}</b></span>
                    <span>Checked In: <b>{s.checked_in_count}</b></span>
                  </div>
                  <button className="btn-secondary" style={{ width: '100%', padding: '10px' }} onClick={() => openStudentsList(s)}>
                    Review Attendance
                  </button>
                </div>
              )}
            </div>
          )})}
        </div>
      )}

      {showStudentsModal && (
        <Modal onClose={() => setShowStudentsModal(false)} title={`Attendance: ${selectedSchedule?.course_code}`} icon="fa-users" width={700}>
          <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '16px', fontWeight: 800 }}>{selectedSchedule?.course_label}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{selectedSchedule?.section} • {selectedSchedule?.time}</div>
          </div>

          {statusLoading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}><i className="fas fa-spinner fa-spin fa-2x color-muted"></i></div>
          ) : studentsStatus.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No students found in this section.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', minWidth: '500px' }}>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th>Time</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsStatus.map(st => (
                    <tr key={st.student_id} className="table-row-hover">
                      <td style={{ fontWeight: 600, padding: '12px' }}>{st.student_name}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{getStatusBadge(st.status)}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px' }}>
                        {st.checked_in_time ? new Date(st.checked_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button 
                            className="action-btn" 
                            style={{ width: '36px', height: '36px', borderRadius: '8px', color: 'var(--accent)' }}
                            title="View Student Calendar"
                            onClick={() => setShowCalendar({ scheduleId: st.schedule_id, studentId: st.student_id, courseCode: selectedSchedule?.course_code })}
                          >
                            <i className="fas fa-calendar-alt"></i>
                          </button>
                          
                          {st.status === 'Pending' && st.attendance_id ? (
                            <>
                              <button className="action-btn" style={{ background: '#ecfdf5', color: '#10b981', padding: '8px 16px', width: 'auto', height: '36px', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}
                                onClick={() => handleApprove(st.attendance_id, 'Approved')} disabled={processingId === st.attendance_id}>
                                Approve
                              </button>
                              <button className="action-btn hover-red" style={{ background: '#fef2f2', color: '#ef4444', padding: '8px 16px', width: 'auto', height: '36px', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}
                                onClick={() => handleApprove(st.attendance_id, 'Absent')} disabled={processingId === st.attendance_id}>
                                Reject (Absent)
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '0 8px' }}>{st.attendance_id ? 'Reviewed' : 'No record'}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {showCalendar && (
        <Modal onClose={() => setShowCalendar(null)} title="Attendance Calendar" icon="fa-calendar-alt" width={600}>
          <AttendanceCalendar 
            scheduleId={showCalendar.scheduleId} 
            studentId={showCalendar.studentId}
            courseCode={showCalendar.courseCode} 
          />
        </Modal>
      )}
    </div>
  );
}
