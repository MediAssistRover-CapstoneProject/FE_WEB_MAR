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

export function matchingPlan(snapshot, metadata, job) {
  const plan = snapshot?.navigationPlan;
  return snapshot?.mqttConnected === true && snapshot?.heartbeatFresh === true && job?.status === 'RUNNING' && plan?.jobId === job.jobId
    && plan.jobId === snapshot.activeJobId && plan.jobStepId === snapshot.selectedJobStepId
    && plan.sessionId === snapshot.navigationSession?.sessionId
    && plan.mapId === metadata?.map_id && plan.mapAssetHash === metadata?.asset_hash
    && plan.frameId === 'map' && Array.isArray(plan.points) ? plan : null;
}
