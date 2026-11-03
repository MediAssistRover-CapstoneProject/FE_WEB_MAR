import { useEffect, useRef, useState } from 'react';
import { readCatalog } from '../../../features/api/backendApi.js';
import './shiftCalendar.css';

const durationKey = 'mar.shift-calendar.hours-per-shift';
const durations = [4, 6, 8, 12];
const zone = 'Asia/Ho_Chi_Minh';
const dayKey = value => new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(value);
const time = value => new Intl.DateTimeFormat('vi-VN', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const dateAt = (year, month, day) => new Date(Date.UTC(year, month, day));
const statuses = { PLANNED: 'Đã lên lịch', ACTIVE: 'Đang trực', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy' };

const list = (path, signal) => readCatalog('GET /api/v1/' + path, { signal });

export default function ShiftCalendar({ role, renderShift }) {
  const today = dayKey(new Date());
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState(null);
  const [detail, setDetail] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [dailyHours, setDailyHours] = useState({});
  const savedHours = dailyHours[selected] ?? Number(localStorage.getItem(durationKey + '.' + selected));
  const hours = durations.includes(savedHours) ? savedHours : 6;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const admin = role === 'ADMIN';
  const editable = admin && selected >= today;

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    Promise.all([
      list(admin ? 'admin/shifts' : 'staff/shifts', controller.signal),
      admin ? list('admin/staff', controller.signal) : [],
      admin ? list('rooms', controller.signal) : [],
    ]).then(([shifts, staff, rooms]) => {
      if (!controller.signal.aborted) setData({ shifts, staff, rooms });
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    });
    return () => controller.abort();
  }, [admin, revision]);

  const [year, monthNumber] = month.split('-').map(Number);
  const first = dateAt(year, monthNumber - 1, 1);
  const offset = (first.getUTCDay() + 6) % 7;
  const days = dateAt(year, monthNumber, 0).getUTCDate();
  const shiftsFor = day => {
    const start = Date.parse(day + 'T00:00:00+07:00');
    return (data?.shifts ?? []).filter(shift =>
      Date.parse(shift.startsAt) < start + 86400000 && Date.parse(shift.endsAt) > start);
  };
  const selectedShifts = shiftsFor(selected).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const dayStart = Date.parse(selected + 'T00:00:00+07:00');
  const duration = hours * 3600000;
  const blocks = Array.from({ length: 24 / hours }, (_, index) => {
    const start = dayStart + index * duration;
    const end = start + duration;
    const name = hours === 6 ? ['Ca đêm', 'Ca sáng', 'Ca chiều', 'Ca tối'][index] : 'Ca ' + (index + 1);
    return {
      name, start, end,
      shifts: selectedShifts.filter(shift => Date.parse(shift.startsAt) < end && Date.parse(shift.endsAt) > start),
    };
  });
  const moveMonth = delta => {
    const next = dateAt(year, monthNumber - 1 + delta, 1).toISOString().slice(0, 10);
    setMonth(next.slice(0, 7));
    setSelected(next);
  };
  const create = (block, roomId) => editable && setDraft({ preset: {
    roomId, shiftCode: 'SHIFT-' + crypto.randomUUID().toUpperCase(),
    shiftName: block.name, startsAt: new Date(block.start).toISOString(),
    endsAt: new Date(block.end).toISOString(), slots: [],
  } });

  return <div className="shift-calendar">
    {error && <p role="alert">{error} <button onClick={() => setRevision(n => n + 1)}>Thử lại</button></p>}
    {!data && !error && <p role="status">Đang tải lịch trực…</p>}
    <section className="be-card shift-month" aria-label="Lịch ca trực theo tháng">
      <div className="shift-toolbar">
        <button aria-label="Tháng trước" onClick={() => moveMonth(-1)}>‹</button>
        <h2>Tháng {monthNumber}/{year}</h2>
        <button aria-label="Tháng sau" onClick={() => moveMonth(1)}>›</button>
        <button onClick={() => { setSelected(today); setMonth(today.slice(0, 7)); }}>Hôm nay</button>
      </div>
      <div className="shift-grid">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => <strong key={day}>{day}</strong>)}
        {Array.from({ length: offset }, (_, i) => <span key={'empty-' + i} />)}
        {Array.from({ length: days }, (_, i) => {
          const date = month + '-' + String(i + 1).padStart(2, '0');
          const count = shiftsFor(date).filter(shift => shift.status !== 'CANCELLED').length;
          return <button key={date} aria-pressed={selected === date} aria-current={date === today ? 'date' : undefined}
            aria-label={date + ', ' + count + ' ca trực'} onClick={() => setSelected(date)}>
            <b>{i + 1}</b>{count > 0 && <small>{count} ca</small>}
          </button>;
        })}
      </div>
    </section>
    <section className="be-card shift-day" aria-label="Chi tiết ngày trực">
      <div className="shift-toolbar">
        <h2>{selected.split('-').reverse().join('/')}</h2>
        {editable && <button type="button" aria-expanded={settingsOpen} aria-controls="shift-duration-settings"
          onClick={() => setSettingsOpen(open => !open)}>Cài đặt khung trực</button>}
      </div>
      {editable && settingsOpen && <div className="shift-room" id="shift-duration-settings">
        <label>Thời lượng mỗi ca{' '}
          <select value={hours} onChange={event => {
            const value = Number(event.target.value);
            localStorage.setItem(durationKey + '.' + selected, String(value));
            setDailyHours(previous => ({ ...previous, [selected]: value }));
          }}>
            {durations.map(value => <option key={value} value={value}>{value} tiếng</option>)}
          </select>
        </label>
        <p>{24 / hours} khung cho ngày đang chọn. Cài đặt được lưu trên trình duyệt này. Các ca đã lưu hiển thị theo giờ trực đã phân.</p>
      </div>}
      {blocks.map(block => {
        const assigned = block.shifts.filter(shift => shift.status !== 'CANCELLED');
        return <section key={block.name} className="shift-room">
          <div className="shift-toolbar">
            <h3>{block.name} · {time(block.start)}–{time(block.end)}</h3>
            {editable && <button onClick={() => create(block)}>+ Phân ca</button>}
          </div>
          {data && !assigned.length && <p>Chưa phân người trực.</p>}
          {block.shifts.map(shift => <article key={shift.shiftId} className="shift-entry">
            <strong>{shift.shiftName} · {time(shift.startsAt)}–{time(shift.endsAt)}</strong>
            <span>{data.rooms.find(room => room.roomId === shift.roomId)?.roomName || shift.roomCode} · {data.staff.find(person => person.staffProfileId === shift.staffProfileId)?.account?.fullName || shift.staffCode}</span>
            <small className="shift-status" data-status={shift.status}>{statuses[shift.status] || shift.status}{dayKey(new Date(shift.startsAt)) !== dayKey(new Date(shift.endsAt)) ? ' · Qua ngày' : ''}</small>
            <button type="button" className="shift-detail-link" onClick={() => setDetail(shift)}>Xem chi tiết →</button>
            {editable && dayKey(new Date(shift.startsAt)) >= today && shift.status === 'PLANNED' && <button type="button" className="shift-edit" aria-label="Chỉnh sửa ca" title="Chỉnh sửa ca" onClick={() => setDraft({ row: shift })}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1 12-12-4-4L4 15z" /></svg></button>}
          </article>)}
          {editable && data?.rooms.some(room => room.active !== false && !assigned.some(shift => shift.roomId === room.roomId)) && <details>
            <summary>Phòng chưa được phân trong khung này</summary>
            {data.rooms.filter(room => room.active !== false && !assigned.some(shift => shift.roomId === room.roomId)).map(room =>
              <div className="shift-toolbar shift-room" key={room.roomId}><span>{room.roomName || room.roomCode}</span><button onClick={() => create(block, room.roomId)}>+ Phân ca</button></div>)}
          </details>}
        </section>;
      })}
      <small>Giờ Việt Nam{selected < today && ' · Ngày đã qua, chỉ xem'}</small>
    </section>
    {detail && <ShiftDetails shift={detail} data={data} onClose={() => setDetail(null)} />}
    {editable && draft && renderShift(draft, () => setDraft(null), () => { setDraft(null); setRevision(n => n + 1); })}
  </div>;
}

const fullDate = value => new Intl.DateTimeFormat('vi-VN', {
  timeZone: zone, dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));

function ShiftDetails({ shift, data, onClose }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const room = data.rooms.find(item => item.roomId === shift.roomId);
  const person = data.staff.find(item => item.staffProfileId === shift.staffProfileId);
  return <dialog ref={dialog} className="be-dialog be-workspace shift-detail-dialog" aria-labelledby="shift-detail-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="shift-toolbar">
      <h2 id="shift-detail-title">{shift.shiftName}</h2>
      <button type="button" onClick={onClose}>Đóng</button>
    </div>
    <p className="shift-status" data-status={shift.status}>{statuses[shift.status] || shift.status}</p>
    <dl className="shift-facts">
      <div><dt>Người trực</dt><dd>{person?.account?.fullName || shift.staffCode || 'Chưa có thông tin'}</dd></div>
      <div><dt>Phòng</dt><dd>{room?.roomName || shift.roomCode || 'Chưa có thông tin'}</dd></div>
      <div><dt>Bắt đầu</dt><dd>{fullDate(shift.startsAt)}</dd></div>
      <div><dt>Kết thúc</dt><dd>{fullDate(shift.endsAt)}</dd></div>
      <div><dt>Mã ca</dt><dd>{shift.shiftCode || '—'}</dd></div>
      <div><dt>Ghi chú</dt><dd>{shift.note || 'Không có ghi chú'}</dd></div>
    </dl>
    {!!shift.slots?.length && <section className="shift-room">
      <h3>Khung giờ trong ca</h3>
      <ul>{shift.slots.map(slot => <li key={slot.slotId}>
        {time(slot.startsAt)}–{time(slot.endsAt)}{slot.note && ' · ' + slot.note}
      </li>)}</ul>
    </section>}
  </dialog>;
}