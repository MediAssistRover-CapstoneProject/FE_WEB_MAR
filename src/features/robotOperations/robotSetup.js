import { insideMap } from '../facility/mapCoordinates.js';

const openStates = new Set(['WAITING_FOR_PI', 'LOCALIZING', 'READY']);
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const sameHash = (a, b) => typeof a === 'string' && typeof b === 'string' && /^[a-f0-9]{64}$/i.test(a) && a.toLowerCase() === b.toLowerCase();
export const openSetupSession = (session, now = Date.now()) => uuid.test(session?.sessionId || '') && openStates.has(session.state) && Date.parse(session.expiresAt) > now;
export const setupContext = snapshot => JSON.stringify([snapshot?.robot?.robotId, snapshot?.navigationSession?.sessionId, snapshot?.navigationSession?.mapId, snapshot?.navigationSession?.mapAssetHash, snapshot?.navigationSession?.initialization?.revision]);

export function setupReadiness({ snapshot, receivedAt, profile, profileContext, map, asset, now = Date.now(), error = '', pending = null }) {
  const session = snapshot?.navigationSession;
  const age = now - receivedAt, observedAge = now - Date.parse(snapshot?.observedAt);
  const fresh = !!snapshot && !error && age >= 0 && age <= 5000 && observedAge >= -1000 && observedAge <= 5000;
  const connected = fresh && snapshot.mqttConnected === true && snapshot.heartbeatFresh === true;
  const open = openSetupSession(session, now);
  const loaded = !!map && asset?.mapId === map.mapId && asset.loaded && sameHash(asset.metadata?.asset_hash, asset.metadata?.asset_hash);
  const matches = loaded && map.status === 'ACTIVE' && asset.metadata.navigation_reload_safe === true && open && session.mapId === map.mapId && session.robotId === snapshot.robot.robotId && sameHash(session.mapAssetHash, asset.metadata.asset_hash);
  const pose = snapshot?.latestPose, poseAge = now - Date.parse(pose?.capturedAt);
  const localized = connected && matches && session.state === 'READY' && session.initialization?.revision > 0 && snapshot.robot.currentMapId === map.mapId && sameHash(snapshot.robot.mapAssetHash, asset.metadata.asset_hash) && pose?.fresh === true && pose.robotId === snapshot.robot.robotId && pose.mapId === map.mapId && pose.frameId === asset.metadata.frame_id && [pose.xM, pose.yM, pose.yawRad].every(Number.isFinite) && insideMap(asset.geometry || map, pose.xM, pose.yM) && poseAge >= -1000 && poseAge <= 2500;
  const acknowledged = fresh && matches && profileContext === setupContext(snapshot) && profile?.robotId === snapshot.robot.robotId && profile.mapId === map.mapId && profile.profileAcknowledged === true && sameHash(profile.profileHash, profile.acknowledgedProfileHash);
  const idle = fresh && snapshot.robot.status === 'IDLE' && !snapshot.activeJobId;
  const checks = [
    { label: 'Kết nối robot', ok: connected, detail: connected ? 'Đã nhận kết nối mới từ Pi' : 'Chờ kết nối và phản hồi mới từ Pi' },
    { label: 'Bản đồ của phiên', ok: matches && fresh, detail: matches ? 'Đúng bản đồ và phiên bản đã chọn' : loaded && map.status !== 'ACTIVE' ? 'Bản đồ chưa được kích hoạt' : open ? 'Phiên đang dùng bản đồ hoặc phiên bản khác' : 'Chưa mở phiên còn hiệu lực' },
    { label: 'Vị trí robot', ok: !!localized, detail: localized ? 'Đã xác minh vị trí và hướng mới' : 'Chờ robot xác minh vị trí trên bản đồ' },
    { label: 'Cấu hình dẫn đường', ok: !!acknowledged, detail: acknowledged ? 'Pi đã xác nhận cấu hình hiện tại' : 'Chờ Pi xác nhận cấu hình điểm và vùng' },
    { label: 'Sẵn sàng nhận nhiệm vụ', ok: idle && snapshot.dispatchReady === true, detail: snapshot?.activeJobId ? 'Robot đang có nhiệm vụ; theo dõi tại Vận hành' : idle && snapshot.dispatchReady ? 'Robot đang rảnh và có thể nhận nhiệm vụ' : 'Chờ robot rảnh và sẵn sàng' },
  ];
  const ready = loaded && checks.every(check => check.ok) && !pending;
  const step = !loaded ? 0 : !matches || session.state === 'WAITING_FOR_PI' ? 1 : !localized ? 2 : 3;
  const title = pending ? 'Đang đối chiếu yêu cầu' : error ? 'Chưa nhận được trạng thái mới' : ready ? 'Sẵn sàng vận hành' : snapshot?.activeJobId ? 'Robot đang thực hiện nhiệm vụ' : !loaded ? 'Chọn robot và bản đồ' : !open ? 'Chưa mở phiên vận hành' : !matches ? 'Kiểm tra bản đồ của phiên' : session.state === 'WAITING_FOR_PI' ? 'Đang chờ Pi kết nối' : !localized ? 'Đang chờ xác minh vị trí' : 'Đang kiểm tra sẵn sàng';
  return { fresh, connected, open, loaded, matches, localized: !!localized, acknowledged: !!acknowledged, idle, checks, ready, step, title, pose: localized ? pose : null };
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
  if (pending.kind === 'open') return openSetupSession(session) && session.mapId === pending.mapId && sameHash(session.mapAssetHash, pending.assetHash);
  if (session?.sessionId !== pending.sessionId) return !!session?.state;
  if (pending.kind === 'close') return ['CLOSED', 'EXPIRED', 'NONE'].includes(session.state);
  return session.initialization?.revision > pending.revision || ['CLOSED', 'EXPIRED'].includes(session.state);
}
