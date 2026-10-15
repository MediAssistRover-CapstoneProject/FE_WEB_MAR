export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = 'demo123';

export function loginWithMockApi({ username, password }) {
  if (username.trim().toLowerCase() !== DEMO_USERNAME || password !== DEMO_PASSWORD) {
    throw new Error('Tên đăng nhập hoặc mật khẩu không đúng.');
  }
  return { username: DEMO_USERNAME, fullName: 'Người dùng', role: 'DEMO' };
}
