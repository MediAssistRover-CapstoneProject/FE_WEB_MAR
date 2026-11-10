export default function OperationsIcon({ name = 'activity', ...props }) {
  const paths = {
    activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 8a7 7 0 0 1 12-2l2 3M4 15l2 3a7 7 0 0 0 12-2" /></>,
    robot: <><rect x="4" y="7" width="16" height="13" rx="4" /><path d="M12 3v4M8 12v2m8-2v2m-7 3h6M1 11v5m22-5v5" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><path d="m12 3 10 18H2Z" /><path d="M12 9v4m0 3v1" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    time: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    list: <path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1" />,
    map: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z" /><path d="M9 3v16M15 5v16" /></>,
    camera: <><rect x="3" y="6" width="13" height="13" rx="3" /><path d="m16 10 5-3v11l-5-3" /><circle cx="9.5" cy="12.5" r="2.5" /></>,
    signal: <><path d="M3 8a14 14 0 0 1 18 0M6 11a9 9 0 0 1 12 0M9 14a4 4 0 0 1 6 0" /><circle cx="12" cy="18" r=".7" /></>,
    battery: <><rect x="2" y="7" width="17" height="10" rx="2" /><path d="M22 10v4M6 10v4m4-4v4m4-4v4" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.activity}</svg>;
}
