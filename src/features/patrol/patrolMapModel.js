import { insideMap } from '../facility/mapCoordinates.js';

// Convert the world-space SVG overlay (x, -y) into the floorplan's local SVG.
export function patrolPresentationMatrix(geometry) {
  const c = Math.cos(geometry.originYawRad), s = Math.sin(geometry.originYawRad);
  return [c, s, -s, c, -c * geometry.originXM - s * geometry.originYM, geometry.heightM - s * geometry.originXM + c * geometry.originYM];
}

// The raster, pose and robot must describe the same map; never invent a pose.
export function patrolMapPose(snapshot, metadata, geometry, now = Date.now()) {
  const pose = snapshot?.latestPose, robot = snapshot?.robot;
  if (!pose || !robot || !metadata || !geometry || robot.currentMapId !== metadata.map_id || pose.mapId !== metadata.map_id || pose.robotId !== robot.robotId) return null;
  if (!Number.isFinite(pose.yawRad) || !insideMap(geometry, pose.xM, pose.yM)) return null;
  if (pose.frameId !== (metadata.frame_id || 'map')) return null;
  if (metadata.asset_hash && robot.mapAssetHash && metadata.asset_hash.toLowerCase() !== robot.mapAssetHash.toLowerCase()) return null;
  const capturedAt = Date.parse(pose.capturedAt), observedAt = Date.parse(snapshot.observedAt);
  const live = pose.fresh === true && snapshot.mqttConnected === true && snapshot.heartbeatFresh === true && Number.isFinite(capturedAt) && Number.isFinite(observedAt) && now - capturedAt <= 15000 && now - observedAt <= 20000 && capturedAt <= now + 5000 && observedAt <= now + 5000;
  return { ...pose, live };
}
