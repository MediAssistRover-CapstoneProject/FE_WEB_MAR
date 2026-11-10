import { insideMap } from '../facility/mapCoordinates.js';

const openStates = new Set(['WAITING_FOR_PI', 'LOCALIZING', 'READY']);
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const sameHash = (a, b) => typeof a === 'string' && typeof b === 'string' && /^[a-f0-9]{64}$/i.test(a) && a.toLowerCase() === b.toLowerCase();
export const openSetupSession = (session, now = Date.now()) => uuid.test(session?.sessionId || '') && openStates.has(session.state) && Date.parse(session.expiresAt) > now;
export const setupContext = snapshot => JSON.stringify([snapshot?.robot?.robotId, snapshot?.navigationSession?.sessionId, snapshot?.navigationSession?.mapId, snapshot?.navigationSession?.mapAssetHash, snapshot?.navigationSession?.initialization?.revision]);

export function setupLivePose(livePose, snapshot, asset, now = Date.now()) {
  const sample = livePose?.value, session = snapshot?.navigationSession, metadata = asset?.metadata;
  const elapsed = now - livePose?.receivedAt;
  const age = Date.parse(sample?.receivedAt) - Date.parse(sample?.capturedAt) + elapsed;
  const pose = sample?.pose;
  if (sample?.messageType !== 'NAVIGATION_POSE' || sample.robotId !== snapshot?.robot?.robotId
    || session?.state !== 'READY' || sample.navigationSessionId !== session.sessionId
    || sample.initializationRevision !== session.initialization?.revision
    || sample.mapId !== asset?.mapId || !sameHash(sample.mapAssetHash, metadata?.asset_hash)
    || !Number.isFinite(elapsed) || elapsed < 0 || !Number.isFinite(age) || age < -1000 || age > 1500
    || ![pose?.xM, pose?.yM, pose?.yawRad].every(Number.isFinite)
    || !insideMap(asset.geometry, pose.xM, pose.yM)) return null;
  return { ...pose, robotId: sample.robotId, mapId: sample.mapId, frameId: metadata.frame_id, capturedAt: sample.capturedAt };
}

export function setupReadiness({ snapshot, receivedAt, profile, profileContext, profileReceivedAt = receivedAt, profileError = '', livePose, map, asset, now = Date.now(), error = '', syncing = false, pending = null }) {
  const session = snapshot?.navigationSession;
  const age = now - receivedAt, observedAge = now - Date.parse(snapshot?.observedAt);
  const fresh = !!snapshot && !error && !syncing && age >= 0 && age <= 5000 && observedAge >= -1000 && observedAge <= 5000;
  const connected = fresh && snapshot.mqttConnected === true && snapshot.heartbeatFresh === true;
  const open = openSetupSession(session, now);
  const loaded = !!map && asset?.mapId === map.mapId && asset.loaded && sameHash(asset.metadata?.asset_hash, asset.metadata?.asset_hash);
  const matches = loaded && map.status === 'ACTIVE' && asset.metadata.navigation_reload_safe === true && open && session.mapId === map.mapId && session.robotId === snapshot.robot.robotId && sameHash(session.mapAssetHash, asset.metadata.asset_hash);
  const streamedPose = connected && matches ? setupLivePose(livePose, snapshot, asset, now) : null;
  const pose = streamedPose || snapshot?.latestPose, poseAge = now - Date.parse(pose?.capturedAt);
  const localized = connected && matches && session.state === 'READY' && session.initialization?.revision > 0 && snapshot.robot.currentMapId === map.mapId && sameHash(snapshot.robot.mapAssetHash, asset.metadata.asset_hash) && (!!streamedPose || pose?.fresh === true) && pose?.robotId === snapshot.robot.robotId && pose.mapId === map.mapId && pose.frameId === asset.metadata.frame_id && [pose.xM, pose.yM, pose.yawRad].every(Number.isFinite) && insideMap(asset.geometry || map, pose.xM, pose.yM) && (!!streamedPose || poseAge >= -1000 && poseAge <= 5000);
  const profileAge = now - profileReceivedAt;
  const acknowledged = fresh && matches && !profileError && profileAge >= 0 && profileAge <= 15000 && profileContext === setupContext(snapshot) && profile?.robotId === snapshot.robot.robotId && profile.mapId === map.mapId && profile.profileAcknowledged === true && sameHash(profile.profileHash, profile.acknowledgedProfileHash);
  const idle = fresh && snapshot.robot.status === 'IDLE' && !snapshot.activeJobId;
  const checks = [
    { label: 'Kết nối robot', ok: connected, detail: connected ? 'Đã nhận kết nối mới từ Pi' : !fresh ? 'UI chưa nhận trạng thái mới; đang kiểm tra lại kết nối' : !snapshot.mqttConnected ? 'Pi chưa kết nối MQTT' : 'Chưa nhận heartbeat mới từ Pi' },
    { label: 'Bản đồ của phiên', ok: matches && fresh, detail: matches ? 'Đúng bản đồ và phiên bản đã chọn' : loaded && map.status !== 'ACTIVE' ? 'Bản đồ chưa được kích hoạt' : open ? 'Phiên đang dùng bản đồ hoặc phiên bản khác' : 'Chưa mở phiên còn hiệu lực' },
    { label: 'Vị trí robot', ok: !!localized, detail: localized ? 'Đã xác minh vị trí và hướng mới' : session?.state === 'WAITING_FOR_PI' ? 'Có thể lưu vị trí trước; chờ Pi kết nối để xác minh' : 'Chờ robot xác minh vị trí trên bản đồ' },
    { label: 'Cấu hình dẫn đường', ok: !!acknowledged, detail: acknowledged ? 'Pi đã xác nhận cấu hình hiện tại' : profileError ? 'Chưa đọc được cấu hình; đang kiểm tra lại' : 'Chờ Pi xác nhận cấu hình điểm và vùng' },
    { label: 'Sẵn sàng nhận nhiệm vụ', ok: idle && snapshot.dispatchReady === true, detail: snapshot?.activeJobId ? 'Robot đang có nhiệm vụ; theo dõi tại Vận hành' : idle && snapshot.dispatchReady ? 'Robot đang rảnh và có thể nhận nhiệm vụ' : 'Chờ robot rảnh và sẵn sàng' },
  ];
  const ready = loaded && checks.every(check => check.ok) && !pending;
  const step = !loaded ? 0 : !matches || session.state === 'WAITING_FOR_PI' ? 1 : !localized ? 2 : 3;
  const title = pending ? 'Đang đối chiếu yêu cầu' : error ? 'Chưa nhận được trạng thái mới' : ready ? 'Sẵn sàng vận hành' : snapshot?.activeJobId ? 'Robot đang thực hiện nhiệm vụ' : !loaded ? 'Chọn robot và bản đồ' : !open ? 'Chưa mở phiên vận hành' : !matches ? 'Kiểm tra bản đồ của phiên' : session.state === 'WAITING_FOR_PI' ? 'Đang chờ Pi kết nối' : !localized ? 'Đang chờ xác minh vị trí' : 'Đang kiểm tra sẵn sàng';
  return { fresh, connected, open, loaded, matches, localized: !!localized, acknowledged: !!acknowledged, idle, checks, ready, step, title, pose: localized ? pose : null };
}

// Wake the form at a validity boundary, rather than rerendering it twice a second.
export function setupNextExpiry(live, now = Date.now()) {
  const times = [live.receivedAt + 5001, Date.parse(live.snapshot?.observedAt) + 5001, Date.parse(live.snapshot?.latestPose?.capturedAt) + 5001,
    Date.parse(live.snapshot?.observedAt) - 1000, live.profileReceivedAt + 15001,
    Date.parse(live.snapshot?.navigationSession?.expiresAt)].filter(time => Number.isFinite(time) && time > now);
  return times.length ? Math.min(...times) : null;
}

export function setupConnection(state, snapshot) {
  if (!state.fresh) return { web: 'Đang đồng bộ lại với máy chủ', robot: 'Đang chờ xác nhận kết nối robot', detail: 'Giữ thông tin cuối để tham khảo; chưa thể xác nhận trạng thái hiện tại.' };
  if (!snapshot.mqttConnected) return { web: 'Đã đồng bộ với máy chủ', robot: 'Robot mất kết nối MQTT', detail: snapshot.sessionFailureReason || 'Chờ Pi kết nối lại với máy chủ.' };
  if (!snapshot.heartbeatFresh) return { web: 'Đã đồng bộ với máy chủ', robot: 'Đang chờ heartbeat mới từ robot', detail: 'MQTT đã kết nối; robot chưa gửi heartbeat còn hiệu lực.' };
  return { web: 'Đã đồng bộ với máy chủ', robot: 'Robot đang kết nối', detail: 'Đã nhận heartbeat mới từ Pi.' };
}

export function setupWriteBlock(snapshot, receivedAt, now = Date.now()) {
  const age = now - receivedAt, observedAge = now - Date.parse(snapshot?.observedAt);
  if (!snapshot || age < 0 || age > 5000 || !Number.isFinite(observedAge) || observedAge < -1000 || observedAge > 5000) return 'Kiểm tra lại trạng thái robot trước khi thay đổi thiết lập.';
  if (snapshot.activeJobId || snapshot.robot?.status === 'BUSY') return 'Robot đang có nhiệm vụ hoặc đang di chuyển. Chờ kết thúc trước khi thay đổi thiết lập.';
  if (snapshot.robot?.status === 'MAINTENANCE') return 'Robot đang bảo trì. Kết thúc bảo trì trước khi mở phiên hoặc định vị lại.';
  return '';
}

export function setupSeed(endpoint, map) {
  if (!endpoint || endpoint.mapId !== map?.mapId || !endpoint.active || !endpoint.accessible || ![endpoint.xM, endpoint.yM, endpoint.yawRad].every(Number.isFinite) || Math.abs(endpoint.yawRad) > Math.PI || !insideMap(map, endpoint.xM, endpoint.yM)) throw Error('Điểm khởi tạo không còn hợp lệ trên bản đồ này. Chọn lại điểm.');
  return { xM: endpoint.xM, yM: endpoint.yM, yawRad: endpoint.yawRad };
}

export function setupPiCommand(session) {
  return uuid.test(session?.sessionId || '') ? `cd /home/ubuntu/mediassist-mqtt-2026-10-08\nzsh tools/navigation_session.zsh --session-id ${session.sessionId}` : '';
}

// A read after a lost response must prove that the operation was processed.
// An unchanged revision is not proof that an initialization failed.
export function setupPendingResolved(pending, snapshot) {
  if (!pending || snapshot?.robot?.robotId !== pending.robotId) return false;
  const session = snapshot.navigationSession;
  if (pending.kind === 'open') return openSetupSession(session) && session.mapId === pending.mapId && sameHash(session.mapAssetHash, pending.assetHash)
    && (!pending.previousSessionId || session.sessionId !== pending.previousSessionId);
  if (session?.sessionId !== pending.sessionId) return !!session?.state;
  if (pending.kind === 'close') return ['CLOSED', 'EXPIRED', 'NONE'].includes(session.state);
  return session.initialization?.revision > pending.revision || ['CLOSED', 'EXPIRED'].includes(session.state);
}
