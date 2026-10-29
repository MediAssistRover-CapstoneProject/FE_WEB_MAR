export async function loadSavedMap(mapId, request, signal) {
  const path = `/api/v1/maps/${encodeURIComponent(mapId)}`;
  const [metadata, response] = await Promise.all([
    request(`${path}/image-metadata`, { signal }),
    request(`${path}/image.png`, { signal, responseType: 'response' }),
  ]);
  if (metadata?.map_id !== mapId || ![metadata.width_px, metadata.height_px, metadata.resolution_m_per_pixel].every(v => Number.isFinite(v) && v > 0)) throw Error('Thông tin bản đồ đã lưu chưa hợp lệ.');
  if (response.status !== 200 || response.headers.get('Content-Type')?.split(';')[0] !== 'image/png') throw Error('Máy chủ chưa trả về ảnh bản đồ PNG đã lưu.');
  return { metadata, blob: await response.blob() };
}
