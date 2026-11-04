import { useEffect, useRef, useState } from 'react';
import { callBackend } from '../../../features/api/backendApi.js';
import { dateLabel, dayKey, fixedShiftPeriods, shiftActions, shiftFingerprint, shiftState, timeLabel, validateShift } from '../../../features/operations/staffShifts.js';

export const staffName = person => person?.account?.fullName || person?.fullName || person?.staffCode || 'Chưa có tên';
export const roomName = room => room?.roomName || room?.roomCode || 'Chưa có tên phòng';

function Modal({ title, subtitle, busy, onClose, children, className = '' }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className={`ss-dialog ${className}`} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="ss-dialog-head"><div><span className="ss-eyebrow">QUẢN LÝ CA TRỰC</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="ss-icon-button" aria-label="Đóng biểu mẫu" disabled={busy} onClick={onClose}>×</button></header>
    {children}
  </dialog>;
}

export function ShiftForm({ draft, data, onClose, onSaved, onRefresh }) {
  const original = draft.row;
  const initial = original || draft.preset;
  const periods = fixedShiftPeriods(draft.day || dayKey(initial.startsAt));
  const [form, setForm] = useState(() => ({ staffProfileId: initial.staffProfileId || '', roomId: initial.roomId || '', periodStart: initial.startsAt, note: initial.note || '' }));
  const period = original || periods.find(p => p.startsAt === form.periodStart);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const field = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const staff = data.staff.filter(p => p.active !== false && (!p.account?.status || p.account.status === 'ACTIVE') || p.staffProfileId === original?.staffProfileId);
  const rooms = data.rooms.filter(r => r.active !== false || r.roomId === original?.roomId);
  const submit = async event => {
    event.preventDefault(); if (lock.current) return;
    setError('');
    if (!period) { setError('Hãy chọn ca trực trong danh sách có sẵn.'); return; }
    const body = { staffProfileId: form.staffProfileId, roomId: form.roomId, shiftName: original ? original.shiftName : period.name, startsAt: period.startsAt, endsAt: period.endsAt, note: form.note.trim() || null,
      slots: (original?.slots || []).map(s => ({ sequenceNo: s.sequenceNo, startsAt: s.startsAt, endsAt: s.endsAt, status: s.status, note: s.note ?? null })),
      ...(!original ? { shiftCode: initial.shiftCode } : {}),
    };
    const invalid = validateShift(body, data.shifts, original, Date.now());
    if (invalid) { setError(invalid); return; }
    lock.current = true; setBusy(true);
    try {
      if (original) {
        const current = await callBackend('GET /api/v1/admin/shifts/{shiftId}', { path: { shiftId: original.shiftId } });
        if (current.status !== 'PLANNED' || shiftFingerprint(current) !== shiftFingerprint(original)) { onRefresh(); throw Error('Ca trực đã thay đổi. Đóng biểu mẫu và mở lại để xem dữ liệu mới nhất.'); }
      }
      const currentError = validateShift(body, data.shifts, original, Date.now());
      if (currentError) throw Error(currentError);
      const saved = await callBackend(original ? 'PUT /api/v1/admin/shifts/{shiftId}' : 'POST /api/v1/admin/shifts', { path: original ? { shiftId: original.shiftId } : {}, body });
      onSaved(saved, original ? 'Đã cập nhật ca trực.' : 'Đã phân ca. Đến giờ, admin cần bắt đầu ca để staff được tính là đang trực.');
    } catch (cause) { setError(cause.message || 'Không lưu được ca trực.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Modal title={original ? 'Chỉnh sửa ca trực' : 'Phân ca trực'} subtitle={original ? 'Điều chỉnh nhân viên, phòng và ghi chú. Giữ nguyên ca và thời gian đã phân.' : 'Chọn ca có sẵn để phân công. Giờ trực tự lấy theo ca, theo giờ Việt Nam (UTC+7).'} busy={busy} onClose={onClose}>
    <form onSubmit={submit}>
      <fieldset disabled={busy} className="ss-form-fields">
        <label>Nhân viên trực *<select required value={form.staffProfileId} onChange={e => field('staffProfileId', e.target.value)}><option value="">Chọn nhân viên</option>{staff.map(p => <option key={p.staffProfileId} value={p.staffProfileId}>{staffName(p)} · {p.staffCode}{p.active === false || p.account?.status && p.account.status !== 'ACTIVE' ? ' · Không hoạt động' : ''}</option>)}</select></label>
        <label>Phòng phụ trách *<select required value={form.roomId} onChange={e => field('roomId', e.target.value)}><option value="">Chọn phòng</option>{rooms.map(r => <option key={r.roomId} value={r.roomId}>{roomName(r)}{r.active === false ? ' · Ngừng hoạt động' : ''}</option>)}</select></label>
        {original ? <div className="ss-assigned-period ss-wide"><span>Ca đã phân</span><strong>{original.shiftName}</strong><small>Giữ nguyên thời gian ca đã lưu, kể cả các ca cũ khác khung hiện tại.</small></div> : <label className="ss-wide">Ca trực *<select required value={form.periodStart} onChange={e => field('periodStart', e.target.value)}>{periods.map(p => <option key={p.startsAt} value={p.startsAt} disabled={p.end <= Date.now()}>{p.name} · {timeLabel(p.start)}–{timeLabel(p.end)}{dayKey(p.startsAt) !== dayKey(p.endsAt) ? ' (+1 ngày)' : ''}{p.end <= Date.now() ? ' · Đã qua giờ' : ''}</option>)}</select></label>}
        {period && <dl className="ss-fixed-times ss-wide" aria-label="Thời gian cố định của ca"><div><dt>Bắt đầu</dt><dd>{dateLabel(period.startsAt)}</dd></div><div><dt>Kết thúc</dt><dd>{dateLabel(period.endsAt)}</dd></div><span>Giờ cố định theo ca · UTC+7</span></dl>}
        <p className="ss-inline-note ss-wide">{!original && period && Date.parse(period.startsAt) < Date.now() && Date.parse(period.endsAt) > Date.now() ? 'Ca đang diễn ra. Phân công bổ sung vẫn giữ nguyên khung ca; nhân viên chỉ được tính đang trực sau khi admin bắt đầu ca.' : 'Thời gian không chỉnh tại biểu mẫu phân công. Hệ thống kiểm tra trùng ca của nhân viên khi lưu.'}</p>
        <label className="ss-wide">Ghi chú bàn giao<textarea rows={3} maxLength={4000} value={form.note} onChange={e => field('note', e.target.value)} placeholder="Nội dung cần lưu ý cho người trực…" /></label>
        {!!original?.slots?.length && <details className="ss-advanced ss-wide"><summary>Khung giờ con đã lưu <span>{original.slots.length} khung</span></summary><p>Các khung giờ con được giữ nguyên khi điều chỉnh phân công.</p><ul>{original.slots.map(s => <li key={s.slotId || s.sequenceNo}>{dateLabel(s.startsAt)} → {dateLabel(s.endsAt)}</li>)}</ul></details>}
      </fieldset>
      {error && <p role="alert" className="ss-notice ss-notice-error">{error}</p>}
      <footer className="ss-dialog-footer"><button type="button" disabled={busy} onClick={onClose}>Đóng</button><button className="ss-primary" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : original ? 'Lưu thay đổi' : 'Lưu ca trực'}</button></footer>
    </form>
  </Modal>;
}

export function ShiftTransition({ action, onClose, onSaved, onRefresh }) {
  const { shift, target } = action;
  const title = { ACTIVE: 'Bắt đầu ca trực', COMPLETED: 'Kết thúc ca trực', CANCELLED: 'Hủy ca trực' }[target];
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [note, setNote] = useState('');
  const lock = useRef(false);
  const early = target === 'COMPLETED' && Date.now() < Date.parse(shift.endsAt);
  const required = target === 'CANCELLED' || early;
  const submit = async event => {
    event.preventDefault(); if (lock.current) return;
    setError('');
    if (required && !note.trim()) { setError('Vui lòng nhập lý do để lưu lại việc thay đổi ca.'); return; }
    lock.current = true; setBusy(true);
    try {
      const current = await callBackend('GET /api/v1/admin/shifts/{shiftId}', { path: { shiftId: shift.shiftId } });
      const allowed = shiftActions(current, Date.now());
      if (shiftFingerprint(current) !== shiftFingerprint(shift) || !(target === 'ACTIVE' ? allowed.start : target === 'COMPLETED' ? allowed.complete : allowed.cancel)) { onRefresh(); throw Error('Ca trực đã thay đổi hoặc không còn phù hợp thời gian thao tác. Đóng hộp thoại để kiểm tra lại.'); }
      const combinedNote = note.trim() ? [current.note, `[${title}] ${note.trim()}`].filter(Boolean).join('\n') : current.note || null;
      if (combinedNote?.length > 4000) throw Error('Tổng ghi chú vượt quá 4.000 ký tự. Hãy rút gọn lý do trước khi xác nhận.');
      const saved = await callBackend('POST /api/v1/admin/shifts/{shiftId}/transition', { path: { shiftId: shift.shiftId }, body: { status: target, note: combinedNote } });
      onSaved(saved, `${title} thành công.`);
    } catch (cause) { setError(cause.message || 'Không cập nhật được trạng thái ca.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Modal title={title} busy={busy} onClose={onClose}>
    <div className="ss-action-summary"><strong>{shift.shiftName}</strong><span>{dateLabel(shift.startsAt)} → {dateLabel(shift.endsAt)}</span></div>
    <p className="ss-action-description">{target === 'ACTIVE' ? 'Staff sẽ được tính là đang trực trong thời gian và phòng đã phân.' : target === 'COMPLETED' ? early ? 'Bạn đang kết thúc ca trước giờ. Cần ghi rõ lý do và bảo đảm có người tiếp nhận phần trực còn lại.' : 'Ca chuyển sang hoàn tất. Staff không còn được tính là đang trực theo ca này.' : 'Ca sẽ ngừng hiệu lực và được giữ trong lịch sử. Kiểm tra lại phần giờ còn thiếu người sau khi hủy.'}</p>
    <form onSubmit={submit}><label className="ss-form-label">{required ? 'Lý do *' : 'Ghi chú'}<textarea rows={3} maxLength={4000} value={note} disabled={busy} onChange={e => setNote(e.target.value)} /></label>
      {error && <p role="alert" className="ss-notice ss-notice-error">{error}</p>}
      <footer className="ss-dialog-footer"><button type="button" disabled={busy} onClick={onClose}>Quay lại</button><button type="submit" disabled={busy} className={target === 'CANCELLED' ? 'ss-danger' : 'ss-primary'}>{busy ? 'Đang cập nhật…' : title}</button></footer>
    </form>
  </Modal>;
}

export function ShiftDetails({ shift, data, now, onClose }) {
  const person = data.staff.find(p => p.staffProfileId === shift.staffProfileId), room = data.rooms.find(r => r.roomId === shift.roomId);
  const state = shiftState(shift, now);
  return <Modal title="Chi tiết ca trực" subtitle={shift.shiftName} onClose={onClose}>
    <span className={`ss-badge ss-${state.tone}`}>{state.label}</span>
    <dl className="ss-facts"><div><dt>Người trực</dt><dd>{person ? staffName(person) : shift.staffCode}</dd></div><div><dt>Phòng phụ trách</dt><dd>{room ? roomName(room) : shift.roomCode}</dd></div><div><dt>Bắt đầu</dt><dd>{dateLabel(shift.startsAt)}</dd></div><div><dt>Kết thúc</dt><dd>{dateLabel(shift.endsAt)}</dd></div></dl>
    <section className="ss-detail-note"><h3>Ghi chú bàn giao</h3><p>{shift.note || 'Chưa có ghi chú.'}</p></section>
    <details className="ss-advanced"><summary>Mã tra cứu và khung giờ con</summary><p>Mã ca: {shift.shiftCode}</p>{shift.slots?.length ? <ul>{shift.slots.map(s => <li key={s.slotId}>{dateLabel(s.startsAt)} → {dateLabel(s.endsAt)} · {{ AVAILABLE: 'Sẵn sàng', BLOCKED: 'Tạm khóa', CLOSED: 'Đã đóng' }[s.status] || s.status}{s.note && ` · ${s.note}`}</li>)}</ul> : <p>Ca này không có khung giờ con.</p>}</details>
    <footer className="ss-dialog-footer"><button type="button" onClick={onClose}>Đóng</button></footer>
  </Modal>;
}
