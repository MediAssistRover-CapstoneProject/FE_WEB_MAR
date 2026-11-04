import { useEffect, useMemo, useState } from 'react';
import { readCatalog } from '../../../features/api/backendApi.js';
import { DAY_MS, SHIFT_STATUSES, dayKey, dayStart, displayBlocks, effectiveShift, fixedShiftPeriods, roomCoverage, shiftActions, shiftState, shiftsOnDay, timeLabel } from '../../../features/operations/staffShifts.js';
import { ShiftDetails, ShiftForm, ShiftTransition, roomName, staffName } from './ShiftDialogs.jsx';
import './shiftCalendar.css';

const HOURS_KEY = 'mar.shift-calendar.display-hours';
const PAGE_SIZE = 8;
const dateAt = (year, month, day) => new Date(Date.UTC(year, month, day));
const dayTitle = day => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dayStart(day)));
const gapLabel = (start, end, day) => `${timeLabel(start)}–${timeLabel(end)}${end === dayStart(day) + DAY_MS ? ' (+1 ngày)' : ''}`;
const savedHours = () => { try { const value = Number(localStorage.getItem(HOURS_KEY)); return [4, 6, 8, 12].includes(value) ? value : 6; } catch { return 6; } };
function Icon({ name = 'calendar' }) {
  const paths = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    room: <><path d="M4 21h16M6 21V3h12v18M9 7h1m4 0h1m-6 4h1m4 0h1m-5 10v-6h4v6" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 8a7 7 0 0 1 12-2l2 3M4 15l2 3a7 7 0 0 0 12-2" /></>,
    alert: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5m0 3v.1" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function ShiftCalendar({ role }) {
  const admin = role === 'ADMIN';
  const [now, setNow] = useState(Date.now()), [selected, setSelected] = useState(() => dayKey(Date.now()));
  const [month, setMonth] = useState(() => selected.slice(0, 7)), [hours, setHours] = useState(savedHours);
  const [revision, setRevision] = useState(0), [tick, setTick] = useState(0), [auto, setAuto] = useState(true);
  const [data, setData] = useState({ shifts: null, staff: [], rooms: [] });
  const [refreshing, setRefreshing] = useState(true), [catalogsReady, setCatalogsReady] = useState(!admin);
  const [error, setError] = useState(''), [catalogError, setCatalogError] = useState(''), [notice, setNotice] = useState(''), [loadedAt, setLoadedAt] = useState(null);
  const [roomId, setRoomId] = useState(''), [search, setSearch] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(0), [tab, setTab] = useState('list');
  const [draft, setDraft] = useState(null), [detailId, setDetailId] = useState(null), [action, setAction] = useState(null);
  const today = dayKey(now), refresh = () => setRevision(n => n + 1);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!auto) return; const timer = setInterval(() => { if (document.visibilityState === 'visible') setTick(n => n + 1); }, 30000); return () => clearInterval(timer); }, [auto]);
  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    Promise.allSettled(['GET /api/v1/admin/staff', 'GET /api/v1/rooms'].map(key => readCatalog(key, { signal: controller.signal }))).then(results => {
      if (controller.signal.aborted) return;
      setData(previous => ({ ...previous, staff: results[0].status === 'fulfilled' ? results[0].value : previous.staff, rooms: results[1].status === 'fulfilled' ? results[1].value : previous.rooms }));
      const ready = results.every(r => r.status === 'fulfilled');
      setCatalogsReady(ready); setCatalogError(ready ? '' : 'Chưa tải đủ danh mục nhân viên/phòng. Bạn vẫn có thể xem ca; hãy tải lại trước khi phân hoặc sửa ca.');
    });
    return () => controller.abort();
  }, [admin, revision]);
  useEffect(() => {
    const controller = new AbortController(); setRefreshing(true);
    readCatalog(admin ? 'GET /api/v1/admin/shifts' : 'GET /api/v1/staff/shifts', { signal: controller.signal }).then(shifts => {
      if (controller.signal.aborted) return;
      setData(previous => ({ ...previous, shifts })); setError(''); setLoadedAt(Date.now());
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message || 'Không tải được lịch trực.'); })
      .finally(() => { if (!controller.signal.aborted) setRefreshing(false); });
    return () => controller.abort();
  }, [admin, revision, tick]);
  useEffect(() => setPage(0), [selected, roomId, search, status]);
  const people = useMemo(() => new Map(data.staff.map(p => [p.staffProfileId, staffName(p)])), [data.staff]);
  const rooms = useMemo(() => new Map(data.rooms.map(r => [r.roomId, roomName(r)])), [data.rooms]);
  const scoped = useMemo(() => (data.shifts || []).filter(s => (!roomId || s.roomId === roomId) && (!search.trim() || [s.shiftName, s.shiftCode, s.staffCode, s.roomCode, people.get(s.staffProfileId), rooms.get(s.roomId)].join(' ').toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))), [data.shifts, roomId, search, people, rooms]);
  const daily = shiftsOnDay(scoped, selected).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || String(a.shiftId).localeCompare(String(b.shiftId)));
  const filtered = daily.filter(s => !status || (status === 'ATTENTION' ? shiftState(s, now).tone === 'warning' : s.status === status));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), safePage = Math.min(page, totalPages - 1), visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const blocks = displayBlocks(selected, hours), activeRooms = data.rooms.filter(r => r.active !== false && (!roomId || r.roomId === roomId));
  const [year, monthNumber] = month.split('-').map(Number), offset = (dateAt(year, monthNumber - 1, 1).getUTCDay() + 6) % 7, days = dateAt(year, monthNumber, 0).getUTCDate();
  const detail = data.shifts?.find(s => s.shiftId === detailId);
  const canCreate = admin && catalogsReady && data.shifts !== null && !error && dayStart(selected) + DAY_MS > now;
  const create = (period, presetRoomId = roomId) => {
    const current = Date.now();
    const anchor = Math.max(period?.start ?? dayStart(selected), current);
    const periods = fixedShiftPeriods(selected);
    const target = periods.find(block => block.start <= anchor && block.end > anchor) || periods.find(block => block.start > anchor);
    if (!target) return;
    if (!canCreate) return;
    setDraft({ day: selected, preset: { roomId: presetRoomId, shiftCode: `SHIFT-${crypto.randomUUID().toUpperCase()}`, shiftName: target.name, startsAt: target.startsAt, endsAt: target.endsAt, slots: [] } });
  };
  const saved = (shift, message) => {
    setDraft(null); setAction(null); setNotice(message);
    setData(previous => ({ ...previous, shifts: [...(previous.shifts || []).filter(s => s.shiftId !== shift.shiftId), shift] }));
    refresh();
  };
  const moveMonth = delta => { const day = dateAt(year, monthNumber - 1 + delta, 1).toISOString().slice(0, 10); setMonth(day.slice(0, 7)); setSelected(day); };
  return <section className="ss-page" aria-label={admin ? 'Quản lý ca trực' : 'Ca trực của tôi'}>
    <header className="ss-hero"><div className="ss-title"><span className="ss-title-icon"><Icon /></span><div><span className="ss-eyebrow">NHÂN SỰ VẬN HÀNH</span><h2>{admin ? 'Quản lý ca trực' : 'Ca trực của tôi'}</h2><p>{admin ? 'Phân người, theo dõi giờ trực và kiểm tra khoảng thời gian còn thiếu.' : 'Theo dõi lịch làm việc và phòng phụ trách của bạn.'}</p></div></div><div className="ss-header-actions"><button disabled={refreshing} onClick={refresh}><Icon name="refresh" />{refreshing && !loadedAt ? 'Đang tải…' : 'Tải lại'}</button>{admin && <button className="ss-primary" disabled={!canCreate} onClick={() => create()}><Icon name="plus" />Phân ca</button>}</div></header>
    {error && <p className="ss-notice ss-notice-error" role="alert">{error} {loadedAt ? 'Đang giữ dữ liệu lần tải trước; hãy tải lại trước khi thao tác.' : ''}<button onClick={refresh}>Thử lại</button></p>}
    {catalogError && <p className="ss-notice ss-notice-warning" role="status">{catalogError}</p>}
    {notice && <div className="ss-notice ss-notice-success" role="status"><span>{notice}</span><button aria-label="Ẩn thông báo" onClick={() => setNotice('')}>×</button></div>}
    <div className="ss-metrics" aria-label="Tóm tắt ngày đang chọn">{[
      { label: 'Ca trong ngày', value: daily.filter(s => s.status !== 'CANCELLED').length, icon: 'calendar', tone: 'blue' },
      { label: selected === today ? 'Đang trực lúc này' : 'Ca đang kích hoạt', value: daily.filter(s => selected === today ? effectiveShift(s, now) : s.status === 'ACTIVE').length, icon: 'user', tone: 'green' },
      { label: 'Đã lên lịch', value: daily.filter(s => s.status === 'PLANNED').length, icon: 'clock', tone: 'violet' },
      { label: 'Cần kiểm tra', value: daily.filter(s => shiftState(s, now).tone === 'warning').length, icon: 'alert', tone: 'amber' },
    ].map(metric => <div className={`ss-metric ss-metric-${metric.tone}`} key={metric.label}><span><Icon name={metric.icon} /></span><div><strong>{data.shifts === null ? '—' : metric.value}</strong><p>{metric.label}</p></div></div>)}</div>
    <div className="ss-layout">
      <aside className="ss-sidebar"><section className="ss-panel ss-month" aria-label="Lịch ca trực theo tháng">
        <div className="ss-month-head"><h3>Tháng {monthNumber}/{year}</h3><div><button className="ss-icon-button" aria-label="Tháng trước" onClick={() => moveMonth(-1)}>‹</button><button className="ss-icon-button" aria-label="Tháng sau" onClick={() => moveMonth(1)}>›</button></div></div>
        <div className="ss-calendar-grid">{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => <strong key={d}>{d}</strong>)}{Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: days }, (_, index) => {
          const day = `${month}-${String(index + 1).padStart(2, '0')}`, count = shiftsOnDay(scoped, day).filter(s => s.status !== 'CANCELLED').length;
          return <button key={day} aria-label={`${day}, ${data.shifts === null ? 'chưa tải' : `${count} ca trực`}`} aria-pressed={selected === day} aria-current={day === today ? 'date' : undefined} onClick={() => setSelected(day)}><b>{index + 1}</b><small>{data.shifts !== null && count ? `${count} ca` : '\u00a0'}</small></button>;
        })}</div><button className="ss-today" onClick={() => { setSelected(today); setMonth(today.slice(0, 7)); }}>Về hôm nay</button>
        <p className="ss-small">Số ca theo phòng và từ khóa đang lọc, không gồm ca đã hủy.</p>
      </section><section className="ss-sidebar-note"><Icon name="clock" /><div><strong>Giờ Việt Nam · UTC+7</strong><p>Ca chỉ có hiệu lực khi đã bắt đầu và đang trong khoảng giờ được phân.</p><label className="ss-auto"><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />Tự đồng bộ mỗi 30 giây</label><small>{loadedAt ? `Đồng bộ lúc ${timeLabel(loadedAt)}${error ? ' · Dữ liệu có thể đã cũ' : ''}` : 'Chưa nhận dữ liệu'}</small></div></section></aside>
      <main className="ss-panel ss-day" aria-label="Chi tiết ngày trực">
        <div className="ss-day-head"><div><span className="ss-eyebrow">LỊCH TRONG NGÀY</span><h3>{dayTitle(selected)}</h3></div><span className={`ss-badge ${selected === today ? 'ss-blue' : 'ss-muted'}`}>{selected === today ? 'Hôm nay' : selected < today ? 'Lịch sử' : 'Sắp tới'}</span></div>
        <div className="ss-filters"><label><span>Tìm kiếm</span><input type="search" value={search} placeholder="Tên ca, nhân viên, mã phòng…" onChange={e => setSearch(e.target.value)} /></label>{admin && <label><span>Phòng phụ trách</span><select value={roomId} onChange={e => setRoomId(e.target.value)}><option value="">Tất cả phòng</option>{data.rooms.map(r => <option value={r.roomId} key={r.roomId}>{roomName(r)}{r.active === false ? ' · Ngừng hoạt động' : ''}</option>)}</select></label>}<label><span>Trạng thái</span><select value={status} onChange={e => setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(SHIFT_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}<option value="ATTENTION">Cần kiểm tra</option></select></label></div>
        <div className="ss-tabs" role="tablist" aria-label="Chế độ xem lịch" onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = !admin ? 'list' : event.key === 'Home' ? 'list' : event.key === 'End' ? 'coverage' : tab === 'list' ? 'coverage' : 'list';
          setTab(next); event.currentTarget.querySelector(`#ss-${next === 'list' ? 'list' : 'coverage'}-tab`)?.focus();
        }}><button role="tab" id="ss-list-tab" tabIndex={tab === 'list' ? 0 : -1} aria-controls="ss-list-panel" aria-selected={tab === 'list'} onClick={() => setTab('list')}>Danh sách ca <span>{filtered.length}</span></button>{admin && <button role="tab" id="ss-coverage-tab" tabIndex={tab === 'coverage' ? 0 : -1} aria-controls="ss-coverage-panel" aria-selected={tab === 'coverage'} onClick={() => setTab('coverage')}>Độ phủ phòng</button>}</div>
        {tab === 'list' ? <div role="tabpanel" id="ss-list-panel" aria-labelledby="ss-list-tab">
          {data.shifts === null ? <div className="ss-empty" role="status"><Icon /><h4>{error ? 'Chưa tải được lịch trực' : 'Đang tải lịch trực…'}</h4></div> : !filtered.length ? <div className="ss-empty"><Icon /><h4>{daily.length ? 'Không có ca phù hợp bộ lọc' : 'Chưa có ca trực phù hợp trong ngày'}</h4><p>{admin ? 'Chọn ngày, phòng khác hoặc phân ca mới cho nhân viên.' : 'Liên hệ quản trị viên nếu cần bổ sung lịch trực.'}</p>{(search || roomId || status) && <button onClick={() => { setSearch(''); setRoomId(''); setStatus(''); }}>Xóa bộ lọc</button>}</div> : <div className="ss-shift-list">{visible.map(shift => {
            const state = shiftState(shift, now), allowed = shiftActions(shift, now), overnight = dayKey(shift.startsAt) !== dayKey(shift.endsAt);
            const startDay = dayKey(shift.startsAt).split('-').reverse().slice(0, 2).join('/'), endDay = dayKey(shift.endsAt).split('-').reverse().slice(0, 2).join('/');
            return <article className={`ss-shift ss-border-${state.tone}`} key={shift.shiftId} data-shift-id={shift.shiftId}>
              <div className="ss-shift-heading"><div><span className="ss-shift-time"><Icon name="clock" />{timeLabel(shift.startsAt)}–{timeLabel(shift.endsAt)}{overnight && <small>{startDay} → {endDay}</small>}</span><h4>{shift.shiftName}</h4></div><span className={`ss-badge ss-${state.tone}`}>{state.label}</span></div>
              <div className="ss-shift-meta"><span><Icon name="user" />{people.get(shift.staffProfileId) || shift.staffCode}</span><span><Icon name="room" />{rooms.get(shift.roomId) || shift.roomCode}</span></div>
              {state.tone === 'warning' && <p className="ss-shift-warning"><Icon name="alert" />{shift.status === 'ACTIVE' ? 'Kiểm tra thời gian hiệu lực và cập nhật ca trực.' : Date.parse(shift.endsAt) <= now ? 'Ca đã quá giờ nhưng chưa bắt đầu. Kiểm tra lại lịch và ghi rõ lý do nếu hủy ca.' : 'Ca chưa có hiệu lực. Admin cần bắt đầu ca để staff được tính là đang trực.'}</p>}
              <footer className="ss-shift-footer"><button className="ss-text-button" onClick={() => setDetailId(shift.shiftId)}>Xem chi tiết →</button>{admin && <div className="ss-shift-actions">{allowed.edit && <button disabled={!catalogsReady || !!error} onClick={() => setDraft({ row: shift })}>Chỉnh sửa</button>}{allowed.start && <button className="ss-start" disabled={!!error} onClick={() => setAction({ shift, target: 'ACTIVE' })}>Bắt đầu trực</button>}{allowed.complete && <button className="ss-primary" disabled={!!error} onClick={() => setAction({ shift, target: 'COMPLETED' })}>Kết thúc ca</button>}{allowed.cancel && <button className="ss-text-button ss-danger-text" disabled={!!error} onClick={() => setAction({ shift, target: 'CANCELLED' })}>Hủy ca</button>}</div>}</footer>
            </article>;
          })}</div>}
          {!!filtered.length && <footer className="ss-pagination"><span>{safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} / {filtered.length} ca</span><div><button aria-label="Trang trước" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>←</button><span>{safePage + 1}/{totalPages}</span><button aria-label="Trang sau" disabled={safePage + 1 >= totalPages} onClick={() => setPage(safePage + 1)}>→</button></div></footer>}
        </div> : <div role="tabpanel" id="ss-coverage-panel" aria-labelledby="ss-coverage-tab" className="ss-coverage">
          <div className="ss-coverage-intro"><div><h4>Lịch bao phủ theo phòng</h4><p>Tính theo ca đã phân, không gồm ca hủy. Đây là độ phủ lịch, không xác nhận staff có mặt và không mặc định mọi phòng phải trực 24 giờ.</p></div><label>Khung hiển thị<select value={hours} onChange={e => { const value = Number(e.target.value); setHours(value); try { localStorage.setItem(HOURS_KEY, String(value)); } catch { /* The view still works without storage. */ } }}>{[4, 6, 8, 12].map(n => <option key={n} value={n}>{n} giờ</option>)}</select></label></div>
          <p className="ss-small">Khung hiển thị chỉ thay đổi cách xem; khi phân công vẫn dùng 4 ca cố định, mỗi ca 6 giờ. Độ phủ dùng toàn bộ lịch của phòng, không theo bộ lọc trạng thái hoặc từ khóa.</p>
          <div className="ss-legend"><span className="ss-dot-full">Đủ khung</span><span className="ss-dot-partial">Còn thiếu giờ</span><span className="ss-dot-empty">Chưa phân</span></div>
          {!catalogsReady || data.shifts === null ? <p className="ss-empty">Cần tải đủ lịch và danh mục phòng để tính độ phủ.</p> : !activeRooms.length ? <p className="ss-empty">Không có phòng đang hoạt động phù hợp.</p> : activeRooms.map(room => <details className="ss-room-coverage" key={room.roomId}>
            <summary><span><Icon name="room" /><strong>{roomName(room)}</strong></span><span className="ss-coverage-blocks">{blocks.map(block => { const coverage = roomCoverage(data.shifts, room.roomId, block.start, block.end); return <span key={block.start} className={`ss-coverage-cell is-${coverage.state}`} title={`${gapLabel(block.start, block.end, selected)} · ${coverage.state === 'full' ? 'Đủ khung' : coverage.state === 'partial' ? 'Còn thiếu giờ' : 'Chưa phân'}`}><b>{timeLabel(block.start)}</b><small>{coverage.state === 'full' ? 'Đủ' : coverage.state === 'partial' ? 'Thiếu giờ' : 'Chưa phân'}</small></span>; })}</span></summary>
            <div className="ss-coverage-breakdown">{blocks.map(block => {
              const coverage = roomCoverage(data.shifts, room.roomId, block.start, block.end);
              return <section key={block.start}><h5>{block.name} · {gapLabel(block.start, block.end, selected)}</h5>{coverage.state === 'full' ? <p className="ss-covered">Đã có lịch bao phủ toàn khung.</p> : coverage.gaps.map(gap => <div className="ss-gap" key={gap.start}><span><i />Chưa phân · {gapLabel(gap.start, gap.end, selected)}</span>{canCreate && gap.end > now && <button onClick={() => create({ ...gap, name: block.name }, room.roomId)}>Phân bổ sung</button>}</div>)}</section>;
            })}</div>
          </details>)}
        </div>}
      </main>
    </div>
    {admin && draft && <ShiftForm draft={draft} data={{ ...data, shifts: data.shifts || [] }} onClose={() => setDraft(null)} onSaved={saved} onRefresh={refresh} />}
    {admin && action && <ShiftTransition action={action} onClose={() => setAction(null)} onSaved={saved} onRefresh={refresh} />}
    {detail && <ShiftDetails shift={detail} data={data} now={now} onClose={() => setDetailId(null)} />}
  </section>;
}
