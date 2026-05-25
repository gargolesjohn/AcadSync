import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';
import api from '../api/client';
import type { Schedule } from '../types';
import { toast, getTodayName } from '../utils';
import { Modal } from './Modal';

interface PendingSchedule {
  course_code: string;
  course_name: string;
  section_name: string;
  section_id: number;
  units: number;
  scheduled_hours: number;
  existing_schedules?: any[];
}

interface Block {
  day_of_week: string;
  start_time: string;
  end_time: string;
  room_location: string;
}

export function ScheduleView() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [pending, setPending] = useState<PendingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<{ course_code: string; course_label: string; section_or_instructor: string; units: number; blocks: Block[] }>({ 
    course_code: '', course_label: '', section_or_instructor: '', units: 3, blocks: [] 
  });
  const [saving, setSaving] = useState(false);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const isIns = user?.role === 'instructor' || user?.role === 'program_head';

  useEffect(() => { 
    fetchData(); 
    if (isIns) fetchPending();
  }, []);

  const fetchData = async () => {
    try { 
      const { data } = await api.get(`/schedules?_t=${new Date().getTime()}`); 
      setSchedule(data.data || []); 
    } catch(e) {}
    finally { setLoading(false); }
  };

  const fetchPending = async () => {
    try {
      const { data } = await api.get(`/schedules/pending?_t=${new Date().getTime()}`);
      setPending(data.data || []);
    } catch(e) {}
  };

  const removeSchedule = async (id: number) => {
    if (!confirm('Remove this class?')) return;
    try { 
      await api.delete(`/schedules/${id}`); 
      await fetchData(); 
      if (isIns) await fetchPending();
    }
    catch { toast('Error removing class', 'error', 'fa-times-circle'); }
  };

  const handleAdd = async () => {
    if (!form.course_code || !form.course_label || !form.section_or_instructor) {
      toast('Please fill in all fields', 'error', 'fa-exclamation-circle'); return;
    }
    for (const b of form.blocks) {
      if (!b.room_location) {
        toast('Please fill in all room locations', 'error', 'fa-exclamation-circle'); return;
      }
    }
    
    const total_hours = calculateHours(form.blocks);
    if (Math.abs(total_hours - form.units) > 0.01) {
      if (total_hours > form.units) {
        toast('Schedule exceeds allowed weekly hours based on subject units.', 'error', 'fa-times-circle');
      } else {
        toast(`Incomplete schedule: Please add ${form.units - total_hours} more hours.`, 'error', 'fa-exclamation-triangle');
      }
      return;
    }
    
    setSaving(true);
    try {
      await api.post('/schedules/batch', {
        course_code: form.course_code,
        course_label: form.course_label,
        section_or_instructor: form.section_or_instructor,
        blocks: form.blocks
      });
      toast('Class schedule saved!', 'success', 'fa-check-circle');
      
      setShowAdd(false);
      setForm({ course_code: '', course_label: '', section_or_instructor: '', units: 3, blocks: [] });
      await fetchData();
      if (isIns) await fetchPending();
    } catch (e: any) { toast(e.response?.data?.detail || 'Failed to save', 'error', 'fa-times-circle'); }
    finally { setSaving(false); }
  };

  const calculateHours = (blocks: Block[]) => {
    return blocks.reduce((acc, b) => {
      try {
        const [sh, sm] = b.start_time.split(':').map(Number);
        const [eh, em] = b.end_time.split(':').map(Number);
        const sDate = new Date(); sDate.setHours(sh, sm, 0);
        const eDate = new Date(); eDate.setHours(eh, em, 0);
        let diff = (eDate.getTime() - sDate.getTime()) / 3600000;
        if (diff > 0) return acc + diff;
      } catch (e) {}
      return acc;
    }, 0);
  };

  const openSetSchedule = (p: PendingSchedule) => {
    const existingBlocks = (p.existing_schedules || []).map(s => ({
      day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time, room_location: s.room_location
    }));
    if (existingBlocks.length === 0) {
      existingBlocks.push({ day_of_week: 'Monday', start_time: '08:00', end_time: '09:30', room_location: '' });
    }
    
    setForm({
      course_code: p.course_code,
      course_label: p.course_name,
      section_or_instructor: p.section_name,
      units: p.units,
      blocks: existingBlocks
    });
    setShowAdd(true);
  };

  const openEditSchedule = (s: Schedule) => {
    // Find all schedules for this course and section
    const related = schedule.filter(sch => sch.course_code === s.course_code && sch.section_or_instructor === s.section_or_instructor);
    const existingBlocks = related.map(sch => ({
      day_of_week: sch.day_of_week, start_time: sch.start_time, end_time: sch.end_time, room_location: sch.room_location
    }));
    
    setForm({
      course_code: s.course_code,
      course_label: s.course_label,
      section_or_instructor: s.section_or_instructor,
      units: s.units || 3,
      blocks: existingBlocks
    });
    setShowAdd(true);
  };

  const addBlock = () => {
    setForm({ ...form, blocks: [...form.blocks, { day_of_week: 'Monday', start_time: '08:00', end_time: '09:30', room_location: '' }] });
  };

  const removeBlock = (index: number) => {
    const newBlocks = [...form.blocks];
    newBlocks.splice(index, 1);
    setForm({ ...form, blocks: newBlocks });
  };
  
  const updateBlock = (index: number, field: string, value: string) => {
    const newBlocks = [...form.blocks];
    (newBlocks[index] as any)[field] = value;
    setForm({ ...form, blocks: newBlocks });
  };

  const renderSchedPill = (s: Schedule) => (
    <div key={s.id} className="sched-pill" style={{ position: 'relative', overflow: 'hidden', minHeight: '80px', cursor: 'pointer' }} onClick={() => setSelectedSchedule(s)}>
      <div style={{ position: 'absolute', top: '6px', right: '6px', display: 'flex', gap: '4px' }}>
        {isIns && (
          <button onClick={(e) => { e.stopPropagation(); openEditSchedule(s); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'rgba(255,255,255,0.9)', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px' }} title="Edit">
            <i className="fas fa-pen" style={{ fontSize: '10px' }}></i>
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); removeSchedule(s.id); }} style={{ background: 'rgba(0,0,0,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px' }} title="Remove">
          <i className="fas fa-times" style={{ fontSize: '10px' }}></i>
        </button>
      </div>
      <div style={{ fontSize: '9px', opacity: 0.8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{s.start_time}-{s.end_time}</div>
      <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '2px', lineHeight: 1.2 }}>{s.course_code}</div>
      <div style={{ fontSize: '10px', opacity: 0.9, marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.course_label}</div>
      <div style={{ fontSize: '9px', background: 'rgba(0,0,0,0.15)', padding: '3px 6px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
        <i className="fas fa-map-marker-alt"></i> {s.room_location}
      </div>
      <div style={{ fontSize: '9px', marginTop: '6px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
        <i className={isIns ? 'fas fa-users' : 'fas fa-chalkboard-teacher'}></i> {s.section_or_instructor}
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px' }}>Class Schedule</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{isIns ? 'Set and manage your teaching hours' : 'Your enrolled classes'} this semester</p>
        </div>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div> : (
        <div className="card fade-in" style={{ overflow: 'hidden', marginBottom: '32px' }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <div style={{ minWidth: '1000px' }}>
              <div className="schedule-grid-header" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                {days.map(day => (
                  <div key={day} style={{ padding: '14px', textAlign: 'center', borderRight: '1px solid var(--border)', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {day === getTodayName() ? <span style={{ background: 'var(--accent)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '11px' }}>{day}</span> : day}
                  </div>
                ))}
              </div>
              <div className="schedule-grid-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', minHeight: '400px' }}>
            {days.map((day, i) => {
              const slots = schedule.filter(s => s.day_of_week === day);
              return (
                <div key={day} className="schedule-day-col" style={{ borderRight: i === 6 ? 'none' : '1px solid var(--border)', padding: '12px', background: day === getTodayName() ? 'color-mix(in srgb, var(--accent) 02%, transparent)' : 'none' }}>
                  {slots.length > 0 ? slots.map(renderSchedPill) : <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--text-muted)', fontSize: '10px', opacity: 0.5 }}>No class</div>}
                </div>
              );
            })}
              </div>
            </div>
          </div>
        </div>
      )}

      {isIns && pending.length > 0 && (
        <div className="fade-in" style={{ paddingBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ width: '4px', height: '20px', background: '#f59e0b', borderRadius: '2px' }}></div>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Action Required: Pending Class Schedules ({pending.length})
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {pending.map((p, idx) => (
              <div key={idx} className="card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <span style={{ background: '#fffbeb', color: '#92400e', padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 800 }}>{p.course_code}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>{p.section_name}</span>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>{p.course_name}</div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>Requires {p.units} hrs/week • Scheduled: {p.scheduled_hours?.toFixed(1) || 0} hrs</p>
                </div>
                <button className="btn-primary" style={{ width: '100%', padding: '10px', fontSize: '12px', background: '#f59e0b', border: 'none' }} onClick={() => openSetSchedule(p)}>
                  <i className="fas fa-calendar-plus" style={{ marginRight: 8 }}></i>{p.scheduled_hours > 0 ? 'Complete Schedule' : 'Set Class Schedule'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} title="Batch Schedule Setup" icon="fa-calendar-check" width={700}>
          <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>SUBJECT & SECTION</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{form.course_code}: {form.course_label}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Target Section: {form.section_or_instructor}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '24px', fontWeight: 900, color: calculateHours(form.blocks) === form.units ? '#10b981' : '#f59e0b' }}>
                  {calculateHours(form.blocks).toFixed(1)} / {form.units.toFixed(1)}
                </div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>HOURS SCHEDULED</div>
              </div>
            </div>
            {Math.abs(calculateHours(form.blocks) - form.units) > 0.01 && (
              <div style={{ marginTop: '12px', padding: '10px', background: '#fffbeb', color: '#92400e', borderRadius: '8px', fontSize: '12px', fontWeight: 700, border: '1px dashed #fcd34d' }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }}></i>
                You must schedule exactly {form.units} hours per week for this subject. Please add or adjust time blocks.
              </div>
            )}
          </div>

          <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {form.blocks.map((b, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', background: 'var(--bg-body)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ width: '140px' }}>
                  <label className="label">Day</label>
                  <select className="input" value={b.day_of_week} onChange={e => updateBlock(idx, 'day_of_week', e.target.value)}>
                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={{ width: '120px' }}>
                  <label className="label">Start Time</label>
                  <input type="time" className="input" value={b.start_time} onChange={e => updateBlock(idx, 'start_time', e.target.value)} />
                </div>
                <div style={{ width: '120px' }}>
                  <label className="label">End Time</label>
                  <input type="time" className="input" value={b.end_time} onChange={e => updateBlock(idx, 'end_time', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Room</label>
                  <input className="input" placeholder="e.g. Room 401" value={b.room_location} onChange={e => updateBlock(idx, 'room_location', e.target.value)} />
                </div>
                <button className="btn-secondary hover-red" style={{ padding: '0', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => removeBlock(idx)} title="Remove Block">
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            ))}
            <button className="btn-secondary" style={{ padding: '12px', borderStyle: 'dashed' }} onClick={addBlock}>
              <i className="fas fa-plus" style={{ marginRight: '8px' }}></i> Add Time Block
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleAdd} disabled={saving}>
              {saving ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-check" style={{ marginRight: 6 }}></i>Save Schedule</>}
            </button>
          </div>
        </Modal>
      )}

      {selectedSchedule && (
        <Modal onClose={() => setSelectedSchedule(null)} title="Schedule Details" icon="fa-info-circle" width={500}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>
                  {selectedSchedule.course_code}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {selectedSchedule.day_of_week}
                </span>
              </div>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--text-primary)' }}>{selectedSchedule.course_label}</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <i className="fas fa-clock"></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedSchedule.start_time} - {selectedSchedule.end_time}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <i className="fas fa-map-marker-alt"></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Room Location</div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedSchedule.room_location}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <i className={isIns ? 'fas fa-users' : 'fas fa-chalkboard-teacher'}></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isIns ? 'Section' : 'Instructor'}</div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedSchedule.section_or_instructor}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px' }}>
              <button className="btn-secondary" onClick={() => setSelectedSchedule(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
