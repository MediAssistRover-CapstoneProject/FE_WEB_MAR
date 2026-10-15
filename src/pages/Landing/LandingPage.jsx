import { vi } from '../../i18n/vi.js';
import { injectStyles } from '../../styles/injectStyles.js';
const inlineStyles = String.raw`.landing-page{--sky:#1687ed;--sky-deep:#0863ba;--ink:#163b67;--muted:#6683a5;--line:#d8eafb;min-width:320px;overflow:hidden;background:linear-gradient(180deg,#fbfdff,#fff 42%,#f3faff);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif}.landing-page *{box-sizing:border-box}.landing-page button{cursor:pointer;transition:.2s}.landing-header{height:92px;max-width:1320px;margin:auto;padding:20px 48px;display:flex;align-items:center;justify-content:space-between}.landing-logo{display:flex;align-items:center;gap:8px;font-size:21px;letter-spacing:-.8px}.landing-logo i{display:grid;place-items:center;width:31px;height:31px;border-radius:10px;background:var(--sky);box-shadow:4px 5px 0 #cfeaff;color:#fff;font-size:14px;font-style:normal}.landing-logo span{color:var(--sky)}.landing-header nav{display:flex;align-items:center;gap:25px}.landing-header nav>button{padding:0;border:0;background:none;color:var(--muted);font-size:14px;font-weight:700}.landing-primary,.landing-secondary{height:46px;padding:0 20px;border-radius:13px;font-size:14px;font-weight:750;white-space:nowrap}.landing-primary{border:0;background:var(--sky);box-shadow:0 6px 0 var(--sky-deep),0 12px 20px #1687ed28;color:#fff}.landing-primary:hover{transform:translateY(-2px);box-shadow:0 8px 0 var(--sky-deep),0 16px 23px #1687ed35}.landing-secondary{border:1px solid var(--line);background:#fff;color:var(--ink)}.landing-header .landing-secondary{width:105px}.landing-header .landing-primary{width:132px}.landing-hero{position:relative;max-width:1320px;margin:auto;padding:65px 48px 105px;display:grid;grid-template-columns:1fr 1.05fr;gap:70px;align-items:center}.landing-hero:before{content:"";position:absolute;left:-120px;top:110px;width:220px;height:220px;border-radius:50%;background:#e1f2ff}.landing-hero-copy{position:relative;z-index:1;display:flex;flex-direction:column;align-items:flex-start;gap:24px}.landing-overline{color:var(--sky);font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase}.landing-hero h1{margin:0;font-size:clamp(49px,5.4vw,73px);line-height:1;letter-spacing:-3.8px;font-weight:800}.landing-hero h1 em{color:var(--sky);font-style:normal}.landing-hero-copy>p{max-width:520px;margin:0;color:var(--muted);font-size:18px;line-height:1.6}.landing-actions{display:flex;gap:14px}.landing-actions .landing-primary,.landing-actions .landing-secondary{height:55px;min-width:178px}.landing-trust{display:flex;gap:20px;color:var(--muted);font-size:12px}.landing-trust b{color:var(--sky)}.landing-preview{position:relative;width:100%;aspect-ratio:1.18;margin:0}.landing-preview:before{content:"";position:absolute;right:-8%;top:-8%;width:82%;height:82%;border-radius:50%;background:#dcedff}.landing-preview:after{content:"";position:absolute;left:-25px;bottom:-27px;width:125px;height:125px;border:16px solid #9bd5ff;border-radius:50%}.landing-preview img{position:relative;z-index:1;width:100%;height:100%;object-fit:cover;border-radius:34px;box-shadow:0 25px 45px #16599220}.landing-preview figcaption{position:absolute;z-index:2;left:-22px;bottom:28px;display:flex;align-items:center;gap:12px;width:min(390px,84%);padding:15px 17px;border-radius:16px;background:#fff;box-shadow:0 13px 28px #1659921c}.landing-preview figcaption>i{display:grid;place-items:center;width:31px;height:31px;border-radius:50%;background:#d9f0ff;color:var(--sky);font-size:14px;font-style:normal}.landing-preview figcaption div{display:flex;flex-direction:column;gap:2px;font-size:14px}.landing-preview figcaption span{color:var(--muted);font-size:11px}.landing-features,.landing-how{max-width:1320px;margin:auto;padding:70px 48px 88px}.landing-features>h2,.landing-how h2{margin:0;font-size:43px;line-height:1.1;letter-spacing:-2px}.landing-features>p{margin:18px 0 31px;color:var(--muted);font-size:17px}.landing-feature-grid{display:grid;grid-template-columns:1.65fr 1fr 1fr;gap:20px}.landing-feature{min-height:320px;padding:27px;border:1px solid #d6eafa;border-radius:26px;background:#edf7ff;display:flex;flex-direction:column;gap:18px;transition:.25s}.landing-feature:hover{transform:translateY(-5px);box-shadow:0 18px 32px #16599213}.landing-feature--dark{background:#e1f1ff;border-color:#cce6fa}.landing-feature--outlined{background:#fff}.landing-feature-top{display:flex;justify-content:space-between}.landing-feature-top span{color:var(--sky);font-size:11px;font-weight:800}.landing-feature-top i{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:#fff;color:var(--sky);font-size:18px;font-style:normal}.landing-feature h3{margin:4px 0 0;font-size:24px;line-height:1.16;letter-spacing:-.85px}.landing-feature--dark h3{font-size:31px}.landing-feature p{margin:0;color:var(--muted);font-size:14px;line-height:1.55}.landing-feature>div:last-child{margin-top:auto;padding:14px;border-radius:12px;background:#fff;color:var(--ink);font-size:13px;font-weight:750}.landing-feature--dark>div:last-child{background:var(--sky);color:#fff}.landing-how{padding-top:80px;padding-bottom:92px}.landing-section-heading{display:flex;flex-direction:column;gap:14px}.landing-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:42px}.landing-steps article{padding:22px 20px 0;border-top:2px solid var(--line)}.landing-steps article:first-child{border-color:var(--sky)}.landing-steps b{color:var(--sky);font-size:27px}.landing-steps h3{margin:15px 0 10px;font-size:20px}.landing-steps p{margin:0;color:var(--muted);font-size:15px;line-height:1.55}.landing-cta{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;min-height:240px;padding:56px max(48px,calc((100vw - 1224px)/2));background:#e1f3ff}.landing-cta:before{content:"";position:absolute;right:11%;top:-155px;width:385px;height:385px;border:48px solid #c5e6ff;border-radius:50%}.landing-cta>div,.landing-cta .landing-secondary{position:relative;z-index:1}.landing-cta h2{margin:0 0 12px;font-size:41px;letter-spacing:-1.8px}.landing-cta p{margin:0;color:var(--muted);font-size:17px}.landing-cta .landing-secondary{width:200px;height:55px;border:0;background:var(--sky);box-shadow:0 6px 0 var(--sky-deep);color:#fff}.landing-footer{max-width:1320px;min-height:95px;margin:auto;padding:30px 48px;display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:13px}.landing-footer button{padding:0;border:0;background:none;color:var(--sky);font-size:14px;font-weight:800}@media(max-width:900px){.landing-header,.landing-hero,.landing-features,.landing-how,.landing-footer{padding-left:28px;padding-right:28px}.landing-hero{grid-template-columns:1fr;gap:50px}.landing-preview{max-width:650px}.landing-cta{padding-left:28px;padding-right:28px}}@media(max-width:640px){.landing-header{height:auto;padding:20px 24px}.landing-logo{font-size:18px}.landing-header nav>button:not(.landing-primary):not(.landing-secondary),.landing-header .landing-secondary{display:none}.landing-header .landing-primary{width:auto;padding:0 14px}.landing-hero{padding:45px 24px 66px;gap:46px}.landing-hero h1{font-size:49px;letter-spacing:-2.7px}.landing-hero-copy>p{font-size:16px}.landing-actions{width:100%;flex-direction:column}.landing-actions .landing-primary,.landing-actions .landing-secondary{width:100%;height:52px}.landing-trust{flex-direction:column;gap:8px}.landing-preview{width:calc(100% - 14px);margin-left:14px}.landing-preview figcaption{left:-14px;bottom:15px}.landing-features,.landing-how{padding:56px 24px}.landing-features>h2,.landing-how h2{font-size:34px}.landing-feature-grid,.landing-steps{grid-template-columns:1fr}.landing-feature{min-height:248px}.landing-cta{padding:47px 24px;align-items:flex-start;gap:28px;flex-direction:column}.landing-cta h2{font-size:33px}.landing-cta .landing-secondary{width:100%}.landing-footer{padding:28px 24px;align-items:flex-start;gap:18px;flex-direction:column}}

.landing-header{position:relative;height:104px!important;margin-top:18px!important;padding:0 28px!important;border:1px solid #d8eafb;border-radius:22px;background:#ffffffdc;box-shadow:0 12px 32px #1267ad0d;backdrop-filter:blur(12px)}
.landing-header:after{content:"";position:absolute;z-index:-1;inset:-1px;border-radius:22px;background:linear-gradient(105deg,#fff,#e9f6ff);opacity:.8}
.landing-header .landing-logo{font-size:22px}.landing-header nav{gap:29px!important}.landing-header nav>button{font-size:13px!important}.landing-header .landing-primary{height:48px!important;border-radius:14px!important}
.landing-footer{max-width:none!important;display:block!important;margin-top:0!important;padding:0!important;background:#123b6b!important;color:#d7eaff!important}.landing-footer-main{max-width:1224px;margin:auto;padding:58px 48px 52px;display:grid;grid-template-columns:1.05fr 1.45fr;gap:70px}.landing-footer-brand{display:flex;flex-direction:column;align-items:flex-start;gap:16px}.landing-footer .landing-logo{color:#fff}.landing-footer .landing-logo i{background:#55b4ff!important;box-shadow:4px 5px 0 #2a70ab!important}.landing-footer .landing-logo span{color:#9ed8ff}.landing-footer-brand p{max-width:260px;margin:0;color:#b9d5eb;font-size:16px;line-height:1.55}.landing-footer-login{margin-top:5px;padding:0;border:0;background:transparent;color:#8ed0ff;font-size:14px;font-weight:800;cursor:pointer}.landing-footer-login:hover{color:#fff;text-decoration:underline}.landing-footer-links{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}.landing-footer-links>div{display:flex;flex-direction:column;align-items:flex-start;gap:12px}.landing-footer-links b{color:#fff;font-size:13px}.landing-footer-links button{padding:0;border:0;background:none;color:#b9d5eb;font-size:13px;line-height:1.45;cursor:pointer}.landing-footer-links button:hover{color:#fff}.landing-footer-links span{color:#b9d5eb;font-size:13px;line-height:1.55}.landing-footer-bottom{max-width:1224px;margin:auto;padding:20px 48px;border-top:1px solid #ffffff1f;display:flex;justify-content:space-between;color:#8fb6d4;font-size:12px}@media(max-width:900px){.landing-header{margin:12px 28px 0!important;padding:0 22px!important}.landing-footer-main{padding-left:28px;padding-right:28px;grid-template-columns:1fr;gap:38px}.landing-footer-bottom{padding-left:28px;padding-right:28px}.landing-footer-links{max-width:650px}}@media(max-width:640px){.landing-header{height:76px!important;margin:10px 16px 0!important;padding:0 16px!important;border-radius:17px}.landing-header:after{border-radius:17px}.landing-header .landing-logo{font-size:18px}.landing-footer-main{padding:43px 24px 36px;gap:32px}.landing-footer-links{grid-template-columns:1fr 1fr;gap:28px}.landing-footer-links>div:last-child{grid-column:span 2}.landing-footer-bottom{padding:18px 24px;gap:8px;align-items:flex-start;flex-direction:column}}

.landing-logo{display:flex!important;flex-direction:column;align-items:flex-start!important;gap:3px!important;line-height:1!important;letter-spacing:0!important}.landing-logo>span{color:#163b67!important;font-size:24px;font-weight:800;letter-spacing:-.9px}.landing-logo>small{color:#6683a5;font-size:9px;font-weight:750;letter-spacing:.75px}.landing-footer .landing-logo>span{color:#fff!important}.landing-footer .landing-logo>small{color:#9ed8ff}.landing-footer .landing-logo i{display:none!important}@media(max-width:640px){.landing-logo>span{font-size:20px}.landing-logo>small{font-size:8px}}

/* Keep the compact header and feature cards visually balanced at every width. */
.landing-header .landing-primary{box-shadow:0 8px 18px #1687ed2b!important}.landing-header .landing-primary:hover{box-shadow:0 11px 22px #1687ed38!important}.landing-feature-grid{align-items:stretch}.landing-feature{min-height:300px!important}.landing-feature--dark h3{font-size:28px!important}.landing-feature>div:last-child{min-height:52px;display:flex;align-items:center}@media(max-width:640px){.landing-header{width:calc(100% - 32px)!important;max-width:none!important;overflow:visible}.landing-header nav{flex:0 0 auto!important}.landing-header .landing-primary{height:42px!important;padding:0 13px!important;box-shadow:0 6px 13px #1687ed2b!important}.landing-header .landing-primary:hover{transform:none!important}.landing-feature{min-height:236px!important}.landing-feature--dark h3{font-size:26px!important}}
`;
injectStyles('mediassist-style-pages-Landing-LandingPage-jsx', inlineStyles);

import previewImage from '../../assets/images/mediassist-preview.png';

const features = [
  { tag: '01 / DELIVER', icon: '✦', title: <>{vi("Every delivery,")}<br />{vi("a clear destination.")}</>, text: 'Coordinate supplies from pickup to handover.', useCase: 'Pharmacy  →  Room 305', dark: true },
  { tag: '02 / GUIDE', icon: '⌁', title: <>{vi("A familiar guide")}<br />{vi("in an unfamiliar place.")}</>, text: 'Help patients find the right destination.', useCase: 'Patient guidance' },
  { tag: '03 / CONNECT', icon: '◌', title: <>{vi("Your operations.")}<br />{vi("One clear view.")}</>, text: 'Follow missions and robot status in one workspace.', useCase: 'Live operations', outlined: true },
];

const steps = [
  ['01', 'Prepare your workspace', 'Configure maps, endpoints and reusable workflows.'],
  ['02', 'Dispatch a task', 'Start a configured workflow from a workstation.'],
  ['03', 'Follow the progress', 'Track the robot and review the task outcome.'],
];

function PrimaryButton({ children, onClick, className = '' }) {
  return <button type="button" className={`landing-primary ${className}`} onClick={onClick}>{vi(children)}</button>;
}

function SecondaryButton({ children, onClick, className = '' }) {
  return <button type="button" className={`landing-secondary ${className}`} onClick={onClick}>{vi(children)}</button>;
}

function FeatureCard({ tag, icon, title, text, useCase, dark, outlined }) {
  return <article className={`landing-feature ${dark ? 'landing-feature--dark' : ''} ${outlined ? 'landing-feature--outlined' : ''}`}>
    <div className="landing-feature-top"><span>{vi(tag)}</span><i aria-hidden="true">{vi(icon)}</i></div>
    <h3>{vi(title)}</h3>
    <p>{vi(text)}</p>
    <div>{vi(useCase)}</div>
  </article>;
}

export default function LandingPage({ onLogin, onRegister }) {
  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return <div className="landing-page" data-node-id="529:31782">
    <header className="landing-header" data-node-id="495:31737">
      <strong className="landing-logo"><span>{vi("MediAssistRover")}</span><small>{vi("HOSPITAL SERVICE ROBOTICS")}</small></strong>
      <nav aria-label={vi("Primary navigation")}>
        <button onClick={() => scrollTo('features')}>{vi("Features")}</button>
        <button onClick={() => scrollTo('how-it-works')}>{vi("How it works")}</button>
        <SecondaryButton onClick={onLogin}>{vi("Log in")}</SecondaryButton>
        <PrimaryButton onClick={onRegister}>Yêu cầu tài khoản</PrimaryButton>
      </nav>
    </header>

    <main>
      <section className="landing-hero" data-node-id="495:31746">
        <div className="landing-hero-copy">
          <span className="landing-overline">{vi("The calmer way to run a busy floor")}</span>
          <h1>{vi("More time for")}<br /><em>{vi("human care.")}</em></h1>
          <p>{vi("MediAssistRover quietly takes care of the little journeys, so your team can stay present for the moments that matter.")}</p>
          <div className="landing-actions">
            <PrimaryButton onClick={onRegister}>Yêu cầu tài khoản</PrimaryButton>
            <SecondaryButton onClick={onLogin}>{vi("Log in to workspace")}</SecondaryButton>
          </div>
          <div className="landing-trust"><span><b>{vi("●")}</b>{vi(" Live across your care floor")}</span><span><b>{vi("24/7")}</b>{vi(" support for your team")}</span></div>
        </div>
        <figure className="landing-preview" data-node-id="495:31757">
          <img src={previewImage} alt={vi("MediAssistRover concept illustration")} />
          <figcaption><i>{vi("✦")}</i><div><b>{vi("One more task, already handled.")}</b><span>{vi("Rover A-07 · on its way to Pharmacy")}</span></div></figcaption>
        </figure>
      </section>

      <section id="features" className="landing-features" data-node-id="496:31740">
        <h2>{vi("Less running around.")}<br />{vi("More room for care.")}</h2>
        <p>{vi("Practical support for the moments that keep your hospital moving.")}</p>
        <div className="landing-feature-grid">{vi(features.map(feature => <FeatureCard key={feature.tag} {...feature} />))}</div>
      </section>

      <section id="how-it-works" className="landing-how" data-node-id="497:31740">
        <div className="landing-section-heading"><span className="landing-overline">{vi("Simple by design")}</span><h2>{vi("Thoughtfully connected.")}<br />{vi("From request to arrival.")}</h2></div>
        <div className="landing-steps">{vi(steps.map(([number, title, text]) => <article key={number}><b>{vi(number)}</b><h3>{vi(title)}</h3><p>{vi(text)}</p></article>))}</div>
      </section>

      <section className="landing-cta" data-node-id="497:31755">
        <div><h2>{vi("A better flow starts here.")}</h2><p>{vi("Give your team a workspace that moves with them.")}</p></div>
        <SecondaryButton onClick={onRegister}>Yêu cầu tài khoản</SecondaryButton>
      </section>
    </main>

    <footer className="landing-footer" data-node-id="497:31761">
      <div className="landing-footer-main">
        <div className="landing-footer-brand"><strong className="landing-logo"><span>{vi("MediAssistRover")}</span><small>{vi("HOSPITAL SERVICE ROBOTICS")}</small></strong><p>{vi("A calmer, more connected way to care.")}</p><button className="landing-footer-login" onClick={onLogin}>{vi("Log in to your workspace →")}</button></div>
        <div className="landing-footer-links"><div><b>{vi("Explore")}</b><button onClick={() => scrollTo('features')}>{vi("What we do")}</button><button onClick={() => scrollTo('how-it-works')}>{vi("How it works")}</button></div><div><b>{vi("Workspace")}</b><button onClick={onLogin}>{vi("Log in")}</button><button onClick={onRegister}>Yêu cầu tài khoản</button></div><div><b>{vi("Built for care teams")}</b><span>{vi("Purposeful robotics.")}<br />{vi("Human-centered care.")}</span></div></div>
      </div>
      <div className="landing-footer-bottom"><span>{vi("© 2026 MediAssistRover. All rights reserved.")}</span><span>{vi("Private & secure hospital workspace")}</span></div>
    </footer>
  </div>;
}
