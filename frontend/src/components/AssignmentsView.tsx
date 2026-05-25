import { useEffect, useState } from 'react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { useAuth } from '../store/auth';
import api from '../api/client';
import type { Assignment, Submission, Course } from '../types';
import { formatDate, toast } from '../utils';
import { Modal } from './Modal';

export function AssignmentsView() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showSubmit, setShowSubmit] = useState<Assignment | null>(null);
  const [showSubs, setShowSubs] = useState<Assignment | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [createForm, setCreateForm] = useState({ course_code: '', course_name: '', title: '', description: '', due_date: '', max_points: 100 });
  const [saving, setSaving] = useState(false);
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ id: number; name: string } | null>(null);
  const [gradeId, setGradeId] = useState<number | null>(null);
  const [gradeVal, setGradeVal] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [txtContent, setTxtContent] = useState<string | null>(null);
  const [docxContent, setDocxContent] = useState<string | null>(null);
  const [xlsxContent, setXlsxContent] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isStudent = user?.role === 'student';
  const canCreate = user?.role === 'admin' || user?.role === 'instructor' || user?.role === 'program_head';

  useEffect(() => { fetchData(); fetchCourses(); }, []);

  const fetchData = async () => {
    try { 
      const { data } = await api.get('/assignments'); 
      setAssignments(data.data.items || []); 
    } catch (e) {
      toast('Failed to load assignments', 'error');
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

  const handleCreate = async () => {
    const f = createForm;
    if (!f.course_code || !f.course_name || !f.title || !f.description || !f.due_date) {
      toast('Please fill in all fields', 'error', 'fa-exclamation-circle'); return;
    }
    setSaving(true);
    try {
      await api.post('/assignments', { ...f, due_date: new Date(f.due_date).toISOString(), max_points: Number(f.max_points) });
      toast('Assignment created!', 'success', 'fa-check-circle');
      setShowCreate(false);
      setCreateForm({ course_code: '', course_name: '', title: '', description: '', due_date: '', max_points: 100 });
      fetchData();
    } catch (e: any) { toast(e.response?.data?.detail || 'Failed to create', 'error', 'fa-times-circle'); }
    finally { setSaving(false); }
  };

  const handleSubmitWork = async () => {
    if (!submitFile || !showSubmit) { toast('Please select a file', 'error', 'fa-exclamation-circle'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', submitFile);
      await api.post(`/submissions/${showSubmit.id}/submit`, fd);
      toast('Submitted successfully!', 'success', 'fa-check-circle');
      setShowSubmit(null); setSubmitFile(null);
      fetchData();
    } catch (e: any) { 
      const msg = e.response?.data?.detail || e.message || 'Failed to submit';
      toast(msg, 'error', 'fa-times-circle'); 
    }
    finally { setSubmitting(false); }
  };

  const viewSubmissions = async (a: Assignment) => {
    setShowSubs(a); setSubsLoading(true);
    try {
      const { data } = await api.get(`/assignments/${a.id}`);
      setSubs(data.data.submissions || []);
    } finally { setSubsLoading(false); }
  };

  useEffect(() => {
    const handleAssignmentUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      fetchData();
      if (showSubs && (!detail?.assignment_id || detail.assignment_id === showSubs.id)) {
        viewSubmissions(showSubs);
      }
    };

    const handleGradeUpdate = () => {
      // When grades change from the Grades tab, refresh submissions too
      if (showSubs) viewSubmissions(showSubs);
    };

    window.addEventListener('assignment-updated', handleAssignmentUpdate);
    window.addEventListener('grade-updated', handleGradeUpdate);
    return () => {
      window.removeEventListener('assignment-updated', handleAssignmentUpdate);
      window.removeEventListener('grade-updated', handleGradeUpdate);
    };
  }, [showSubs]);

  const handleGrade = async (subId: number) => {
    if (!gradeVal) { toast('Enter a grade', 'error', 'fa-exclamation-circle'); return; }
    try {
      await api.patch(`/submissions/${subId}/grade`, { grade: Number(gradeVal), feedback: gradeFeedback || null });
      toast('Graded!', 'success', 'fa-check-circle');
      setGradeId(null); setGradeVal(''); setGradeFeedback('');
      if (showSubs) viewSubmissions(showSubs);
    } catch (e: any) { toast(e.response?.data?.detail || 'Failed to grade', 'error', 'fa-times-circle'); }
  };

  const deleteAssignment = async (id: number) => {
    if (!confirm('Delete this assignment?')) return;
    await api.delete(`/assignments/${id}`);
    toast('Assignment deleted', 'info', 'fa-trash');
    fetchData();
  };

  useEffect(() => {
    if (!previewFile) {
      setTxtContent(null); setDocxContent(null); setXlsxContent(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }

    const name = previewFile.name.toLowerCase();
    const isTextFile = (n: string) => ['txt', 'py', 'js', 'ts', 'tsx', 'html', 'css', 'json', 'md', 'c', 'cpp', 'java', 'sql'].includes(n.split('.').pop() || '');
    const isDocxFile = (n: string) => n.endsWith('.docx');
    const isExcelFile = (n: string) => !!n.match(/\.(xlsx|xls|csv)$/);
    const isMediaFile = (n: string) => !!n.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|ico|mp4|webm|ogg|mov|mp3|wav|m4a|pdf)$/);

    setTxtContent(null); setDocxContent(null); setXlsxContent(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);

    if (isTextFile(name)) {
      api.get(`/submissions/${previewFile.id}/file`, { responseType: 'text' })
        .then(res => setTxtContent(typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2)))
        .catch(() => setTxtContent('Error loading text content. Check if you are still logged in.'));
    } else if (isDocxFile(name)) {
      api.get(`/submissions/${previewFile.id}/file`, { responseType: 'arraybuffer' })
        .then(res => {
          mammoth.convertToHtml({ arrayBuffer: res.data })
            .then(result => setDocxContent(result.value))
            .catch(() => setDocxContent('<p style="color: red;">Error converting DOCX to HTML.</p>'));
        })
        .catch(() => setDocxContent('<p style="color: red;">Error loading DOCX file.</p>'));
    } else if (isExcelFile(name)) {
      api.get(`/submissions/${previewFile.id}/file`, { responseType: 'arraybuffer' })
        .then(res => {
          const wb = XLSX.read(res.data, { type: 'array' });
          const html = XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]]);
          setXlsxContent(html);
        })
        .catch(() => setXlsxContent('<p style="color: red;">Error loading or converting Excel file.</p>'));
    } else if (isMediaFile(name)) {
      api.get(`/submissions/${previewFile.id}/file`, { responseType: 'blob' })
        .then(res => {
          const url = URL.createObjectURL(res.data);
          setPreviewUrl(url);
        })
        .catch(() => setTxtContent('Error loading file. Not authenticated?'));
    }
  }, [previewFile]);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px' }}>
            {isStudent ? 'My Assignments' : 'Assignment Management'}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            {isStudent ? 'Track your coursework' : 'Create assignments and grade submissions'}
          </p>
        </div>
        {canCreate && (
          <div className="page-header-actions">
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <i className="fas fa-plus" style={{ marginRight: '6px' }}></i>Create Assignment
            </button>
          </div>
        )}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626' }}></div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                {isStudent ? 'Pending Assignments' : 'Active Assignments'}
              </h3>
              <span style={{ fontSize: '11px', background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                {assignments.filter(a => isStudent ? !a.submitted_by_me : true).length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {assignments.filter(a => isStudent ? !a.submitted_by_me : true).map(a => (
                <div key={a.id} className="card fade-in" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <span style={{ background: '#eef2ff', color: 'var(--accent)', padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 800 }}>{a.course_code}</span>
                        {canCreate && <span style={{ background: '#fef3c7', color: '#d97706', padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700 }}>{a.submission_count} SUBMISSIONS</span>}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{a.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{a.course_name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '10px' }}>{a.description}</div>
                      <div style={{ display: 'flex', gap: '24px', marginTop: '12px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                        <div><span style={{ color: '#dc2626' }}>DUE</span><div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>{formatDate(a.due_date)}</div></div>
                        <div><span>POINTS</span><div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>{a.max_points}</div></div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {canCreate && <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => viewSubmissions(a)}>View Submissions</button>}
                      {isStudent && <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => setShowSubmit(a)}><i className="fas fa-upload" style={{ marginRight: 6 }}></i>Submit Work</button>}
                      {canCreate && <button style={{ background: 'none', color: '#dc2626', border: 'none', padding: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }} onClick={() => deleteAssignment(a.id)}><i className="fas fa-trash-alt"></i></button>}
                    </div>
                  </div>
                </div>
              ))}
              {assignments.filter(a => isStudent ? !a.submitted_by_me : true).length === 0 && (
                <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', borderStyle: 'dashed' }}>
                  No pending assignments. All caught up!
                </div>
              )}
            </div>
          </section>

          {isStudent && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }}></div>
                <h3 style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                  Completed / Submitted
                </h3>
                <span style={{ fontSize: '11px', background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                  {assignments.filter(a => a.submitted_by_me).length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {assignments.filter(a => a.submitted_by_me).map(a => (
                  <div key={a.id} className="card fade-in" style={{ padding: '16px 20px', opacity: 0.8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>{a.title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{a.course_code} · {a.course_name}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {a.my_submission && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '16px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                              Submitted: {formatDate(a.my_submission.submitted_at)}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => setPreviewFile({ id: a.my_submission!.id, name: a.my_submission!.file_name })} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="fas fa-eye"></i> View Work
                              </button>
                              {a.my_grade === null && new Date(a.due_date) > new Date() && (
                                <button onClick={() => setShowSubmit(a)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', borderColor: '#16a34a' }}>
                                  <i className="fas fa-redo"></i> Resubmit
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        {a.my_grade !== null ? (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>GRADE</div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent)' }}>{a.my_grade}/{a.max_points}</div>
                          </div>
                        ) : (
                          <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>PENDING GRADE</span>
                        )}
                        <span style={{ color: '#16a34a', fontSize: '18px' }}><i className="fas fa-check-circle"></i></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="Create Assignment" icon="fa-clipboard-list" width={580}>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Select Course *</label>
            <select 
              className="input" 
              value={createForm.course_code} 
              onChange={e => {
                const selected = courses.find(c => c.code === e.target.value);
                setCreateForm({ 
                  ...createForm, 
                  course_code: e.target.value, 
                  course_name: selected ? selected.name : '' 
                });
              }}
            >
              <option value="">Select a course...</option>
              {courses.map(c => (
                <option key={c.id} value={c.code}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Course Name (Auto-filled)</label>
            <input className="input" placeholder="Select a course above" value={createForm.course_name} readOnly style={{ background: '#f8fafc', color: '#64748b' }} />
          </div>
          <div style={{ marginBottom: 16 }}><label className="label">Title</label><input className="input" placeholder="Assignment title" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} /></div>
          <div style={{ marginBottom: 16 }}><label className="label">Description</label><textarea className="input" rows={3} placeholder="Instructions..." value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} style={{ resize: 'none' }} /></div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}><label className="label">Due Date</label><input type="datetime-local" className="input" value={createForm.due_date} onChange={e => setCreateForm({ ...createForm, due_date: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label className="label">Max Points</label><input type="number" className="input" value={createForm.max_points} onChange={e => setCreateForm({ ...createForm, max_points: Number(e.target.value) })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-plus" style={{ marginRight: 6 }}></i>Create</>}
            </button>
          </div>
        </Modal>
      )}

      {showSubmit && (
        <Modal onClose={() => { setShowSubmit(null); setSubmitFile(null); }} title={`Submit: ${showSubmit.title}`} icon="fa-upload" iconColor="#16a34a">
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              <strong>{showSubmit.course_code}</strong> · Due: {formatDate(showSubmit.due_date)} · {showSubmit.max_points} points
            </div>
            <label className="label">Upload File</label>
            <input type="file" className="input" onChange={e => setSubmitFile(e.target.files?.[0] || null)} style={{ padding: '10px' }} />
            {submitFile && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 8 }}><i className="fas fa-file"></i> {submitFile.name} ({(submitFile.size / 1024).toFixed(1)} KB)</div>}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => { setShowSubmit(null); setSubmitFile(null); }}>Cancel</button>
            <button className="btn-primary" onClick={handleSubmitWork} disabled={submitting}>
              {submitting ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-paper-plane" style={{ marginRight: 6 }}></i>Submit</>}
            </button>
          </div>
        </Modal>
      )}

      {showSubs && (
        <Modal onClose={() => { setShowSubs(null); setGradeId(null); }} title={`Submissions: ${showSubs.title}`} icon="fa-list-check" width={680}>
          {subsLoading ? <div style={{ textAlign: 'center', padding: 32 }}>Loading...</div> : (
            <div>
              {subs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No submissions yet</div>
              ) : (
                <div style={{ maxHeight: 450, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#f59e0b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fas fa-clock"></i> PENDING REVIEW ({subs.filter(s => s.grade === null).length})
                    </div>
                    {subs.filter(s => s.grade === null).map(s => (
                      <div key={s.id} style={{ padding: '12px 16px', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '8px', background: 'var(--bg-surface)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{s.student_name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                              <button onClick={() => setPreviewFile({ id: s.id, name: s.file_name })} style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: 11, color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                <i className="fas fa-eye"></i> View Submission
                              </button>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({s.file_name})</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.student_id}</div>
                          </div>
                          {gradeId === s.id ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input type="number" min={0} max={showSubs.max_points} className="input" style={{ width: 60, padding: '6px 8px', fontSize: 12 }} placeholder="Grade" value={gradeVal} onChange={e => setGradeVal(e.target.value)} />
                              <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 11 }} onClick={() => handleGrade(s.id)}>Save</button>
                              <button className="btn-secondary" style={{ padding: '6px 8px', fontSize: 11 }} onClick={() => setGradeId(null)}>✕</button>
                            </div>
                          ) : (
                            <button className="btn-primary" style={{ fontSize: 11, padding: '6px 12px' }} onClick={() => { setGradeId(s.id); setGradeVal(''); setGradeFeedback(''); }}>Grade</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fas fa-check-double"></i> GRADED ({subs.filter(s => s.grade !== null).length})
                    </div>
                    {subs.filter(s => s.grade !== null).map(s => (
                      <div key={s.id} style={{ padding: '12px 16px', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{s.student_name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                              <button onClick={() => setPreviewFile({ id: s.id, name: s.file_name })} style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: 11, color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                <i className="fas fa-eye"></i> View Submission
                              </button>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({s.file_name})</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.student_id}</div>
                          </div>
                          {gradeId === s.id ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input type="number" min={0} max={showSubs.max_points} className="input" style={{ width: 60, padding: '6px 8px', fontSize: 12 }} placeholder="Grade" value={gradeVal} onChange={e => setGradeVal(e.target.value)} />
                              <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 11 }} onClick={() => handleGrade(s.id)}>Save</button>
                              <button className="btn-secondary" style={{ padding: '6px 8px', fontSize: 11 }} onClick={() => setGradeId(null)}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ background: '#dcfce7', color: '#16a34a', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>{s.grade}/{showSubs.max_points}</span>
                              {canCreate && <button onClick={() => { setGradeId(s.id); setGradeVal(String(s.grade)); setGradeFeedback(''); }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: 11, color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><i className="fas fa-edit" style={{ fontSize: 10 }}></i> Edit</button>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {previewFile && (
        <Modal onClose={() => setPreviewFile(null)} title={`Preview: ${previewFile.name}`} icon="fa-file-alt" width={800}>
          <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', marginBottom: '16px', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {previewFile.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)$/) ? (
              previewUrl ? <img src={previewUrl} style={{ maxWidth: '100%', maxHeight: '600px', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} alt="Preview" /> : <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading image...</div>
            ) : previewFile.name.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/) ? (
              previewUrl ? <video src={previewUrl} controls style={{ maxWidth: '100%', maxHeight: '600px', borderRadius: '4px' }} /> : <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading video...</div>
            ) : previewFile.name.toLowerCase().match(/\.(mp3|wav|ogg|m4a)$/) ? (
              <div style={{ textAlign: 'center', width: '100%', padding: '40px' }}>
                <i className="fas fa-file-audio" style={{ fontSize: '48px', color: 'var(--accent)', marginBottom: '24px' }}></i>
                {previewUrl ? <audio src={previewUrl} controls style={{ width: '100%' }} /> : <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading audio...</div>}
              </div>
            ) : previewFile.name.toLowerCase().endsWith('.pdf') ? (
              previewUrl ? <iframe src={previewUrl} style={{ width: '100%', height: '600px', border: 'none', borderRadius: '4px' }} title="PDF Preview" /> : <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading PDF...</div>
            ) : previewFile.name.toLowerCase().match(/\.(xlsx|xls|csv)$/) ? (
              xlsxContent === null ? (
                <div style={{ textAlign: 'center', padding: '100px 40px', width: '100%' }}>
                  <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px', color: 'var(--accent)', marginBottom: '16px' }}></i>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Processing spreadsheet...</div>
                </div>
              ) : (
                <div 
                  style={{ width: '100%', height: '600px', background: '#fff', padding: '20px', borderRadius: '4px', border: '1px solid var(--border)', overflow: 'auto', fontSize: '13px' }}
                  className="xlsx-preview-content"
                  dangerouslySetInnerHTML={{ __html: xlsxContent }}
                />
              )
            ) : previewFile.name.toLowerCase().endsWith('.docx') ? (
              docxContent === null ? (
                <div style={{ textAlign: 'center', padding: '100px 40px', width: '100%' }}>
                  <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px', color: 'var(--accent)', marginBottom: '16px' }}></i>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Converting document...</div>
                </div>
              ) : (
                <div 
                  style={{ width: '100%', height: '600px', background: '#fff', padding: '40px', borderRadius: '4px', border: '1px solid var(--border)', overflowY: 'auto', fontSize: '16px', color: '#334155', lineHeight: 1.6 }}
                  className="docx-preview-content"
                  dangerouslySetInnerHTML={{ __html: docxContent }}
                />
              )
            ) : ['txt', 'py', 'js', 'ts', 'tsx', 'html', 'css', 'json', 'md', 'c', 'cpp', 'java', 'sql'].includes(previewFile.name.toLowerCase().split('.').pop() || '') ? (
              txtContent === null ? (
                <div style={{ textAlign: 'center', padding: '100px 40px', width: '100%' }}>
                  <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px', color: 'var(--accent)', marginBottom: '16px' }}></i>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading file content...</div>
                </div>
              ) : (
                <div style={{ width: '100%', height: '600px', background: '#fff', padding: '20px', borderRadius: '4px', border: '1px solid var(--border)', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: '13px', color: '#334155', fontFamily: 'monospace' }}>
                  {txtContent || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(Empty file)</span>}
                </div>
              )
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <i className="fas fa-file-download" style={{ fontSize: '48px', color: 'var(--accent)', marginBottom: '16px', opacity: 0.5 }}></i>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Preview not available for this file type</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Please download the file to view its contents.</div>
                <a href={`${api.defaults.baseURL}/submissions/${previewFile.id}/file`} download={previewFile.name} className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
                  <i className="fas fa-download" style={{ marginRight: '8px' }}></i>Download File
                </a>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <a href={`${api.defaults.baseURL}/submissions/${previewFile.id}/file`} download={previewFile.name} className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
              <i className="fas fa-download" style={{ marginRight: '8px' }}></i>Download
            </a>
            <button className="btn-primary" onClick={() => setPreviewFile(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
