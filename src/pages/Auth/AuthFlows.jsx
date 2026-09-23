import { useState } from 'react';
import './Auth.css';
import { AuthButton, AuthField, AuthShell } from './components/AuthUi.jsx';

const TEST_ACCOUNT = { email: 'admin@gmail.com', password: '123456' };

const screenCopy = {
  Login: { title: 'Welcome back', description: 'Sign in to your MediAssistRover workspace.', fields: [['Work email', 'email', 'name@hospital.org'], ['Password', 'password', '••••••••••••']], action: 'Log in', footer: 'New to MediAssistRover? Create an account' },
  Register: { title: 'Create your account', description: 'Use your work email to get started.', fields: [['Full name', 'text', 'Your full name'], ['Work email', 'email', 'name@hospital.org'], ['Password', 'password', 'Create a password'], ['Confirm password', 'password', 'Re-enter your password']], hint: 'Use at least 12 characters with a mix of letters, numbers and symbols.', action: 'Create account', footer: 'Already have an account? Log in' },
  Forgot: { title: 'Forgot your password?', description: 'Enter your work email. If an account exists, we will send a password reset link.', fields: [['Work email', 'email', 'name@hospital.org']], action: 'Send reset link', footer: 'Back to login' },
  Reset: { title: 'Set a new password', description: 'Choose a new password for your workspace account.', fields: [['New password', 'password', 'Create a new password'], ['Confirm new password', 'password', 'Re-enter your new password']], hint: 'Use at least 12 characters with a mix of letters, numbers and symbols.', action: 'Update password', footer: 'Back to login' },
  Verify: { title: 'Check your email', description: 'We sent a verification link to name@hospital.org. Open the link to verify your email address.', message: 'After verification, return here to sign in.', action: 'Back to login', secondary: 'Resend verification email', footer: 'Use a different email' },
  Sent: { title: 'Check your inbox', description: 'If an account exists for name@hospital.org, you will receive a password reset link shortly.', message: 'Check your spam folder if the email has not arrived.', secondary: 'Resend reset email', footer: 'Back to login' },
  Updated: { title: 'Password updated', description: 'Your password has been changed. You can now sign in with your new password.', message: 'Account recovery complete', success: true, action: 'Return to login' },
  Expired: { title: 'This link has expired', description: 'This reset link has expired or has already been used. Request a new link to continue.', action: 'Request a new link', footer: 'Back to login' },
  Error: { title: 'Welcome back', description: 'Sign in to your MediAssistRover workspace.', fields: [['Work email', 'email', 'name@hospital.org'], ['Password', 'password', '••••••••••••']], error: 'The email or password is incorrect. Please try again.', action: 'Try again', footer: 'Create an account' },
};

export default function AuthFlows({ initial = 'Login', onHome, onAuthenticated }) {
  const [screen, setScreen] = useState(initial);
  const [values, setValues] = useState({ 'Work email': TEST_ACCOUNT.email, Password: TEST_ACCOUNT.password });
  const info = screenCopy[screen];
  const isLogin = screen === 'Login' || screen === 'Error';
  const onSubmit = () => {
    if (isLogin) {
      if (values['Work email']?.trim().toLowerCase() === TEST_ACCOUNT.email && values.Password?.trim() === TEST_ACCOUNT.password) { onAuthenticated?.(); return; }
      setScreen('Error'); return;
    }
    if (screen === 'Register') setScreen('Verify'); else if (screen === 'Forgot') setScreen('Sent'); else if (screen === 'Reset') setScreen('Updated'); else if (screen === 'Expired') setScreen('Forgot'); else setScreen('Login');
  };
  const footerAction = () => { if (isLogin) setScreen('Register'); else setScreen('Login'); };
  return <AuthShell><main className="auth-form" data-auth-screen={screen}><button className="auth-home" onClick={onHome}>← Home</button><h2>{info.title}</h2><p className="auth-description">{info.description}</p>{info.fields?.map(([label, type, placeholder]) => <AuthField key={label} label={label} type={type} placeholder={placeholder} value={values[label] ?? ''} onChange={(value) => setValues((current) => ({ ...current, [label]: value }))} />)}{isLogin && <p className="auth-hint">Test account: admin@gmail.com / 123456</p>}{info.error && <p className="auth-error">{info.error}</p>}{isLogin ? <button className="auth-link" onClick={() => setScreen('Forgot')}>Forgot password?</button> : null}{info.message && <p className={info.success ? 'auth-success' : 'auth-message'}>{info.message}</p>}{info.hint && <p className="auth-hint">{info.hint}</p>}{info.action && <AuthButton onClick={onSubmit}>{info.action}</AuthButton>}{info.secondary && <AuthButton secondary onClick={() => {}}> {info.secondary}</AuthButton>}{info.footer && <button className="auth-link auth-footer-link" onClick={footerAction}>{info.footer}</button>}</main></AuthShell>;
}
