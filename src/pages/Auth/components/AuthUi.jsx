import { vi } from '../../../i18n/vi.js';
import { injectStyles } from '../../../styles/injectStyles.js';
const inlineStyles = String.raw`.auth-logo{display:flex!important;flex-direction:column;align-items:flex-start!important;gap:3px!important;line-height:1!important;letter-spacing:0!important}.auth-logo>span{color:#163b67!important;font-size:24px;font-weight:800;letter-spacing:-.9px}.auth-logo>small{color:#6683a5;font-size:9px;font-weight:750;letter-spacing:.75px}.auth-logo i{display:none!important}@media(max-width:480px){.auth-logo>span{font-size:20px}.auth-logo>small{font-size:8px}}
`;
injectStyles('mediassist-style-pages-Auth-components-AuthUi-jsx', inlineStyles);

import authIllustration from '../../../assets/images/mediassist-auth.png';

export function AuthButton({ secondary, children, onClick, disabled = false, type = 'button' }) {
  return <button type={type} disabled={disabled} className={secondary ? 'auth-button auth-button--secondary' : 'auth-button'} onClick={onClick}>{vi(children)}</button>;
}

export function AuthField({ label, type, placeholder, value, onChange }) {
  return <label className="auth-field"><span>{vi(label)}</span><input aria-label={vi(label)} type={type} placeholder={vi(placeholder)} value={value} onChange={(event) => onChange?.(event.target.value)} /></label>;
}

export function AuthShell({ children }) {
  return <div className="auth-flow"><header><strong className="auth-logo"><span>{vi("MediAssistRover")}</span><small>{vi("HOSPITAL SERVICE ROBOTICS")}</small></strong><span>{vi("Care operations, made simple")}</span></header><section className="auth-brand"><b>{vi("Meet your new care companion")}</b><h1>{vi("A calmer floor.")}<br /><em>{vi("A happier team.")}</em></h1><p>{vi("Every delivery, request and handoff stays right where your team needs it.")}</p><img src={authIllustration} alt={vi("MediAssistRover concept illustration")} /><div className="auth-brand-note"><i>{vi("✓")}</i><span><strong>{vi("Everything is in motion")}</strong><small>{vi("Your workspace is ready when you are.")}</small></span></div></section>{vi(children)}<footer><span>{vi("© 2026 MediAssistRover")}</span><span>{vi("Private & secure workspace")}</span></footer></div>;
}
