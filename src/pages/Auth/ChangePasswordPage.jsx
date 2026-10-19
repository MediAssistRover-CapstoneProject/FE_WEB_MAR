import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword, logout } from '../../features/auth/authApi.js';
import { clearSession, getRefreshToken } from '../../features/auth/session.js';
import { AuthButton, AuthField, AuthShell } from './components/AuthUi.jsx';
import './AuthFlows.jsx';

export default function ChangePasswordPage() {
  const navigate = useNavigate(), lock = useRef(false);
  const [currentPassword, setCurrent] = useState(''), [newPassword, setNew] = useState(''), [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = async event => {
    event.preventDefault(); if (lock.current) return;
    setError('');
    if (!currentPassword || newPassword.length < 8 || newPassword.length > 128) { setError('Nhập mật khẩu hiện tại và mật khẩu mới từ 8 đến 128 ký tự.'); return; }
    if (newPassword !== confirmation) { setError('Xác nhận mật khẩu mới chưa khớp.'); return; }
    if (currentPassword === newPassword) { setError('Mật khẩu mới phải khác mật khẩu hiện tại.'); return; }
    lock.current = true; setBusy(true);
    try {
      await changePassword({ currentPassword, newPassword });
      clearSession();
      navigate('/login', { replace: true, state: { passwordChanged: true } });
    } catch (e) { setError(e.message || 'Không đổi được mật khẩu.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const signOut = async () => {
    if (lock.current) return; lock.current = true; setBusy(true);
    try { await logout(getRefreshToken()); } catch { /* Local logout must still work. */ }
    finally { clearSession(); navigate('/login', { replace: true }); }
  };
  return <AuthShell><form className="auth-form" onSubmit={submit}>
    <h2>Đổi mật khẩu</h2><p className="auth-description">Tài khoản cần đổi mật khẩu trước khi sử dụng hệ thống.</p>
    <AuthField label="Mật khẩu hiện tại" type="password" value={currentPassword} onChange={setCurrent} />
    <AuthField label="Mật khẩu mới" type="password" value={newPassword} onChange={setNew} />
    <AuthField label="Xác nhận mật khẩu mới" type="password" value={confirmation} onChange={setConfirmation} />
    {error && <p className="auth-error" role="alert">{error}</p>}
    <AuthButton type="submit" disabled={busy}>{busy ? 'Đang xử lý…' : 'Lưu mật khẩu mới'}</AuthButton>
    <AuthButton secondary disabled={busy} onClick={signOut}>Quay lại đăng nhập</AuthButton>
  </form></AuthShell>;
}
