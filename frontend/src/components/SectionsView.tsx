import { useEffect, useState, useMemo } from 'react';
import api from '../api/client';
import type { User, Section, Course } from '../types';
import { toast } from '../utils';
import { Modal } from './Modal';

export function SectionsView() {
  const [sections, setSections] = useState<Section[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState<Section | null>(null);
  const [showView, setShowView] = useState<Section | null>(null);
  const [viewStudents, setViewStudents] = useState<User[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState('All Years');
  const [filterStatus, setFilterStatus] = useState('All Status');

  // Form states
  const initialForm = { 
    name: '', 
    year_level: '1st Year', 
    course_ids: [] as number[], 
    instructor_ids: [] as string[],
    subject_assignments: [] as {course_id: number, instructor_id: string}[],
    student_ids: [] as string[] 
  };
  const [form, setForm] = useState(initialForm);
  const [allStudents, setAllStudents] = useState<User[]>([]);

  useEffect(() => {
    fetchSections();
    fetchCourses();
    fetchInstructors();
    fetchAvailableStudents();
  }, []);

  const fetchSections = async () => {
    try {
      const { data } = await api.get('/users/sections');
      setSections(data.data || []);
    } catch (e) {
      toast('Failed to load sections', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const { data: response } = await api.get('/courses');
      setCourses(response.data || []);
    } catch (e) {}
  };

  const fetchInstructors = async () => {
    try {
      const { data } = await api.get('/users?role=instructor&per_page=100');
      const instructorsList = data.data?.items || [];
      
      try {
        const { data: facultyData } = await api.get('/users?role=program_head&per_page=100');
        const facultyList = facultyData.data?.items || [];
        setInstructors([...instructorsList, ...facultyList]);
      } catch {
        setInstructors(instructorsList);
      }
    } catch (e) {}
  };

  const fetchAvailableStudents = async () => {
    try {
      const { data } = await api.get('/users?role=student&per_page=1000');
      setAllStudents(data.data?.items || []);
    } catch (e) {}
  };

  const filteredSections = useMemo(() => {
    return sections.filter(s => {
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        s.name.toLowerCase().includes(searchLower) ||
        (s.courses && s.courses.some(c => c.name.toLowerCase().includes(searchLower))) ||
        (s.instructors && s.instructors.some(i => i.name.toLowerCase().includes(searchLower)));
      
      const matchesYear = filterYear === 'All Years' || s.year_level === filterYear;
      const matchesStatus = filterStatus === 'All Status' || s.status === filterStatus;
      
      return matchesSearch && matchesYear && matchesStatus;
    });
  }, [sections, search, filterYear, filterStatus]);

  const handleCreate = async () => {
    if (!form.name || form.course_ids.length === 0 || form.instructor_ids.length === 0) {
      toast('Please fill name, courses, and instructors', 'error', 'fa-exclamation-circle');
      return;
    }
    setSaving(true);
    try {
      await api.post('/users/sections', form);
      toast('Section created successfully!', 'success', 'fa-check-circle');
      setShowAdd(false);
      setForm(initialForm);
      fetchSections();
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Failed to create section', 'error', 'fa-times-circle');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!showEdit) return;
    setSaving(true);
    try {
      await api.patch(`/users/sections/${showEdit.id}`, form);
      toast('Section updated!', 'success', 'fa-check-circle');
      setShowEdit(null);
      fetchSections();
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Failed to update', 'error', 'fa-times-circle');
    } finally {
      setSaving(false);
    }
  };

  const deleteSection = async (id: number) => {
    if (!confirm('Are you sure you want to delete this section? This action cannot be undone.')) return;
    try {
      await api.delete(`/users/sections/${id}`);
      toast('Section deleted', 'info', 'fa-trash');
      fetchSections();
    } catch (e) {
      toast('Failed to delete', 'error', 'fa-times-circle');
    }
  };

  const updateSectionStatus = async (id: number, status: string) => {
    try {
      await api.patch(`/users/sections/${id}`, { status });
      toast(`Section is now ${status}`, 'success', 'fa-check-circle');
      fetchSections();
    } catch (e) {
      toast('Update failed', 'error', 'fa-times-circle');
    }
  };

  const openEdit = (s: Section) => {
    setForm({
      name: s.name,
      year_level: s.year_level,
      course_ids: s.courses.map(c => c.id),
      instructor_ids: s.instructors.map(i => i.id),
      subject_assignments: s.subject_assignments || [],
      student_ids: []
    });
    setShowEdit(s);
  };

  const openView = (sectionId: number) => {
    const s = sections.find(x => x.id === sectionId);
    if (s) {
      setShowView(s);
      fetchViewStudents(s.id);
    }
  };

  const fetchViewStudents = async (sectionId: number) => {
    setLoadingStudents(true);
    try {
      const { data } = await api.get(`/users/sections/${sectionId}/students`);
      setViewStudents(data.data);
    } finally {
      setLoadingStudents(false);
    }
  };

  const MultiSelect = ({ 
    label, 
    options, 
    selected, 
    onChange, 
    placeholder,
    displayKey = 'name'
  }: { 
    label: string, 
    options: any[], 
    selected: any[], 
    onChange: (ids: any[]) => void, 
    placeholder: string,
    displayKey?: string
  }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const filtered = options.filter(opt => 
      !selected.includes(opt.id) && 
      (opt[displayKey] as string).toLowerCase().includes(query.toLowerCase())
    );

    return (
      <div style={{ marginBottom: 16, position: 'relative' }}>
        <label className="label">{label}</label>
        <div style={{ 
          minHeight: 42, 
          padding: '4px 8px', 
          background: 'var(--bg-surface)', 
          border: '1px solid var(--border)', 
          borderRadius: 10,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
          cursor: 'text'
        }} onClick={() => setOpen(true)}>
          {selected.map(id => {
            const opt = options.find(o => o.id === id);
            return (
              <span key={id} style={{ 
                background: 'var(--accent)', 
                color: 'white', 
                padding: '2px 10px', 
                borderRadius: 20, 
                fontSize: 11, 
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                {opt ? opt[displayKey] : id}
                <i className="fas fa-times" style={{ cursor: 'pointer', fontSize: 10 }} onClick={(e) => {
                  e.stopPropagation();
                  onChange(selected.filter(sid => sid !== id));
                }}></i>
              </span>
            );
          })}
          <input 
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, flex: 1, minWidth: 60 }}
            placeholder={selected.length === 0 ? placeholder : ''}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
        </div>
        {open && filtered.length > 0 && (
          <div style={{ 
            position: 'absolute', 
            top: '100%', 
            left: 0, 
            right: 0, 
            zIndex: 100, 
            background: 'white', 
            border: '1px solid var(--border)', 
            borderRadius: 10, 
            marginTop: 4, 
            maxHeight: 200, 
            overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            {filtered.map(opt => (
              <div 
                key={opt.id} 
                style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}
                className="table-row-hover"
                onClick={() => {
                  onChange([...selected, opt.id]);
                  setQuery('');
                  setOpen(false);
                }}
              >
                {opt[displayKey]} {opt.id.length > 5 ? `(${opt.id})` : ''}
              </div>
            ))}
          </div>
        )}
        {open && <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />}
      </div>
    );
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>Loading Section Management...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px' }}>Section Management</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Advanced control for courses and instructor assignments</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(initialForm); setShowAdd(true); }}>
          <i className="fas fa-plus" style={{ marginRight: 6 }}></i>Add New Section
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
            <i className="fas fa-search" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
            <input className="input" style={{ paddingLeft: 40 }} placeholder="Search sections, courses, or professors..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: 140 }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
            <option>All Years</option>
            <option>1st Year</option>
            <option>2nd Year</option>
            <option>3rd Year</option>
            <option>4th Year</option>
          </select>
          <select className="input" style={{ width: 140 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
            <option>Archived</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
              {['SECTION NAME', 'YEAR LEVEL', 'COURSES', 'PROFESSORS', 'STATUS', 'ACTIONS'].map(h => (
                <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredSections.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{s.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>{new Date(s.created_at).toLocaleDateString()}</div>
                </td>
                <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600 }}>{s.year_level}</td>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {s.courses.map(c => (
                      <span key={c.id} style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{c.name}</span>
                    ))}
                    {s.courses.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>No courses</span>}
                  </div>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {s.instructors.map(i => {
                      const subjectCount = s.subject_assignments?.filter(sa => sa.instructor_id === i.id).length || 0;
                      return (
                        <span key={i.id} style={{ background: '#eef2ff', color: 'var(--accent)', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700 }} title={`${subjectCount} subject(s)`}>
                          {i.name} {subjectCount > 0 && `(${subjectCount})`}
                        </span>
                      );
                    })}
                    {s.instructors.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Unassigned</span>}
                  </div>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <select 
                    className={`input ${s.status === 'Active' ? 'text-success' : 'text-muted'}`} 
                    style={{ padding: '4px 8px', fontSize: '11px', width: 'auto', fontWeight: 700 }}
                    value={s.status}
                    onChange={(e) => updateSectionStatus(s.id, e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Archived">Archived</option>
                  </select>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openView(s.id)} className="btn-secondary" style={{ padding: '6px', width: 32, height: 32 }} title="View"><i className="fas fa-eye"></i></button>
                    <button onClick={() => openEdit(s)} className="btn-secondary" style={{ padding: '6px', width: 32, height: 32 }} title="Edit"><i className="fas fa-pen"></i></button>
                    <button onClick={() => deleteSection(s.id)} className="btn-secondary" style={{ padding: '6px', width: 32, height: 32, color: '#ef4444' }} title="Delete"><i className="fas fa-trash"></i></button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredSections.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <i className="fas fa-layer-group" style={{ fontSize: 24, opacity: 0.3, marginBottom: 12, display: 'block' }}></i>
                  No sections found. Try adjusting your search or filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {(showAdd || showEdit) && (
        <Modal onClose={() => { setShowAdd(false); setShowEdit(null); }} title={showAdd ? 'Add New Section' : `Edit Section: ${showEdit?.name}`} icon="fa-layer-group">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 2 }}>
              <label className="label">Section Name *</label>
              <input 
                className="input" 
                placeholder="e.g. BSIT 1-A" 
                value={form.name} 
                onChange={e => {
                  const name = e.target.value;
                  let detectedYear = form.year_level;
                  const digitMatch = name.match(/[1-4]/);
                  if (digitMatch) {
                    const map: any = { '1': '1st Year', '2': '2nd Year', '3': '3rd Year', '4': '4th Year' };
                    detectedYear = map[digitMatch[0]];
                  }
                  setForm({ ...form, name, year_level: detectedYear });
                }} 
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Year Level *</label>
              <select className="input" value={form.year_level} onChange={e => setForm({ ...form, year_level: e.target.value })}>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>
          </div>

          <MultiSelect 
            label="Program / Courses *" 
            options={courses} 
            selected={form.course_ids} 
            onChange={ids => setForm({ ...form, course_ids: ids })} 
            placeholder="Select one or more courses" 
          />

          <MultiSelect 
            label="Assigned Instructors *" 
            options={instructors} 
            selected={form.instructor_ids} 
            onChange={ids => setForm({ ...form, instructor_ids: ids })} 
            placeholder="Search and assign professors" 
          />

          {form.instructor_ids.length > 0 && form.course_ids.length > 0 && (
            <div style={{ marginBottom: 16, background: 'var(--bg-surface)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
              <label className="label" style={{ marginBottom: 12 }}>Assign Subjects to Professors</label>
              {form.instructor_ids.map(iid => {
                const inst = instructors.find(x => x.id === iid);
                if (!inst) return null;
                
                // Get assignments for this instructor
                const instAssignments = form.subject_assignments.filter(sa => sa.instructor_id === iid);
                const assignedCount = instAssignments.length;
                
                return (
                  <div key={iid} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{inst.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: assignedCount > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {assignedCount} {assignedCount === 1 ? 'Subject' : 'Subjects'} Assigned
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {form.course_ids.map(cid => {
                        const c = courses.find(x => x.id === cid);
                        if (!c) return null;
                        
                        const isAssigned = instAssignments.some(sa => sa.course_id === cid);
                        
                        return (
                          <div 
                            key={cid}
                            onClick={() => {
                              let newAssignments = [...form.subject_assignments];
                              if (isAssigned) {
                                newAssignments = newAssignments.filter(sa => !(sa.instructor_id === iid && sa.course_id === cid));
                              } else {
                                newAssignments.push({ course_id: cid, instructor_id: iid });
                              }
                              setForm({ ...form, subject_assignments: newAssignments });
                            }}
                            style={{ 
                              padding: '6px 12px', 
                              borderRadius: 8, 
                              fontSize: 11, 
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: isAssigned ? '1px solid var(--accent)' : '1px solid var(--border)',
                              background: isAssigned ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg-card)',
                              color: isAssigned ? 'var(--accent)' : 'var(--text-secondary)',
                              transition: 'all 0.2s'
                            }}
                          >
                            {isAssigned && <i className="fas fa-check" style={{ marginRight: 4 }}></i>}
                            {c.code}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <MultiSelect 
            label="Enroll Students" 
            options={allStudents} 
            selected={form.student_ids} 
            onChange={ids => setForm({ ...form, student_ids: ids })} 
            placeholder="Search and enroll students" 
          />
          
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
            <button className="btn-secondary" onClick={() => { setShowAdd(false); setShowEdit(null); }}>Cancel</button>
            <button className="btn-primary" onClick={showAdd ? handleCreate : handleUpdate} disabled={saving}>
              {saving ? <i className="fas fa-spinner fa-spin"></i> : (showAdd ? 'Create Section' : 'Save Changes')}
            </button>
          </div>
        </Modal>
      )}

      {/* View Modal */}
      {showView && (
        <Modal onClose={() => setShowView(null)} title={`Section Details: ${showView.name}`} icon="fa-eye" width={800}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: 16 }}>
              <div className="label">Subjects & Assigned Professors</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginTop: 12, maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
                {showView.courses.map(c => {
                   const assignedSa = showView.subject_assignments?.find((sa: any) => sa.course_id === c.id);
                   const assignedProf = assignedSa ? showView.instructors.find((i: any) => i.id === assignedSa.instructor_id) : null;
                   return (
                     <div key={c.id} style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.code} - {c.name}</div>
                        {assignedProf ? (
                           <span style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                              <i className="fas fa-user-tie" style={{ marginRight: 6 }}></i>{assignedProf.name}
                           </span>
                        ) : (
                           <span style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                              <i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }}></i>No Professor Assigned
                           </span>
                        )}
                     </div>
                   );
                })}
                {showView.courses.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No courses assigned to this section.</div>
                )}
              </div>
            </div>
          </div>

          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Enrolled Students
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{viewStudents.length} Total</span>
          </div>

          <div className="card" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {loadingStudents ? <div style={{ padding: 40, textAlign: 'center' }}>Loading students...</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                    {['STUDENT ID', 'FULL NAME', 'EMAIL', 'STATUS'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewStudents.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700 }}>{s.id}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{s.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{s.email}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          background: s.enrollment_status === 'Regular' ? '#dcfce7' : '#fee2e2', 
                          color: s.enrollment_status === 'Regular' ? '#16a34a' : '#dc2626',
                          padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700
                        }}>{s.enrollment_status}</span>
                      </td>
                    </tr>
                  ))}
                  {viewStudents.length === 0 && <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No students in this section</td></tr>}
                </tbody>
              </table>
            )}
          </div>
          
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setShowView(null)}>Close Details</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
