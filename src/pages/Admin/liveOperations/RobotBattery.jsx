import { useEffect, useState } from 'react';
import { request } from '../../../features/robotOperations/api.js';

export default function RobotBattery({ robotId, auto, revision, now }) {
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!robotId) return;
    const controller = new AbortController();
    let timer;
    const load = async () => {
      if (document.hidden) {
        if (!controller.signal.aborted && auto) timer = setTimeout(load, 15000);
        return;
      }
      try {
        const data = await request(`/api/v1/robots/${encodeURIComponent(robotId)}/battery`, { signal: controller.signal });
        if (data?.robotId !== robotId) throw new Error('Dữ liệu pin không khớp robot.');
        if (!controller.signal.aborted) setState({ robotId, data, receivedAt: Date.now() });
      } catch (error) {
        if (!controller.signal.aborted) setState(previous => ({
          ...(previous?.robotId === robotId ? previous : {}), robotId, error: error.message,
        }));
      }
      if (!controller.signal.aborted && auto) timer = setTimeout(load, 15000);
    };
    load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [robotId, auto, revision]);

  const current = state?.robotId === robotId ? state : null;
  const data = current?.data;
  // Advance the server's measurement age locally, including when auto refresh is paused.
  const age = data ? (data.ageSec ?? 0) + Math.max(0, now - current.receivedAt) / 1000 : 0;
  const stale = data?.estimateStatus === 'STALE' || data?.fresh === true && age > 60;
  const rawPercent = data?.batteryPercent;
  const percent = typeof rawPercent === 'number' ? rawPercent
    : typeof rawPercent === 'string' && rawPercent.trim() ? Number(rawPercent) : NaN;
  const available = Number.isFinite(percent) && percent >= 0 && percent <= 100;
  const outdated = stale || data?.fresh === false || !!current?.error;
  const low = available && !outdated && percent <= 20;
  const text = available ? `${Math.round(percent)}%` : '--%';
  const note = current?.error ? available ? 'Lần gần nhất · Lỗi cập nhật' : 'Chưa tải được'
    : outdated ? 'Dữ liệu cũ' : !available ? !robotId || data ? 'Chưa có dữ liệu' : 'Đang tải…' : low ? 'Pin yếu' : '';
  const title = current?.error || (available ? `Mức pin ước tính của robot: ${text}${note ? ` · ${note}` : ''}.`
    : 'Đang chờ phần trăm pin từ robot.');

  return <div className={`rm-robot-battery ${available && !outdated ? low ? 'is-low' : 'is-good' : ''}`} title={title}>
    <span><small>Pin robot</small>
      <span className="rm-battery-gauge">
        <span className="rm-battery-track" aria-hidden="true"><span className="rm-battery-fill" style={{ width: `${available ? percent : 0}%` }} /></span>
        <strong role="status" aria-label={`Pin robot: ${text}${note ? ` · ${note}` : ''}`}>{text}</strong>
      </span>
      {note && <span className="rm-battery-note">{note}</span>}
    </span>
  </div>;
}
