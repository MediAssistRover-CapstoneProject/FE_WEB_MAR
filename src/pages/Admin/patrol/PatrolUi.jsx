import { useEffect, useId, useRef } from 'react';

export function Icon({ name = 'route', className = '' }) {
  const paths = {
    route: <><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h8"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    refresh: <><path d="M20 4v6h-6M4 20v-6h6"/><path d="M5.5 8a7 7 0 0 1 12-3L20 8M4 16l2.5 3a7 7 0 0 0 12-3"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    robot: <><rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4M8 12v2m8-2v2m-7 3h6M1 11v5m22-5v5"/></>,
    map: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16m6-14v16"/></>,
    play: <path d="m8 4 12 8-12 8Z"/>,
    pause: <><path d="M8 5v14M16 5v14"/></>,
    stop: <rect x="5" y="5" width="14" height="14" rx="2"/>,
    loop: <><path d="m17 2 4 4-4 4M3 10V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14 0v2a2 2 0 0 1-2 2H3"/></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v1"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    chevron: <path d="m9 5 7 7-7 7"/>,
  };
  return <svg className={`pt-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.route}</svg>;
}

export function Button({ children, icon, tone = '', className = '', ...props }) {
  return <button type="button" className={`pt-btn ${tone ? `pt-btn-${tone}` : ''} ${className}`} {...props}>{icon && <Icon name={icon}/>}<span>{children}</span></button>;
}

export function Empty({ title, children, icon = 'route', action }) {
  return <div className="pt-empty"><span className="pt-empty-icon"><Icon name={icon}/></span><strong>{title}</strong>{children && <p>{children}</p>}{action}</div>;
}

export function Modal({ title, subtitle, children, onClose, busy = false, wide = false }) {
  const dialog = useRef(null);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);
  return <dialog ref={dialog} className={`pt-dialog ${wide ? 'pt-dialog-wide' : ''}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) close.current(); }} onClick={event => { if (event.target === event.currentTarget && !busy) close.current(); }}>
    <div className="pt-dialog-inner"><header className="pt-dialog-heading"><div><h3 id={titleId}>{title}</h3>{subtitle && <p>{subtitle}</p>}</div><Button className="pt-icon-btn" icon="close" aria-label="Đóng hộp thoại" disabled={busy} onClick={onClose}/></header>{children}</div>
  </dialog>;
}
