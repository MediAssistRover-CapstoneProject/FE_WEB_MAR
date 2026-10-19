import { useLocation, useNavigate } from 'react-router-dom';
import AuthFlows from './AuthFlows.jsx';
import { clearSession, createDemoSession, createSession, updateCurrentUser } from '../../features/auth/session.js';
import { getCurrentUser, login as loginWithApi } from '../../features/auth/authApi.js';
import { DEMO_USERNAME, loginWithMockApi } from '../../features/auth/mockAuthApi.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = async (credentials) => {
    if (credentials.username.toLowerCase() === DEMO_USERNAME) {
      createDemoSession(loginWithMockApi(credentials));
      navigate('/admin');
      return;
    }
    const tokens = await loginWithApi(credentials);
    if (!tokens?.accessToken) throw new Error('Máy chủ chưa trả phiên đăng nhập hợp lệ. Vui lòng thử lại.');
    createSession({ tokens });
    if (tokens.mustChangePassword) { navigate('/change-password', { replace: true }); return; }
    try {
      const account = await getCurrentUser();
      if (!account || !['ADMIN', 'STAFF'].includes(account.role)) throw new Error('Tài khoản chưa được cấp quyền truy cập. Vui lòng liên hệ quản trị viên.');
      updateCurrentUser(account);
    } catch (error) {
      clearSession();
      throw error;
    }
    navigate('/admin');
  };

  return <AuthFlows notice={location.state?.passwordChanged ? 'Đã đổi mật khẩu. Hãy đăng nhập lại bằng mật khẩu mới.' : ''} onHome={() => navigate('/')} onAuthenticated={login} />;
}
