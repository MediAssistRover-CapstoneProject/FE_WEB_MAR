import { cloneElement, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { allFacilityPages, facilityApi as api } from '../../../features/facility/facilityApi.js';
import { getSession } from '../../../features/auth/session.js';
import { ROOM_TYPES, isSosRoom, roomTypePatch } from '../../../features/facility/roomDefaults.js';
import { ENDPOINT_CATEGORIES } from '../../../features/facility/facilityContract.js';
import { saveValidatedEndpoint } from '../../../features/facility/navigationPoint.js';
import { endpointRoomPayload, newRoomForm, roomForm, roomPayload, roomTypeLabel } from '../../../features/facility/roomEditing.js';
import FacilityGeometryPreview from '../FacilityGeometryPreview.jsx';
import EndpointFields, { EndpointLifecycle } from '../EndpointFields.jsx';
import RoomTypeSelect from './RoomTypeSelect.jsx';
import RoomDepartmentSelect from './RoomDepartmentSelect.jsx';
import RoomSosNotice from './RoomSosNotice.jsx';
import './roomsWorkspace.css';

const emptyCatalog = { rooms: [], endpoints: [], maps: [], floors: [], groups: [], zones: [] };
const labelType = value => roomTypeLabel(value, ROOM_TYPES);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const mapState = { ACTIVE: 'Đang hoạt động', DRAFT: 'Nháp', INACTIVE: 'Chưa kích hoạt', ARCHIVED: 'Lưu trữ' };

function Field({ label, children, wide = false }) {
  return <label className={`rw-field${wide ? ' rw-wide' : ''}`}><span>{label}</span>{cloneElement(children, { 'aria-label': label })}</label>;
}

export default function RoomsWorkspace({ onCountChange, onDirtyChange, onBusyChange, refreshKey = 0 }) {
  const canEdit = getSession()?.account?.role === 'ADMIN';
  const [catalog, setCatalog] = useState(emptyCatalog);
  const [selectedId, setSelectedId] = useState(''), [mapId, setMapId] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  const [loadError, setLoadError] = useState(''), [feedback, setFeedback] = useState(null);
  const [search, setSearch] = useState(''), [floorFilter, setFloorFilter] = useState(''), [typeFilter, setTypeFilter] = useState(''), [stateFilter, setStateFilter] = useState('');
  const [form, setForm] = useState(null), [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false), [catalogStale, setCatalogStale] = useState(false);
  const [pointId, setPointId] = useState(''), [pointForm, setPointForm] = useState(null), [drawing, setDrawing] = useState(false);
  const [linkMode, setLinkMode] = useState(''), [targetId, setTargetId] = useState('');
  const writeLock = useRef(false), mounted = useRef(true);
  const { rooms, maps, floors, endpoints, groups, zones } = catalog;
  const room = rooms.find(room => room.roomId === selectedId);
  const map = maps.find(map => map.mapId === mapId && map.floorId === room?.floorId);
  const roomMaps = maps.filter(map => map.floorId === room?.floorId);
  const linked = endpoints.filter(point => point.roomId === selectedId && point.mapId === mapId);
  const point = linked.find(point => point.endpointId === pointId);
  const roomDirty = creating || !!room && !!form && !same(form, roomForm(room));
  const pointDirty = !!point && !!pointForm && !same(pointForm, point);
  const dirty = roomDirty || pointDirty || !!targetId;
  const locked = busy || loading || catalogStale || !canEdit;
  const pointLocked = locked || map?.status === 'ARCHIVED';
  const roomFloor = floors.find(floor => floor.floorId === room?.floorId);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onDirtyChange?.(dirty || busy); }, [dirty, busy, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  useEffect(() => {
    if (!loading && !loadError) onCountChange?.({ total: rooms.length, active: rooms.filter(room => room.active).length });
  }, [rooms, loading, loadError, onCountChange]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    const guardLink = event => {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || anchor.target === '_blank') return;
      if (busy || !window.confirm('Bạn có thay đổi chưa lưu. Bỏ thay đổi và rời trang?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', guardLink, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', guardLink, true); };
  }, [dirty, busy]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError(''); setFeedback(null);
    const load = resource => allFacilityPages(params => api[resource]({ ...params, ...(canEdit ? { includeDeleted: true } : {}) }, { signal: controller.signal }));
    Promise.all(['listRooms', 'listEndpoints', 'listMaps', 'listFloors', 'listEndpointGroups', 'listZones'].map(load))
      .then(([rooms, endpoints, maps, floors, groups, zones]) => {
        if (controller.signal.aborted) return;
        setCatalog({ rooms, endpoints, maps, floors, groups, zones });
        setCreating(false); setCatalogStale(false);
        setSelectedId(current => rooms.some(room => room.roomId === current) ? current : rooms[0]?.roomId || '');
        setEditing(false); setLinkMode(''); setTargetId(''); setPointForm(null);
      })
      .catch(error => { if (!controller.signal.aborted) setLoadError(error.message || 'Không tải được danh mục phòng.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload, refreshKey, canEdit]);

  useEffect(() => { if (!creating) setForm(room ? roomForm(room) : null); }, [room, creating]);
  useEffect(() => {
    const available = maps.filter(map => map.floorId === room?.floorId);
    setMapId(current => available.some(map => map.mapId === current) ? current : available.find(map => map.status === 'ACTIVE')?.mapId || available[0]?.mapId || '');
    setPointId(''); setPointForm(null); setDrawing(false); setLinkMode(''); setTargetId('');
  }, [selectedId, room?.floorId, maps]);
  useEffect(() => {
    const points = endpoints.filter(point => point.roomId === selectedId && point.mapId === mapId);
    setPointId(current => points.some(point => point.endpointId === current) ? current : points[0]?.endpointId || '');
  }, [endpoints, selectedId, mapId]);

  const confirmLeave = () => !busy && (!dirty || window.confirm('Bạn có thay đổi chưa lưu. Bỏ thay đổi và tiếp tục?'));
  const resetPoint = () => { setPointForm(null); setDrawing(false); setLinkMode(''); setTargetId(''); };
  const chooseRoom = id => {
    if ((!creating && id === selectedId) || !confirmLeave()) return;
    setCreating(false); setSelectedId(id); setEditing(false); resetPoint(); setFeedback(null);
  };
  const startCreate = () => {
    if (locked || !confirmLeave()) return;
    setForm(newRoomForm(rooms, floors.find(floor => floor.floorId === floorFilter && floor.active)?.floorId || floors.find(floor => floor.active)?.floorId || ''));
    setCreating(true); setEditing(true); resetPoint(); setFeedback(null);
  };
  const refresh = () => { if (confirmLeave()) setReload(value => value + 1); };
  const updateRoom = value => {
    setCatalog(current => ({ ...current, rooms: current.rooms.some(room => room.roomId === value.roomId)
      ? current.rooms.map(room => room.roomId === value.roomId ? value : room) : [...current.rooms, value] }));
  };
  const updatePoint = value => {
    setCatalog(current => ({ ...current, endpoints: current.endpoints.map(point => point.endpointId === value.endpointId ? value : point) }));
    window.dispatchEvent(new Event('mediassist-facility-updated'));
  };
  const write = async action => {
    if (writeLock.current || !canEdit) return;
    writeLock.current = true; setBusy(true); setFeedback(null);
    try { await action(); }
    catch (error) { if (mounted.current) setFeedback({ error: true, text: `Chưa lưu được${error.status ? ` (HTTP ${error.status})` : ''}: ${error.message}` }); }
    finally { writeLock.current = false; if (mounted.current) setBusy(false); }
  };
  const saveRoom = event => {
    event.preventDefault();
    if (locked) return;
    write(async () => {
      const body = roomPayload(form, creating ? null : room.roomId, rooms, groups, maps);
      const affectsSos = isSosRoom(body.roomType) || (!creating && isSosRoom(room.roomType));
      const result = await (creating ? api.createRoom(body) : api.updateRoom(room.roomId, body));
      if (!result?.roomId || (!creating && result.roomId !== room.roomId)) {
        setCreating(false); setEditing(false); setCatalogStale(true);
        setFeedback({ error: true, text: 'Chưa xác nhận được kết quả lưu phòng. Tải lại danh mục để kiểm tra trước khi gửi yêu cầu khác.' });
        return;
      }
      if (!mounted.current) return;
      updateRoom(result); setCreating(false); setSelectedId(result.roomId); setForm(roomForm(result)); setEditing(false);
      setSearch(''); setFloorFilter(''); setTypeFilter(''); setStateFilter(''); resetPoint();
      window.dispatchEvent(new Event('mediassist-facility-updated'));
      if (affectsSos) {
        try {
          const [rooms, endpoints] = await Promise.all(['listRooms', 'listEndpoints'].map(resource => allFacilityPages(params => api[resource]({ ...params, includeDeleted: true }))));
          if (!mounted.current) return;
          setCatalog(current => ({ ...current, rooms, endpoints }));
        } catch (error) {
          if (mounted.current) { setCatalogStale(true); setFeedback({ error: true, text: `Đã lưu, chưa tải lại được dữ liệu: ${error.message}. Bấm Tải lại phòng để kiểm tra trước khi chỉnh sửa tiếp.` }); }
          return;
        }
      }
      setFeedback({ text: 'Đã lưu thông tin phòng. Nếu cần cập nhật nhãn trên bản đồ đã xuất bản, mở Map Studio và áp dụng bản vẽ.' });
    });
  };
  const savePoint = event => {
    event.preventDefault();
    write(async () => {
      const result = await saveValidatedEndpoint(api, pointForm, map, zones, rooms);
      if (result?.endpointId !== point.endpointId || result.mapId !== mapId || result.roomId !== selectedId) throw Error('Máy chủ chưa xác nhận đúng điểm của phòng. Hãy tải lại để kiểm tra.');
      if (!mounted.current) return;
      updatePoint(result); resetPoint(); setFeedback({ text: 'Đã lưu điểm đến của phòng.' });
    });
  };
  const togglePointActive = () => {
    if (!point || pointDirty || pointLocked) return;
    const target = point, active = !point.active;
    write(async () => {
      const result = await (active ? api.activateEndpoint(target.endpointId) : api.deactivateEndpoint(target.endpointId));
      if (result?.endpointId !== target.endpointId || result.mapId !== target.mapId || result.roomId !== selectedId || result.active !== active) {
        throw Error('Máy chủ chưa xác nhận trạng thái của đúng điểm đích. Hãy tải lại để kiểm tra.');
      }
      if (!mounted.current) return;
      updatePoint(result); setPointForm({ ...result }); setDrawing(false);
      setFeedback({ text: active ? 'Đã kích hoạt lại điểm đích.' : 'Đã ngừng sử dụng điểm đích.' });
    });
  };
  const startLink = mode => {
    if (pointDirty && !window.confirm('Bỏ thay đổi chưa lưu của điểm để đổi liên kết?')) return;
    resetPoint(); setLinkMode(mode); setFeedback(null);
  };
  const saveLink = event => {
    event.preventDefault();
    write(async () => {
      const target = endpoints.find(point => point.endpointId === targetId);
      if (!target || target.mapId !== mapId || target.roomId || !target.active || !target.accessible) throw Error('Chọn điểm đang hoạt động, có thể tiếp cận và chưa thuộc phòng khác trên đúng bản đồ.');
      const result = await saveValidatedEndpoint(api, { ...target, roomId: selectedId }, map, zones, rooms);
      if (result?.endpointId !== targetId || result.mapId !== mapId || result.roomId !== selectedId) throw Error('Chưa xác nhận được liên kết điểm. Tải lại để kiểm tra trước khi thử tiếp.');
      updatePoint(result);
      if (linkMode === 'replace' && point) {
        try {
          const detached = await api.updateEndpoint(point.endpointId, endpointRoomPayload(point, null));
          if (detached?.endpointId !== point.endpointId || detached.mapId !== mapId || detached.roomId) throw Error('Chưa xác nhận được việc bỏ liên kết điểm cũ.');
          updatePoint(detached);
        } catch (error) {
          if (!mounted.current) return;
          resetPoint(); setPointId(targetId);
          setFeedback({ error: true, text: `Đã gắn điểm “${target.endpointName}”, nhưng chưa xác nhận bỏ điểm cũ: ${error.message} Phòng có thể đang gắn cả hai điểm; tải lại để kiểm tra.` });
          return;
        }
      }
      if (!mounted.current) return;
      resetPoint(); setPointId(result.endpointId); setFeedback({ text: 'Đã cập nhật liên kết điểm đến.' });
    });
  };
  const detachPoint = () => {
    if (!point || !window.confirm(`Bỏ liên kết “${point.endpointName}” khỏi phòng? Điểm vẫn được giữ trên bản đồ.`)) return;
    write(async () => {
      const result = await api.updateEndpoint(point.endpointId, endpointRoomPayload(point, null));
      if (result?.endpointId !== point.endpointId || result.mapId !== mapId || result.roomId) throw Error('Máy chủ chưa xác nhận bỏ liên kết. Tải lại để kiểm tra.');
      if (!mounted.current) return;
      updatePoint(result); resetPoint(); setFeedback({ text: 'Đã bỏ liên kết. Điểm vẫn được giữ trên bản đồ.' });
    });
  };

  const filtered = rooms.filter(room => {
    const matches = !search || [room.roomName, room.roomCode, room.roomType, labelType(room.roomType), room.departmentCode,
      ...endpoints.filter(point => point.roomId === room.roomId).map(point => point.endpointName)].join(' ').toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'));
    return matches && (!floorFilter || room.floorId === floorFilter) && (!typeFilter || room.roomType === typeFilter)
      && (!stateFilter || (stateFilter === 'active' ? room.active : stateFilter === 'inactive' ? !room.active : stateFilter === 'private' ? !room.publicVisible : !endpoints.some(point => point.roomId === room.roomId)));
  });
  const changeFilter = (setter, value) => {
    if (!confirmLeave()) return;
    if (roomDirty) setForm(room ? roomForm(room) : null);
    setCreating(false);
    setEditing(false); resetPoint(); setter(value);
  };
  const set = (key, value) => setForm(current => ({ ...current, ...(key === 'roomType'
    ? roomTypePatch(current, value, rooms, { roomId: creating ? null : room?.roomId }) : { [key]: value }) }));

  return <div className="rw-workspace">
    <div className="lo-filters rw-filters">
      <label className="lo-search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><input aria-label="Tìm kiếm phòng" placeholder="Tìm tên phòng, mã phòng, khoa hoặc tên điểm…" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <select aria-label="Lọc tầng" value={floorFilter} disabled={busy} onChange={event => changeFilter(setFloorFilter, event.target.value)}><option value="">Tất cả tầng</option>{floors.map(floor => <option key={floor.floorId} value={floor.floorId}>{floor.floorName}</option>)}</select>
      <select aria-label="Lọc loại phòng" value={typeFilter} disabled={busy} onChange={event => changeFilter(setTypeFilter, event.target.value)}><option value="">Tất cả loại phòng</option>{[...new Set(rooms.map(room => room.roomType))].map(type => <option key={type} value={type}>{labelType(type)}</option>)}</select>
      <select aria-label="Lọc trạng thái phòng" value={stateFilter} disabled={busy} onChange={event => changeFilter(setStateFilter, event.target.value)}><option value="">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option><option value="private">Chỉ dùng nội bộ</option><option value="unlinked">Chưa có điểm</option></select>
      <button type="button" className="lo-button" disabled={busy || loading} onClick={refresh}>Tải lại phòng</button>
      {canEdit && <button type="button" className="lo-button lo-primary" disabled={locked} onClick={startCreate}>Thêm phòng</button>}
    </div>
    {loadError && <div className="lo-notice lo-notice-error rw-feedback" role="alert"><p>Không tải được danh mục: {loadError}</p><button type="button" className="lo-text-button" disabled={busy || loading} onClick={refresh}>Thử lại</button></div>}
    {feedback && <div className={`lo-notice lo-notice-${feedback.error ? 'error' : 'success'} rw-feedback`} role={feedback.error ? 'alert' : 'status'}><p>{feedback.text}</p><button type="button" className="lo-text-button" onClick={() => setFeedback(null)}>Đóng</button></div>}
    {loading ? <div className="lo-loading" role="status"><span className="lo-spinner" />Đang tải phòng và điểm đến…</div> : !loadError && <div className="lo-layout rw-layout">
      <aside className="lo-job-list" aria-label="Danh sách phòng quản trị">
        <header><strong>{filtered.length} phòng</strong><span>Bao gồm phòng ẩn và chưa có điểm</span></header>
        <div className="lo-job-items">
          {!filtered.length && <p className="lo-list-empty">Không có phòng phù hợp bộ lọc.</p>}
          {filtered.map(item => {
            const count = endpoints.filter(point => point.roomId === item.roomId).length;
            return <button type="button" key={item.roomId} disabled={busy} aria-pressed={selectedId === item.roomId} className={`lo-job-item ${selectedId === item.roomId ? 'is-selected' : ''}`} onClick={() => chooseRoom(item.roomId)}>
              <div className="lo-job-item-top"><span className={`lo-badge ${item.active ? 'lo-success' : 'lo-failed'}`}><i />{item.active ? 'Hoạt động' : 'Ngừng hoạt động'}</span><span>{item.roomCode}</span></div>
              <strong>{item.roomName}</strong><span className="lo-job-target">{floors.find(floor => floor.floorId === item.floorId)?.floorName || 'Chưa xác định tầng'}</span>
              <div className="lo-job-item-bottom"><span>{labelType(item.roomType)}</span><span className={count ? '' : 'rw-missing'}>{count ? `${count} điểm` : 'Chưa có điểm'}</span></div>
              {!item.publicVisible && <small className="rw-private">Chỉ dùng nội bộ</small>}
            </button>;
          })}
        </div>
      </aside>
      {(creating || room) && form ? <article className="lo-detail rw-detail" aria-label="Chi tiết phòng">
        <header className="lo-detail-header">{creating ? <div><h3>Thêm phòng mới</h3><p>Phòng mới được cấp ID khi lưu thành công.</p></div> : <div><div className="lo-detail-kicker"><span className={`lo-badge ${room.active ? 'lo-success' : 'lo-failed'}`}><i />{room.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span><span className="lo-badge lo-running">{room.publicVisible ? 'Công khai' : 'Nội bộ'}</span><span>{room.roomCode}</span></div><h3>{room.roomName}</h3><p>{roomFloor?.floorName || room.floorId}</p></div>}
          {!editing && canEdit && <button type="button" className="lo-button lo-primary" disabled={locked} onClick={() => setEditing(true)}>Chỉnh sửa phòng</button>}
        </header>
        {!canEdit && <p className="lo-muted">Chỉ quản trị viên được chỉnh sửa phòng và điểm đến.</p>}
        {editing ? <form aria-label={creating ? 'Tạo phòng mới' : 'Chỉnh sửa thông tin phòng'} onSubmit={saveRoom}>
          <fieldset disabled={locked} className="rw-fieldset"><legend>Thông tin phòng</legend><div className="rw-grid">
            {creating && <><Field label="Tầng"><select required value={form.floorId} onChange={event => setForm(current => ({ ...current, floorId: event.target.value, defaultEndpointGroupId: '' }))}><option value="">Chọn tầng</option>{floors.filter(floor => floor.active).map(floor => <option key={floor.floorId} value={floor.floorId}>{floor.floorName}</option>)}</select></Field><Field label="Mã phòng"><input required maxLength={64} value={form.roomCode} onChange={event => set('roomCode', event.target.value.toUpperCase())} /></Field></>}
            <Field label="Tên phòng" wide><input required maxLength={160} value={form.roomName} onChange={event => set('roomName', event.target.value)} /></Field>
            <Field label="Loại phòng"><RoomTypeSelect required value={form.roomType} onChange={value => set('roomType', value)} /></Field>
            <Field label="Khoa phụ trách"><RoomDepartmentSelect value={form.departmentCode} onChange={value => set('departmentCode', value)} /></Field>
            <Field label="Mô tả phòng" wide><textarea rows={3} value={form.description} onChange={event => set('description', event.target.value)} placeholder="Chức năng phòng, hướng dẫn nhận hàng…" /></Field>
          </div><RoomSosNotice type={form.roomType} previousType={creating ? null : room.roomType} active={form.active} /><div className="rw-checks"><label><input type="checkbox" checked={form.active} onChange={event => set('active', event.target.checked)} />Phòng hoạt động</label><label><input type="checkbox" checked={form.publicVisible} onChange={event => set('publicVisible', event.target.checked)} />Công khai cho người dùng tra cứu</label></div>
          <details className="rw-advanced"><summary>Thiết lập nâng cao</summary><div className="rw-grid">
            {!creating && <Field label="Mã phòng"><input required maxLength={64} value={form.roomCode} onChange={event => set('roomCode', event.target.value)} /></Field>}
            <Field label="Nhóm điểm mặc định"><select value={form.defaultEndpointGroupId} onChange={event => set('defaultEndpointGroupId', event.target.value)}><option value="">Không dùng nhóm mặc định</option>{groups.filter(group => maps.some(map => map.mapId === group.mapId && map.floorId === form.floorId)).map(group => <option key={group.endpointGroupId} value={group.endpointGroupId}>{group.groupName}{!group.active ? ' · Ngừng hoạt động' : ''}</option>)}</select></Field>
          </div><p className="lo-muted">Mã phòng phải duy nhất trong hệ thống. Nhóm điểm mặc định được cấu hình riêng với các điểm liên kết bên dưới.</p></details>
          <div className="rw-save"><span>{roomDirty ? 'Có thay đổi chưa lưu' : 'Thông tin đã được lưu'}</span><button type="button" className="lo-button" onClick={() => { if (!roomDirty || window.confirm('Bỏ các thay đổi thông tin phòng?')) { setCreating(false); setForm(room ? roomForm(room) : null); setEditing(false); } }}>Hủy chỉnh sửa</button><button type="submit" className="lo-button lo-primary" disabled={!roomDirty}>{busy ? 'Đang lưu…' : creating ? 'Lưu phòng mới' : 'Lưu thông tin phòng'}</button></div>
          </fieldset>
        </form> : <><dl className="lo-job-facts rw-facts"><div><dt>Loại phòng</dt><dd>{labelType(room.roomType)}</dd></div><div><dt>Khoa phụ trách</dt><dd>{room.departmentCode || 'Chưa cập nhật'}</dd></div></dl><div className="rw-description"><strong>Mô tả</strong><p>{room.description || 'Chưa có mô tả cho phòng này.'}</p></div></>}

        {!creating && <section className="rw-points" aria-label="Điểm đến robot của phòng">
          <header className="rw-section-heading"><div><h4>Điểm đến robot</h4><p>Đổi tên, vị trí hoặc chọn điểm khác cho phòng.</p></div><span className="lo-badge lo-running">{linked.length} điểm trên map</span></header>
          <Field label="Bản đồ của phòng"><select value={mapId} disabled={busy} onChange={event => { if ((!pointDirty && !targetId) || window.confirm('Bỏ thay đổi điểm chưa lưu để chuyển bản đồ?')) { resetPoint(); setMapId(event.target.value); } }}>{!roomMaps.length && <option value="">Tầng này chưa có bản đồ</option>}{roomMaps.map(map => <option key={map.mapId} value={map.mapId}>{map.mapName} · v{map.versionNo} · {mapState[map.status] || map.status}</option>)}</select></Field>
          {map?.status === 'ARCHIVED' && <p className="lo-muted">Bản đồ đã lưu trữ, chỉ có thể xem điểm.</p>}
          {linked.length > 0 ? <>
            <Field label="Điểm liên kết"><select value={pointId} disabled={busy || !!linkMode} onChange={event => { if (!pointDirty || window.confirm('Bỏ thay đổi chưa lưu để chọn điểm khác?')) { resetPoint(); setPointId(event.target.value); } }}>{linked.map(point => <option key={point.endpointId} value={point.endpointId}>{point.endpointName} · {point.endpointCode}{!point.active ? ' · Ngừng hoạt động' : !point.accessible ? ' · Không thể tiếp cận' : ''}</option>)}</select></Field>
            {point && !pointForm && <div className="rw-point-card"><div><strong>{point.endpointName}</strong><span>{point.endpointCode} · {ENDPOINT_CATEGORIES[point.endpointType] || point.endpointType}</span></div><dl><div><dt>Vị trí</dt><dd>X {point.xM} · Y {point.yM} m</dd></div><div><dt>Hướng</dt><dd>{(Number(point.yawRad) * 180 / Math.PI).toFixed(1)}°</dd></div><div><dt>Hiển thị</dt><dd>{point.publicVisible ? 'Công khai' : 'Nội bộ'}</dd></div><div><dt>Trạng thái</dt><dd>{!point.active ? 'Ngừng sử dụng' : !point.accessible ? 'Không thể tiếp cận' : 'Có thể tiếp cận'}</dd></div></dl></div>}
          </> : <div className="rw-no-point"><strong>Chưa có điểm trên bản đồ này</strong><p>Gắn một endpoint để thiết lập vị trí robot đến phòng.</p></div>}
          {canEdit && !pointForm && !linkMode && <div className="rw-actions"><button type="button" className="lo-button lo-primary" disabled={pointLocked || !map} onClick={() => startLink('attach')}>+ Gắn thêm điểm</button>{point && <><button type="button" className="lo-button" disabled={pointLocked} onClick={() => { setPointForm({ ...point }); setFeedback(null); }}>Chỉnh sửa điểm</button><button type="button" className="lo-button" disabled={pointLocked} onClick={() => startLink('replace')}>Đổi sang điểm khác</button><button type="button" className="lo-text-button rw-danger" disabled={pointLocked} onClick={detachPoint}>Bỏ liên kết</button></>}</div>}
          {linkMode && <form className="rw-link-form" aria-label="Chọn điểm cho phòng" onSubmit={saveLink}><fieldset disabled={pointLocked} className="rw-fieldset"><legend>{linkMode === 'replace' ? 'Đổi điểm hiện tại' : 'Gắn thêm điểm đến'}</legend><Field label="Chọn endpoint mới"><select required value={targetId} onChange={event => setTargetId(event.target.value)}><option value="">Chọn điểm trên bản đồ này</option>{endpoints.filter(point => point.mapId === mapId && point.roomId !== selectedId).map(point => <option key={point.endpointId} value={point.endpointId} disabled={!!point.roomId || !point.active || !point.accessible}>{point.endpointName} · {point.endpointCode}{point.roomId ? ` · Đang thuộc ${rooms.find(room => room.roomId === point.roomId)?.roomName || 'phòng khác'}` : !point.active ? ' · Ngừng sử dụng' : !point.accessible ? ' · Không thể tiếp cận' : ''}</option>)}</select></Field><p className="lo-muted">{linkMode === 'replace' ? 'Điểm mới sẽ được gắn vào phòng, sau đó bỏ liên kết điểm đang chọn. Các điểm khác của phòng được giữ nguyên.' : 'Điểm hiện có của phòng được giữ nguyên.'} Chỉ chọn được điểm chưa thuộc phòng khác.</p><div className="rw-actions"><button type="submit" className="lo-button lo-primary" disabled={!targetId}>{busy ? 'Đang cập nhật…' : 'Lưu liên kết điểm'}</button><button type="button" className="lo-button" onClick={resetPoint}>Hủy chọn điểm</button></div></fieldset></form>}

          {pointForm && <div className="rw-point-form">
            <EndpointLifecycle point={point} locked={pointLocked} busy={busy} hasUnsavedChanges={pointDirty} onToggleActive={togglePointActive} />
            <form aria-label="Chỉnh sửa điểm đến" onSubmit={savePoint}><fieldset className="rw-fieldset" disabled={pointLocked}><legend>Chỉnh điểm đích</legend>
              <EndpointFields endpoint={pointForm} setEndpoint={setPointForm} mapId={mapId} zones={zones} rooms={rooms.filter(room => room.floorId === map?.floorId)} fixedRoom={room} />
              <button type="button" className="lo-button" onClick={() => setDrawing(value => !value)}>{drawing ? 'Hủy đặt điểm' : 'Đặt lại vị trí / hướng'}</button>
              <div className="rw-save"><span>{pointDirty ? 'Điểm có thay đổi chưa lưu' : 'Điểm chưa thay đổi'}</span><button type="button" className="lo-button" onClick={() => { if (!pointDirty || window.confirm('Bỏ thay đổi của điểm?')) resetPoint(); }}>Bỏ thay đổi</button><button type="submit" className="lo-button lo-primary" disabled={!pointDirty}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
            </fieldset></form>
          </div>}
          {map && <details className="rw-map-preview" open={drawing || undefined}><summary>Xem vị trí trên bản đồ</summary><FacilityGeometryPreview map={map} zones={zones} endpoints={endpoints.filter(point => point.roomId === selectedId)} endpointEdit={pointForm || point} showInactiveEndpoints drawing={drawing && !pointLocked} allowDraftMove={!!pointForm && !pointLocked} onPoint={value => { if (pointForm) setPointForm(current => ({ ...current, ...value })); }} onPlacementEnd={() => setDrawing(false)} /><Link className="lo-text-button" to={`/admin/map?mapId=${encodeURIComponent(mapId)}`}>Mở Map Studio →</Link></details>}
        </section>}
      </article> : <article className="lo-detail"><div className="lo-empty"><h3>Chưa có phòng</h3><p>{canEdit ? 'Bấm Thêm phòng để tạo phòng mới hoặc tạo phòng trong Map Studio.' : 'Chưa có phòng trong danh mục.'}</p><Link className="lo-button lo-primary" to="/admin/map">Mở Map Studio</Link></div></article>}
    </div>}
  </div>;
}
