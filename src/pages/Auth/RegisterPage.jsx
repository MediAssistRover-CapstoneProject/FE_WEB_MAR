import { useNavigate } from 'react-router-dom';
import { AuthButton, AuthShell } from './components/AuthUi.jsx';

export default function RegisterPage() {
  const navigate = useNavigate();
  return <AuthShell><main className="auth-form">
    <button type="button" className="auth-home" onClick={() => navigate('/')}>← Trang chủ</button>
    <h2>Yêu cầu tài khoản</h2>
    <p className="auth-description">Tài khoản MediAssistRover được quản trị viên cấp. Vui lòng liên hệ quản trị viên của đơn vị để được tạo tài khoản hoặc đặt lại mật khẩu.</p>
    <AuthButton onClick={() => navigate('/login')}>Về trang đăng nhập</AuthButton>
  </main></AuthShell>;
}
