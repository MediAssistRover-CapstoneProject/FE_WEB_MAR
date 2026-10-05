const ADMIN_ACCOUNT = {
  email: 'admin@gmail.com',
  password: '123456',
  name: 'MediAssistRover Admin',
  role: 'admin',
};

export async function loginWithMockApi({ email, password }) {
  await new Promise((resolve) => window.setTimeout(resolve, 350));

  if (email.trim().toLowerCase() !== ADMIN_ACCOUNT.email || password !== ADMIN_ACCOUNT.password) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return { email: ADMIN_ACCOUNT.email, name: ADMIN_ACCOUNT.name, role: ADMIN_ACCOUNT.role };
}
