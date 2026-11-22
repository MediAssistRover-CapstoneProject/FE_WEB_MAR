import { useState } from 'react';
import { vi } from '../../../i18n/vi.js';
import { injectStyles } from '../../../styles/injectStyles.js';
import AuthRobotShowcase from './AuthRobotShowcase.jsx';
import BrandMark from '../../../components/BrandMark.jsx';

const inlineStyles = String.raw`
.auth-flow{
  --sky:#1675c5;--sky-2:#087f99;--teal:#087d8d;--violet:#3a6bb0;
  --card:linear-gradient(155deg,#e8f5ff,#cfe8ff);--line:#bdd9ed;
  --text:#0f2a4a;--muted:#4e6c87;
  position:relative;isolation:isolate;min-height:100vh;display:flex;flex-direction:column;
  background:radial-gradient(1100px 650px at 78% 38%,#d3edf9 0%,transparent 65%),linear-gradient(150deg,#edf7ff 0%,#dcefff 55%,#e7f7ff 100%);
  color:var(--text);font-family:'Be Vietnam Pro',Inter,ui-sans-serif,system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;overflow-x:hidden;
}
.auth-flow *{box-sizing:border-box}
.auth-flow button,.auth-flow input{font-family:inherit}
.auth-bg-grid{position:fixed;inset:0;z-index:-2;pointer-events:none;background-image:linear-gradient(#4e8cb71a 1px,transparent 1px),linear-gradient(90deg,#4e8cb71a 1px,transparent 1px);background-size:52px 52px;mask-image:radial-gradient(ellipse 85% 75% at 50% 45%,#000 25%,transparent 78%)}
.auth-bg-orb{position:fixed;z-index:-1;pointer-events:none;border-radius:50%;filter:blur(90px);opacity:.45;animation:auth-float 16s ease-in-out infinite}
.auth-bg-orb--1{width:460px;height:460px;left:-140px;top:-110px;background:#afd6fb}
.auth-bg-orb--2{width:420px;height:420px;right:-110px;bottom:-120px;background:#b3e8ef;opacity:.35;animation-delay:-6s}

/* Header */
.auth-flow>header{
  width:min(1220px,calc(100% - 48px));margin:22px auto 0;padding:14px 22px;
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  border:1px solid var(--line);border-radius:18px;background:#ffffffc9;
  backdrop-filter:blur(16px);box-shadow:0 18px 40px -22px #286b9d30;
}
.auth-logo{display:flex;align-items:center;gap:11px;color:var(--text);text-decoration:none}
.auth-logo-mark{display:grid;place-items:center;flex:0 0 52px;width:52px;height:46px}
.auth-logo-text{display:flex;flex-direction:column;line-height:1}
.auth-logo-text>span{font-size:19px;font-weight:800;letter-spacing:-.5px;color:var(--text)}
.auth-logo-text>span em{font-style:normal;background:linear-gradient(90deg,#1675b9,#087d8d);-webkit-background-clip:text;background-clip:text;color:transparent}
.auth-logo-text>small{margin-top:4px;color:#55738f;font-size:9px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase}
.auth-flow>header>span{color:#4e6c87;font-size:13px;font-weight:600}

/* Main 2-column grid */
.auth-main{
  flex:1;width:min(1220px,calc(100% - 48px));margin:28px auto;
  display:grid;grid-template-columns:1.12fr 0.88fr;gap:34px;align-items:stretch;align-content:center;
}

/* Left brand + 3D showcase */
.auth-brand{
  position:relative;display:flex;flex-direction:column;gap:16px;padding:34px 36px 28px;
  border:1px solid var(--line);border-radius:28px;
  background:radial-gradient(ellipse at 50% 62%,#bfe8f34d,transparent 68%),linear-gradient(155deg,#f8fcffe6,#e2f1ffdf);
  box-shadow:0 35px 80px -40px #286b9d38,inset 0 1px 0 #fff;overflow:hidden;
}
.auth-brand-badge{
  display:inline-flex;align-items:center;gap:8px;align-self:flex-start;
  padding:5px 12px 5px 7px;border:1px solid #a8cfe8;border-radius:999px;
  background:#ffffff8c;color:#2b6087;font-size:12px;font-weight:600;
}
.auth-brand-badge i{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:999px;background:linear-gradient(90deg,#1675c5,#087f99);color:#fff;font-size:10px;font-style:normal;font-weight:800;letter-spacing:.5px}
.auth-brand-badge i:before{content:"";width:5px;height:5px;border-radius:50%;background:#fff;animation:auth-blink 1.6s infinite}
.auth-brand h1{margin:0;font-size:clamp(30px,3vw,42px);line-height:1.24;letter-spacing:-.025em;font-weight:800;color:var(--text)}
.auth-brand h1 em{font-style:normal;background:linear-gradient(90deg,#146db5,#087d8d);-webkit-background-clip:text;background-clip:text;color:transparent}
.auth-brand>p{max-width:440px;margin:0;color:var(--muted);font-size:15px;line-height:1.6}

/* Robot Showcase */
.auth-stage{position:relative;width:100%;height:280px;margin:4px 0;display:grid;place-items:center}
.auth-stage-glow{position:absolute;left:50%;top:50%;width:260px;height:260px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#fff 0%,#b5e0fa66 48%,transparent 72%);filter:blur(8px);pointer-events:none}
.auth-stage-ring{position:absolute;left:50%;top:64%;width:270px;height:86px;transform:translate(-50%,-50%);border-radius:50%;border:1px solid #509ecc55;box-shadow:0 0 24px #9dd7fa33;pointer-events:none}
.auth-stage-shadow{position:absolute;left:50%;top:84%;width:190px;height:22px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(ellipse,#4e789b45,transparent 70%);pointer-events:none}
.auth-stage-img{position:relative;z-index:1;width:min(84%,347px);filter:drop-shadow(0 22px 26px #335e7a38);animation:auth-hover 6s ease-in-out infinite}

.auth-brand-note{
  display:flex;align-items:center;gap:12px;padding:13px 16px;
  border:1px solid #b7d8e5;border-radius:16px;background:#ffffffb3;backdrop-filter:blur(10px);
}
.auth-brand-note i{display:grid;place-items:center;width:30px;height:30px;flex:0 0 auto;border-radius:10px;background:linear-gradient(135deg,#1675c5,#087f99);color:#fff;font-size:14px;font-style:normal;font-weight:800}
.auth-brand-note span{display:flex;flex-direction:column;gap:2px;font-size:13px;color:var(--text)}
.auth-brand-note small{color:var(--muted);font-size:12px}

/* Right Auth Card */
.auth-form{
  position:relative;width:100%;max-width:460px;justify-self:center;
  padding:36px 36px 34px;border:1px solid var(--line);border-radius:28px;
  background:var(--card);backdrop-filter:blur(20px) saturate(140%);
  box-shadow:0 30px 75px -35px #286b9d40,inset 0 1px 0 #fff;
  display:flex;flex-direction:column;justify-content:center;gap:18px;
}
.auth-home{
  align-self:flex-start;display:inline-flex;align-items:center;gap:6px;
  padding:6px 12px;border:1px solid #c3ddec;border-radius:999px;
  background:#edf6ff;color:#315f85;font-size:12px;font-weight:700;cursor:pointer;transition:.2s;
}
.auth-home:hover{background:#e1f0fc;color:#174d78;transform:translateX(-2px)}
.auth-form h2{margin:4px 0 0;font-size:30px;line-height:1.28;letter-spacing:-.02em;font-weight:800;color:var(--text)}
.auth-description,.auth-message{margin:0;color:var(--muted);font-size:14px;line-height:1.6}

/* Fields */
.auth-field{display:flex;flex-direction:column;gap:8px;color:#284e6d;font-size:13px;font-weight:700}
.auth-input-wrap{position:relative;display:flex;align-items:center}
.auth-field input{
  height:50px;width:100%;padding:0 16px;border:1px solid #b5cfe4;border-radius:14px;
  background:#fff;color:var(--text);font-size:14px;font-weight:500;outline:0;
  transition:border-color .2s,box-shadow .2s,background .2s;
}
.auth-field input.has-toggle{padding-right:46px}
.auth-field input:focus{border-color:#1675c5;background:#fff;box-shadow:0 0 0 4px #1675c526}
.auth-field input::placeholder{color:#5a748d}
.auth-eye{
  position:absolute;right:8px;display:grid;place-items:center;width:34px;height:34px;
  border:0;border-radius:10px;background:transparent;color:#55738f;cursor:pointer;transition:.2s;
}
.auth-eye:hover{color:#145b96;background:#e6f3fc}
.auth-eye svg{width:18px;height:18px}

/* Buttons */
.auth-button{
  position:relative;overflow:hidden;height:52px;width:100%;border:0;border-radius:14px;
  background:linear-gradient(135deg,#1675c5,#087f99);background-size:180% 180%;
  box-shadow:0 12px 28px -8px #1675c570,inset 0 1px 0 #ffffff55;
  color:#fff;font-size:15px;font-weight:700;cursor:pointer;transition:transform .2s,box-shadow .2s,opacity .2s;
}
.auth-button:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 16px 34px -8px #1675c58c}
.auth-button:disabled{opacity:.65;cursor:not-allowed}
.auth-button--secondary{
  border:1px solid #accfe7;background:#f1f8ff;box-shadow:none;color:#244e73;
}
.auth-button--secondary:hover:not(:disabled){background:#e5f2fc;box-shadow:none}

/* Alerts & Hints */
.auth-error,.auth-success{margin:0;padding:11px 14px;border-radius:12px;font-size:13px;line-height:1.5}
.auth-error{border:1px solid #f2b7bc;background:#fff1f2;color:#9b2c2c;font-weight:600}
.auth-success{border:1px solid #9bd9c3;background:#e8f8f1;color:#116553;font-weight:700}
.auth-hint{margin:0;color:var(--muted);font-size:12px;line-height:1.55}

/* Footer */
.auth-flow>footer{
  width:min(1220px,calc(100% - 48px));margin:0 auto 22px;padding-top:16px;
  border-top:1px solid #b8d6ea;display:flex;justify-content:space-between;color:#52708c;font-size:12px;
}

@keyframes auth-blink{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes auth-float{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-24px)}}
@keyframes auth-hover{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}

@media(max-width:960px){
  .auth-main{grid-template-columns:1fr;gap:24px;margin:20px auto 28px;align-content:start}
  .auth-brand{order:2;padding:24px}
  .auth-stage{height:220px}
  .auth-stage-img{width:min(84%,280px)}
  .auth-form{order:1;max-width:520px}
  .auth-flow>header>span{display:none}
}
@media(max-width:540px){
  .auth-flow>header,.auth-main,.auth-flow>footer{width:calc(100% - 28px)}
  .auth-flow>header{margin-top:14px;padding:12px 16px}
  .auth-form{padding:26px 22px;border-radius:22px}
  .auth-form h2{font-size:25px}
  .auth-flow>footer{flex-direction:column;gap:6px}
}
@media(prefers-reduced-motion:reduce){.auth-flow *,.auth-flow *:before,.auth-flow *:after{animation:none!important;transition:none!important}}
`;
injectStyles('mediassist-style-pages-Auth-components-AuthUi-v2', inlineStyles);

export function AuthButton({ secondary, children, onClick, disabled = false, type = 'button' }) {
  return <button type={type} disabled={disabled} className={secondary ? 'auth-button auth-button--secondary' : 'auth-button'} onClick={onClick}>{vi(children)}</button>;
}

export function AuthField({ label, type = 'text', placeholder, value, onChange }) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && revealed ? 'text' : type;

  return <label className="auth-field">
    <span>{vi(label)}</span>
    <span className="auth-input-wrap">
      <input
        className={isPassword ? 'has-toggle' : undefined}
        aria-label={vi(label)}
        type={inputType}
        placeholder={vi(placeholder)}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {isPassword && (
        <button
          type="button"
          className="auth-eye"
          tabIndex={-1}
          aria-label={revealed ? 'Ẩn ký tự' : 'Hiện ký tự'}
          onClick={() => setRevealed(r => !r)}
        >
          {revealed ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.94" />
              <path d="M1 1l22 22" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-3.17 4.49" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      )}
    </span>
  </label>;
}

export function AuthShell({ children }) {
  return <div className="auth-flow">
    <div className="auth-bg-grid" aria-hidden="true" />
    <div className="auth-bg-orb auth-bg-orb--1" aria-hidden="true" />
    <div className="auth-bg-orb auth-bg-orb--2" aria-hidden="true" />

    <header>
      <strong className="auth-logo">
        <span className="auth-logo-mark"><BrandMark /></span>
        <span className="auth-logo-text">
          <span>MediAssist<em>Rover</em></span>
          <small>{vi('HOSPITAL SERVICE ROBOTICS')}</small>
        </span>
      </strong>
      <span>{vi('Care operations, made simple')}</span>
    </header>

    <div className="auth-main">
      <section className="auth-brand">
        <span className="auth-brand-badge"><i>LIVE</i>Robot dịch vụ bệnh viện</span>
        <h1>{vi('A calmer floor.')}<br /><em>{vi('A happier team.')}</em></h1>
        <p>{vi('Every delivery, request and handoff stays right where your team needs it.')}</p>
        <AuthRobotShowcase />
        <div className="auth-brand-note">
          <i>✓</i>
          <span>
            <strong>{vi('Everything is in motion')}</strong>
            <small>{vi('Your workspace is ready when you are.')}</small>
          </span>
        </div>
      </section>

      {vi(children)}
    </div>

    <footer>
      <span>{vi('© 2026 MediAssistRover')}</span>
      <span>{vi('Private & secure workspace')}</span>
    </footer>
  </div>;
}
