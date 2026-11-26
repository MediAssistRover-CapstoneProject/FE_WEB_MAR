import { useRef, useState } from 'react';
import { API_SELECTION_POLICIES } from '../../features/facility/endpointGroups.js';

const maxSequence = 2147483647;
const blankGroup = {
  code: '', name: '', description: '', selectionPolicy: 'PRIORITY', allowFallback: false,
  active: true, roomId: null, fallbackRadiusM: 0.75, members: [],
};

function useSubmission(onSubmit, busy) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const disabled = busy || pending;

  async function submit(event, value, valid) {
    event.preventDefault();
    if (disabled || uncertain || lock.current || !valid) return;
    lock.current = true;
    setPending(true);
    setError('');
    try {
      await onSubmit(value);
    } catch (failure) {
      const unknown = failure.uncertain || failure.status === 0 || failure.status === 408 ||
        failure.status >= 500 || failure.name === 'AbortError' || failure.name === 'TimeoutError';
      setUncertain(Boolean(unknown));
      setError(unknown ? 'Chưa xác nhận được kết quả. Quay lại danh sách và tải lại để kiểm tra thay đổi.' :
        failure.message || 'Không lưu được thay đổi.');
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return { disabled, pending, uncertain, error, submit };
}

function FormActions({ submission, valid, onCancel, label }) {
  const { disabled, pending, uncertain, error } = submission;
  return <>
    {error && <p className="eg-error" role="alert">{error}</p>}
    <div className="eg-actions">
      <button type="button" className="eg-button" disabled={disabled} onClick={onCancel}>{uncertain ? 'Quay lại danh sách' : 'Hủy'}</button>
      <button type="submit" className="eg-button eg-primary" disabled={disabled || uncertain || !valid}>{pending ? 'Đang lưu…' : label}</button>
    </div>
  </>;
}

export function GroupForm({ group, groups, busy, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({ ...blankGroup, ...group }));
  const submission = useSubmission(onSubmit, busy);
  const code = form.code.trim();
  const name = form.name.trim();
  const duplicate = code && groups.some(item => item.id !== group?.id && item.code.trim().toUpperCase() === code.toUpperCase());
  const radius = Number(form.fallbackRadiusM);
  const valid = name && code && !duplicate && (!form.roomId || (Number.isFinite(radius) && radius >= 0.1 && radius <= 2));
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const result = { ...form, name, code, selectionPolicy: form.roomId ? 'PRIORITY' : form.selectionPolicy, fallbackRadiusM: radius };

  return <form className="eg-form" aria-label="Thông tin nhóm" onSubmit={event => submission.submit(event, result, valid)}>
    <fieldset className="eg-fields" disabled={submission.disabled || submission.uncertain}>
      <label>Tên nhóm
        <input required maxLength={160} value={form.name} onChange={event => set('name', event.target.value)} />
      </label>
      <label>Mã nhóm
        <input required maxLength={64} value={form.code} aria-invalid={duplicate || undefined} onChange={event => set('code', event.target.value)} />
      </label>
      {duplicate && <p className="eg-error eg-wide" role="alert">Mã nhóm đã tồn tại trên bản đồ. Hãy chọn mã khác.</p>}
      <label>Chính sách chọn điểm
        <select aria-label="Chính sách chọn điểm" value={result.selectionPolicy} disabled={Boolean(form.roomId)} onChange={event => set('selectionPolicy', event.target.value)}>
          {Object.entries(API_SELECTION_POLICIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {form.roomId && <label>Bán kính dự phòng (m)
        <input type="number" required min="0.1" max="2" step="any" value={form.fallbackRadiusM} onChange={event => set('fallbackRadiusM', event.target.value)} />
      </label>}
      <label className="eg-wide">Mô tả
        <textarea rows={3} value={form.description || ''} onChange={event => set('description', event.target.value)} />
      </label>
      <label className="eg-check eg-wide">
        <input type="checkbox" checked={form.allowFallback} onChange={event => set('allowFallback', event.target.checked)} />
        Cho phép dùng điểm dự phòng
      </label>
    </fieldset>
    <FormActions submission={submission} valid={valid} onCancel={onCancel} label="Lưu nhóm" />
  </form>;
}

function nextSequence(members, roomId) {
  const occupied = new Set(members.map(member => member.sequenceNo));
  if (roomId && !occupied.has(1)) return 1;
  if (roomId && !occupied.has(2)) return 2;
  const highest = members.reduce((highest, member) => Math.max(highest, member.sequenceNo), 0);
  if (highest < maxSequence) return highest + 1;
  let sequence = 1;
  while (occupied.has(sequence)) sequence += 1;
  return sequence;
}

export function MemberForm({ group, member, endpoints, busy, onSubmit, onCancel }) {
  const others = group.members.filter(item => item.endpointId !== member?.endpointId);
  const atLimit = Boolean(group.roomId) && others.filter(item => item.active).length >= 2;
  const available = endpoints.filter(point => (!group.mapId || point.mapId === group.mapId) &&
    (!group.roomId || point.roomId === group.roomId) &&
    (member ? point.id === member.endpointId : !others.some(item => item.endpointId === point.id)));
  const [form, setForm] = useState(() => member || { endpointId: '', sequenceNo: nextSequence(others, group.roomId), active: !atLimit });
  const submission = useSubmission(onSubmit, busy);
  const sequenceNo = Number(form.sequenceNo);
  const duplicate = others.some(item => item.sequenceNo === sequenceNo);
  const valid = available.some(point => point.id === form.endpointId) && Number.isInteger(sequenceNo) &&
    sequenceNo > 0 && sequenceNo <= maxSequence && !duplicate && !(atLimit && form.active);
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }));

  return <form className="eg-form" aria-label="Thành viên nhóm" onSubmit={event => submission.submit(event, { ...form, sequenceNo }, valid)}>
    <fieldset className="eg-fields" disabled={submission.disabled || submission.uncertain}>
      <label className="eg-wide">Điểm đích
        <select aria-label="Điểm đích" required value={form.endpointId} disabled={Boolean(member)} onChange={event => set('endpointId', event.target.value)}>
          <option value="">Chọn điểm đích</option>
          {available.map(point => <option key={point.id} value={point.id}>
            {point.name}{point.code ? ' · ' + point.code : ''}{point.enabled === false ? ' · đã tắt' : ''}{point.accessible === false ? ' · không thể tiếp cận' : ''}
          </option>)}
        </select>
      </label>
      {!available.length && <p className="eg-note eg-wide">{member ? 'Điểm này hiện nằm ngoài phạm vi của nhóm.' :
        'Không còn điểm đích phù hợp để thêm vào nhóm.'}</p>}
      <label>Thứ tự ưu tiên
        <input type="number" required min="1" max={maxSequence} step="1" value={form.sequenceNo}
          aria-invalid={duplicate || undefined} onChange={event => set('sequenceNo', event.target.value)} />
      </label>
      {duplicate && <p className="eg-error eg-wide" role="alert">Thứ tự này đã được dùng trong nhóm. Hãy chọn số khác.</p>}
      <label className="eg-check eg-wide">
        <input type="checkbox" checked={form.active} onChange={event => set('active', event.target.checked)} />
        Thành viên hoạt động
      </label>
      {atLimit && <p className="eg-note eg-wide">Nhóm của phòng đã có hai thành viên hoạt động. Tắt một thành viên trước khi bật thêm.</p>}
    </fieldset>
    <FormActions submission={submission} valid={valid} onCancel={onCancel} label="Lưu thành viên" />
  </form>;
}

export function ReasonForm({ prompt, busy, onSubmit, onCancel }) {
  const [reason, setReason] = useState('');
  const submission = useSubmission(onSubmit, busy);
  const trimmed = reason.trim();
  const valid = trimmed.length >= 5 && trimmed.length <= 500;
  return <form className="eg-form" aria-label="Xác nhận thay đổi trạng thái" onSubmit={event => submission.submit(event, trimmed, valid)}>
    {prompt && <p className="eg-note">{prompt}</p>}
    <fieldset className="eg-fields" disabled={submission.disabled || submission.uncertain}>
      <label className="eg-wide">Lý do
        <textarea rows={3} required minLength={5} maxLength={500} placeholder="Nhập từ 5 đến 500 ký tự"
          value={reason} onChange={event => setReason(event.target.value)} />
      </label>
    </fieldset>
    <FormActions submission={submission} valid={valid} onCancel={onCancel} label="Xác nhận" />
  </form>;
}
