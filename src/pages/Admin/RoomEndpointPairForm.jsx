import { useRef, useState } from 'react';

const initialPair = {
  roomId: '', primaryEndpointId: '', fallbackEndpointId: '', groupCode: '', groupName: '',
  fallbackRadiusM: '0.75', setAsRoomDefault: false,
};

export default function RoomEndpointPairForm({
  rooms, endpoints, mapId, groups, busy, onCreatePair, onCreated, onCancel,
}) {
  const [pair, setPair] = useState(initialPair);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const activeRooms = rooms.filter(room => room.active);
  const room = activeRooms.find(item => item.roomId === pair.roomId);
  const points = endpoints.filter(point => room && point.roomId === room.roomId &&
    point.mapId === mapId && point.enabled && point.accessible);
  const code = pair.groupCode.trim();
  const duplicate = code && groups.some(group => group.code.trim().toUpperCase() === code.toUpperCase());
  const radius = Number(pair.fallbackRadiusM);
  const validPair = pair.primaryEndpointId !== pair.fallbackEndpointId &&
    [pair.primaryEndpointId, pair.fallbackEndpointId].every(id => points.some(point => point.id === id));
  const ready = mapId && validPair && code && pair.groupName.trim() && !duplicate &&
    Number.isFinite(radius) && radius >= 0.1 && radius <= 2;
  const disabled = busy || saving;

  function change(field, value) {
    setError('');
    setPair(previous => ({ ...previous, [field]: value }));
  }

  function selectRoom(id) {
    const next = activeRooms.find(item => item.roomId === id);
    const roomCode = next?.roomCode || '';
    const prefix = /^ROOM_/i.test(roomCode) ? roomCode : 'ROOM_' + roomCode;
    setError('');
    setPair({
      ...initialPair, roomId: id,
      groupCode: next ? prefix.slice(0, 59) + '_PAIR' : '',
      groupName: next ? (next.roomName + ' · điểm chính và dự phòng').slice(0, 160) : '',
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (!ready || disabled || savingRef.current || uncertain) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const group = await onCreatePair({
        ...pair, mapId, groupCode: code, groupName: pair.groupName.trim(), fallbackRadiusM: radius,
      });
      if (!group?.id) throw new Error('Máy chủ chưa trả về mã định danh của nhóm.');
      onCreated(group);
    } catch (failure) {
      if (!failure.status || failure.status === 408 || failure.status >= 500) {
        setUncertain(true);
        setError('Chưa xác nhận được kết quả. Quay lại danh sách và tải lại để kiểm tra nhóm ' + code + '.');
      } else {
        setError(failure.status === 409 ? 'Mã nhóm đã tồn tại trên bản đồ. Hãy chọn mã khác.' :
          failure.message || 'Không tạo được cặp điểm cho phòng.');
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function pointField(label, field, otherId) {
    return <label>{label}
      <select aria-label={label} required value={pair[field]} disabled={points.length < 2} onChange={event => change(field, event.target.value)}>
        <option value="">Chọn điểm</option>
        {points.map(point => <option key={point.id} value={point.id} disabled={point.id === otherId}>
          {point.name}{point.code ? ' · ' + point.code : ''}
        </option>)}
      </select>
    </label>;
  }

  return <form className="eg-form" aria-label="Cặp điểm cho phòng" onSubmit={submit}>
    <fieldset className="eg-fields" disabled={disabled || uncertain}>
      <label className="eg-wide">Phòng
        <select aria-label="Phòng" required value={pair.roomId} onChange={event => selectRoom(event.target.value)}>
          <option value="">Chọn phòng</option>
          {activeRooms.map(item => <option key={item.roomId} value={item.roomId}>{item.roomName} · {item.roomCode}</option>)}
        </select>
      </label>
      {!activeRooms.length && <p className="eg-note eg-wide">Tầng của bản đồ này chưa có phòng đang hoạt động.</p>}
      {room && points.length < 2 && <p className="eg-note eg-wide">
        Phòng có {points.length} điểm đủ điều kiện trên bản đồ này. Cần gắn ít nhất hai điểm đang hoạt động và có thể tiếp cận vào phòng.
      </p>}
      {pointField('Điểm chính', 'primaryEndpointId', pair.fallbackEndpointId)}
      {pointField('Điểm dự phòng', 'fallbackEndpointId', pair.primaryEndpointId)}
      <label>Tên nhóm
        <input required maxLength={160} value={pair.groupName} onChange={event => change('groupName', event.target.value)} />
      </label>
      <label>Mã nhóm
        <input required maxLength={64} value={pair.groupCode} aria-invalid={duplicate || undefined}
          onChange={event => change('groupCode', event.target.value)} />
      </label>
      {duplicate && <p className="eg-error eg-wide" role="alert">Mã nhóm đã tồn tại trên bản đồ. Hãy chọn mã khác.</p>}
      <label>Bán kính dự phòng (m)
        <input type="number" required min="0.1" max="2" step="any" value={pair.fallbackRadiusM}
          onChange={event => change('fallbackRadiusM', event.target.value)} />
      </label>
      <label className="eg-check eg-wide">
        <input type="checkbox" checked={pair.setAsRoomDefault} onChange={event => change('setAsRoomDefault', event.target.checked)} />
        Dùng làm nhóm mặc định của phòng
      </label>
      {pair.setAsRoomDefault && room?.defaultEndpointGroupId && <p className="eg-note eg-wide">
        Nhóm mới sẽ thay nhóm mặc định hiện tại của phòng {room.roomName}.
      </p>}
    </fieldset>
    {error && <p className="eg-error" role="alert">{error}</p>}
    <div className="eg-actions">
      <button type="button" className="eg-button" disabled={disabled} onClick={onCancel}>{uncertain ? 'Quay lại danh sách' : 'Hủy'}</button>
      <button type="submit" className="eg-button eg-primary" disabled={disabled || uncertain || !ready}>
        {saving ? 'Đang tạo…' : 'Tạo cặp điểm'}
      </button>
    </div>
  </form>;
}
