import { mapGeometry } from '../facility/mapCoordinates.js';
import { setupContext, setupLivePose } from '../robotOperations/robotSetup.js';

// Image coordinates refer to cell centres. SVG coordinates refer to cell edges.
export function imagePoint(point, metadata) {
  if (!point || !metadata || ![point.xM, point.yM].every(Number.isFinite)) return null;
  const matrix = metadata.pixel_center_to_map;
  if (!Array.isArray(matrix) || matrix.length < 2) return null;
  const [[a, b, tx], [c, d, ty]] = matrix;
  const det = a * d - b * c;
  if (![a, b, c, d, tx, ty, det].every(Number.isFinite) || Math.abs(det) < 1e-12) return null;
  const dx = point.xM - tx, dy = point.yM - ty;
  const x = (d * dx - b * dy) / det + .5;
  const y = (-c * dx + a * dy) / det + .5;
  return x >= 0 && y >= 0 && x <= metadata.width_px && y <= metadata.height_px ? { x, y } : null;
}

export function freshMonitorPose(snapshot, now = Date.now()) {
  const pose = snapshot?.latestPose;
  const age = now - Date.parse(pose?.capturedAt);
  return snapshot?.mqttConnected && snapshot?.heartbeatFresh && pose?.fresh === true
    && Number.isFinite(pose.yawRad) && pose.frameId === 'map' && pose.mapId === snapshot.robot?.currentMapId
    && Number.isFinite(age) && age >= -1000 && age <= 5000 ? pose : null;
}

export function monitorPoseScope(snapshot, metadata, job) {
  return JSON.stringify([setupContext(snapshot), metadata?.map_id, metadata?.asset_hash, metadata?.frame_id, job?.jobId]);
}

export function monitorPoseView(memory, { snapshot, livePose, metadata, job, fresh, now = Date.now() }) {
  const scope = monitorPoseScope(snapshot, metadata, job);
  if (memory?.scope !== scope) memory = null;
  const session = snapshot?.navigationSession;
  const closed = ['NONE', 'CLOSED', 'EXPIRED'].includes(session?.state)
    || !!session?.expiresAt && !(Date.parse(session.expiresAt) > now);
  if (closed) return { memory: null, pose: null, live: false, ageMs: null };
  let live = null;
  if (fresh && snapshot?.mqttConnected && snapshot.heartbeatFresh && metadata?.map_id === snapshot.robot?.currentMapId
    && (!snapshot.navigationSession?.expiresAt || Date.parse(snapshot.navigationSession.expiresAt) > now)
    && snapshot.robot.mapAssetHash?.toLowerCase() === metadata.asset_hash?.toLowerCase()) {
    try { live = setupLivePose(livePose, snapshot, { mapId: metadata.map_id, metadata, geometry: mapGeometry(metadata) }, now); } catch { /* Await complete metadata. */ }
  }
  const sqlCandidate = fresh && (!session?.state || session.state === 'READY') ? freshMonitorPose(snapshot, now) : null;
  const sql = sqlCandidate && (!sqlCandidate.robotId || sqlCandidate.robotId === snapshot.robot?.robotId)
    && sqlCandidate.mapId === metadata?.map_id && sqlCandidate.frameId === metadata?.frame_id
    && (!snapshot.robot.mapAssetHash || snapshot.robot.mapAssetHash.toLowerCase() === metadata.asset_hash?.toLowerCase()) ? sqlCandidate : null;
  const candidate = live || sql;
  const pose = candidate && (!memory || Date.parse(candidate.capturedAt) >= Date.parse(memory.capturedAt)) ? candidate : null;
  if (pose && imagePoint(pose, metadata) && (!pose.jobId || !job || pose.jobId === job.jobId)) {
    memory = { scope, pose, capturedAt: pose.capturedAt };
    return { memory, pose, live: true, ageMs: Math.max(0, now - Date.parse(pose.capturedAt)) };
  }
  const ageMs = now - Date.parse(memory?.capturedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 60000) return { memory: null, pose: null, live: false, ageMs: null };
  return { memory, pose: memory.pose, live: false, ageMs };
}

export function matchingPlan(snapshot, metadata, job) {
  const plan = snapshot?.navigationPlan;
  return snapshot?.mqttConnected === true && snapshot?.heartbeatFresh === true && job?.status === 'RUNNING' && plan?.jobId === job.jobId
    && plan.jobId === snapshot.activeJobId && plan.jobStepId === snapshot.selectedJobStepId
    && plan.sessionId === snapshot.navigationSession?.sessionId
    && plan.mapId === metadata?.map_id && plan.mapAssetHash === metadata?.asset_hash
    && plan.frameId === 'map' && Array.isArray(plan.points) ? plan : null;
}
