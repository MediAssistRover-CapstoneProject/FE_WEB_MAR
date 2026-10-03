import authIllustration from '../../../assets/images/mediassist-auth.png';

export function AuthButton({ secondary, children, onClick }) {
  return <button type="button" className={secondary ? 'auth-button auth-button--secondary' : 'auth-button'} onClick={onClick}>{children}</button>;
}

export function AuthField({ label, type, placeholder, value, onChange }) {
  return <label className="auth-field"><span>{label}</span><input aria-label={label} type={type} placeholder={placeholder} value={value} onChange={(event) => onChange?.(event.target.value)} /></label>;
}

export function AuthShell({ children }) {
  return <div className="auth-flow"><header><strong className="auth-logo"><i>✦</i>MediAssist<span>Rover</span></strong><span>Care operations, made simple</span></header><section className="auth-brand"><b>Meet your new care companion</b><h1>A calmer floor.<br /><em>A happier team.</em></h1><p>Every delivery, request and handoff stays right where your team needs it.</p><img src={authIllustration} alt="MediAssistRover concept illustration" /><div className="auth-brand-note"><i>✓</i><span><strong>Everything is in motion</strong><small>Your workspace is ready when you are.</small></span></div></section>{children}<footer><span>© 2026 MediAssistRover</span><span>Private & secure workspace</span></footer></div>;
}
