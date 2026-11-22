import robotImage from '../assets/images/mentorpi-m1.png';
import './robotIllustration.css';

// The overlay is anchored to the LiDAR face in the original 912 × 644 image.
// Keeping both in one wrapper preserves alignment while resizing and floating.
export default function RobotIllustration({ className = '', alt = 'Robot dịch vụ bệnh viện MediAssistRover' }) {
  return <div className={`robot-illustration ${className}`}>
    <img className="robot-illustration-image" src={robotImage} alt={alt} width="912" height="644" />
    <svg className="robot-lidar-scan" viewBox="0 0 200 200" fill="none" aria-hidden="true" focusable="false">
      <circle cx="100" cy="100" r="82" stroke="#1687ed" strokeWidth="2" opacity=".4" />
      <circle cx="100" cy="100" r="58" stroke="#1687ed" strokeWidth="1.5" strokeDasharray="4 8" opacity=".4" />
      <g className="robot-lidar-rotor">
        <path d="M100 100V18a82 82 0 0 1 82 82Z" fill="#1f8fff" fillOpacity=".15" />
        <circle cx="100" cy="100" r="82" stroke="#1687ed" strokeWidth="4" strokeLinecap="round" strokeDasharray="125 391" />
        <path d="M100 100V18" stroke="#1687ed" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="100" cy="18" r="4" fill="#1687ed" />
      </g>
      <circle cx="100" cy="100" r="4" fill="#e0f5ff" stroke="#1687ed" strokeWidth="2" />
    </svg>
  </div>;
}
