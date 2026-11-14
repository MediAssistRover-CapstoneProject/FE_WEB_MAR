import { useEffect, useRef, useState } from 'react';
import { facilityApi } from '../../features/facility/facilityApi.js';

export default function DeleteMapDialog({ maps, onClose, onDeleted }) {
  const dialog = useRef(null), inFlight = useRef(false), alive = useRef(true);
  const [targets, setTargets] = useState(maps);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [errors, setErrors] = useState([]);
  const [progress, setProgress] = useState({ completed: 0, total: maps.length });
  const [deletedCount, setDeletedCount] = useState(0);
  const [impacts, setImpacts] = useState({}), [checking, setChecking] = useState(true), [checkError, setCheckError] = useState(''), [checkRevision, setCheckRevision] = useState(0);
  const valid = reason.trim().length >= 5 && reason.trim().length <= 500;
  const multiple = targets.length > 1, activeCount = targets.filter(map => map.status === 'ACTIVE').length;

  useEffect(() => { alive.current = true; dialog.current?.showModal(); return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setChecking(true); setCheckError(''); setImpacts({});
    Promise.all(targets.map(async map => {
      const impact = await facilityApi.getMapDeletionImpact(map.mapId, { signal: controller.signal });
      if (impact?.resourceId !== map.mapId || typeof impact.canHardDelete !== 'boolean' || !Array.isArray(impact.blockers) || !impact.dependencies) throw Error('Chưa xác nhận được dữ liệu sẽ xóa.');
      return [map.mapId, impact];
    })).then(rows => { if (!controller.signal.aborted) setImpacts(Object.fromEntries(rows)); })
      .catch(error => { if (!controller.signal.aborted) setCheckError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [targets, checkRevision]);
  const blocked = targets.some(map => !impacts[map.mapId]?.canHardDelete);

  function close() {
    if (inFlight.current) return;
    dialog.current?.close();
    onClose();
  }

  async function remove(event) {
    event.preventDefault();
    if (!valid || checking || checkError || blocked || inFlight.current) return;
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
      <div className="sml-delete-targets">{targets.map(map => <div className="sml-delete-target" key={map.mapId}><strong>{map.mapName}</strong><span>Phiên bản v{map.versionNo}</span>{impacts[map.mapId] && <><small>{impacts[map.mapId].dependencies.Endpoint || 0} endpoint · {impacts[map.mapId].dependencies.Room || 0} phòng sẽ xóa · {impacts[map.mapId].dependencies.Zone || 0} vùng</small>{impacts[map.mapId].dependencies.sharedRooms > 0 && <small>Giữ {impacts[map.mapId].dependencies.sharedRooms} phòng dùng chung với bản đồ khác.</small>}{!impacts[map.mapId].canHardDelete && <ul className="sml-delete-blockers">{impacts[map.mapId].blockers.map(message => <li key={message}>{message}</li>)}</ul>}</>}</div>)}</div>
      <p id="sml-delete-description">Xóa vĩnh viễn bản đồ, endpoint, các phòng chỉ thuộc bản đồ này, vùng, nhóm điểm, bản vẽ, dữ liệu quét, lịch sử vị trí và dữ liệu giám sát thuộc bản đồ trong database. Phòng dùng chung với bản đồ khác được giữ lại. Thao tác không thể hoàn tác.</p>
      {checking && <p role="status">Đang kiểm tra dữ liệu liên quan…</p>}
      {checkError && <div className="sml-delete-error" role="alert"><p>Chưa kiểm tra được dữ liệu sẽ xóa: {checkError}</p><button type="button" className="ls-btn" disabled={busy} onClick={() => setCheckRevision(value => value + 1)}>Kiểm tra lại</button></div>}
      {!checking && !checkError && blocked && <p className="sml-delete-warning" role="alert">Chưa thể xóa. Hãy xử lý các ràng buộc được liệt kê rồi kiểm tra lại.</p>}
      {!checking && !checkError && blocked && <button type="button" className="ls-btn" disabled={busy} onClick={() => setCheckRevision(value => value + 1)}>Kiểm tra lại</button>}
      {activeCount > 0 && <p className="sml-delete-warning">{multiple ? `Có ${activeCount} bản đồ đang hoạt động. Xác nhận xóa sẽ ngừng sử dụng các bản đồ này.` : 'Bản đồ này đang hoạt động. Xác nhận xóa sẽ ngừng sử dụng bản đồ.'}</p>}
      <label className="sml-delete-field" htmlFor="sml-delete-reason">Lý do xóa <span>(bắt buộc)</span></label>
      <textarea id="sml-delete-reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="Ví dụ: Bản quét cũ, đã có bản đồ thay thế." required minLength={5} maxLength={500} rows={3} disabled={busy} aria-describedby="sml-delete-hint" autoFocus/>
      <small id="sml-delete-hint">Nhập từ 5 đến 500 ký tự. <span>{reason.length}/500</span></small>
      {deletedCount > 0 && <p className="sml-delete-progress" role="status">Đã xóa {deletedCount} bản đồ. Chỉ các bản đồ chưa xóa thành công còn trong danh sách xác nhận.</p>}
      {errors.length > 0 && <div className="sml-delete-error" role="alert"><strong>Không xóa được {errors.length} bản đồ:</strong><ul>{errors.map(({ map, message }) => <li key={map.mapId}><b>{map.mapName}</b>: {message}</li>)}</ul><span>Bạn có thể xác nhận để thử lại các bản đồ này.</span></div>}
      {busy && <p className="sml-delete-progress" role="status">Đang xử lý {progress.completed}/{progress.total} bản đồ…</p>}
      <footer><button type="button" className="ls-btn" disabled={busy} onClick={close}>{deletedCount ? 'Đóng' : 'Hủy'}</button><button type="submit" className="ls-btn sml-delete-confirm" disabled={busy || !valid || checking || !!checkError || blocked}>{busy ? 'Đang xóa…' : multiple ? `Xác nhận xóa ${targets.length} bản đồ` : 'Xác nhận xóa'}</button></footer>
    </form>
  </dialog>;
}
