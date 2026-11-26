import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useStaffAlertEvents } from '../../../features/monitoring/useStaffAlertEvents.js';
import { apiRequest } from '../../../features/api/client.js';
import { getSession } from '../../../features/auth/session.js';
import { confirmAction } from '../../../components/appDialog.js';
import './batteryPolicy.css';
const labels = { NORMAL:'Bình thường', LOW:'Pin thấp', RETURN_REQUESTED:'Đã yêu cầu về sạc', WAITING_FOR_STOP:'Chờ robot dừng', BLOCKED:'Đang bị chặn', RETURNING:'Đang về điểm sạc', ARRIVED:'Đã đến điểm sạc', FAILED:'Thất bại' };
const reasons = {WAITING_FOR_PHYSICAL_STOP:'Đang chờ xác nhận robot đã dừng.',DELIVERY_RECOVERY_REQUIRED:'Cần hoàn tất xử lý bàn giao hàng.',INCIDENT_OR_MEDIA_HOLD:'Robot đang phục vụ sự cố hoặc phiên hỗ trợ trực tiếp.',MAPPING_ACTIVE:'Robot đang quét bản đồ.',ROBOT_UNAVAILABLE:'Robot chưa sẵn sàng hoạt động.',NO_ACTIVE_MAP:'Chưa có bản đồ đang hoạt động.',MISSING_CHARGER:'Chưa cấu hình điểm sạc hợp lệ.',CHARGER_UNAVAILABLE:'Điểm sạc đã chọn không khả dụng.',NAVIGATION_NOT_READY:'Chưa xác minh phiên dẫn đường.',BATTERY_TELEMETRY_UNAVAILABLE:'Chưa có thông số pin mới.',RETURN_WORKFLOW_UNAVAILABLE:'Chưa có quy trình về sạc phù hợp.',WARNING_JOB_FAILED:'Tác vụ thông báo về sạc gặp lỗi.',RETURN_JOB_MISSING:'Chưa tìm thấy tác vụ về sạc.',RETURN_JOB_FAILED:'Tác vụ về sạc gặp lỗi.'};
const reasonText = code => reasons[code] || (code ? `Cần kiểm tra điều kiện vận hành (${code}).` : 'Không có điều kiện chặn được báo cáo.');

const validPercent = value => value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100;
const percentLabel = value => validPercent(value) ? `${Number(value)}%` : '—';
function policyIssue(error, resource) {
  if (error.status === 404 && /API endpoint not found|No static resource/i.test(error.message)) {
    return { unsupported: true, message: `Máy chủ chưa cung cấp ${resource}. Thông tin kết nối và pin robot vẫn được cập nhật riêng.` };
  }
  if (error.status === 404 && /Robot not found/i.test(error.message)) {
    return { message: 'Robot đã chọn không còn trong danh sách máy chủ. Tải lại trang để chọn lại robot.' };
  }
  if (error.status === 404) return { message: `Máy chủ trả 404 khi đọc ${resource}. Chưa đủ thông tin để xác định nguyên nhân; dữ liệu pin vẫn hiển thị độc lập.` };
  if (error.status === 403) return { message: `Tài khoản chưa có quyền xem ${resource}.` };
  return { message: `Chưa đọc được ${resource}. ${error.status ? `Máy chủ trả HTTP ${error.status}.` : 'Kiểm tra kết nối tới máy chủ.'} Dữ liệu đã nhận trước đó được giữ lại.` };
}

export default function BatteryPolicyPanel() {
  const [robots, setRobots] = useState([]), [id, setId] = useState('');
  const [state, setState] = useState(null), [chargers, setChargers] = useState([]), [endpointId, setEndpoint] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [revision, setRevision] = useState(0);
  const [battery, setBattery] = useState(null), [batteryError, setBatteryError] = useState('');
  const [alerts, setAlerts] = useState(null), [alertsError, setAlertsError] = useState('');
  const [policyError, setPolicyError] = useState(null), [chargerError, setChargerError] = useState(null), [actionError, setActionError] = useState('');
  const unsupported = useRef(new Map()), lock = useRef(false);
  const admin = getSession()?.account?.role === 'ADMIN';
  const stream = useStaffAlertEvents(() => setRevision(value => value + 1));
  useEffect(() => {
    setState(null); setChargers([]); setBattery(null); setEndpoint(''); setError(''); setNotice('');
    setActionError(''); setPolicyError(null); setChargerError(null); setBatteryError('');
  }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/api/v1/robots?page=0&size=100', { signal: controller.signal })
      .then(page => {
        if (controller.signal.aborted) return;
        const list = Array.isArray(page) ? page : page.content || [];
        setRobots(list); setId(list[0]?.robotId || '');
      }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    let timer;
    async function read(path) {
      if (unsupported.current.has(path)) throw unsupported.current.get(path);
      try { return await apiRequest(path, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }); }
      catch (error) {
        // Retry an absent route only on explicit refresh; keep polling real telemetry.
        if (!controller.signal.aborted && policyIssue(error, '').unsupported) unsupported.current.set(path, error);
        throw error;
      }
    }
    async function load() {
      const prefix = `/api/v1/robots/${encodeURIComponent(id)}`;
      const results = await Promise.allSettled([
        read(`${prefix}/battery-policy`), read(`${prefix}/chargers`), read(`${prefix}/battery`),
        read('/api/v1/alerts?type=LOW_BATTERY&status=OPEN&size=100'), read(prefix),
      ]);
      if (controller.signal.aborted) return;
      const [policy, charging, telemetry, notices, robot] = results;
      if (policy.status === 'fulfilled' && policy.value?.robotId === id) { setState(policy.value); setPolicyError(null); }
      else setPolicyError(policyIssue(policy.reason || { status: 502 }, 'chính sách về sạc'));
      if (charging.status === 'fulfilled' && Array.isArray(charging.value)) {
        setChargers(charging.value); setChargerError(null);
        setEndpoint(previous => previous && !charging.value.some(charger => charger.endpointId === previous) ? '' : previous);
      } else setChargerError(policyIssue(charging.reason || { status: 502 }, 'danh sách điểm sạc'));
      if (telemetry.status === 'fulfilled' && telemetry.value?.robotId === id) { setBattery(telemetry.value); setBatteryError(''); }
      else setBatteryError('Chưa cập nhật được thông số pin; đang giữ mức pin đã ghi nhận.');
      if (notices.status === 'fulfilled') { setAlerts(notices.value); setAlertsError(''); }
      else setAlertsError('Chưa tải được cảnh báo pin thấp.');
      if (robot.status === 'fulfilled' && robot.value?.robotId === id) setRobots(previous => previous.map(item => item.robotId === id ? robot.value : item));
      timer = setTimeout(load, 10000);
    }
    load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, revision]);

  function refresh() { unsupported.current.clear(); setRevision(value => value + 1); }
  async function requestReturn() {
    if (!id || lock.current || !admin || !current || policyError || chargerError || !chargers.length) return;
    lock.current = true; setBusy(true); setActionError(''); setNotice('');
    try {
      if (!await confirmAction('Yêu cầu robot đang chọn về điểm sạc? Thao tác này có thể hủy nhiệm vụ hiện tại và làm robot di chuyển.')) return;
      const result = await apiRequest(`/api/v1/robots/${encodeURIComponent(id)}/return-to-charger`, {
        method: 'POST', body: endpointId ? { endpointId } : {}, retry: false, signal: AbortSignal.timeout(15000),
      });
      if (result?.robotId !== id) throw Error('Chưa xác minh được phản hồi của robot đang chọn. Tải lại trạng thái trước khi gửi thêm yêu cầu.');
      setState(result); setNotice('Máy chủ đã tiếp nhận yêu cầu về sạc.');
    } catch (error) { setActionError(error.message); }
    finally { lock.current = false; setBusy(false); }
  }

  const robot = robots.find(item => item.robotId === id);
  const current = state?.robotId === id ? state : null;
  const telemetry = battery?.robotId === id ? battery : null;
  const batteryValue = validPercent(telemetry?.batteryPercent) ? Number(telemetry.batteryPercent) : null;
  const measured = batteryValue ?? (validPercent(current?.measuredPercent) ? Number(current.measuredPercent) : null);
  const saved = validPercent(robot?.batteryPercent) ? Number(robot.batteryPercent) : null;
  const offline = robot?.status === 'OFFLINE';
  const fresh = measured !== null && !offline && (batteryValue !== null ? telemetry?.fresh === true && telemetry.estimateStatus !== 'STALE' && !batteryError : current?.measuredFresh === true);
  const displayedPercent = fresh ? measured : saved ?? measured;
  const batteryNote = displayedPercent === null ? 'Chưa có dữ liệu pin được ghi nhận' : fresh ? 'Dữ liệu pin mới' : 'Lần ghi nhận cuối' + (offline ? ' · Robot ngoại tuyến' : ' · Chưa có dữ liệu mới');
  const stateLabel = current ? labels[current.state] || current.state : policyError?.unsupported ? 'Chưa hỗ trợ trên máy chủ' : policyError ? 'Chưa có dữ liệu' : 'Đang tải…';

  return <section className="bp-panel" aria-label="Pin và về sạc">
    <header className="bp-heading"><div><h2>Pin & về sạc</h2><p>Theo dõi pin và quá trình robot trở về điểm sạc · Cập nhật mỗi 10 giây</p></div><div className="bp-heading-actions"><label>Robot<select aria-label="Chọn robot" disabled={busy} value={id} onChange={event => setId(event.target.value)}><option value="">Chọn robot</option>{robots.map(item => <option key={item.robotId} value={item.robotId}>{item.robotName || item.robotCode || item.robotId}</option>)}</select></label><button className="bp-secondary" disabled={busy} onClick={refresh}>Tải lại</button></div></header>
    {error && <p className="bp-error" role="alert">{error}</p>}
    {actionError && <p className="bp-error" role="alert">{actionError}</p>}
    {notice && <p className="bp-notice" role="status">{notice}</p>}
    <article className="bp-card bp-low-alerts"><div className="bp-alert-heading"><h3>Cảnh báo pin thấp đang mở</h3><Link to="/admin/alerts?type=LOW_BATTERY&status=OPEN">Xem và xử lý cảnh báo →</Link></div>
      {stream !== 'idle' && <p role="status">Thông báo staff: {stream === 'live' ? 'Đang nhận trực tiếp' : stream === 'unavailable' ? 'Không mở được kết nối; dùng cập nhật định kỳ' : 'Đang kết nối lại; dùng cập nhật định kỳ'}</p>}
      {alertsError ? <p role="alert">{alertsError}</p> : alerts ? <><p>{alerts.totalElements ?? (Array.isArray(alerts) ? alerts.length : alerts.content?.length ?? 0)} cảnh báo trong phạm vi tài khoản.</p><ul>{(Array.isArray(alerts) ? alerts : alerts.content || []).map(alert => <li key={alert.alertId}><strong>Pin robot thấp</strong><p>{alert.message || 'Kiểm tra mức pin và chính sách về sạc của robot.'}</p><small>{alert.createdAt ? new Date(alert.createdAt).toLocaleString('vi-VN') : ''}</small></li>)}</ul></> : <p>Đang tải cảnh báo…</p>}
    </article>
    {!id && <p>Chọn robot để xem thông tin pin và điểm sạc.</p>}
    {id && <>
      <div className="bp-grid">
        <article className="bp-card"><h3>Pin đo từ robot</h3><strong className="bp-percent">{percentLabel(displayedPercent)}</strong><p>{batteryNote}</p>{batteryError && <p className="bp-battery-note">{batteryError}</p>}<dl><dt>Điện áp</dt><dd>{telemetry?.voltageV == null ? '—' : `${telemetry.voltageV} V`}</dd><dt>Thời điểm đo</dt><dd>{telemetry?.capturedAt ? new Date(telemetry.capturedAt).toLocaleString('vi-VN') : '—'}</dd></dl><p>Mức pin ước tính đã được máy chủ lưu; giữ lại khi robot mất kết nối.</p></article>
        <article className="bp-card"><h3>Chính sách về sạc</h3><span className={`bp-state bp-state-${current?.state || 'unknown'}`} role="status">{stateLabel}</span>{policyError && <p className={policyError.unsupported ? 'bp-capability-note' : 'bp-battery-note'}>{policyError.message}</p>}<dl><dt>Cảnh báo pin thấp</dt><dd>{percentLabel(current?.lowThreshold)}</dd><dt>Ngưỡng pin nguy cấp</dt><dd>{percentLabel(current?.criticalThreshold)}</dd><dt>Ngưỡng phục hồi</dt><dd>{percentLabel(current?.rearmThreshold)}</dd><dt>Nhận nhiệm vụ mới</dt><dd>{current ? current.foregroundBlocked ? 'Đang bị chặn' : 'Được phép' : 'Chưa xác định'}</dd></dl></article>
        <article className="bp-card"><h3>Tiến trình</h3><p>{current ? reasonText(current.blockedReason) : 'Chưa có dữ liệu tiến trình về sạc từ máy chủ.'}</p><p>Tác vụ về sạc: {current?.returnJobId ? <Link className="bp-job-link" to={`/admin/live-operations?jobId=${encodeURIComponent(current.returnJobId)}`}>Xem tiến trình →</Link> : current ? 'Chưa có' : 'Chưa xác định'}</p><p>Đánh giá gần nhất: {current?.lastEvaluatedAt ? new Date(current.lastEvaluatedAt).toLocaleString('vi-VN') : '—'}</p><p>Đến điểm sạc không đồng nghĩa đang nạp điện.</p></article>
      </div>
      <article className="bp-card bp-chargers"><h3>Điểm sạc trên bản đồ đang hoạt động</h3><label>Điểm sạc<select aria-label="Chọn điểm sạc" disabled={busy || !!chargerError || !chargers.length} value={endpointId} onChange={event => setEndpoint(event.target.value)}><option value="">Tự chọn điểm hợp lệ đầu tiên</option>{chargers.map(charger => <option key={charger.endpointId} value={charger.endpointId}>{charger.endpointName} · {charger.endpointCode}</option>)}</select></label><p>{chargerError?.message || (!chargers.length ? 'Không có điểm sạc hợp lệ trên bản đồ đang hoạt động.' : `${chargers.length} điểm sạc hợp lệ cho ${robot?.robotCode || 'robot đang chọn'}.`)}</p>{!chargerError && <p>Để tự chọn, máy chủ lấy điểm hợp lệ đầu tiên theo mã điểm sạc.</p>}{admin && <button disabled={busy || !!policyError || !!chargerError || !current || !chargers.length} onClick={requestReturn}>{busy ? 'Đang xử lý…' : 'Yêu cầu về sạc'}</button>}</article>
    </>}
  </section>;
}
