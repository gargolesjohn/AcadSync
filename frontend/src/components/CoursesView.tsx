import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../store/auth';
import type { Course } from '../types';
import { toast } from '../utils';
import { Modal } from './Modal';

export function CoursesView() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', units: 3 });
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [search, setSearch] = useState('');

  const isInstructor = user?.role === 'instructor';

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const { data: response } = await api.get('/courses');
      setCourses(response.data || []);
    } catch (e) {
      toast('Failed to load courses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast('Please fill in all fields', 'error', 'fa-exclamation-circle');
      return;
    }
    setSaving(true);
    try {
      if (editingCourse) {
        await api.put(`/courses/${editingCourse.id}`, form);
        toast('Course updated successfully!', 'success', 'fa-check-circle');
      } else {
        await api.post('/courses', form);
        toast('Course created successfully!', 'success', 'fa-check-circle');
      }
      setShowAdd(false);
      setEditingCourse(null);
      setForm({ code: '', name: '', units: 3 });
      fetchCourses();
    } catch (e: any) {
      toast(e.response?.data?.detail || `Failed to ${editingCourse ? 'update' : 'create'} course`, 'error', 'fa-times-circle');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (course: Course) => {
    setForm({ code: course.code, name: course.name, units: course.units || 3 });
    setEditingCourse(course);
    setShowAdd(true);
  };

  const deleteCourse = async (id: number) => {
    if (!confirm('Are you sure you want to delete this course?')) return;
    try {
      await api.delete(`/courses/${id}`);
      toast('Course deleted', 'info', 'fa-trash');
      fetchCourses();
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Failed to delete', 'error', 'fa-times-circle');
    }
  };

  const filteredCourses = courses.filter(c => 
    c.code.toLowerCase().includes(search.toLowerCase()) || 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px' }}>Course Management</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            {isInstructor ? 'Subjects assigned to your sections' : 'Manage the academic programs and subject codes'}
          </p>
        </div>
        {!isInstructor && (
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <i className="fas fa-plus" style={{ marginRight: 6 }}></i>Add Course
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ position: 'relative', maxWidth: 400 }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
          <input className="input" style={{ paddingLeft: 40 }} placeholder="Search course code or name..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Loading courses...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                {['COURSE CODE', 'PROGRAM / COURSE NAME', 'UNITS / HOURS'].map(h => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                ))}
                {!isInstructor && <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {filteredCourses.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800 }}>{c.code}</span>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</td>
                  <td style={{ padding: '14px 20px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {c.units} Units ({c.units} Hours)
                  </td>
                  {!isInstructor && (
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => openEdit(c)} className="btn-secondary" style={{ color: 'var(--primary)', padding: '6px 10px', border: 'none' }} title="Edit Course">
                          <i className="fas fa-edit"></i>
                        </button>
                        <button onClick={() => deleteCourse(c.id)} className="btn-secondary" style={{ color: '#ef4444', padding: '6px 10px', border: 'none' }} title="Delete Course">
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredCourses.length === 0 && (
                <tr>
                  <td colSpan={isInstructor ? 3 : 4} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No courses found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <Modal onClose={() => { setShowAdd(false); setEditingCourse(null); setForm({ code: '', name: '', units: 3 }); }} title={editingCourse ? "Edit Course" : "Add New Course"} icon="fa-book">
          <div style={{ marginBottom: 16 }}>
            <label className="label">Course Code *</label>
            <input className="input" placeholder="e.g. BSIT" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="label">Course Name *</label>
            <input className="input" placeholder="e.g. Bachelor of Science in Information Technology" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="label">Units *</label>
            <input className="input" type="number" min="1" max="10" placeholder="e.g. 3" value={form.units} onChange={e => setForm({ ...form, units: parseInt(e.target.value) || 0 })} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => { setShowAdd(false); setEditingCourse(null); setForm({ code: '', name: '', units: 3 }); }}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <i className="fas fa-spinner fa-spin"></i> : (editingCourse ? 'Save Changes' : 'Create Course')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
