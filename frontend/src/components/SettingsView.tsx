import { useState } from 'react';
import { useAuth } from '../store/auth';
import api from '../api/client';
import { toast } from '../utils';

export function SettingsView() {
  const { user, prefs, updatePrefs, refreshUser } = useAuth();

  // Profile state
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.bio || '');

  // Password state
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');

  const saveProfile = async () => {
    try {
      await api.patch('/users/me', { name, email, phone, bio });
      toast('Profile updated successfully', 'success', 'fa-check-circle');
      refreshUser();
    } catch {
      toast('Failed to update profile', 'error', 'fa-times-circle');
    }
  };

  const changePw = async () => {
    if (!curPw || !newPw) return;
    try {
      await api.post('/users/me/change-password', { current_password: curPw, new_password: newPw });
      toast('Password changed successfully', 'success', 'fa-check-circle');
      setCurPw(''); setNewPw('');
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Failed to change password', 'error', 'fa-times-circle');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '24px' }}>Settings</h2>

      <div className="card fade-in" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}><i className="fas fa-user" style={{ marginRight: '8px', color: 'var(--accent)' }}></i>Profile Information</h3>
        <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Email Address</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input className="input" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">Department / Section</label>
            <input className="input" value={user?.department_section} disabled style={{ opacity: 0.7 }} />
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label className="label">Bio</label>
          <textarea className="input" rows={3} value={bio} onChange={e => setBio(e.target.value)} style={{ resize: 'none' }}></textarea>
        </div>
        <button className="btn-primary" onClick={saveProfile}>Save Profile</button>
      </div>

      <div className="card fade-in" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}><i className="fas fa-palette" style={{ marginRight: '8px', color: '#ec4899' }}></i>Appearance</h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-surface)', borderRadius: '14px', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Dark Mode</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Switch to dark theme for easier reading at night</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={prefs.dark_mode} onChange={e => updatePrefs({ dark_mode: e.target.checked })} />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <div>
          <label className="label">Accent Color</label>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {['indigo', 'violet', 'rose', 'teal', 'amber'].map(c => (
              <button key={c} onClick={() => updatePrefs({ accent_color: c })} style={{ width: '36px', height: '36px', borderRadius: '50%', background: `var(--${c}, ${c === 'indigo' ? '#4f46e5' : c === 'violet' ? '#7c3aed' : c === 'rose' ? '#e11d48' : c === 'teal' ? '#0d9488' : '#d97706'})`, border: prefs.accent_color === c ? '3px solid white' : '2px solid transparent', boxShadow: prefs.accent_color === c ? '0 0 0 2px var(--accent), 0 4px 12px color-mix(in srgb, var(--accent) 30%, transparent)' : 'none', cursor: 'pointer', transition: 'all 0.25s', transform: prefs.accent_color === c ? 'scale(1.15)' : 'scale(1)' }} aria-label={`Set ${c} accent`} />
            ))}
          </div>
        </div>
      </div>

      <div className="card fade-in" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}><i className="fas fa-lock" style={{ marginRight: '8px', color: '#f59e0b' }}></i>Security</h3>
        <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label className="label">Current Password</label>
            <input className="input" type="password" value={curPw} onChange={e => setCurPw(e.target.value)} />
          </div>
          <div>
            <label className="label">New Password</label>
            <input className="input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
          </div>
        </div>
        <button className="btn-secondary" onClick={changePw}>Update Password</button>
      </div>
    </div>
  );
}
