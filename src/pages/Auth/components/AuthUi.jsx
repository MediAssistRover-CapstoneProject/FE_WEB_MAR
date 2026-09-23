import authIllustration from '../../../assets/images/mediassist-auth.png';

export function AuthButton({ secondary, children, onClick }) {
  return <button type="button" className={secondary ? 'auth-button auth-button--secondary' : 'auth-button'} onClick={onClick}>{children}</button>;
}

export function AuthField({ label, type, placeholder, value, onChange }) {
  return <label className="auth-field"><span>{label}</span><input aria-label={label} type={type} placeholder={placeholder} value={value} onChange={(event) => onChange?.(event.target.value)} /></label>;
}

export function AuthShell({ children }) {
  return <div className="auth-flow"><header><strong>MediAssistRover</strong><span>Hospital service robotics</span></header><section className="auth-brand"><b>Purposeful robotics. Human-centered care.</b><h1>Care in focus.<br />Everything else, in motion.</h1><p>A helping hand for every hospital journey.<br />Connected to your team, from request to arrival.</p><img src={authIllustration} alt="MediAssistRover concept illustration" /><small>MediAssistRover · Concept illustration</small></section>{children}<footer><span>© 2026 MediAssistRover</span><span>Your hospital workspace</span></footer></div>;
}
