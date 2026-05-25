import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';
import api from '../api/client';
import type { Announcement } from '../types';
import { formatDateTime, toast } from '../utils';
import { Modal } from './Modal';

export function AnnouncementsView() {
  const { user } = useAuth();
  const [anns, setAnns] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<Announcement | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [annType, setAnnType] = useState('CAMPUS');
  const [target, setTarget] = useState('ALL');
  const [targetClass, setTargetClass] = useState('');
  const [sections, setSections] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAnns();
    if (user?.role === 'admin' || user?.role === 'instructor' || user?.role === 'program_head') {
      fetchSections();
    }

    const handleNewAnnouncement = () => {
      fetchAnns();
    };

    window.addEventListener('new-announcement-received', handleNewAnnouncement);
    return () => {
      window.removeEventListener('new-announcement-received', handleNewAnnouncement);
    };
  }, []);

  const fetchAnns = async () => {
    try {
      const url = user?.role === 'admin' ? '/announcements?management=true' : '/announcements';
      const { data } = await api.get(url);
      setAnns(data.data.items);
    } catch (err: any) {
      console.error('[AnnouncementsView] Failed to fetch announcements:', err);
      toast(err.response?.data?.detail || 'Failed to load announcements', 'error', 'fa-exclamation-circle');
    } finally {
      setLoading(false);
    }
  };

  const fetchSections = async () => {
    try {
      const { data } = await api.get('/users/sections');
      setSections(data.data);
    } catch (err) {
      console.error('[AnnouncementsView] Failed to fetch sections:', err);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) { toast('Please fill in all fields', 'error', 'fa-exclamation-circle'); return; }
    if (user?.role !== 'admin' && user?.role !== 'program_head' && !targetClass) {
      toast('Please select a target section', 'error', 'fa-exclamation-circle');
      return;
    }
    setSaving(true);
    try {
      const payload = { title, body, type: annType, target_audience: target, target_class: targetClass };
      if (showEdit) {
        await api.patch(`/announcements/${showEdit.id}`, payload);
        toast('Announcement updated!', 'success', 'fa-check-circle');
      } else {
        await api.post('/announcements', payload);
        toast('Announcement posted!', 'success', 'fa-check-circle');
      }
      setShowCreate(false); setShowEdit(null);
      setTitle(''); setBody(''); setAnnType('CAMPUS'); setTarget('ALL'); setTargetClass('');
      fetchAnns();
    } catch (e: any) { toast(e.response?.data?.detail || 'Failed to save', 'error', 'fa-times-circle'); }
    finally { setSaving(false); }
  };

  const getDepartment = (s: string) => {
    const upper = s.toUpperCase();
    if (["BSCS", "BSIT", "ICS", "IT"].some(x => upper.includes(x))) return "ICS";
    if (["BSBA", "IBE"].some(x => upper.includes(x))) return "IBE";
    if (["BSE", "ITE"].some(x => upper.includes(x))) return "ITE";
    return s;
  };

  const getCategoryColor = (type: string) => {
    switch (type) {
      case 'URGENT': return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
      case 'ACADEMIC': return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' };
      case 'FACULTY': return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
      case 'CAMPUS': return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
      default: return { color: 'var(--accent)', bg: 'color-mix(in srgb, var(--accent) 10%, transparent)' };
    }
  };

  const openEdit = (a: Announcement) => {
    setTitle(a.title);
    setBody(a.body);
    setAnnType(a.type);
    setTarget(a.target_audience);
    setTargetClass(a.target_class || '');
    setShowEdit(a);
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    try {
      await api.delete(`/announcements/${showDeleteConfirm}`);
      toast('Announcement deleted', 'info', 'fa-trash');
      setShowDeleteConfirm(null);
      fetchAnns();
    } catch (e: any) { toast('Failed to delete', 'error', 'fa-times-circle'); }
  };

  const canManage = (a: Announcement) => {
    if (!user) return false;
    return user.role === 'admin' || user.id === a.author_id;
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px' }}>Announcements</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Stay updated with campus news</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'instructor' || user?.role === 'program_head') && (
          <div className="page-header-actions">
            <button className="btn-primary" onClick={() => {
              setShowCreate(true);
              if (user.role !== 'admin') {
                setAnnType('ACADEMIC');
                setTarget('STUDENTS');
              }
            }}>
              <i className="fas fa-plus" style={{ marginRight: '6px' }}></i>Post Announcement
            </button>
          </div>
        )}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {anns.map(a => {
            const theme = getCategoryColor(a.type);
            return (
            <div key={a.id} className="card fade-in" style={{ padding: '12px 16px', position: 'relative', overflow: 'hidden', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: theme.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`fas ${a.type === 'URGENT' ? 'fa-exclamation-triangle' : a.type === 'ACADEMIC' ? 'fa-graduation-cap' : 'fa-bullhorn'}`} style={{ color: theme.color, fontSize: '14px' }}></i>
              </div>
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setSelectedAnn(a)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>{formatDateTime(a.created_at)}</div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, color: theme.color, fontSize: '10px', textTransform: 'uppercase' }}>{a.type}</span>
                  <span style={{ opacity: 0.5 }}>•</span>
                  <span>{a.author_name}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.body}</div>
              </div>
              {canManage(a) && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => openEdit(a)} style={{ background: 'none', color: 'var(--text-muted)', border: 'none', padding: '8px', cursor: 'pointer', flexShrink: 0, transition: 'color 0.2s' }}>
                    <i className="fas fa-pencil-alt" style={{ fontSize: '12px' }}></i>
                  </button>
                  <button onClick={() => setShowDeleteConfirm(a.id)} style={{ background: 'none', color: 'var(--text-muted)', border: 'none', padding: '8px', cursor: 'pointer', flexShrink: 0, transition: 'color 0.2s' }} className="hover-red">
                    <i className="fas fa-trash-alt" style={{ fontSize: '12px' }}></i>
                  </button>
                </div>
              )}
            </div>
          )})}
          {anns.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}><i className="fas fa-bullhorn" style={{ fontSize: '32px', marginBottom: '12px', display: 'block', opacity: 0.5 }}></i>No announcements</div>}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreate || showEdit) && (
        <Modal onClose={() => { setShowCreate(false); setShowEdit(null); setTitle(''); setBody(''); setTargetClass(''); }} 
          title={showEdit ? 'Edit Announcement' : 'Post Announcement'} icon="fa-bullhorn">
          <div style={{ marginBottom: 16 }}>
            <label className="label">Title</label>
            <input className="input" placeholder="Announcement title" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            {user?.role === 'admin' ? (
              <>
                <div style={{ flex: 1 }}>
                  <label className="label">Type</label>
                  <select className="input" value={annType} onChange={e => setAnnType(e.target.value)}>
                    <option value="CAMPUS">Campus</option><option value="ACADEMIC">Academic</option>
                    <option value="URGENT">Urgent</option><option value="FACULTY">Faculty</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Target Audience</label>
                  <select className="input" value={target} onChange={e => setTarget(e.target.value)}>
                    <option value="ALL">All</option><option value="STUDENTS">Students Only</option><option value="FACULTY">Faculty Only</option>
                  </select>
                </div>
              </>
            ) : user?.role === 'program_head' ? (
              <>
                <div style={{ flex: 1 }}>
                  <label className="label">Target Audience</label>
                  <select className="input" value={target} onChange={e => setTarget(e.target.value)}>
                    <option value="STUDENTS">Students (Department)</option>
                    <option value="FACULTY">Faculty (Professors)</option>
                  </select>
                </div>
                {target === 'STUDENTS' && (
                  <div style={{ flex: 1 }}>
                    <label className="label">Target Department</label>
                    <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {getDepartment(user.department_section)}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ flex: 1 }}>
                <label className="label">Target Class / Section</label>
                <select className="input" value={targetClass} onChange={e => setTargetClass(e.target.value)}>
                  <option value="" disabled>Select a section</option>
                  {sections.map((s: any) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="label">Content</label>
            <textarea className="input" rows={5} placeholder="Write your announcement..." value={body} onChange={e => setBody(e.target.value)} style={{ resize: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => { setShowCreate(false); setShowEdit(null); }}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-paper-plane" style={{ marginRight: 6 }}></i>{showEdit ? 'Update' : 'Post'}</>}
            </button>
          </div>
        </Modal>
      )}

      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal onClose={() => setShowDeleteConfirm(null)} title="Confirm Deletion" icon="fa-trash-alt" iconColor="#ef4444">
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Are you sure you want to delete this announcement? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
            <button className="btn-danger" onClick={handleDelete} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '10px', fontWeight: 'bold' }}>
              Delete Announcement
            </button>
          </div>
        </Modal>
      )}

      {/* Expanded Announcement Modal */}
      {selectedAnn && (
        <Modal onClose={() => setSelectedAnn(null)} title="" width={650}>
          <div style={{ 
            marginTop: '-24px', 
            marginLeft: '-24px', 
            marginRight: '-24px', 
            background: `linear-gradient(135deg, ${getCategoryColor(selectedAnn.type).color} 0%, rgba(0,0,0,0.8) 100%)`, 
            padding: '32px 24px',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', right: '-10%', top: '-20%', opacity: 0.1 }}>
              <i className={`fas ${selectedAnn.type === 'URGENT' ? 'fa-exclamation-triangle' : selectedAnn.type === 'ACADEMIC' ? 'fa-graduation-cap' : 'fa-bullhorn'}`} style={{ fontSize: '150px' }}></i>
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 800, letterSpacing: '1px', marginBottom: '12px', backdropFilter: 'blur(4px)' }}>
                {selectedAnn.type}
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 16px 0', lineHeight: 1.3 }}>{selectedAnn.title}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', opacity: 0.9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fas fa-user-circle"></i> {selectedAnn.author_name}
                </div>
                <span>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fas fa-clock"></i> {formatDateTime(selectedAnn.created_at)}
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ padding: '24px 8px 16px 8px' }}>
            <div style={{ 
              fontSize: '15px', 
              color: 'var(--text-primary)', 
              lineHeight: 1.8, 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word'
            }}>
              {selectedAnn.body}
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <button className="btn-secondary" onClick={() => setSelectedAnn(null)} style={{ padding: '8px 24px', borderRadius: '8px', fontWeight: 700 }}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
