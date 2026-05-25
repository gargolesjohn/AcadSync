import { useState, useEffect } from 'react';
import api from '../api/client';
import { toast, getTodayName } from '../utils';
import { useAuth } from '../store/auth';

interface AttendanceCalendarProps {
  scheduleId?: number;
  studentId?: string;
  courseCode: string;
  onUpdate?: () => void;
}

export function AttendanceCalendar({ scheduleId, studentId, courseCode, onUpdate }: AttendanceCalendarProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState<{ [date: string]: string }>({});
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleString("en-CA", {timeZone: "Asia/Manila"}).split(',')[0]);
  const [updating, setUpdating] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const canEditAttendance = user?.role === 'instructor' || user?.role === 'program_head';
  const showManualPanel = canEditAttendance && studentId && isPanelOpen;

  useEffect(() => {
    fetchCalendarData();
  }, [scheduleId, studentId]);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      let url = `/attendance/calendar-data?`;
      if (scheduleId) url += `schedule_id=${scheduleId}`;
      else url += `course_code=${courseCode}`;
      
      if (studentId) url += `&student_id=${studentId}`;
      
      const { data } = await api.get(url);
      
      const dataMap: { [date: string]: string } = {};
      data.data.forEach((item: any) => {
        dataMap[item.date] = item.status;
      });
      setAttendanceData(dataMap);
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Failed to load calendar data', 'error', 'fa-times-circle');
    } finally {
      setLoading(false);
    }
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleManualUpdate = async (status: string) => {
    if (!studentId) return;
    setUpdating(true);
    try {
      await api.post('/attendance/manual', {
        course_code: courseCode,
        student_id: studentId,
        date: selectedDate,
        status: status
      });
      toast(`Attendance manually updated to ${status}`, 'success', 'fa-check');
      fetchCalendarData();
      if (onUpdate) onUpdate();
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Update failed', 'error', 'fa-times-circle');
    } finally {
      setUpdating(false);
    }
  };

  const handleResetAttendance = async () => {
    if (!studentId) return;
    if (!confirm('Are you sure you want to reset ALL attendance records for this subject to 0? This cannot be undone.')) return;
    
    setUpdating(true);
    try {
      await api.post('/attendance/reset', {
        course_code: courseCode,
        student_id: studentId
      });
      toast('Attendance reset to 0', 'success', 'fa-redo-alt');
      fetchCalendarData();
      if (onUpdate) onUpdate();
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Reset failed', 'error', 'fa-times-circle');
    } finally {
      setUpdating(false);
    }
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    // Header
    const headerRow = weekDays.map(day => (
      <div key={day} style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)', padding: '10px 0', textAlign: 'center' }}>
        {day}
      </div>
    ));

    // Empty days before start of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} style={{ padding: '10px' }}></div>);
    }

    // Days in month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const status = attendanceData[dateStr];

      let bgColor = 'var(--bg-surface)';
      let color = 'var(--text-primary)';
      let tooltip = '';
      
      if (status === 'Approved' || status === 'Late') {
        bgColor = 'rgba(16, 185, 129, 0.15)'; // emerald
        color = '#10b981';
        tooltip = 'Present';
      } else if (status === 'Absent' || status === 'Pending') {
        bgColor = 'rgba(239, 68, 68, 0.15)'; // red
        color = '#ef4444';
        tooltip = status === 'Pending' ? 'Unapproved (Pending)' : 'Absent';
      }

      const isToday = dateStr === new Date().toLocaleString("en-CA", {timeZone: "Asia/Manila"}).split(',')[0];
      const isSelected = dateStr === selectedDate;

      days.push(
        <div key={i} title={tooltip} onClick={() => showManualPanel && setSelectedDate(dateStr)} style={{ 
          padding: '12px', 
          textAlign: 'center', 
          borderRadius: '8px', 
          background: isSelected ? 'var(--accent)' : bgColor, 
          color: isSelected ? 'white' : color,
          fontWeight: status ? 800 : 500,
          border: isToday && !isSelected ? '1px solid var(--text-muted)' : '1px solid transparent',
          cursor: showManualPanel || status ? 'pointer' : 'default',
          transition: 'all 0.2s',
          fontSize: '13px',
          boxShadow: isSelected ? '0 4px 10px color-mix(in srgb, var(--accent) 30%, transparent)' : 'none'
        }} className={showManualPanel || status ? 'hover-scale' : ''}>
          {i}
        </div>
      );
    }

    return (
      <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={prevMonth} className="btn-secondary" style={{ padding: '6px 12px' }}><i className="fas fa-chevron-left"></i></button>
            <button onClick={nextMonth} className="btn-secondary" style={{ padding: '6px 12px' }}><i className="fas fa-chevron-right"></i></button>
          </div>
        </div>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)', 
          gap: '8px' 
        }}>
          {headerRow}
          {days}
        </div>
        
        <div style={{ display: 'flex', gap: '16px', marginTop: '20px', fontSize: '12px', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '12px', height: '12px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981' }}></span> Present</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '12px', height: '12px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444' }}></span> Absent / Unapproved</div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <i className="fas fa-circle-notch fa-spin fa-2x" style={{ marginBottom: '12px' }}></i>
      <div>Loading calendar data...</div>
    </div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Attendance tracking for <b style={{ color: 'var(--text-primary)' }}>{courseCode}</b>
        </div>
        {canEditAttendance && studentId && (
          <button 
            className="btn-secondary" 
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}
            title="Toggle Custom Attendance"
          >
            <i className={`fas ${isPanelOpen ? 'fa-times' : 'fa-edit'}`}></i> {isPanelOpen ? 'Close Editor' : 'Edit Attendance'}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          {renderCalendar()}
        </div>
        {showManualPanel && (
          <div style={{ width: '280px', background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <button 
                onClick={handleResetAttendance}
                disabled={updating}
                className="btn-secondary" 
                style={{ padding: '4px 8px', fontSize: '10px', color: '#ef4444', borderColor: '#fca5a5' }}
                title="Reset all attendance for this subject to 0"
              >
                <i className="fas fa-redo-alt"></i> Reset
              </button>
              <h4 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>Customize Attendance</h4>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>Manually correct or test records.</p>
            
            <div style={{ marginBottom: '16px' }}>
              <label className="label">Selected Date</label>
              <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-calendar-day" style={{ color: 'var(--accent)' }}></i> {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className="btn-primary" 
                style={{ width: '100%', background: '#10b981', padding: '12px', border: 'none' }}
                onClick={() => handleManualUpdate('Approved')}
                disabled={updating}
              >
                <i className="fas fa-check-circle" style={{ marginRight: '6px' }}></i> Mark Present (Green)
              </button>
              <button 
                className="btn-danger" 
                style={{ width: '100%', background: '#ef4444', padding: '12px', border: 'none', color: 'white', borderRadius: '10px', fontWeight: 'bold' }}
                onClick={() => handleManualUpdate('Absent')}
                disabled={updating}
              >
                <i className="fas fa-times-circle" style={{ marginRight: '6px' }}></i> Mark Absent (Red)
              </button>
              <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }}></div>
              <button 
                className="btn-secondary" 
                style={{ width: '100%', padding: '12px', borderRadius: '10px' }}
                onClick={() => handleManualUpdate('Remove')}
                disabled={updating}
              >
                <i className="fas fa-trash-alt" style={{ marginRight: '6px', color: 'var(--text-secondary)' }}></i> Clear Record
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
