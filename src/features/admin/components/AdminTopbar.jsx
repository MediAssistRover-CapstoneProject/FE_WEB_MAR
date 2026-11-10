import { vi } from '../../../i18n/vi.js';
import { getApiTarget, setApiTarget } from '../../api/client.js';
import { getSession } from '../../auth/session.js';

export default function AdminTopbar({ title }) {
  const account = getSession()?.account;
  const target = getApiTarget();
  const isLocal = target === 'local';

  return (
    <header className="topbar">
      <h1>{vi(title)}</h1>
      <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          role="group"
          aria-label="Chuyển đổi môi trường API"
          style={{
            display: 'inline-flex',
            background: '#eef4fb',
            padding: 3,
            borderRadius: 999,
            border: '1px solid #d0dfef',
            gap: 2,
          }}
        >
          <button
            type="button"
            onClick={() => setApiTarget('local')}
            title="Kết nối BE Local tại http://localhost:8080"
            style={{
              border: 0,
              borderRadius: 999,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: isLocal ? '#1687ed' : 'transparent',
              color: isLocal ? '#fff' : '#4a6583',
              boxShadow: isLocal ? '0 2px 6px rgba(22,135,237,0.28)' : 'none',
            }}
          >
            🟢 API Local
          </button>
          <button
            type="button"
            onClick={() => setApiTarget('server')}
            title="Kết nối BE Server tại https://bemar-production.up.railway.app"
            style={{
              border: 0,
              borderRadius: 999,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: !isLocal ? '#1687ed' : 'transparent',
              color: !isLocal ? '#fff' : '#4a6583',
              boxShadow: !isLocal ? '0 2px 6px rgba(22,135,237,0.28)' : 'none',
            }}
          >
            ☁️ API Server
          </button>
        </div>
        <span>{vi(account?.fullName || account?.username)}</span>
        <span>{account?.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'}</span>
      </div>
    </header>
  );
}
