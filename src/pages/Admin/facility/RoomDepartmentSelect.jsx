import { ROOM_DEPARTMENTS } from '../../../features/facility/roomDefaults.js';

export default function RoomDepartmentSelect({ value = '', onChange, ...props }) {
  const known = ROOM_DEPARTMENTS.some(([code]) => code === value);
  return <select {...props} value={value ?? ''} onChange={event => onChange(event.target.value)}>
    <option value="">Chọn khoa</option>
    {value && !known && <option value={value}>{value}</option>}
    {ROOM_DEPARTMENTS.map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
  </select>;
}
