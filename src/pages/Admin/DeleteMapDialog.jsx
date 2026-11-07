import { useEffect, useRef, useState } from 'react';
import { facilityApi } from '../../features/facility/facilityApi.js';

export default function DeleteMapDialog({ maps, onClose, onDeleted }) {
  const dialog = useRef(null), inFlight = useRef(false), alive = useRef(true);
  const [targets, setTargets] = useState(maps);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [errors, setErrors] = useState([]);
  const [progress, setProgress] = useState({ completed: 0, total: maps.length });
  const [deletedCount, setDeletedCount] = useState(0);
  const valid = reason.trim().length >= 5 && reason.trim().length <= 500;
  const multiple = targets.length > 1, activeCount = targets.filter(map => map.status === 'ACTIVE').length;

  useEffect(() => { alive.current = true; dialog.current?.showModal(); return () => { alive.current = false; }; }, []);

  function close() {
    if (inFlight.current) return;
    dialog.current?.close();
    onClose();
  }

  async function remove(event) {
    event.preventDefault();
    if (!valid || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setErrors([]);
    setProgress({ completed: 0, total: targets.length });
    const deleted = [], failed = [];
    for (const map of targets) {
      try {
        await facilityApi.deleteMap(map.mapId, reason.trim());
        deleted.push(map);
      } catch (e) {
        failed.push({ map, message: e.message });
      }
      if (!alive.current) return;
      setProgress({ completed: deleted.length + failed.length, total: targets.length });
    }
    if (!failed.length) dialog.current?.close();
    if (deleted.length) onDeleted(deleted);
    if (!failed.length) { onClose(); return; }
    setTargets(failed.map(item => item.map));
    setErrors(failed);
    setDeletedCount(count => count + deleted.length);
    inFlight.current = false;
    setBusy(false);
  }

  return <dialog ref={dialog} className="sml-delete-dialog" aria-labelledby="sml-delete-title" aria-describedby="sml-delete-description" onCancel={event => { event.preventDefault(); close(); }}>
    <form onSubmit={remove} aria-busy={busy}>
      <header><span className="sml-delete-icon" aria-hidden="true">!</span><div><h3 id="sml-delete-title">{multiple ? `Xóa ${targets.length} bản đồ?` : 'Xóa bản đồ?'}</h3><p>Kiểm tra bản đồ và nhập lý do trước khi xác nhận.</p></div></header>
      <div className="sml-delete-targets">{targets.map(map => <div className="sml-delete-target" key={map.mapId}><strong>{map.mapName}</strong><span>Phiên bản v{map.versionNo}</span></div>)}</div>
      <p id="sml-delete-description">Bản đồ sẽ được chuyển sang lưu trữ và ẩn khỏi danh sách sử dụng. Dữ liệu quét vẫn được giữ lại.</p>
      {activeCount > 0 && <p className="sml-delete-warning">{multiple ? `Có ${activeCount} bản đồ đang hoạt động. Xác nhận xóa sẽ ngừng sử dụng các bản đồ này.` : 'Bản đồ này đang hoạt động. Xác nhận xóa sẽ ngừng sử dụng bản đồ.'}</p>}
      <label className="sml-delete-field" htmlFor="sml-delete-reason">Lý do xóa <span>(bắt buộc)</span></label>
      <textarea id="sml-delete-reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="Ví dụ: Bản quét cũ, đã có bản đồ thay thế." required minLength={5} maxLength={500} rows={3} disabled={busy} aria-describedby="sml-delete-hint" autoFocus/>
      <small id="sml-delete-hint">Nhập từ 5 đến 500 ký tự. <span>{reason.length}/500</span></small>
      {deletedCount > 0 && <p className="sml-delete-progress" role="status">Đã xóa {deletedCount} bản đồ. Chỉ các bản đồ chưa xóa thành công còn trong danh sách xác nhận.</p>}
      {errors.length > 0 && <div className="sml-delete-error" role="alert"><strong>Không xóa được {errors.length} bản đồ:</strong><ul>{errors.map(({ map, message }) => <li key={map.mapId}><b>{map.mapName}</b>: {message}</li>)}</ul><span>Bạn có thể xác nhận để thử lại các bản đồ này.</span></div>}
      {busy && <p className="sml-delete-progress" role="status">Đang xử lý {progress.completed}/{progress.total} bản đồ…</p>}
      <footer><button type="button" className="ls-btn" disabled={busy} onClick={close}>{deletedCount ? 'Đóng' : 'Hủy'}</button><button type="submit" className="ls-btn sml-delete-confirm" disabled={busy || !valid}>{busy ? 'Đang xóa…' : multiple ? `Xác nhận xóa ${targets.length} bản đồ` : 'Xác nhận xóa'}</button></footer>
    </form>
  </dialog>;
}
