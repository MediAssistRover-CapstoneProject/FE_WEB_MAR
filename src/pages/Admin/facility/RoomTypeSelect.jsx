import { ROOM_TYPES } from '../../../features/facility/roomDefaults.js';

export default function RoomTypeSelect({ value = '', onChange, ...props }) {
  const known = ROOM_TYPES.some(([code]) => code === value);
  return <select {...props} value={value ?? ''} onChange={event => onChange(event.target.value)}>
    <option value="">Chọn loại phòng</option>
    {value && !known && <option value={value}>{value}</option>}
    {ROOM_TYPES.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
  </select>;
}
