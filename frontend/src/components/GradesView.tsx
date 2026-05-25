import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../store/auth';
import api from '../api/client';
import { toast } from '../utils';
import { Modal } from './Modal';
import { AttendanceCalendar } from './AttendanceCalendar';

interface Quiz {
  name: string;
  score: number;
  max: number;
}

interface Activity {
  id?: number;
  name: string;
  score: number;
  max: number;
}

interface GradeRecord {
  id: number;
  student_id: string;
  student_name: string;
  subject: string;
  subject_units?: number;
  section: string;
  attendance_score: number;
  recitation_score: number;
  quizzes_data: string;
  activities_data: string;
  activities_score: number;
  exam_score: number;
  percentage_score: number;
  final_grade: number;
  remarks: string;
  professor_name?: string;
}

export function GradesView() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('All Subjects');
  const [filterSection, setFilterSection] = useState('All Sections');
  const [activeTab, setActiveTab] = useState<'detailed' | 'gwa'>('detailed');
  
  // State for temporary input changes
  const [displayData, setDisplayData] = useState<GradeRecord[]>([]);
  
  const [quizModal, setQuizModal] = useState({ open: false, studentId: '', subject: '', quizzes: [] as Quiz[] });
  const [activitiesModal, setActivitiesModal] = useState({ open: false, studentId: '', subject: '', activities: [] as Activity[] });
  const [calendarModal, setCalendarModal] = useState<{ open: boolean, studentId: string, subject: string }>({ open: false, studentId: '', subject: '' });
  const [gwaModal, setGwaModal] = useState<{ open: boolean, studentName: string, scores: {subject: string, grade: number, units: number}[] }>({ open: false, studentName: '', scores: [] });

  const isManager = user?.role === 'admin' || user?.role === 'registrar';
  const canEditGrades = user?.role === 'instructor' || user?.role === 'program_head';

  useEffect(() => {
    fetchGrades();
  }, []);

  useEffect(() => {
    const handleGradeUpdate = () => fetchGrades();
    window.addEventListener('grade-updated', handleGradeUpdate);
    return () => window.removeEventListener('grade-updated', handleGradeUpdate);
  }, []);

  useEffect(() => {
    setDisplayData(grades);
  }, [grades]);

  const fetchGrades = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/grades');
      setGrades(data.data || []);
    } catch (e) {
      toast('Failed to load grades', 'error', 'fa-times-circle');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInput = (studentId: string, subject: string, field: keyof GradeRecord, value: string) => {
    
    let numVal = value === '' ? 0 : Number(value);
    
    // Enforce limits
    if (field === 'recitation_score' && numVal > 10) numVal = 10;
    if (field === 'attendance_score' && numVal > 100) numVal = 100;
    if (field === 'activities_score' && numVal > 100) numVal = 100;
    if (field === 'exam_score' && numVal > 100) numVal = 100;

    setDisplayData(prev => prev.map(g => {
      if (g.student_id === studentId && g.subject === subject) {
        return { ...g, [field]: numVal };
      }
      return g;
    }));
  };

  const handleSave = async (studentId: string, subject: string) => {
    const record = displayData.find(g => g.student_id === studentId && g.subject === subject);
    const original = grades.find(g => g.student_id === studentId && g.subject === subject);
    if (!record || !original) return;

    // BREAK INFINITE LOOP: Only trigger API save if values actually changed
    if (record.recitation_score === original.recitation_score && 
        record.exam_score === original.exam_score) {
      return;
    }

    try {
      await api.post('/grades', {
        student_id: record.student_id,
        subject: record.subject,
        section: record.section,
        attendance_score: record.attendance_score,
        recitation_score: record.recitation_score,
        quizzes_data: record.quizzes_data,
        activities_data: record.activities_data || "[]",
        activities_score: record.activities_score,
        exam_score: record.exam_score
      });
      fetchGrades(); 
    } catch (e) {
      toast('Error saving grade', 'error', 'fa-times-circle');
    }
  };

  const handleQuizUpdate = async (updatedQuizzes: Quiz[]) => {
    const qData = JSON.stringify(updatedQuizzes);
    const record = displayData.find(g => g.student_id === quizModal.studentId && g.subject === quizModal.subject);
    if (!record) return;

    try {
      await api.post('/grades', {
        student_id: record.student_id,
        subject: record.subject,
        section: record.section,
        attendance_score: record.attendance_score,
        recitation_score: record.recitation_score,
        quizzes_data: qData,
        activities_data: record.activities_data || "[]",
        activities_score: record.activities_score,
        exam_score: record.exam_score
      });
      setQuizModal({ ...quizModal, open: false });
      fetchGrades();
    } catch (e) {
      toast('Error saving quizzes', 'error', 'fa-times-circle');
    }
  };

  const handleActivityUpdate = async (updatedActivities: Activity[]) => {
    const aData = JSON.stringify(updatedActivities);
    const record = displayData.find(g => g.student_id === activitiesModal.studentId && g.subject === activitiesModal.subject);
    if (!record) return;

    try {
      await api.post('/grades', {
        student_id: record.student_id,
        subject: record.subject,
        section: record.section,
        attendance_score: record.attendance_score,
        recitation_score: record.recitation_score,
        quizzes_data: record.quizzes_data,
        activities_data: aData,
        activities_score: record.activities_score,
        exam_score: record.exam_score
      });
      setActivitiesModal({ ...activitiesModal, open: false });
      fetchGrades();
    } catch (e) {
      toast('Error saving activities', 'error', 'fa-times-circle');
    }
  };


  const isNegative = (val: any) => Number(val) < 0;
  const isOverLimit = (val: any, limit: number) => Number(val) > limit;

  const calculatePercentage = (att: number, rec: number, quizPerc: number, act: number, e: number) => {
    // Math.min ensures categories never exceed their weight even if data is corrupted
    const attScore = Math.min((Number(att) / 100) * 10, 10);
    const recScore = Math.min((Number(rec) / 10) * 10, 10); 
    const quizScore = Math.min((Number(quizPerc) / 100) * 20, 20);
    const actScore = Math.min((Number(act) / 100) * 20, 20);
    const examScore = Math.min((Number(e) / 100) * 40, 40);
    return Math.min(attScore + recScore + quizScore + actScore + examScore, 100);
  };

  const calculatePHGrade = (p: number) => {
    if (p >= 97) return 1.00;
    if (p >= 94) return 1.25;
    if (p >= 91) return 1.50;
    if (p >= 88) return 1.75;
    if (p >= 85) return 2.00;
    if (p >= 82) return 2.25;
    if (p >= 79) return 2.50;
    if (p >= 76) return 2.75;
    if (p >= 75) return 3.00;
    if (p >= 70) return 4.00;
    return 5.00;
  };

  const filteredGrades = displayData.filter(g => {
    const matchSearch = g.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        g.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        g.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSub = filterSubject === 'All Subjects' || g.subject === filterSubject;
    const matchSec = filterSection === 'All Sections' || g.section === filterSection;
    return matchSearch && matchSub && matchSec;
  });

  const subjects = useMemo(() => ['All Subjects', ...Array.from(new Set(grades.map(g => g.subject)))], [grades]);
  const sections = useMemo(() => ['All Sections', ...Array.from(new Set(grades.map(g => g.section)))], [grades]);

  // Group by Student for GWA Summary
  const studentGWAs = useMemo(() => {
    const studentData = new Map<string, { name: string, scores: {subject: string, grade: number, units: number}[], section: string, subjects: string[] }>();
    
    grades.forEach(g => {
      if (g.final_grade > 0) {
        if (!studentData.has(g.student_id)) {
          studentData.set(g.student_id, { name: g.student_name, scores: [], section: g.section, subjects: [] });
        }
        const s = studentData.get(g.student_id)!;
        s.scores.push({subject: g.subject, grade: g.final_grade, units: g.subject_units || 3});
        s.subjects.push(`${g.subject} (${g.subject_units || 3}u)`);
      }
    });
    
    return Array.from(studentData.entries()).map(([id, data]) => {
      const totalUnits = data.scores.reduce((acc, curr) => acc + curr.units, 0);
      const totalWeightedGrade = data.scores.reduce((acc, curr) => acc + (curr.grade * curr.units), 0);
      const gwa = totalUnits > 0 ? (totalWeightedGrade / totalUnits) : 0;
      return {
        id,
        name: data.name,
        section: data.section,
        gwa: gwa.toFixed(3),
        scores: data.scores,
        subjectCount: data.subjects.length,
        subjects: data.subjects.join(', ')
      };
    }).filter(s => {
      const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSec = filterSection === 'All Sections' || s.section === filterSection;
      return matchSearch && matchSec;
    });
  }, [grades, searchTerm, filterSection]);

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px' }}>Grade Management</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            {isManager ? 'Audit and review student performance records' : 'Input and manage grades for your assigned sections'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button className={`btn-${activeTab === 'detailed' ? 'primary' : 'secondary'}`} style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => setActiveTab('detailed')}>
          Detailed Subject Grades
        </button>
        <button className={`btn-${activeTab === 'gwa' ? 'primary' : 'secondary'}`} style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => setActiveTab('gwa')}>
          Overall GWA Summary
        </button>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <i className="fas fa-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '12px' }}></i>
            <input className="input" style={{ paddingLeft: '36px', fontSize: '13px' }} placeholder="Search student..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          
          {activeTab === 'detailed' && (
            <select className="input" style={{ width: '180px', fontSize: '13px' }} value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          <select className="input" style={{ width: '160px', fontSize: '13px' }} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {(filterSubject !== 'All Subjects' || filterSection !== 'All Sections' || searchTerm) && (
            <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: '12px', color: '#ef4444' }} onClick={() => { setFilterSubject('All Subjects'); setFilterSection('All Sections'); setSearchTerm(''); }}>
              Clear Filters
            </button>
          )}
        </div>

        {activeTab === 'detailed' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Student</th>
                  <th style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Subject / Units</th>
                  <th style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Att (10%)</th>
                  <th style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Rec (10%)</th>
                  <th style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Quizzes (20%)</th>
                  <th style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Activities (20%)</th>
                  <th style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Exam (40%)</th>
                  <th style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Total %</th>
                  <th style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Grade</th>
                  {isManager && <th style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Professor</th>}
                </tr>
              </thead>
              <tbody>
                {filteredGrades.map(g => {
                  let quizList: Quiz[] = [];
                  try { quizList = JSON.parse(g.quizzes_data); } catch(e) {}
                  const quizPerc = quizList.length > 0 ? quizList.reduce((acc, q) => acc + (q.score/q.max)*100, 0) / quizList.length : 0;
                  
                  let activityList: Activity[] = [];
                  try { activityList = JSON.parse(g.activities_data || "[]"); } catch(e) {}

                  const perc = calculatePercentage(g.attendance_score, g.recitation_score, quizPerc, g.activities_score, g.exam_score);
                  const final = calculatePHGrade(perc);

                  return (
                    <tr key={g.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '14px 10px' }}>
                        <div style={{ fontWeight: 700, fontSize: '13px' }}>{g.student_name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{g.student_id} · {g.section}</div>
                      </td>
                      <td style={{ padding: '14px 10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>{g.subject}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{g.subject_units || 3} Units</div>
                      </td>
                      <td style={{ padding: '14px 5px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <div style={{ width: '75px', textAlign: 'center', padding: '6px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
                            {g.attendance_score || 0}
                          </div>
                          <button className="btn-secondary" style={{ padding: '6px', fontSize: '11px', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="View Calendar" onClick={() => setCalendarModal({ open: true, studentId: g.student_id, subject: g.subject })}>
                            <i className="fas fa-calendar-alt" style={{ color: 'var(--accent)' }}></i>
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '14px 5px', textAlign: 'center' }}>
                        {canEditGrades ? (
                          <input type="number" className="input"
                            style={{ width: '85px', textAlign: 'center', background: 'white', borderColor: (isOverLimit(g.recitation_score, 10) || isNegative(g.recitation_score)) ? '#ef4444' : 'var(--border)' }} 
                            value={g.recitation_score || ''} onChange={e => handleUpdateInput(g.student_id, g.subject, 'recitation_score', e.target.value)} onBlur={() => handleSave(g.student_id, g.subject)} />
                        ) : (
                          <div style={{ width: '85px', textAlign: 'center', padding: '6px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, margin: 'auto' }}>
                            {g.recitation_score || 0}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 5px', textAlign: 'center' }}>
                        <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} disabled={!canEditGrades} onClick={() => setQuizModal({ open: true, studentId: g.student_id, subject: g.subject, quizzes: quizList })}>
                          {quizList.length} Quizzes ({quizPerc.toFixed(0)}%)
                        </button>
                      </td>
                      <td style={{ padding: '14px 5px', textAlign: 'center' }}>
                        <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} disabled={!canEditGrades} onClick={() => setActivitiesModal({ open: true, studentId: g.student_id, subject: g.subject, activities: activityList })}>
                          {activityList.length > 0 ? `${activityList.length} Acts` : `${(g.activities_score || 0).toFixed(0)}%`}
                        </button>
                      </td>
                      <td style={{ padding: '14px 5px', textAlign: 'center' }}>
                        {canEditGrades ? (
                          <input type="number" max="100" className="input"
                            style={{ width: '85px', textAlign: 'center', background: 'white', borderColor: (isOverLimit(g.exam_score, 100) || isNegative(g.exam_score)) ? '#ef4444' : 'var(--border)' }} 
                            value={g.exam_score || ''} onChange={e => handleUpdateInput(g.student_id, g.subject, 'exam_score', e.target.value)} onBlur={() => handleSave(g.student_id, g.subject)} />
                        ) : (
                          <div style={{ width: '85px', textAlign: 'center', padding: '6px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, margin: 'auto' }}>
                            {g.exam_score || 0}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 5px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 700 }}>{perc.toFixed(0)}%</span>
                      </td>
                      <td style={{ padding: '14px 5px', textAlign: 'center' }}>
                        <span style={{ 
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800,
                          background: final <= 3.0 ? '#ecfdf5' : '#fee2e2',
                          color: final <= 3.0 ? '#059669' : '#ef4444'
                        }}>{final.toFixed(2)}</span>
                      </td>
                      {isManager && (
                        <td style={{ padding: '14px 10px', fontSize: '11px', color: 'var(--text-muted)' }}>{g.professor_name}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Student</th>
                  <th style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Section</th>
                  <th style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Subjects Combined</th>
                  <th style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>OVERALL GWA</th>
                  <th style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Summary of Courses</th>
                </tr>
              </thead>
              <tbody>
                {studentGWAs.map(s => (
                  <tr key={s.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '18px 10px' }}>
                      <div style={{ fontWeight: 800, fontSize: '14px' }}>{s.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.id}</div>
                    </td>
                    <td style={{ padding: '18px 10px' }}>
                      <span style={{ fontWeight: 600 }}>{s.section}</span>
                    </td>
                    <td style={{ padding: '18px 10px', textAlign: 'center' }}>
                      <span style={{ background: '#f1f5f9', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>{s.subjectCount} Subjects</span>
                    </td>
                    <td style={{ padding: '18px 10px', textAlign: 'center' }}>
                      <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: '20px', fontWeight: 900, color: 'var(--accent)', background: 'transparent', border: '1px solid var(--accent)' }} title="View Computation" onClick={() => setGwaModal({ open: true, studentName: s.name, scores: s.scores })}>
                        {s.gwa}
                      </button>
                    </td>
                    <td style={{ padding: '18px 10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', maxWidth: '300px' }}>{s.subjects}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {quizModal.open && (
        <Modal onClose={() => setQuizModal({ ...quizModal, open: false })} title="Quiz Details" icon="fa-tasks" width={450}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {quizModal.quizzes.map((q, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ flex: 1, fontSize: '13px', fontWeight: 600 }}>{q.name}</div>
                <input type="number" className="input" style={{ width: '70px', textAlign: 'center' }} value={q.score} 
                  onChange={e => {
                    const newQuizzes = [...quizModal.quizzes];
                    let val = Number(e.target.value);
                    if (val < 0) val = 0;
                    if (val > newQuizzes[i].max) val = newQuizzes[i].max;
                    newQuizzes[i].score = val;
                    setQuizModal({ ...quizModal, quizzes: newQuizzes });
                  }} />
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <input type="number" className="input" style={{ width: '70px', textAlign: 'center' }} value={q.max}
                  onChange={e => {
                    const newQuizzes = [...quizModal.quizzes];
                    let val = Number(e.target.value);
                    if (val < 0) val = 0;
                    newQuizzes[i].max = val;
                    if (newQuizzes[i].score > val) newQuizzes[i].score = val;
                    setQuizModal({ ...quizModal, quizzes: newQuizzes });
                  }} />
                <button className="btn-secondary" style={{ padding: '6px', color: '#ef4444', borderColor: 'transparent', background: 'transparent' }} onClick={() => {
                  const newQuizzes = quizModal.quizzes.filter((_, idx) => idx !== i);
                  setQuizModal({ ...quizModal, quizzes: newQuizzes });
                }}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
            <button className="btn-secondary" style={{ fontSize: '12px' }} onClick={() => setQuizModal({ ...quizModal, quizzes: [...quizModal.quizzes, { name: `Quiz ${quizModal.quizzes.length + 1}`, score: 0, max: 100 }] })}>
              + Add Quiz
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button className="btn-secondary" onClick={() => setQuizModal({ ...quizModal, open: false })}>Close</button>
            {canEditGrades && <button className="btn-primary" onClick={() => handleQuizUpdate(quizModal.quizzes)}>Save Changes</button>}
          </div>
        </Modal>
      )}

      {activitiesModal.open && (
        <Modal onClose={() => setActivitiesModal({ ...activitiesModal, open: false })} title="Activities Details" icon="fa-tasks" width={450}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {activitiesModal.activities.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ flex: 1, fontSize: '13px', fontWeight: 600 }}>{a.name}</div>
                <input type="number" className="input" style={{ width: '70px', textAlign: 'center' }} value={a.score} 
                  onChange={e => {
                    const newActivities = [...activitiesModal.activities];
                    let val = Number(e.target.value);
                    if (val < 0) val = 0;
                    if (val > newActivities[i].max) val = newActivities[i].max;
                    newActivities[i].score = val;
                    setActivitiesModal({ ...activitiesModal, activities: newActivities });
                  }} />
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <input type="number" className="input" style={{ width: '70px', textAlign: 'center' }} value={a.max}
                  onChange={e => {
                    const newActivities = [...activitiesModal.activities];
                    let val = Number(e.target.value);
                    if (val < 0) val = 0;
                    newActivities[i].max = val;
                    if (newActivities[i].score > val) newActivities[i].score = val;
                    setActivitiesModal({ ...activitiesModal, activities: newActivities });
                  }} />
                <button className="btn-secondary" style={{ padding: '6px', color: '#ef4444', borderColor: 'transparent', background: 'transparent' }} onClick={() => {
                  const newActivities = activitiesModal.activities.filter((_, idx) => idx !== i);
                  setActivitiesModal({ ...activitiesModal, activities: newActivities });
                }}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
            <button className="btn-secondary" style={{ fontSize: '12px' }} onClick={() => setActivitiesModal({ ...activitiesModal, activities: [...activitiesModal.activities, { name: `Activity ${activitiesModal.activities.length + 1}`, score: 0, max: 100 }] })}>
              + Add Activity
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button className="btn-secondary" onClick={() => setActivitiesModal({ ...activitiesModal, open: false })}>Close</button>
            {canEditGrades && <button className="btn-primary" onClick={() => handleActivityUpdate(activitiesModal.activities)}>Save Changes</button>}
          </div>
        </Modal>
      )}

      {gwaModal.open && (
        <Modal onClose={() => setGwaModal({ ...gwaModal, open: false })} title={`GWA Computation: ${gwaModal.studentName}`} icon="fa-calculator" width={600}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Subject</th>
                  <th style={{ padding: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Grade</th>
                  <th style={{ padding: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Units</th>
                  <th style={{ padding: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Computation</th>
                </tr>
              </thead>
              <tbody>
                {gwaModal.scores.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 8px', fontSize: '13px', fontWeight: 600 }}>{s.subject}</td>
                    <td style={{ padding: '12px 8px', fontSize: '13px' }}>{s.grade.toFixed(2)}</td>
                    <td style={{ padding: '12px 8px', fontSize: '13px' }}>{s.units}</td>
                    <td style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {s.grade.toFixed(2)} × {s.units} = {(s.grade * s.units).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Total:</div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <li>Weighted grades = {gwaModal.scores.map(s => (s.grade * s.units).toFixed(2)).join(' + ')} = <strong>{gwaModal.scores.reduce((acc, s) => acc + (s.grade * s.units), 0).toFixed(2)}</strong></li>
                <li>Total units = <strong>{gwaModal.scores.reduce((acc, s) => acc + s.units, 0)}</strong></li>
              </ul>
              
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>So:</div>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>
                  GWA = <span style={{ padding: '4px 8px', background: 'white', border: '1px solid var(--border)', borderRadius: '6px' }}>{gwaModal.scores.reduce((acc, s) => acc + (s.grade * s.units), 0).toFixed(2)} / {gwaModal.scores.reduce((acc, s) => acc + s.units, 0)}</span> = <span style={{ color: 'var(--accent)' }}>{(gwaModal.scores.reduce((acc, s) => acc + (s.grade * s.units), 0) / (gwaModal.scores.reduce((acc, s) => acc + s.units, 0) || 1)).toFixed(3)}</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button className="btn-secondary" onClick={() => setGwaModal({ ...gwaModal, open: false })}>Close</button>
          </div>
        </Modal>
      )}

      {calendarModal.open && (
        <Modal onClose={() => setCalendarModal({ ...calendarModal, open: false })} title="Attendance Calendar" icon="fa-calendar-alt" width={900}>
          <AttendanceCalendar studentId={calendarModal.studentId} courseCode={calendarModal.subject} onUpdate={fetchGrades} />
        </Modal>
      )}
    </div>
  );
}
