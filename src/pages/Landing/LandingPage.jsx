import previewImage from '../../assets/images/mediassist-preview.png';
import './LandingPage.css';

const features = [
  { tag: '01 / DELIVER', icon: '✦', title: <>Every delivery,<br />a clear destination.</>, text: 'Coordinate supplies from pickup to handover.', useCase: 'Pharmacy  →  Room 305', dark: true },
  { tag: '02 / GUIDE', icon: '⌁', title: <>A familiar guide<br />in an unfamiliar place.</>, text: 'Help patients find the right destination.', useCase: 'Patient guidance' },
  { tag: '03 / CONNECT', icon: '◌', title: <>Your operations.<br />One clear view.</>, text: 'Follow missions and robot status in one workspace.', useCase: 'Live operations', outlined: true },
];

const steps = [
  ['01', 'Prepare your workspace', 'Configure maps, endpoints and reusable workflows.'],
  ['02', 'Dispatch a task', 'Start a configured workflow from a workstation.'],
  ['03', 'Follow the progress', 'Track the robot and review the task outcome.'],
];

function PrimaryButton({ children, onClick, className = '' }) {
  return <button type="button" className={`landing-primary ${className}`} onClick={onClick}>{children}</button>;
}

function SecondaryButton({ children, onClick, className = '' }) {
  return <button type="button" className={`landing-secondary ${className}`} onClick={onClick}>{children}</button>;
}

function FeatureCard({ tag, icon, title, text, useCase, dark, outlined }) {
  return <article className={`landing-feature ${dark ? 'landing-feature--dark' : ''} ${outlined ? 'landing-feature--outlined' : ''}`}>
    <div className="landing-feature-top"><span>{tag}</span><i aria-hidden="true">{icon}</i></div>
    <h3>{title}</h3>
    <p>{text}</p>
    <div>{useCase}</div>
  </article>;
}

export default function LandingPage({ onLogin, onRegister }) {
  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return <div className="landing-page" data-node-id="529:31782">
    <header className="landing-header" data-node-id="495:31737">
      <strong className="landing-logo"><i>✦</i>MediAssist<span>Rover</span></strong>
      <nav>
        <button onClick={() => scrollTo('features')}>Features</button>
        <button onClick={() => scrollTo('how-it-works')}>How it works</button>
        <SecondaryButton onClick={onLogin}>Log in</SecondaryButton>
        <PrimaryButton onClick={onRegister}>Get started</PrimaryButton>
      </nav>
    </header>

    <main>
      <section className="landing-hero" data-node-id="495:31746">
        <div className="landing-hero-copy">
          <span className="landing-overline">The calmer way to run a busy floor</span>
          <h1>More time for<br /><em>human care.</em></h1>
          <p>MediAssistRover quietly takes care of the little journeys, so your team can stay present for the moments that matter.</p>
          <div className="landing-actions">
            <PrimaryButton onClick={onRegister}>Get started</PrimaryButton>
            <SecondaryButton onClick={onLogin}>Log in to workspace</SecondaryButton>
          </div>
          <div className="landing-trust"><span><b>●</b> Live across your care floor</span><span><b>24/7</b> support for your team</span></div>
        </div>
        <figure className="landing-preview" data-node-id="495:31757">
          <img src={previewImage} alt="MediAssistRover concept illustration" />
          <figcaption><i>✦</i><div><b>One more task, already handled.</b><span>Rover A-07 · on its way to Pharmacy</span></div></figcaption>
        </figure>
      </section>

      <section id="features" className="landing-features" data-node-id="496:31740">
        <h2>Less running around.<br />More room for care.</h2>
        <p>Practical support for the moments that keep your hospital moving.</p>
        <div className="landing-feature-grid">{features.map(feature => <FeatureCard key={feature.tag} {...feature} />)}</div>
      </section>

      <section id="how-it-works" className="landing-how" data-node-id="497:31740">
        <div className="landing-section-heading"><span className="landing-overline">Simple by design</span><h2>Thoughtfully connected.<br />From request to arrival.</h2></div>
        <div className="landing-steps">{steps.map(([number, title, text]) => <article key={number}><b>{number}</b><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="landing-cta" data-node-id="497:31755">
        <div><h2>A better flow starts here.</h2><p>Give your team a workspace that moves with them.</p></div>
        <SecondaryButton onClick={onRegister}>Create an account</SecondaryButton>
      </section>
    </main>

    <footer className="landing-footer" data-node-id="497:31761"><span>© 2026 MediAssistRover</span><button onClick={onLogin}>Log in to your workspace</button></footer>
  </div>;
}
