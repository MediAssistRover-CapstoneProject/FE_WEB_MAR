import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getSession } from '../../../features/auth/session.js';
import { isOperator } from '../../../features/robotOperations/model.js';
import { useRobotSetup } from '../../../features/robotOperations/useRobotSetup.js';
import { setupConnection, setupLivePose, setupNextExpiry, setupReadiness, setupPiCommand, setupSeed, setupWriteBlock } from '../../../features/robotOperations/robotSetup.js';
import RobotSetupMap from './RobotSetupMap.jsx';
import './robotSetup.css';

const steps = ['Bản đồ đang hoạt động', 'Kết nối navigation', 'Xác nhận vị trí', 'Sẵn sàng vận hành'];
const number = value => Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const emptyPoints = [];
const noLivePose = () => false;
const expires = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' }) : 'Chưa có phiên';

function useSetupClock(live) {
  const [, tick] = useState(0), now = Date.now();
  useEffect(() => {
    const expiry = setupNextExpiry(live, now);
    if (expiry === null) return;
    const timer = setTimeout(() => tick(value => value + 1), Math.max(1, expiry - Date.now()));
    return () => clearTimeout(timer);
  }, [live, now]);
  return now;
}

export default function RobotSetupPage() {
  if (!isOperator(getSession())) return <section className="rsu-page"><h2>Thiết lập vận hành</h2><p role="alert">Chỉ quản trị viên đăng nhập thật được thiết lập vận hành robot.</p></section>;
  return <RobotSetupWorkspace />;
}

function RobotSetupWorkspace() {
  const [params, setParams] = useSearchParams();
  const setup = useRobotSetup(params.get('robotId') || '');
  const { catalog, robotId, mapId, live, asset, busy, pending } = setup;
  const now = useSetupClock(live);
  const [seed, setSeed] = useState(null), [endpointId, setEndpointId] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [choosing, setChoosing] = useState(false), [duration, setDuration] = useState(7200), [editing, setEditing] = useState(false), [localError, setLocalError] = useState(''), [copied, setCopied] = useState(false);
  const [compactContext, setCompactContext] = useState('');
  const map = catalog.maps.find(value => value.mapId === mapId), robot = catalog.robots.find(value => value.robotId === robotId);
  const snapshot = live.snapshot?.robot?.robotId === robotId ? live.snapshot : null, session = snapshot?.navigationSession;
  const currentAsset = asset?.mapId === mapId ? asset : null;
  const hasLivePose = useSyncExternalStore(setup.poseFeed.subscribe, useCallback(() => !!setupLivePose(setup.poseFeed.getSnapshot(), snapshot, currentAsset), [setup.poseFeed, snapshot, currentAsset]), noLivePose);
  const state = setupReadiness({ ...live, snapshot, livePose: hasLivePose ? setup.poseFeed.getSnapshot() : null, asset: currentAsset, map, now, pending });
  const connection = setupConnection(state, snapshot);
  const block = setupWriteBlock(snapshot, live.receivedAt, now), locked = !!busy || !!pending;
  const canInitialize = !locked && !block && state.fresh && state.idle && state.matches;
  const points = useMemo(() => catalog.endpoints.filter(point => point.mapId === mapId && point.active && point.accessible).sort((a, b) => (a.endpointType === 'PARK' ? 0 : 1) - (b.endpointType === 'PARK' ? 0 : 1)), [catalog.endpoints, mapId]);
  const command = state.open ? setupPiCommand(session) : '';
  const seedVisible = seed || (state.matches && session.initialization?.pose ? { xM: session.initialization.pose.x_m, yM: session.initialization.pose.y_m, yawRad: session.initialization.pose.yaw_rad } : null);
  const context = JSON.stringify([robotId, mapId, currentAsset?.metadata.asset_hash, session?.sessionId, session?.initialization?.revision]);
  const expanded = compactContext !== context || editing;
  useEffect(() => { if (state.ready) setCompactContext(context); }, [state.ready, context]);
  useEffect(() => {
    setSeed(null); setEndpointId(''); setConfirmed(false); setChoosing(false); setLocalError(''); setCopied(false); setEditing(false);
  }, [robotId, mapId, currentAsset?.metadata.asset_hash, session?.sessionId, session?.initialization?.revision]);
  useEffect(() => {
    if (!robotId) return;
    setParams(previous => {
      if (previous.get('robotId') === robotId && (previous.get('mapId') || '') === mapId) return previous;
      const next = new URLSearchParams(previous); next.set('robotId', robotId);
      if (mapId) next.set('mapId', mapId); else next.delete('mapId');
      return next;
    }, { replace: true });
  }, [robotId, mapId, setParams]);
  const choosePoint = useCallback(point => {
    try { const value = setupSeed(point, { mapId, ...currentAsset?.geometry }); setSeed(value); setEndpointId(point.endpointId); setConfirmed(false); setChoosing(false); setLocalError(''); setEditing(true); }
    catch (error) { setLocalError(error.message); }
  }, [mapId, currentAsset?.geometry]);
  const place = useCallback(value => { setSeed(value); setEndpointId(''); setConfirmed(false); setLocalError(''); }, []);
  const reloadMap = useCallback(() => { setConfirmed(false); setSeed(null); setEndpointId(''); setup.reloadAsset(); }, [setup.reloadAsset]);
  const imageError = useCallback(() => setLocalError('Không đọc được ảnh bản đồ. Bấm tải lại bản đồ để thử lại.'), []);
  const copy = async () => { try { await navigator.clipboard.writeText(command); setCopied(true); } catch { setLocalError('Không sao chép được. Chọn và sao chép lệnh trong khung bên dưới.'); } };
  const check = () => setup.refresh().catch(() => {});
  const act = (kind, values) => { setLocalError(''); if (kind === 'seed') { setConfirmed(false); setChoosing(false); } setup.perform(kind, values); };
  return <section className="rsu-page" aria-label="Thiết lập vận hành robot">
    <header className="rsu-heading"><div><span className="rsu-eyebrow">CHUẨN BỊ ROBOT</span><h2>Thiết lập vận hành</h2><p>Sử dụng bản đồ đang hoạt động, xác nhận vị trí và kiểm tra robot trước khi giao việc.</p></div><Link className="rsu-button" to="/admin/robots">Trạng thái robot <span aria-hidden="true">↗</span></Link></header>
    <section className="rsu-card rsu-selection" aria-label="Robot và bản đồ vận hành">
      <label className="rsu-field">Robot<select aria-label="Robot cần thiết lập" value={robotId} disabled={locked || setup.loading} onChange={event => setup.chooseRobot(event.target.value)}><option value="">Chọn robot</option>{catalog.robots.map(value => <option key={value.robotId} value={value.robotId}>{value.robotName || value.robotCode || value.robotId}</option>)}</select></label>
      <div className="rsu-field"><span id="rsu-active-map-label">Bản đồ vận hành</span><div className="rsu-map-value" aria-labelledby="rsu-active-map-label">{map ? `${map.mapName} · v${map.versionNo}` : setup.loading ? 'Đang tải bản đồ…' : 'Chưa có bản đồ đang hoạt động'}</div></div>
      <div className={`rsu-state ${state.ready ? 'is-ready' : ''}`} role="status"><span className="rsu-state-dot" /><div><strong>{state.title}</strong><small>{connection.robot}{robot?.batteryPercent != null ? ` · Pin ${robot.batteryPercent}%` : ''}</small></div></div>
      <button type="button" className="rsu-icon-button" aria-label="Cập nhật trạng thái thiết lập" disabled={!robotId || !!busy} onClick={check}>↻</button>
    </section>
    <section className="rsu-sync" aria-label="Kết nối và đồng bộ">
      <div className="rsu-sync-status"><p data-setup-transport><strong>Kết nối web</strong><span>{connection.web}</span></p><p data-setup-robot><strong>Kết nối robot</strong><span>{connection.robot}</span></p><p className="rsu-connection-detail">{connection.detail}</p></div>
      <div className="rsu-feedback" aria-live="polite">
        {setup.loading && <p className="rsu-message" role="status">Đang tải robot và bản đồ…</p>}
        {[setup.catalogError, setup.assetError, setup.error, live.error, localError].filter(Boolean).map((message, index) => <p key={index} className="rsu-message rsu-error" role="alert">{message}</p>)}
        {!setup.loading && !catalog.robots.length && <p className="rsu-message">Chưa có robot trong hệ thống.</p>}
        {!setup.loading && !map && <p className="rsu-message">Chưa có bản đồ đang hoạt động. <Link to="/admin/map">Mở thư viện bản đồ để kích hoạt bản đồ.</Link></p>}
        {setup.notice && !state.ready && <p className="rsu-message rsu-notice" role="status">{setup.notice}</p>}
        {state.fresh && state.matches && !state.connected && <p className="rsu-message rsu-notice">Bạn có thể lưu vị trí khởi tạo khi đang chờ Pi. Robot chỉ sẵn sàng sau khi Pi kết nối, xác minh vị trí và xác nhận cấu hình dẫn đường.</p>}
        {pending && <p className="rsu-message rsu-warning" role="status">Đang đối chiếu yêu cầu trước. Các thao tác thiết lập tạm khóa để tránh gửi lặp. <button className="rsu-text-button" onClick={check} disabled={!!busy}>Kiểm tra lại</button></p>}
        {state.open && !state.matches && currentAsset?.loaded && <div className="rsu-message rsu-warning" role="alert">Robot đang có phiên trên {catalog.maps.find(value => value.mapId === session.mapId)?.mapName || 'bản đồ khác'} hoặc phiên bản dữ liệu đã thay đổi. Đóng phiên hiện tại trước khi mở phiên mới trên bản đồ đang hoạt động.</div>}
      </div>
    </section>
    {state.open && <section className="rsu-card rsu-restart" aria-label="Tạo lại phiên vận hành"><div><h3>Tạo phiên mới khi cần khởi động lại robot</h3><p>Dừng tiến trình navigation cũ trên Pi và bảo đảm robot đã hết nhiệm vụ, ngừng di chuyển. UI sẽ đóng phiên cũ, mở phiên mới ngay và cập nhật lệnh chạy Pi; không cần chờ hết 2 giờ.</p></div><div className="rsu-restart-actions"><label className="rsu-field">Thời hạn phiên mới<select aria-label="Thời hạn phiên mới" value={duration} disabled={locked} onChange={event => setDuration(Number(event.target.value))}><option value={7200}>2 giờ</option><option value={14400}>4 giờ</option><option value={28800}>8 giờ</option></select></label><button type="button" className="rsu-button rsu-primary" disabled={locked || !!block || !state.fresh || !state.matches} onClick={() => act('restart', { durationSec: duration, expectedSessionId: session.sessionId })}>{busy === 'close' ? 'Đang đóng phiên cũ…' : busy === 'open' ? 'Đang tạo mã phiên mới…' : 'Dừng phiên và mở phiên mới'}</button></div>{block && <p className="rsu-hint">{block}</p>}</section>}
    <ol className="rsu-steps" aria-label="Tiến trình thiết lập">{steps.map((label, index) => <li key={label} className={state.ready || index < state.step ? 'is-complete' : index === state.step ? 'is-current' : ''} aria-current={!state.ready && index === state.step ? 'step' : undefined}><span>{state.ready || index < state.step ? '✓' : index + 1}</span><strong>{label}</strong></li>)}</ol>
    {!expanded && <div className={`rsu-ready-banner${state.ready ? '' : ' is-checking'}`} role="status"><div><strong>{state.ready ? 'Robot đã sẵn sàng nhận nhiệm vụ' : 'Đang kiểm tra lại trạng thái robot'}</strong><p>{state.ready ? `${robot?.robotName || robot?.robotCode} · ${map?.mapName} · Phiên đến ${expires(session?.expiresAt)}` : 'Chưa đủ xác nhận sẵn sàng. Xem các kiểm tra bên dưới hoặc mở thiết lập để kiểm tra chi tiết.'}</p></div><button className="rsu-button" onClick={() => setEditing(true)}>Xem thiết lập</button></div>}
    <div className="rsu-workspace">
      <section className="rsu-card rsu-map-card"><div className="rsu-panel-heading"><div><span className="rsu-eyebrow">BẢN ĐỒ VẬN HÀNH</span><h3>{map?.mapName || 'Vị trí robot trên bản đồ'}</h3></div>{map && <span className="rsu-badge">Phiên bản {map.versionNo}</span>}</div>
        <RobotSetupMap key={`${mapId}:${currentAsset?.url}`} asset={currentAsset} endpoints={expanded ? points : emptyPoints} seed={!expanded || state.localized && !editing ? null : seedVisible} pose={pending ? null : state.pose} snapshot={snapshot} poseFeed={setup.poseFeed} allowLivePose={state.connected && state.matches && !pending} choosing={choosing} disabled={!canInitialize || !expanded} onPoint={place} onEndpoint={choosePoint} onLoaded={setup.markImageLoaded} onImageError={imageError} onReload={reloadMap} reloading={locked} />
      </section>
      <aside className="rsu-controls">
        {expanded && <>
          <section className="rsu-card rsu-step-card"><div className="rsu-card-title"><span>1</span><h3>Bản đồ đang hoạt động</h3></div><p>{map ? `${map.mapName} · v${map.versionNo}` : 'Kích hoạt bản đồ trong thư viện để thiết lập robot.'}</p>{map && <p className="rsu-hint">{currentAsset?.metadata.navigation_reload_safe === false ? 'Bản đồ cần tạo bản sao tương thích dẫn đường.' : 'Trang tự động sử dụng bản đồ đang hoạt động trong thư viện chung.'}</p>}<Link className="rsu-text-link" to={`/admin/map${mapId ? `?mapId=${encodeURIComponent(mapId)}` : ''}`}>Mở thư viện bản đồ ↗</Link></section>
          <section className="rsu-card rsu-step-card"><div className="rsu-card-title"><span>2</span><h3>Kết nối navigation</h3></div>{state.open ? <><p>Phiên đang mở đến <strong>{expires(session.expiresAt)}</strong>.</p><p className="rsu-hint">{session.state === 'WAITING_FOR_PI' ? 'Khởi động navigation trên Pi và chờ kết nối.' : state.matches ? 'Đang sử dụng lại phiên của robot trên bản đồ này.' : 'Phiên hiện tại chưa khớp bản đồ đã chọn.'}</p></> : <><label className="rsu-field">Thời gian vận hành<select aria-label="Thời gian vận hành" value={duration} disabled={locked} onChange={event => setDuration(Number(event.target.value))}><option value={7200}>2 giờ</option><option value={14400}>4 giờ</option><option value={28800}>8 giờ</option></select></label><button className="rsu-button rsu-primary" disabled={locked || !!block || !state.fresh || !state.loaded || map?.status !== 'ACTIVE' || currentAsset?.metadata.navigation_reload_safe !== true} onClick={() => act('open', { durationSec: duration })}>{busy === 'open' ? 'Đang mở phiên…' : 'Mở phiên vận hành'}</button></>}
            {command && <details className="rsu-details" open={session.state === 'WAITING_FOR_PI' || undefined}><summary>Khởi động navigation trên Pi</summary><p>Dừng <code>robot.zsh run</code> trong container Pi, sau đó chạy lệnh bên dưới.</p><pre>{command}</pre><button className="rsu-button" type="button" onClick={copy}>{copied ? 'Đã sao chép' : 'Sao chép lệnh chạy Pi'}</button><p className="rsu-hint">Mở phiên trên web chưa tự khởi chạy navigation trên Pi.</p></details>}
          </section>
          <section className="rsu-card rsu-step-card"><div className="rsu-card-title"><span>3</span><h3>Xác nhận vị trí</h3></div><p>Chọn nơi robot thực tế đang đứng và hướng robot đang quay.</p><label className="rsu-field">Điểm đỗ / vị trí đã lưu<select aria-label="Điểm khởi tạo đã lưu" value={endpointId} disabled={!canInitialize} onChange={event => { const point = points.find(value => value.endpointId === event.target.value); if (point) choosePoint(point); else { setSeed(null); setEndpointId(''); setConfirmed(false); } }}><option value="">Chọn vị trí</option>{points.map(point => <option key={point.endpointId} value={point.endpointId}>{point.endpointName}{point.endpointType === 'PARK' ? ' · Điểm đỗ' : ''}</option>)}</select></label><button className={`rsu-button ${choosing ? 'is-selected' : ''}`} disabled={!canInitialize} onClick={() => { setChoosing(value => !value); setConfirmed(false); setEditing(true); }}>{choosing ? 'Đang chọn trên bản đồ' : 'Đặt vị trí và hướng trên bản đồ'}</button>
            {seed && <p className="rsu-seed-summary">X {number(seed.xM)} m · Y {number(seed.yM)} m · Hướng {number(seed.yawRad * 180 / Math.PI)}°</p>}
            <label className="rsu-confirm"><input type="checkbox" aria-label="Robot đang đúng vị trí và hướng đã chọn" checked={confirmed} disabled={!canInitialize || !seed} onChange={event => setConfirmed(event.target.checked)} /><span>Robot đang đứng đúng vị trí và hướng đã chọn.</span></label>
            <button className="rsu-button rsu-primary" disabled={!canInitialize || !seed || !confirmed} onClick={() => act('seed', { seed, endpointId, confirmed })}>{busy === 'seed' ? 'Đang gửi vị trí…' : 'Xác nhận vị trí robot'}</button>
            <details className="rsu-details"><summary>Định vị nâng cao</summary><p>Yêu cầu robot tự tìm vị trí khi chưa biết chính xác điểm đang đứng.</p><button className="rsu-button" disabled={!canInitialize} onClick={() => act('global')}>{busy === 'global' ? 'Đang gửi yêu cầu…' : 'Tự tìm vị trí'}</button></details>
          </section>
        </>}
        <section className="rsu-card rsu-step-card"><div className="rsu-card-title"><span>{state.ready ? '✓' : '4'}</span><h3>Kiểm tra sẵn sàng</h3></div><ul className="rsu-checks">{state.checks.map(check => <li key={check.label} className={check.ok ? 'is-ok' : ''}><span aria-hidden="true">{check.ok ? '✓' : '○'}</span><div><strong>{check.label}</strong><small>{check.detail}</small></div></li>)}</ul>{live.profileError && <p className="rsu-hint">Chưa đọc được xác nhận cấu hình. Trang đang kiểm tra lại.</p>}{block && <p className="rsu-hint">{block}</p>}{state.ready && <Link className="rsu-button rsu-primary" to="/admin/live-operations">Theo dõi vận hành ↗</Link>}{snapshot?.activeJobId && <Link className="rsu-text-link" to="/admin/live-operations">Theo dõi nhiệm vụ đang chạy ↗</Link>}</section>
      </aside>
    </div>
    {state.open && <details className="rsu-card rsu-technical"><summary>Thông tin phiên và kết thúc vận hành</summary><dl><div><dt>Robot</dt><dd>{robotId}</dd></div><div><dt>Phiên vận hành</dt><dd>{session.sessionId}</dd></div><div><dt>Hết hạn</dt><dd>{expires(session.expiresAt)}</dd></div><div><dt>Trạng thái định vị</dt><dd>{session.state}{session.localization?.reason ? ` · ${session.localization.reason}` : ''}</dd></div></dl><button className="rsu-button rsu-danger" disabled={locked || !!block || !state.fresh} onClick={() => act('close')}>{busy === 'close' ? 'Đang đóng phiên…' : 'Đóng phiên vận hành'}</button><p className="rsu-hint">Đóng phiên khi kết thúc sử dụng hoặc trước khi đổi bản đồ. Robot phải hết nhiệm vụ và đã dừng di chuyển.</p></details>}
  </section>;
}
