import { useEffect, useState } from 'react';
import { request } from '../../../features/robotOperations/api.js';
import { loadSavedMap } from '../../../features/robotOperations/savedMap.js';
import { ErrorNotice } from './Shared.jsx';

export default function SavedMappingImage({ mapId }) {
  const [image, setImage] = useState(null), [error, setError] = useState(null), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let url;
    setImage(null); setError(null);
    loadSavedMap(mapId, request, controller.signal).then(({ metadata, blob }) => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob); setImage({ url, metadata });
    }).catch(e => { if (!controller.signal.aborted) setError(e); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [mapId, revision]);
  return <>
    <div className="ro-preview map">{image ? <div className="ro-map-frame"><img src={image.url} alt="Bản đồ robot vừa quét đã lưu trên máy chủ" onError={() => { setImage(null); setError(Error('Không đọc được ảnh bản đồ đã lưu.')); }} /></div> : <p>{error ? 'Không tải được bản đồ đã lưu.' : 'Đang tải bản đồ vừa lưu từ máy chủ…'}</p>}</div>
    <div className="ro-pose-status"><strong>Bản đồ đã lưu</strong><span>{image && `${image.metadata.width_px} × ${image.metadata.height_px} px · ${image.metadata.resolution_m_per_pixel} m/ô`}</span><small>Ảnh lưu trên máy chủ, vẫn xem được khi robot kết thúc quét. Vị trí trực tiếp đã dừng cập nhật.</small></div>
    <ErrorNotice error={error} />
    <div className="ro-actions"><button onClick={() => setRevision(v => v + 1)}>Tải lại bản đồ đã lưu</button>{image && <a href={image.url} download={`map-${mapId}.png`}>Tải bản đồ PNG</a>}</div>
  </>;
}
