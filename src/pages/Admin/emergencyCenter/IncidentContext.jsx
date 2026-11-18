import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../../features/api/client.js';
import { loadSavedMap } from '../../../features/robotOperations/savedMap.js';
import { imagePoint } from '../../../features/operations/monitorGeometry.js';
import { matchingPresentation, presentationViewport } from '../../../features/operations/monitorPresentation.js';
import { INCIDENT_STATUSES, isFallIncident } from '../../../features/operations/emergencyCenter.js';
import { getIncidentLocation, getIncidentResponseRoute, emergencyError } from '../../../features/operations/emergencyApi.js';
import { scopedIncidentLocation, routeReason } from '../../../features/operations/incidentLocation.js';
import MapPresentationCanvas from '../MapPresentationCanvas.jsx';

export function IncidentMap({ incident, info }) {
  const [saved, setSaved] = useState(null), [published, setPublished] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [location, setLocation] = useState(null), [locationError, setLocationError] = useState('');
  const fall = isFallIncident(incident);
  useEffect(() => {
    const controller = new AbortController(); setLocation(null); setLocationError('');
    const read = incident.status === 'IN_PROGRESS' ? getIncidentResponseRoute
      : fall && ['OPEN', 'ACKNOWLEDGED'].includes(incident.status) ? getIncidentLocation : null;
    if (read) read(incident.incidentId, controller.signal).then(value => {
      if (!controller.signal.aborted) {
        if (!value || !['PREVIEW', 'FOUND', 'UNAVAILABLE'].includes(value.status) || value.unit !== 'cm'
          || value.mapId && value.mapId !== incident.mapId) throw Error('Thông tin vị trí không khớp sự cố.');
        setLocation(value);
      }
    }).catch(cause => { if (!controller.signal.aborted) setLocationError(emergencyError(cause)); });
    return () => controller.abort();
  }, [incident.incidentId, incident.mapId, incident.status, fall, retry]);
  useEffect(() => {
    const controller = new AbortController(); let imageUrl;
    setSaved(null); setPublished(null); setError('');
    if (!incident.mapId) return () => controller.abort();
    const path = `/api/v1/maps/${encodeURIComponent(incident.mapId)}`;
    Promise.all([
      loadSavedMap(incident.mapId, apiRequest, controller.signal),
      apiRequest(`${path}/presentation/published`, { signal: controller.signal }).catch(() => null),
    ]).then(([value, presentation]) => {
      if (controller.signal.aborted) return;
      imageUrl = URL.createObjectURL(value.blob);
      setSaved({ ...value, url: imageUrl });
      setPublished(matchingPresentation(presentation, value.metadata));
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message || 'Chưa tải được bản đồ.'); });
    return () => { controller.abort(); if (imageUrl) URL.revokeObjectURL(imageUrl); };
  }, [incident.mapId, retry]);
  const scoped = saved && scopedIncidentLocation(location, incident, saved.metadata);
  const patient = scoped?.patient || (!fall && [incident.xM, incident.yM].every(Number.isFinite) ? incident : null);
  const point = saved && imagePoint(patient, saved.metadata);
  const observation = scoped?.observation && imagePoint(scoped.observation, saved.metadata);
  const target = scoped?.destination && imagePoint(scoped.destination, saved.metadata);
  const routePoints = scoped?.points.map(value => imagePoint(value, saved.metadata)) || [];
  const routeVisible = routePoints.length > 1 && routePoints.every(Boolean);
  const radius = saved ? Math.max(saved.metadata.width_px, saved.metadata.height_px) / 65 : 0;
  const ongoing = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(incident.status);
  const markerColor = ongoing ? '#e5484d' : incident.status === 'RESOLVED' ? '#25836c' : '#7a8a9f';
  const marker = point && <g className={`ec-sos-marker ${ongoing ? 'is-active' : ''}`} data-status={incident.status} style={{ '--ec-marker-color': markerColor }} transform={`translate(${point.x} ${point.y})`}><title>Vị trí ghi nhận trong sự cố</title>
    <circle r={radius * 2} fill={markerColor} fillOpacity=".12" />
    {ongoing && <circle className="ec-sos-pulse" r={radius * 1.5} fill={markerColor} fillOpacity=".2" stroke={markerColor} strokeOpacity=".5" strokeWidth={radius * .15} />}
    <circle className="ec-sos-marker-core" r={radius} fill={markerColor} stroke="white" strokeWidth={radius * .25} />
    <text textAnchor="middle" dominantBaseline="central" fill="white" fontSize={radius * 1.4} fontWeight="800">{ongoing ? '!' : '✓'}</text>
  </g>;
  const overlays = <>
    {routeVisible && <polyline className="ec-response-route" points={routePoints.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#2864ed" strokeWidth={Math.max(1, radius / 3)} strokeLinecap="round" strokeLinejoin="round"><title>Đường đi bộ hỗ trợ từ phòng trực</title></polyline>}
    {target && !point && !observation && <g transform={`translate(${target.x} ${target.y})`}><circle r={radius} fill="#2864ed" stroke="white" strokeWidth={radius / 4} /><title>Điểm hỗ trợ do máy chủ ghi nhận</title></g>}
    {observation && <g className="ec-observation-marker" transform={`translate(${observation.x} ${observation.y})`}><rect x={-radius} y={-radius} width={radius * 2} height={radius * 2} rx={radius / 3} fill="#2864ed" stroke="white" strokeWidth={radius / 4} /><title>Vị trí robot lúc phát hiện, chưa phải vị trí người</title></g>}
    {marker}
  </>;
  const view = published && presentationViewport(published, 1);
  return <section className="ec-context-card ec-map-card"><header><div><h4>Vị trí ghi nhận</h4><p>{info.map}</p></div><span className="ec-small-tag">Bản đồ sự cố</span></header>
    <div className="ec-map-preview">{saved ? published ? <MapPresentationCanvas source={published.source} document={published.document} preview imageUrl={saved.url} opacity={published.document.features.length ? 0 : 1} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="img" aria-label="Bản đồ vị trí ghi nhận sự cố"><g transform={`scale(${published.source.widthM / saved.metadata.width_px} ${published.source.heightM / saved.metadata.height_px})`}>{overlays}</g></MapPresentationCanvas>
      : <svg viewBox={`0 0 ${saved.metadata.width_px} ${saved.metadata.height_px}`} role="img" aria-label="Bản đồ vị trí ghi nhận sự cố"><image href={saved.url} width={saved.metadata.width_px} height={saved.metadata.height_px} />{overlays}</svg>
      : <div className="ec-map-placeholder"><span>⌖</span><strong>{!incident.mapId ? 'Chưa có bản đồ liên kết' : error ? 'Chưa tải được bản đồ' : 'Đang tải bản đồ…'}</strong>{error && <button className="ec-text-button" onClick={() => setRetry(value => value + 1)}>Thử lại bản đồ</button>}</div>}</div>
    <footer><strong>{info.endpoint}</strong>{point && <span className={`ec-map-location-status ${ongoing ? 'is-active' : ''}`} style={{ '--ec-marker-color': markerColor }}><i />{fall ? 'Vị trí người được ghi nhận' : ongoing ? 'Điểm SOS đang diễn ra' : INCIDENT_STATUSES[incident.status]?.label || 'Vị trí ghi nhận'}</span>}
      {observation && <span className="ec-map-location-status ec-observation-label">■ Vị trí robot lúc phát hiện</span>}
      <p>{saved && point ? 'Vị trí do sự cố ghi nhận, không phải vị trí robot trực tiếp.' : observation ? 'Chưa xác định vị trí người cần hỗ trợ. Điểm màu xanh là vị trí robot lúc quan sát.' : info.coordinates ? `Tọa độ ghi nhận: ${info.coordinates}. Chưa thể đánh dấu trên bản đồ.` : 'Chưa có tọa độ ghi nhận. Không thể xác định vị trí người cần hỗ trợ trên bản đồ.'}</p>
      {location?.status === 'FOUND' && scoped && <p className="ec-route-summary">Đường đi bộ hỗ trợ từ phòng trực: {scoped.distanceM?.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) ?? '—'} m. {location.destinationBasis?.startsWith('ROBOT') ? 'Đích là vị trí robot lúc phát hiện; cần tìm người trong khu vực quan sát.' : 'Đích do máy chủ xác định từ vị trí sự cố.'}</p>}
      {location?.status === 'UNAVAILABLE' && <p className="ec-inline-warning">{routeReason(location.reason)}</p>}
      {locationError && <p className="ec-inline-warning" role="status">{locationError}</p>}
      {(locationError || location?.status === 'UNAVAILABLE' || location && saved && !scoped) && <button className="ec-text-button" onClick={() => setRetry(value => value + 1)}>Thử lại vị trí / đường hỗ trợ</button>}
      {location && saved && !scoped && <p className="ec-inline-warning">Dữ liệu vị trí chưa khớp phiên bản bản đồ. Chưa thể vẽ đường hỗ trợ.</p>}
    </footer>
  </section>;
}

const robotStatuses = { IDLE: 'Đang rảnh', BUSY: 'Đang thực hiện công việc', OFFLINE: 'Ngoại tuyến', ERROR: 'Cần kiểm tra', CHARGING: 'Đang sạc', MAINTENANCE: 'Đang bảo trì' };
export function IncidentRobot({ incident, info, tick }) {
  const [snapshot, setSnapshot] = useState(null), [error, setError] = useState('');
  const [session, setSession] = useState(null), [sessionError, setSessionError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/api/v1/media-sessions', { signal: controller.signal }).then(value => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(value)) throw Error('Chưa kiểm tra được phiên hỗ trợ.');
      setSession(value.find(row => row.incidentId === incident.incidentId && row.mode === (isFallIncident(incident) ? 'MONITOR' : 'ASSIST')) || null); setSessionError('');
    }).catch(() => { if (!controller.signal.aborted) setSessionError('Chưa kiểm tra được'); });
    return () => controller.abort();
  }, [incident.incidentId, tick]);
  useEffect(() => {
    if (!incident.robotId) return;
    const controller = new AbortController();
    apiRequest(`/api/v1/robots/${encodeURIComponent(incident.robotId)}/snapshot`, { signal: controller.signal }).then(value => {
      if (controller.signal.aborted) return;
      if (value?.robot?.robotId !== incident.robotId) throw Error('Chưa có dữ liệu robot hợp lệ.');
      setSnapshot(value); setError('');
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message || 'Không tải được trạng thái robot.'); });
    return () => controller.abort();
  }, [incident.robotId, tick]);
  return <section className="ec-context-card ec-robot-context"><header><div><h4>Robot liên quan</h4><p>{info.robot}</p></div><span className="ec-small-tag">Theo dõi riêng</span></header><dl>
    <div><dt>Trạng thái ghi nhận</dt><dd>{error ? 'Chưa cập nhật được' : robotStatuses[snapshot?.robot?.status] || snapshot?.robot?.status || 'Chưa có dữ liệu'}</dd></div>
    <div><dt>Kết nối lúc ghi nhận</dt><dd>{error || !snapshot ? 'Chưa xác định' : snapshot.mqttConnected && snapshot.heartbeatFresh ? 'Có tín hiệu từ robot' : 'Chưa có tín hiệu kết nối mới'}</dd></div>
    <div><dt>Công việc đang gắn</dt><dd>{error || !snapshot ? 'Chưa xác định' : snapshot.activeJobId ? 'Có công việc đang gắn với robot' : 'Không có công việc đang gắn'}</dd></div>
    <div><dt>{isFallIncident(incident) ? 'Phiên camera xác minh' : 'Phiên hỗ trợ SOS'}</dt><dd>{sessionError || (session ? ({ RINGING: isFallIncident(incident) ? 'Chờ mở camera xác minh' : 'Đang đổ chuông', CONNECTING: 'Đang kết nối', ACTIVE: isFallIncident(incident) ? 'Camera xác minh đang kết nối' : 'Đang hỗ trợ qua cuộc gọi', RECONNECTING: 'Đang kết nối lại', ENDED: 'Đã kết thúc', FAILED: 'Kết nối thất bại', EXPIRED: 'Phiên đã hết hạn' }[session.state] || 'Chưa xác định') : 'Chưa ghi nhận phiên đang mở')}</dd></div>
    {snapshot?.observedAt && <div><dt>Ghi nhận lúc</dt><dd>{new Date(snapshot.observedAt).toLocaleString('vi-VN')}</dd></div>}
  </dl><p>Tiến độ tuần tra chưa được cung cấp tại đây. Đóng hồ sơ sự cố không xác nhận robot đã dừng hay đã tiếp tục tuần tra.</p>{incident.robotId && <Link to={snapshot?.activeJobId ? `/admin/live-operations?jobId=${encodeURIComponent(snapshot.activeJobId)}` : '/admin/live-operations'}>{snapshot?.activeJobId ? 'Xem công việc của robot' : 'Mở vận hành trực tiếp'} <span aria-hidden="true">↗</span></Link>}</section>;
}
