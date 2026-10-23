import { useEffect, useState } from 'react';
import { localMapCatalog } from '../../features/workflows/localPatrolDesign.js';
import './workflow-link.css';

export default function MoveDestinationFields({ step, onChange }) {
  const [catalog, setCatalog] = useState({ maps: [], endpoints: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const reload = () => {
      try { setCatalog(localMapCatalog()); setError(''); }
      catch (cause) { setError(cause.message); }
      setLoading(false);
    };
    reload();
    window.addEventListener('focus', reload); window.addEventListener('storage', reload);
    return () => { window.removeEventListener('focus', reload); window.removeEventListener('storage', reload); };
  }, [attempt]);
  const values = step.values;
  const dynamic = Object.keys(step.inputMappingJson ?? {}).length > 0 || Object.values(values).some(value => value && typeof value === 'object') || [values.map_id, values.endpoint_id].some(value => typeof value === 'string' && value.includes('${'));
  const endpoints = catalog.endpoints.filter(item => item.mapId === values.map_id);
  const selected = endpoints.find(item => item.endpointId === values.endpoint_id);
  const update = patch => onChange({ ...step, values: { ...values, ...patch } });
  return <div className="move-destination-fields">
    <p className="wf-link-note">Danh sách dùng chung với Bản đồ và Điều phối trên thiết bị này. Mỗi bước chọn một điểm; không lấy điểm từ bản đồ khác trên máy chủ.</p>
    {dynamic && <p role="status">Bước này dùng tham số động. Giữ nguyên cấu hình hiện có; bộ chọn điểm cố định không chỉnh sửa tham số động.</p>}
    {!loading && values.map_id && !catalog.maps.some(map => map.mapId === values.map_id) && <p role="status">Bước cũ dùng bản đồ khác hoặc dữ liệu máy chủ. Chọn lại bản đồ đã lưu bên dưới, rồi chọn điểm đích tương ứng; hệ thống không tự ghép hai bộ tọa độ.</p>}
    {error && <div role="alert">{error} <button type="button" onClick={() => setAttempt(value => value + 1)}>Thử lại</button></div>}
    <div className="inline-config-fields">
      <label>Bản đồ<select disabled={loading || !!error || dynamic} value={typeof values.map_id === 'string' ? values.map_id : ''} onChange={event => update({ map_id: event.target.value, endpoint_id: '' })}>
        <option value="">{loading ? 'Đang tải bản đồ…' : 'Chọn bản đồ đã lưu'}</option>
        {values.map_id && !catalog.maps.some(item => item.mapId === values.map_id) && <option value={values.map_id} disabled>Bản đồ hiện tại không còn khả dụng</option>}
        {catalog.maps.map(map => <option key={map.mapId} value={map.mapId}>{map.mapName} · v{map.versionNo}{map.status !== 'ACTIVE' ? ' · Chưa kích hoạt' : ''}</option>)}
      </select></label>
      <label>Điểm đích<select disabled={loading || !!error || dynamic || !values.map_id} value={typeof values.endpoint_id === 'string' ? values.endpoint_id : ''} onChange={event => update({ endpoint_id: event.target.value })}>
        <option value="">{!values.map_id ? 'Chọn bản đồ trước' : 'Chọn điểm đích'}</option>
        {values.endpoint_id && !selected && <option value={values.endpoint_id} disabled>Điểm đã chọn không còn thuộc bản đồ này</option>}
        {endpoints.map(endpoint => <option key={endpoint.endpointId} value={endpoint.endpointId} disabled={endpoint.active === false || endpoint.accessible === false}>{endpoint.endpointName}{endpoint.active === false || endpoint.accessible === false ? ' · Không khả dụng' : ''}</option>)}
      </select></label>
      <label>Chế độ<select disabled={dynamic} value={values.mode || ''} onChange={event => update({ mode: event.target.value })}><option value="">Chọn chế độ</option><option value="NORMAL">Di chuyển thông thường</option><option value="PATROL">Tuần tra</option><option value="ESCORT">Dẫn đường</option></select></label>
      <label>Tốc độ tối đa (m/s)<input disabled={dynamic} type="number" min="0.01" max="0.3" step="0.01" value={dynamic ? '' : values.max_speed_mps ?? ''} onChange={event => update({ max_speed_mps: event.target.value === '' ? '' : Number(event.target.value) })} placeholder="Ví dụ: 0,08" /></label>
    </div>
    {!loading && !error && values.map_id && !endpoints.length && <p role="status">Bản đồ này chưa có điểm đích. Tạo điểm trong Bản đồ → Điểm đích, sau đó bấm Thử lại.</p>}
    {!loading && !catalog.maps.length && <p role="status">Chưa có bản đồ đã lưu. Mở Bản đồ, lưu bản đồ cùng các điểm đích rồi tải lại.</p>}
    {selected && <p className="wf-link-note">{selected.endpointName} — dùng cùng vị trí trên bản đồ đã lưu, không phải điểm điều khiển robot thật.</p>}
    <button type="button" className="config-back" onClick={() => setAttempt(value => value + 1)}>Tải lại bản đồ và điểm đích</button>
  </div>;
}
