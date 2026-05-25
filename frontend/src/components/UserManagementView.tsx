import { useEffect, useState } from 'react';
import api from '../api/client';
import type { User, Section } from '../types';
import { toast } from '../utils';
import { Modal } from './Modal';

export function UserManagementView() {
  const [users, setUsers] = useState<User[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterSection, setFilterSection] = useState('All');

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString().slice(-2));

  const emptyAdd = { first_name: '', last_name: '', middle_initial: '', email: '', password: '', role: 'student', department_section: '', section_id: '' as any, phone: '' };
  const [addForm, setAddForm] = useState(emptyAdd);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', department_section: '', section_id: '' as any, status: '', password: '' });

  const [activeTab, setActiveTab] = useState<'all' | 'admin' | 'instructor' | 'program_head' | 'student'>('all');
  const [nextId, setNextId] = useState('');
  const [customId, setCustomId] = useState('');

  useEffect(() => { 
    fetchUsers(); 
    fetchSections();
  }, []);

  const filteredUsers = users.filter(u => {
    if (activeTab !== 'all' && u.role !== activeTab) return false;
    if (activeTab === 'student' && filterSection !== 'All') {
      if (u.department_section !== filterSection) return false;
    }
    return true;
  });

  const fetchUsers = async (q?: string) => {
    try {
      const params = new URLSearchParams({ per_page: '100' });
      if (q) params.set('search', q);
      const { data } = await api.get(`/users?${params.toString()}`);
      setUsers(data.data.items);
    } finally { setLoading(false); }
  };

  const fetchSections = async () => {
    try {
      const { data } = await api.get('/users/sections');
      setSections(data.data);
    } catch (e) {}
  };

  const fetchNextId = async (role: string, year?: string) => {
    try {
      const url = `/users/next-id?role=${role}${role === 'student' && year ? `&year=${year}` : ''}`;
      const { data } = await api.get(url);
      setNextId(data.data.id);
      setCustomId(prev => {
        if (!prev) return data.data.id;
        if (role === 'student' && year && prev.startsWith('STU')) {
           const digits = prev.replace(/\D/g, '');
           const suffix = digits.substring(2, 7);
           if (suffix) return `STU${year}-${suffix}`;
        }
        return data.data.id;
      });
    } catch (e) { console.error('Failed to fetch next ID', e); }
  };

  useEffect(() => {
    if (showAdd) fetchNextId(addForm.role, selectedYear);
  }, [showAdd, addForm.role, selectedYear]);

  const handleSearch = (val: string) => {
    setSearch(val);
    fetchUsers(val || undefined);
  };

  const handleAddUser = async () => {
    const f = addForm;
    if (!f.first_name || !f.last_name || !f.password || !f.department_section) {
      toast('Please fill required fields', 'error', 'fa-exclamation-circle'); return;
    }
    const isCustomId = f.role === 'student' && parseInt(selectedYear) <= 25;
    if (isCustomId && customId.length !== 11) {
      toast('User ID must be complete (e.g., STU25-00001)', 'error', 'fa-exclamation-circle'); 
      return;
    }
    setSaving(true);
    try {
      const name = `${f.last_name}, ${f.first_name}${f.middle_initial ? ' ' + f.middle_initial + '.' : ''}`;
      await api.post('/users', { ...f, name, section_id: f.section_id || null, year: selectedYear, custom_id: isCustomId ? customId : null });
      toast('User created successfully!', 'success', 'fa-check-circle');
      setShowAdd(false); setAddForm(emptyAdd); setCustomId('');
      fetchUsers(search || undefined);
    } catch (e: any) { toast(e.response?.data?.detail || 'Failed to create user', 'error', 'fa-times-circle'); }
    finally { setSaving(false); }
  };

  const openEdit = (u: User) => {
    let sid = u.section_id ? u.section_id.toString() : '';
    if (!sid && u.department_section && u.role === 'student') {
      const matched = sections.find(s => s.name === u.department_section);
      if (matched) sid = matched.id.toString();
    }
    setEditForm({ 
      name: u.name, 
      email: u.email || '', 
      phone: u.phone || '', 
      department_section: u.department_section, 
      section_id: sid,
      status: u.status, 
      password: '' 
    });
    setShowEdit(u);
  };

  const handleEditUser = async () => {
    if (!showEdit) return;
    setSaving(true);
    try {
      const payload: any = { 
        name: editForm.name, 
        email: editForm.email, 
        phone: editForm.phone, 
        department_section: editForm.department_section,
        section_id: editForm.section_id || null,
        status: editForm.status
      };
      if (editForm.password) payload.password = editForm.password;
      await api.patch(`/users/${showEdit.id}`, payload);
      toast('User updated!', 'success', 'fa-check-circle');
      setShowEdit(null);
      fetchUsers(search || undefined);
    } catch (e: any) { toast(e.response?.data?.detail || 'Failed to update', 'error', 'fa-times-circle'); }
    finally { setSaving(false); }
  };

  const deleteUser = async (id: string) => {
    if (!confirm(`Delete user ${id}?`)) return;
    try {
      await api.delete(`/users/${id}`);
      toast('User deleted', 'info', 'fa-trash');
      fetchUsers(search || undefined);
    } catch (e: any) { toast(e.response?.data?.detail || 'Failed to delete', 'error', 'fa-times-circle'); }
  };

  const resetSystem = async () => {
    if (!confirm('⚠️ This will reset ALL data to defaults. Are you sure?')) return;
    if (!confirm('This action cannot be undone. Continue?')) return;
    try {
      await api.post('/admin/reset-data');
      toast('System reset complete', 'success', 'fa-redo');
      fetchUsers();
    } catch (e: any) { toast(e.response?.data?.detail || 'Reset failed', 'error', 'fa-times-circle'); }
  };

  const roleBadge = (role: string) => {
    const map: Record<string, { bg: string; color: string; icon: string; label: string }> = {
      admin: { bg: '#fef3c7', color: '#d97706', icon: 'fa-shield-alt', label: 'Admin' },
      instructor: { bg: '#e0e7ff', color: 'var(--accent)', icon: 'fa-chalkboard-teacher', label: 'Instructor' },
      program_head: { bg: '#e0e7ff', color: 'var(--accent)', icon: 'fa-chalkboard-teacher', label: 'Program Head' },
      student: { bg: '#dcfce7', color: '#16a34a', icon: 'fa-user-graduate', label: 'Student' },
    };
    const r = map[role] || map.student;
    return <span style={{ background: r.bg, color: r.color, padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className={`fas ${r.icon}`}></i> {r.label}</span>;
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px' }}>User Management</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Manage system access and accounts</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={resetSystem} style={{ color: '#dc2626', borderColor: '#fca5a5' }}>
            <i className="fas fa-redo" style={{ marginRight: 6 }}></i>Reset System
          </button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <i className="fas fa-user-plus" style={{ marginRight: 6 }}></i>Add User
          </button>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
            {(['all', 'admin', 'instructor', 'program_head', 'student'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                padding: '6px 16px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: activeTab === t ? 'white' : 'transparent',
                color: activeTab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: activeTab === t ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
              }}>
                {t === 'program_head' ? 'PROGRAM HEAD' : t.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {activeTab === 'student' && (
              <select className="input" style={{ width: '160px', fontSize: '13px', padding: '6px 12px' }} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                <option value="All">All Sections</option>
                {Array.from(new Set(users.filter(u => u.role === 'student' && u.department_section).map(u => u.department_section))).sort().map(s => (
                  <option key={s as string} value={s as string}>{s as string}</option>
                ))}
              </select>
            )}
            <div style={{ position: 'relative', width: 240 }}>
              <i className="fas fa-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '13px' }}></i>
              <input className="input" style={{ paddingLeft: '38px' }} placeholder="Search users..." value={search} onChange={e => handleSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                {['USER', 'ROLE', 'DEPARTMENT / SECTION', 'STATUS', 'ACTIONS'].map(h => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="table-row-hover">
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="avatar" style={{ width: '36px', height: '36px', fontSize: '11px' }}>{u.avatar || u.name?.[0]}</div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.id} · {u.email || 'No email'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>{roleBadge(u.role)}</td>
                  <td style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)' }}>{u.department_section}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ 
                      color: u.status === 'Active' ? '#16a34a' : u.status === 'Suspended' ? '#dc2626' : '#64748b', 
                      fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 
                    }}>
                      <span style={{ 
                        width: 6, height: 6, borderRadius: '50%', 
                        background: u.status === 'Active' ? '#16a34a' : u.status === 'Suspended' ? '#dc2626' : '#64748b' 
                      }}></span>
                      {u.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(u)} style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)', border: 'none', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}><i className="fas fa-pen"></i></button>
                      <button onClick={() => deleteUser(u.id)} style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: 'none', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}><i className="fas fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filteredUsers.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No users found in this section</div>}
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <Modal onClose={() => { setShowAdd(false); setCustomId(''); }} title="Add New User" icon="fa-user-plus">
          <div style={{ background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fas fa-magic" style={{ color: 'var(--accent)' }}></i>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {addForm.role === 'student' && parseInt(selectedYear) <= 25 ? 'You can manually edit the User ID for 2025 and older.' : 'The User ID (e.g. STU26-00001) will be generated automatically.'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 2 }}><label className="label">First Name *</label><input className="input" placeholder="John" value={addForm.first_name} onChange={e => setAddForm({ ...addForm, first_name: e.target.value })} /></div>
            <div style={{ flex: 2 }}><label className="label">Last Name *</label><input className="input" placeholder="Doe" value={addForm.last_name} onChange={e => setAddForm({ ...addForm, last_name: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label className="label">M.I.</label><input className="input" placeholder="S" maxLength={1} value={addForm.middle_initial} onChange={e => setAddForm({ ...addForm, middle_initial: e.target.value.toUpperCase() })} /></div>
          </div>
          <div style={{ marginBottom: 16 }}><label className="label">Email</label><input type="email" className="input" placeholder="user@acadsync.edu.ph" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label className="label">User ID {addForm.role === 'student' && parseInt(selectedYear) <= 25 ? '(Manual)' : '(Auto)'}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  className="input" 
                  value={addForm.role === 'student' && parseInt(selectedYear) <= 25 ? customId : nextId} 
                  onChange={e => {
                    const prefix = `STU${selectedYear}-`;
                    let val = e.target.value;
                    if (val.startsWith(prefix)) {
                       setCustomId(prefix + val.substring(prefix.length).replace(/\D/g, '').substring(0, 5));
                    } else {
                       const digits = val.replace(/\D/g, '');
                       const suffix = digits.substring(2, 7);
                       setCustomId(prefix + suffix);
                    }
                  }}
                  maxLength={11}
                  disabled={!(addForm.role === 'student' && parseInt(selectedYear) <= 25)} 
                  style={{ background: addForm.role === 'student' && parseInt(selectedYear) <= 25 ? 'white' : 'var(--bg-surface)', cursor: addForm.role === 'student' && parseInt(selectedYear) <= 25 ? 'text' : 'not-allowed', flex: 2 }} 
                />
                {addForm.role === 'student' && (
                  <select 
                    className="input" 
                    style={{ flex: 1 }} 
                    value={selectedYear} 
                    onChange={e => {
                      const newYear = e.target.value;
                      setSelectedYear(newYear);
                      setCustomId(prev => {
                        if (!prev.startsWith('STU')) return prev;
                        const digits = prev.replace(/\D/g, '');
                        const suffix = digits.substring(2, 7);
                        return `STU${newYear}-${suffix}`;
                      });
                    }}
                  >
                    {[23, 24, 25, 26, 27, 28, 29, 30].map(y => (
                      <option key={y} value={y.toString()}>20{y}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div style={{ flex: 1 }}><label className="label">Role *</label><select className="input" value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })}><option value="student">Student</option><option value="instructor">Instructor</option><option value="program_head">Program Head</option><option value="registrar">Registrar</option><option value="admin">Admin</option></select></div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 2 }}>
              <label className="label">Assigned Section / Department *</label>
              {addForm.role === 'student' ? (
                <select className="input" value={addForm.section_id} onChange={e => {
                  const sid = e.target.value;
                  const sec = sections.find(s => s.id.toString() === sid);
                  setAddForm({ ...addForm, section_id: sid, department_section: sec ? sec.name : '' });
                }}>
                  <option value="">-- Select Section --</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name} ({s.year_level})</option>)}
                </select>
              ) : (
                <select className="input" value={addForm.department_section} onChange={e => setAddForm({ ...addForm, department_section: e.target.value })}>
                  <option value="">-- Select Department --</option>
                  <option value="ICS">ICS (Computing)</option>
                  <option value="IBE">IBE (Business)</option>
                  <option value="ITE">ITE (Education)</option>
                </select>
              )}
            </div>
            <div style={{ flex: 1 }}><label className="label">Password *</label><input type="password" className="input" placeholder="Set password" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => { setShowAdd(false); setCustomId(''); }}>Cancel</button>
            <button className="btn-primary" onClick={handleAddUser} disabled={saving}>
              {saving ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-user-plus" style={{ marginRight: 6 }}></i>Create User</>}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit User Modal */}
      {showEdit && (
        <Modal onClose={() => setShowEdit(null)} title={`Edit: ${showEdit.name}`} icon="fa-user-edit">
          <div style={{ marginBottom: 16 }}><label className="label">Full Name</label><input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
          <div style={{ marginBottom: 16 }}><label className="label">Email</label><input type="email" className="input" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
          <div style={{ marginBottom: 16 }}><label className="label">Phone</label><input className="input" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label className="label">Assigned Section / Department</label>
              {showEdit.role === 'student' ? (
                <select className="input" value={editForm.section_id?.toString() || ''} onChange={e => {
                  const sid = e.target.value;
                  const sec = sections.find(s => s.id.toString() === sid);
                  setEditForm({ ...editForm, section_id: sid, department_section: sec ? sec.name : '' });
                }}>
                  <option value="">
                    {editForm.department_section && !editForm.section_id 
                      ? `-- Unassigned (Requested: ${editForm.department_section}) --` 
                      : `-- No Section --`}
                  </option>
                  {sections.map(s => <option key={s.id} value={s.id.toString()}>{s.name} ({s.year_level})</option>)}
                </select>
              ) : (
                <input className="input" value={editForm.department_section} onChange={e => setEditForm({ ...editForm, department_section: e.target.value })} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Account Status</label>
              <select className="input" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Graduated">Graduated</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}><label className="label">New Password <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(leave blank to keep current)</span></label><input type="password" className="input" placeholder="New password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setShowEdit(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleEditUser} disabled={saving}>
              {saving ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-save" style={{ marginRight: 6 }}></i>Save Changes</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
