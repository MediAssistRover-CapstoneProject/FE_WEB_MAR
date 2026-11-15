import { useEffect, useState } from 'react';
import { matchingPresentation } from '../operations/monitorPresentation.js';
import { request } from './api.js';

// Display drawings are separate from the navigation image and never change
// the asset hash, readiness checks or coordinates sent to the robot.
export function useSetupMapPresentation(asset) {
  const [state, setState] = useState({ mapId: '', value: null, status: 'loading' });
  const mapId = asset?.mapId, imageUrl = asset?.url;
  useEffect(() => {
    if (!mapId || !imageUrl) return;
    const controller = new AbortController();
    let timer, sequence = 0;
    setState(previous => ({ mapId, value: previous.mapId === mapId ? previous.value : null, status: 'loading' }));
    const load = async () => {
      clearTimeout(timer);
      const current = ++sequence;
      try {
        const value = await request(`/api/v1/maps/${encodeURIComponent(mapId)}/presentation/published`, { signal: controller.signal });
        if (!controller.signal.aborted && current === sequence) setState({ mapId, value, status: 'ready' });
      } catch (error) {
        if (!controller.signal.aborted && current === sequence) setState(previous => ({ mapId,
          value: [404, 409].includes(error.status) ? null : previous.mapId === mapId ? previous.value : null,
          status: error.status === 404 ? 'missing' : error.status === 409 ? 'outdated' : 'error' }));
      } finally {
        if (!controller.signal.aborted && current === sequence) timer = setTimeout(load, 60000);
      }
    };
    load();
    const onFocus = () => { if (!controller.signal.aborted) load(); };
    window.addEventListener('focus', onFocus);
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener('focus', onFocus); };
  }, [mapId, imageUrl]);

  const metadata = asset && { ...asset.metadata,
    width_m: asset.metadata.width_m ?? asset.geometry.widthM,
    height_m: asset.metadata.height_m ?? asset.geometry.heightM };
  const presentation = matchingPresentation(state.mapId === mapId ? state.value : null, metadata);
  const presentationNotice = presentation
    ? state.status === 'error' ? 'Chưa cập nhật được bản chỉnh sửa. Đang giữ bản đã tải trước đó.' : 'Đang hiển thị bản đồ đã chỉnh sửa và áp dụng.'
    : state.status === 'loading' ? 'Đang kiểm tra bản đồ đã chỉnh sửa…'
      : state.status === 'missing' ? 'Chưa có bản chỉnh sửa đã áp dụng. Đang hiển thị bản đồ quét gốc.'
        : state.status === 'error' ? 'Chưa tải được bản chỉnh sửa. Đang hiển thị bản đồ quét gốc.'
          : 'Bản chỉnh sửa không khớp phiên bản bản đồ này. Đang hiển thị bản đồ quét gốc.';
  return { presentation, presentationNotice };
}
