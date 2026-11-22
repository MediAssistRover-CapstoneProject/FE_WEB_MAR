import { useRef, useState } from 'react';
import { vi } from '../../i18n/vi.js';
import { AuthButton, AuthField, AuthShell } from './components/AuthUi.jsx';
import { API_BASE_URL } from '../../features/api/client.js';

export default function AuthFlows({ onHome, onAuthenticated, notice }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginFailure, setLoginFailure] = useState(null);
  const submitting = useRef(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const identifier = username.trim();
    if (!identifier || !password) {
      setLoginError('Nhập tên đăng nhập và mật khẩu.');
      return;
    }
    submitting.current = true;
    setIsSubmitting(true);
    setLoginError('');
    setLoginFailure(null);
    try {
      await onAuthenticated({ username: identifier, password });
    } catch (error) {
      setLoginError(error?.message || 'Không thể đăng nhập. Hãy thử lại sau.');
      setLoginFailure({ status: error?.status, correlationId: error?.body?.correlationId });
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };
  return <AuthShell><form className="auth-form" onSubmit={onSubmit}>
    <button type="button" className="auth-home" onClick={onHome}>{vi('← Home')}</button>
    <h2>{vi('Welcome back')}</h2>
    <p className="auth-description">Đăng nhập bằng tên tài khoản được cấp trên hệ thống.</p>
    {notice && <p className="auth-success" role="status">{notice}</p>}
    <AuthField label="Tên đăng nhập" type="text" placeholder="Ví dụ: admin" value={username} onChange={value => { setUsername(value); setLoginError(''); }} />
    <AuthField label="Mật khẩu" type="password" placeholder="Nhập mật khẩu" value={password} onChange={value => { setPassword(value); setLoginError(''); }} />
    {loginError && <p className="auth-error" role="alert">{vi(loginError)}</p>}
    {loginError && loginFailure?.status === 401 && <p className="auth-hint">Đang đăng nhập tại {new URL(API_BASE_URL || '/', window.location.origin).host}. Hãy dùng tài khoản được cấp trên máy chủ này. Nếu vẫn lỗi, nhờ quản trị viên kiểm tra hoặc đặt lại mật khẩu{loginFailure.correlationId ? ` (mã tra cứu: ${loginFailure.correlationId})` : ''}.</p>}
    <p className="auth-hint">Nếu chưa có tài khoản hoặc quên mật khẩu, liên hệ quản trị viên để được cấp hoặc đặt lại.</p>
    <AuthButton type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</AuthButton>
  </form></AuthShell>;
}
