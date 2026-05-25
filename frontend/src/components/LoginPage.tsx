import { useState, useRef } from 'react';
import { useAuth } from '../store/auth';
import api from '../api/client';
import { toast } from '../utils';
import { useGoogleLogin } from '@react-oauth/google';

export function LoginPage() {
  const { login, register, oauthLogin } = useAuth();
  const [step, setStep] = useState<'login' | 'forgot1' | 'forgot2' | 'forgot3'>('login');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpDisplay, setOtpDisplay] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPw1, setNewPw1] = useState('');
  const [newPw2, setNewPw2] = useState('');

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError('');
      try { await oauthLogin('google', tokenResponse.access_token); }
      catch (e: any) { setError(e.response?.data?.detail || 'Google login failed. Please try again.'); }
      finally { setLoading(false); }
    },
    onError: (err) => setError(err?.error_description || 'Google login was cancelled or failed.'),
  });

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleLogin = async () => {
    setError('');
    if (!userId) { setError('Please enter your User ID or Email.'); return; }
    if (!password) { setError('Please enter your password.'); return; }
    setLoading(true);
    try {
      await login(userId, password);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Incorrect ID or password.');
    } finally {
      setLoading(false);
    }
  };



  const handleSendOtp = async () => {
    setError('');
    if (!forgotEmail) { setError('Please enter your Email address.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password/request', { email: forgotEmail });
      setMaskedEmail(data.data.email_masked);
      if (data.data.otp) setOtpDisplay(data.data.otp);
      setStep('forgot2');
      setOtp(['', '', '', '', '', '']);
    } catch (e: any) { setError(e.response?.data?.detail || 'Error sending OTP.'); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    setError('');
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter the full 6-digit code.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password/verify-otp', { email: forgotEmail, otp: code });
      setResetToken(data.data.password_reset_token);
      setStep('forgot3');
    } catch (e: any) { setError(e.response?.data?.detail || 'Incorrect code.'); }
    finally { setLoading(false); }
  };

  const handleResetPw = async () => {
    setError('');
    if (!newPw1) { setError('Please enter a new password.'); return; }
    if (newPw1.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPw1 !== newPw2) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password/reset', { password_reset_token: resetToken, new_password: newPw1 });
      toast('Password updated! Please sign in.', 'success', 'fa-check-circle');
      setStep('login');
    } catch (e: any) { setError(e.response?.data?.detail || 'Error resetting password.'); }
    finally { setLoading(false); }
  };

  const otpInput = (idx: number, val: string) => {
    const v = val.replace(/\D/, '');
    const newOtp = [...otp]; newOtp[idx] = v; setOtp(newOtp);
    if (v && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const otpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      const newOtp = [...otp]; newOtp[idx - 1] = ''; setOtp(newOtp);
      otpRefs.current[idx - 1]?.focus();
    }
  };

  return (
    <div className="login-gate">
      <div className="login-card">
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg,var(--accent),var(--accent),var(--accent))', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 12px 32px color-mix(in srgb, var(--accent) 35%, transparent)' }}>
            <i className="fas fa-comments" style={{ color: 'white', fontSize: 24 }}></i>
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: 'var(--login-text)', margin: 0, letterSpacing: '-0.03em' }}>AcadSync</h1>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase', marginTop: 8 }}>Campus Communication Hub</p>
        </div>

        {/* ───── LOGIN STEP ───── */}
        {step === 'login' && (
          <div className="fade-in">
            {error && <div className="error-msg"><i className="fas fa-exclamation-circle" style={{ marginRight: 6 }}></i>{error}</div>}
            <div style={{ marginBottom: 16 }}>
              <label className="label login-label">User ID</label>
              <input className="input login-input" placeholder="e.g. ADM-00001" value={userId}
                onChange={e => setUserId(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              <div style={{ fontSize: 10, color: 'var(--login-sub)', marginTop: 6, fontWeight: 500 }}>Format: ADM-##### · INS-##### · STU##-#####</div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label className="label login-label">Password</label>
              <div className="pw-wrap">
                <input type={showPw ? 'text' : 'password'} className="input login-input" placeholder="Enter your password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                <button className="pw-toggle" onClick={() => setShowPw(!showPw)} type="button">
                  <i className={`fas ${showPw ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>
            <div style={{ textAlign: 'right', marginBottom: 24 }}>
              <button onClick={() => { setStep('forgot1'); setForgotEmail(''); setError(''); }}
                style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.target as HTMLButtonElement).style.color = '#a5b4fc'}
                onMouseLeave={e => (e.target as HTMLButtonElement).style.color = 'var(--accent)'}>Forgot password?</button>
            </div>
            <button className="btn-primary" style={{ width: '100%', padding: 14, fontSize: 13, letterSpacing: '0.08em', boxShadow: '0 4px 20px color-mix(in srgb, var(--accent) 35%, transparent)' }} onClick={handleLogin} disabled={loading}>
              {loading ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Signing in...</> : <><i className="fas fa-sign-in-alt" style={{ marginRight: 8 }}></i>SIGN IN</>}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', margin: '22px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent)' }}></div>
              <div style={{ padding: '0 14px', fontSize: 9, color: 'rgba(255,255,255,.35)', fontWeight: 700, letterSpacing: '.08em' }}>OR CONTINUE WITH</div>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent)' }}></div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button
                onClick={() => googleLogin()}
                style={{ flex: 1, height: 42, borderRadius: 10, background: 'white', border: '1px solid rgba(255,255,255,.12)', color: '#333', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.25s', fontSize: '12px', fontFamily: 'inherit' }}
              >
                <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Google
              </button>
            </div>
          </div>
        )}



        {/* ───── FORGOT STEP 1 ───── */}
        {step === 'forgot1' && (
          <div className="fade-in">
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 52, height: 52, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><i className="fas fa-key" style={{ color: 'var(--accent)', fontSize: 22 }}></i></div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--login-text)' }}>Forgot Password?</div>
              <div style={{ fontSize: 12, color: 'var(--login-sub)', marginTop: 4 }}>Enter your Email address to receive a reset code</div>
            </div>
            {error && <div className="error-msg"><i className="fas fa-exclamation-circle" style={{ marginRight: 6 }}></i>{error}</div>}
            <div style={{ marginBottom: 20 }}>
              <label className="label login-label">Email address</label>
              <input type="email" className="input login-input" placeholder="e.g. name@example.com" value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendOtp()} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }} onClick={() => { setStep('login'); setError(''); }}>← Back</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleSendOtp} disabled={loading}>
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-paper-plane" style={{ marginRight: 6 }}></i>Send Reset Code</>}
              </button>
            </div>
          </div>
        )}

        {/* ───── FORGOT STEP 2 (OTP) ───── */}
        {step === 'forgot2' && (
          <div className="fade-in">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, background: 'rgba(22,163,74,0.15)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><i className="fas fa-envelope-open-text" style={{ color: '#4ade80', fontSize: 22 }}></i></div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--login-text)' }}>Check Your Email</div>
              <div style={{ fontSize: 12, color: 'var(--login-sub)', marginTop: 4 }}>We sent a 6-digit code to {maskedEmail}</div>
            </div>
            <div className="demo-warning"><i className="fas fa-flask"></i> DEMO MODE — In production, the code would be emailed only.</div>
            <div className="email-preview-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 30, height: 30, background: 'linear-gradient(135deg,var(--accent),#7c3aed)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><i className="fas fa-comments" style={{ color: 'white', fontSize: 12 }}></i></div>
                <div><div style={{ fontSize: 11, fontWeight: 700, color: '#c7d2fe' }}>AcadSync</div><div style={{ fontSize: 10, color: '#64748b' }}>noreply@acadsync.edu.ph</div></div>
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '0.35em', color: 'var(--accent)', textAlign: 'center', padding: '12px 0' }}>{otpDisplay}</div>
              <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center' }}>Expires in 10 minutes · Do not share</div>
            </div>
            {error && <div className="error-msg"><i className="fas fa-exclamation-circle" style={{ marginRight: 6 }}></i>{error}</div>}
            <div style={{ fontSize: 11, color: 'var(--login-sub)', fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>Enter the 6-digit code</div>
            <div className="otp-wrap">
              {otp.map((v, i) => (
                <input key={i} ref={el => { otpRefs.current[i] = el; }} className={`otp-box ${v ? 'filled' : ''}`}
                  maxLength={1} inputMode="numeric" value={v}
                  onChange={e => otpInput(i, e.target.value)} onKeyDown={e => otpKeyDown(i, e)} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn-secondary" style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }} onClick={() => { setStep('forgot1'); setError(''); }}>← Back</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleVerifyOtp} disabled={loading}>
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-check" style={{ marginRight: 6 }}></i>Verify Code</>}
              </button>
            </div>
          </div>
        )}

        {/* ───── FORGOT STEP 3 (RESET) ───── */}
        {step === 'forgot3' && (
          <div className="fade-in">
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 52, height: 52, background: 'rgba(245,158,11,0.15)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><i className="fas fa-lock-open" style={{ color: '#fbbf24', fontSize: 22 }}></i></div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--login-text)' }}>Set New Password</div>
              <div style={{ fontSize: 12, color: 'var(--login-sub)', marginTop: 4 }}>Choose a strong password with at least 6 characters</div>
            </div>
            {error && <div className="error-msg"><i className="fas fa-exclamation-circle" style={{ marginRight: 6 }}></i>{error}</div>}
            <div style={{ marginBottom: 16 }}>
              <label className="label login-label">New Password</label>
              <input type="password" className="input login-input" placeholder="New password" value={newPw1} onChange={e => setNewPw1(e.target.value)} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="label login-label">Confirm Password</label>
              <input type="password" className="input login-input" placeholder="Confirm password" value={newPw2}
                onChange={e => setNewPw2(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleResetPw()} />
            </div>
            <button className="btn-primary" style={{ width: '100%', padding: 14 }} onClick={handleResetPw} disabled={loading}>
              {loading ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-save" style={{ marginRight: 8 }}></i>Update Password</>}
            </button>
          </div>
        )}
      </div>
      <div id="toast-container"></div>
    </div>
  );
}
