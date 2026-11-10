import { rotationBounds, toView } from '../facility/mapPresentationView.js';

// A presentation is usable only with the exact navigation map it was drawn on.
export function matchingPresentation(published, metadata) {
  const source = published?.source, document = published?.document;
  if (!metadata?.asset_hash || source?.mapId !== metadata.map_id || source.assetHash !== metadata.asset_hash
    || document?.schemaVersion !== 1 || !Array.isArray(document.features)) return null;
  const rotation = document.rotationDegrees ?? 0;
  if (!Number.isFinite(rotation) || Math.abs(rotation) > 180) return null;
  const pairs = [[source.widthPx, metadata.width_px], [source.heightPx, metadata.height_px],
    [source.widthM, metadata.width_m], [source.heightM, metadata.height_m],
    [source.resolutionMPerPixel, metadata.resolution_m_per_pixel], [source.originXM, metadata.origin_x_m],
    [source.originYM, metadata.origin_y_m], [source.originYawRad, metadata.origin_yaw_rad]];
  if (source.frameId !== metadata.frame_id || pairs.some(([a, b]) => !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > 1e-8)
    || source.widthM <= 0 || source.heightM <= 0) return null;
  return published;
}

export function presentationViewport(published, zoom, pixelPosition) {
  const { source, document } = published, rotation = document.rotationDegrees ?? 0;
  const bounds = rotationBounds(source, rotation);
  const width = bounds.width / zoom, height = bounds.height / zoom;
  const center = pixelPosition ? toView({ x: pixelPosition.x * source.widthM / source.widthPx,
    y: source.heightM - pixelPosition.y * source.heightM / source.heightPx }, source, rotation)
    : { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  return { x: Math.max(bounds.x, Math.min(bounds.x + bounds.width - width, center.x - width / 2)),
    y: Math.max(bounds.y, Math.min(bounds.y + bounds.height - height, center.y - height / 2)), width, height };
}
