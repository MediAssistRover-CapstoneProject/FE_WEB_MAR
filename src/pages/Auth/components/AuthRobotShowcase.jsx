import RobotIllustration from '../../../components/RobotIllustration.jsx';

export default function AuthRobotShowcase() {
  return <div className="auth-stage">
    <div className="auth-stage-glow" aria-hidden="true" />
    <div className="auth-stage-ring" aria-hidden="true" />
    <div className="auth-stage-shadow" aria-hidden="true" />
    <RobotIllustration className="auth-stage-img" />
  </div>;
}
