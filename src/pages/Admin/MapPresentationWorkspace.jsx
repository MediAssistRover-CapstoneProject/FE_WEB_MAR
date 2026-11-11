import { featureNames } from '../../features/facility/mapPresentation.js';
import MapPresentationCanvas from './MapPresentationCanvas.jsx';
import MapRotationControls from './MapRotationControls.jsx';
import { doorGeometry, setDoorOpening } from '../../features/facility/doorGeometry.js';
import { areaColor, roomColorsFor } from '../../features/facility/roomAppearance.js';
import RoomDepartmentSelect from './facility/RoomDepartmentSelect.jsx';
import RoomTypeSelect from './facility/RoomTypeSelect.jsx';

const tools = [
  ['select', 'Chọn', 'V', 'Chọn và kéo đối tượng'],
  ['pan', 'Kéo map', 'H', 'Kéo bản đồ'],
  ['ROOM', 'Phòng', 'R', 'Kéo chuột để vẽ phòng'],
  ['CORRIDOR', 'Hành lang', 'G', 'Kéo chuột để vẽ hành lang'],
  ['polygon', 'Đa giác', 'P', 'Bấm từng đỉnh, Enter để hoàn tất'],
  ['WALL', 'Tường', 'W', 'Bấm lần lượt các góc để nối tường, Enter kết thúc'],
  ['DOOR', 'Cửa', 'D', 'Bấm lên tường đã vẽ để tự căn hướng cửa, sau đó đặt chiều rộng'],
  ['LABEL', 'Nhãn', 'T', 'Bấm vào map để đặt tên'],
  ['LANDMARK', 'Ký hiệu', 'L', 'Bấm vào map để đặt ký hiệu'],
];
const paths = {
  select: 'M5 3 19 13l-7 1-3 7Z', pan: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  ROOM: 'M4 4h16v16H4ZM4 9h16', CORRIDOR: 'M4 4h6v10h10v6H4Z', polygon: 'm12 3 9 7-4 11H7L3 10Z',
  WALL: 'm4 20 16-16M4 14l6 6M9 9l6 6M14 4l6 6', DOOR: 'M4 20V4h16M4 20a16 16 0 0 0 16-16',
  LABEL: 'M4 5h16M12 5v15M8 20h8', LANDMARK: 'm12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z',
};
function ToolIcon({ name }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>; }

export default function MapPresentationWorkspace(props) {
  const { entry, document, selected, selectedId, setSelectedId, tool, setTool, points, setPoints,
    busy, dirty, locked, preview, setPreview, opacity, setOpacity, endpoints, rooms, imageUrl, imageError,
    error, notice, history, future, undo, redo, action, discardReload, update, change,
    finish, zoom, view, setView, svgRef, pointerDown, pointerMove, pointerUp, pointerLeave, featureDown,
    pointerCancel, expanded, setExpanded, spacePanning, showEndpoints, setShowEndpoints, duplicateSelected,
    rotation, rotate, beginRotation, endRotation, fitBounds, contentRef, showGrid, setShowGrid,
    snapEnabled, setSnapEnabled, drawingAssist, drawingPreview, doorPreview, removeSelected,
  } = props;
  const area = selected && ['ROOM', 'CORRIDOR'].includes(selected.type);
  const roomColors = roomColorsFor(document.features), selectedAreaColor = area && areaColor(selected, roomColors);
  const door = selected?.type === 'DOOR' ? doorGeometry(selected, entry.source) : null;
  const roomFeature = selected?.type === 'ROOM';
  const flippedDoor = door && setDoorOpening(selected, entry.source, { flipSwing: true });
  const swappedDoor = door && setDoorOpening(selected, entry.source, { swapHinge: true });
  const activeTool = tool === 'align' ? ['align', 'Căn theo tường', '', points.length ? 'Chọn điểm thứ hai trên cùng đoạn tường để căn ngang/dọc.' : 'Bấm hai điểm cách xa nhau trên một đoạn tường thẳng.'] : tool === 'DOOR' ? ['DOOR', 'Cửa minh họa', 'D', points.length ? 'Bấm mép còn lại để đặt chiều rộng; cửa tự căn theo tường đã chọn.' : 'Bấm lên tường đã vẽ để tự căn hướng, hoặc đặt hai điểm tự do.'] : tool === 'WALL' ? ['WALL', 'Tường liên tục', 'W', points.length ? 'Bấm góc tiếp theo để nối tường. Enter kết thúc, Esc thoát.' : 'Bấm điểm đầu, sau đó bấm lần lượt các góc. Giữ Shift để khóa ngang/dọc.'] : tools.find(t => t[0] === tool);
  const baseFont = Math.max(.05, Math.min(5, Math.min(entry.source.widthM, entry.source.heightM) / 35));
  const chooseTool = id => { setTool(id); setPoints([]); };
  const zoomPercent = Math.round(fitBounds.width / (view?.width || fitBounds.width) * 100);
  const chooseRoom = roomId => {
    const room = rooms.find(value => value.roomId === roomId);
    if (!room) { update({ roomId: null }); return; }
    const endpoint = endpoints.find(value => value.roomId === room.roomId && value.active && value.accessible);
    const chosenEndpoint = endpoint || endpoints.find(value => value.endpointId === selected.endpointId);
    update({ roomId: room.roomId, roomCode: room.roomCode, roomName: room.roomName, label: room.roomName,
      roomType: room.roomType, departmentCode: room.departmentCode || '', roomDescription: room.description || '',
      roomPublicVisible: room.publicVisible !== false, endpointId: chosenEndpoint?.endpointId || null,
      endpointName: chosenEndpoint?.endpointName || '' });
  };
  const chooseEndpoint = endpointId => {
    const endpoint = endpoints.find(value => value.endpointId === endpointId);
    update({ endpointId: endpoint?.endpointId || null, endpointName: endpoint?.endpointName || '' });
  };
  return <div className={`mp-editor${expanded ? ' is-expanded' : ''}`}>
    <header className="mp-heading">
      <div><span className="mp-eyebrow">CHỈNH GIAO DIỆN BẢN ĐỒ</span><h3>Biến map đã quét thành sơ đồ dễ đọc</h3><p>Vẽ theo map gốc, chọn đối tượng để chỉnh sửa.</p></div>
      <div className="mp-actions">
        <span className={'mp-badge ' + (entry.published ? 'is-published' : '')}><i />{dirty ? 'Có thay đổi chưa lưu' : entry.published ? 'Đã áp dụng' : 'Bản nháp'}</span>
        <button className="mp-button" disabled={busy} onClick={discardReload} title="Tải lại từ máy chủ">Tải lại</button>
        <button className="mp-button" disabled={locked || !dirty && !!entry.revision} onClick={() => action('save')} title="Ctrl + S">Lưu nháp</button>
        <button className="mp-button is-primary" disabled={locked || !document.features.length && rotation === 0 && !entry.published} onClick={() => action('publish')}>{busy ? 'Đang lưu…' : 'Áp dụng bản đồ'}</button>
      </div>
    </header>
    {error && <p className="mp-error" role="alert">{error}</p>}{notice && <p className="mp-notice" role="status">{notice}</p>}
    {entry.sourceChanged && <p className="mp-error" role="alert">Map gốc đã thay đổi. Chọn đúng phiên bản map trong thư viện để tiếp tục.</p>}
    <div className="mp-toolbar" role="toolbar" aria-label="Công cụ chỉnh bản đồ">
      <div className="mp-tool-list">{tools.map(([id, label, shortcut, hint], index) => <button key={id} className={index === 2 ? 'mp-tool-divider' : ''} type="button" aria-label={`${id === 'select' || id === 'pan' ? label : 'Vẽ ' + label.toLowerCase()} (${shortcut})`} title={`${hint} · ${shortcut}`} aria-pressed={tool === id} disabled={locked || preview} onClick={() => chooseTool(id)}><ToolIcon name={id} /><span>{label}</span><kbd>{shortcut}</kbd></button>)}</div>
      <button className={'mp-button mp-preview-button' + (preview ? ' is-active' : '')} role="checkbox" aria-checked={preview} aria-label="Xem bản đẹp" onClick={() => { setPreview(!preview); setPoints([]); }}><span aria-hidden="true">◉</span>{preview ? 'Đang xem trước' : 'Xem trước'}</button>
    </div>
    <div className="mp-workspace">
      <section className={'mp-stage' + (tool === 'pan' || spacePanning ? ' is-panning' : '')}>
        <div className="mp-stage-bar">
          <div className="mp-history"><button aria-label="↶ Hoàn tác" title="Hoàn tác · Ctrl + Z" disabled={!history.length || locked || preview} onClick={undo}>↶ <span>Hoàn tác</span></button><button aria-label="↷ Làm lại" title="Làm lại · Ctrl + Shift + Z" disabled={!future.length || locked || preview} onClick={redo}>↷ <span>Làm lại</span></button></div>
          <div className="mp-zoom"><button aria-label="Thu nhỏ bản đồ" title="Thu nhỏ" onClick={() => zoom(1.3)}>−</button><span className="mp-zoom-value">{zoomPercent}%</span><button aria-label="Phóng to bản đồ" title="Phóng to" onClick={() => zoom(1 / 1.3)}>+</button><button onClick={() => setView(fitBounds)}>Vừa khung</button><button aria-label={expanded ? 'Thu gọn vùng vẽ' : 'Mở rộng vùng vẽ'} title={expanded ? 'Thu gọn' : 'Mở rộng vùng vẽ'} onClick={() => setExpanded(!expanded)}>{expanded ? '↙' : '⛶'}</button></div>
        </div>
        <MapRotationControls rotation={rotation} rotate={rotate} beginRotation={beginRotation} endRotation={endRotation} disabled={locked || preview} aligning={tool === 'align'} onAlign={() => chooseTool(tool === 'align' ? 'select' : 'align')} showGrid={showGrid} setShowGrid={setShowGrid}/>
        <div className="mp-tool-hint"><span className="mp-tool-dot" /><strong>{spacePanning ? 'Kéo bản đồ' : preview ? 'Xem trước bản đồ' : activeTool?.[1]}</strong><span>{spacePanning ? 'Thả Space để trở lại công cụ trước.' : preview ? 'Bỏ chọn Xem trước để tiếp tục chỉnh sửa.' : activeTool?.[3]}</span></div>
        {imageError && <p className="mp-error">Không tải được ảnh nền: {imageError}</p>}
        <div className="mp-scroll"><MapPresentationCanvas source={entry.source} document={document} imageUrl={imageUrl} opacity={preview && document.features.length ? 0 : opacity} endpoints={showEndpoints ? endpoints : []} selectedId={selectedId} preview={preview} points={points} drawingTool={tool} drawingAssist={drawingAssist} drawingPreview={drawingPreview} doorPreview={doorPreview} svgRef={svgRef} contentRef={contentRef} showGrid={showGrid} viewBox={view ? `${view.x} ${view.y} ${view.width} ${view.height}` : undefined} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerLeave={pointerLeave} onPointerCancel={pointerCancel} onFeatureDown={featureDown} onVertexDown={(event, feature, index) => featureDown(event, feature, index)} /></div>
        {points.length > 0 && <div className="mp-drawing"><span>{tool === 'polygon' ? `${points.length} đỉnh đã chọn` : tool === 'WALL' ? 'Tiếp tục nối tường' : tool === 'align' ? 'Chọn điểm thứ hai trên tường' : 'Chọn điểm tiếp theo'}</span>{tool === 'polygon' && <button className="mp-button is-primary" disabled={points.length < 3} onClick={finish}>Hoàn tất vùng ↵</button>}{tool === 'WALL' && <button className="mp-button is-primary" aria-label="Kết thúc tường" onClick={finish}>Kết thúc tường ↵</button>}<button className="mp-button" onClick={pointerCancel}>Hủy <kbd>Esc</kbd></button></div>}
        <footer className="mp-map-controls"><label>Map gốc<input aria-label="Độ mờ map gốc" type="range" min="0" max="1" step=".05" disabled={preview} value={opacity} onChange={e => setOpacity(Number(e.target.value))} /><span>{Math.round(opacity * 100)}%</span></label><label className="mp-toggle mp-snap-toggle" title="Bắt dính vào góc và cạnh đã vẽ; giữ Alt để kéo tự do"><input type="checkbox" aria-label="Bắt dính" checked={!!snapEnabled} disabled={locked || preview} onChange={e => setSnapEnabled(e.target.checked)} />Bắt dính</label><label className="mp-toggle" title={preview ? 'Điểm đích được ẩn khi xem trước bản đồ.' : 'Hiện điểm đích để đối chiếu vị trí khi chỉnh sửa.'}><input type="checkbox" checked={!preview && showEndpoints} disabled={preview} onChange={e => setShowEndpoints(e.target.checked)} />Điểm đích</label><span className="mp-map-size">{entry.source.widthM.toFixed(2)} × {entry.source.heightM.toFixed(2)} m</span></footer>
        <div className="mp-shortcut-hint"><span>Cuộn chuột để zoom</span><span><kbd>Space</kbd> + kéo map</span><span><kbd>Shift</kbd> khóa ngang/dọc</span><span><kbd>Alt</kbd> bỏ bắt dính</span><span><kbd>Esc</kbd> thoát nét vẽ</span></div>
      </section>
      <aside className="mp-inspector">
        <header className="mp-panel-heading"><strong>{selected ? 'Chỉnh đối tượng' : 'Thuộc tính'}</strong><span>{selected ? featureNames[selected.type] : 'Chưa chọn'}</span></header>
        <div className="mp-properties">{selected ? <fieldset disabled={locked || preview}>
          {!roomFeature && <label className="mp-field">Tên hiển thị<input placeholder={door?'Ví dụ: Cửa phòng khám':'Ví dụ: Phòng khám 01'} maxLength={120} value={selected.label} onChange={e => update({ label: e.target.value })} /></label>}
          {roomFeature && <div className="mp-room-catalog">
            <p>Thông tin này được đồng bộ vào danh sách phòng khi bấm <strong>Áp dụng bản đồ</strong>.</p>
            <label className="mp-field">Phòng trong database<select value={selected.roomId || ''} onChange={e => chooseRoom(e.target.value)}><option value="">Tạo phòng mới khi áp dụng</option>{rooms.map(room => <option key={room.roomId} value={room.roomId}>{room.roomCode} — {room.roomName}</option>)}</select></label>
            <label className="mp-field">Mã phòng *<input maxLength={64} placeholder="ROOM_01" value={selected.roomCode || ''} onChange={e => update({ roomCode: e.target.value.toUpperCase() })} /></label>
            <label className="mp-field">Tên phòng *<input maxLength={160} placeholder="Phòng khám 01" value={selected.roomName ?? selected.label} onChange={e => update({ roomName: e.target.value, label: e.target.value })} /></label>
            <label className="mp-field">Loại phòng *<RoomTypeSelect required value={selected.roomType || ''} onChange={roomType => update({ roomType })} /></label>
            <label className="mp-field">Mã khoa<RoomDepartmentSelect value={selected.departmentCode || ''} onChange={departmentCode => update({ departmentCode })} /></label>
            <label className="mp-field">Tên endpoint *<input maxLength={160} placeholder="Ví dụ: Cửa phòng khám 01" value={selected.endpointName || ''} onChange={e => update({ endpointName: e.target.value })} /></label>
            <label className="mp-field">Mô tả<textarea rows="3" value={selected.roomDescription || ''} onChange={e => update({ roomDescription: e.target.value })} /></label>
            <label className="mp-room-public"><input type="checkbox" checked={selected.roomPublicVisible !== false} onChange={e => update({ roomPublicVisible: e.target.checked })} />Hiển thị phòng trong thông tin bệnh viện</label>
          </div>}
          {door && <div className="mp-door-properties">
            <div><strong>Ký hiệu cửa</strong><span>Rộng {door.radius.toLocaleString('vi-VN',{maximumFractionDigits:2})} m · Góc vẽ {Math.abs(door.angleDegrees).toLocaleString('vi-VN',{maximumFractionDigits:1})}°</span></div>
            <p>Hướng mở chỉ để minh họa, không phản ánh cửa đang mở hay đóng. Robot đi theo bản đồ quét và vật cản thực tế.</p>
            <div className="mp-door-actions">
              <button type="button" disabled={!flippedDoor} title={flippedDoor?'Đổi hướng mở của ký hiệu sang phía đối diện':'Ký hiệu cửa sẽ vượt ra ngoài map'} onClick={()=>update({points:flippedDoor})}>Đổi phía mở</button>
              <button type="button" disabled={!swappedDoor} title={swappedDoor?'Chuyển bản lề của ký hiệu sang mép còn lại':'Ký hiệu cửa sẽ vượt ra ngoài map'} onClick={()=>update({points:swappedDoor})}>Đổi bên bản lề</button>
            </div>
            <p>Kéo mép cửa để đổi chiều rộng; kéo đầu cánh để chỉnh góc minh họa.</p>
          </div>}
          {area && <div className="mp-room-note"><span className="mp-room-sample" style={{ backgroundColor: `${selectedAreaColor}18`, borderColor: selectedAreaColor }} /><div><strong>Nền màu nhạt, viền mảnh</strong><p>Màu riêng giúp phân biệt các phòng cạnh nhau, vẫn thấy rõ map bên dưới.</p></div></div>}
          <label className="mp-field mp-color-field">{area ? selected.type === 'ROOM' ? 'Màu phòng' : 'Màu hành lang' : 'Màu hiển thị'}<input type="color" value={area ? selectedAreaColor : selected.color} onChange={e => update({ color: e.target.value })} /></label>
          <div className="mp-field"><span>Cỡ nhãn</span><div className="mp-segmented">{[['Nhỏ', .7], ['Vừa', 1], ['Lớn', 1.5]].map(([name, factor]) => { const size = Math.min(5, Math.max(.05, Math.round(baseFont * factor * 100) / 100)); return <button key={name} aria-pressed={Math.abs(selected.fontSizeM - size) < .005} onClick={() => update({ fontSizeM: size })}>{name}</button>; })}</div></div>
          <label className="mp-field">{roomFeature ? 'Endpoint của phòng *' : 'Gắn điểm đích thật'}<select value={selected.endpointId || ''} onChange={e => roomFeature ? chooseEndpoint(e.target.value) : update({ endpointId: e.target.value || null })}><option value="">{roomFeature ? 'Chọn endpoint của phòng' : 'Không gắn điểm'}</option>{endpoints.filter(e => e.active && e.accessible && (!roomFeature || !e.roomId || e.roomId === selected.roomId)).map(e => <option key={e.endpointId} value={e.endpointId}>{e.endpointName}</option>)}</select></label>
          <details className="mp-advanced"><summary>Tùy chỉnh nâng cao</summary><label className="mp-field">Cỡ chữ (m)<input type="number" min=".05" max="5" step=".01" value={selected.fontSizeM} onChange={e => update({ fontSizeM: Number(e.target.value) })} /></label>{!area && <label className="mp-field">Độ dày nét (m)<input type="number" min=".01" max="2" step=".01" value={selected.lineWidthM} onChange={e => update({ lineWidthM: Number(e.target.value) })} /></label>}<p className="mp-field-label">Tọa độ đỉnh (m)</p>{selected.points.map((point, index) => <div className="mp-coordinate" key={index}><small>{index + 1}</small>{['x', 'y'].map(axis => <label key={axis}><span>{axis.toUpperCase()}</span><input aria-label={`Đỉnh ${index + 1} ${axis}`} type="number" step=".01" min="0" max={axis === 'x' ? entry.source.widthM : entry.source.heightM} value={point[axis]} onChange={e => update({ points: selected.points.map((v, i) => i === index ? { ...v, [axis]: Number(e.target.value) } : v) })} /></label>)}</div>)}<div className="mp-layer-order"><button onClick={() => change({ ...document, features: [selected, ...document.features.filter(f => f.id !== selectedId)] })}>Đưa xuống dưới</button><button onClick={() => change({ ...document, features: [...document.features.filter(f => f.id !== selectedId), selected] })}>Đưa lên trên</button></div></details>
          <div className="mp-object-actions"><button onClick={duplicateSelected}>⧉ Nhân bản</button><button className="mp-delete" onClick={removeSelected}>Xóa <kbd>Del</kbd></button></div>
        </fieldset> : <div className="mp-empty-selection"><ToolIcon name="select" /><strong>Chọn đối tượng để chỉnh</strong><p>Bấm lên phòng, tường hoặc tên trong danh sách bên dưới.</p><button className="mp-button" disabled={locked || preview} onClick={() => chooseTool('ROOM')}>+ Vẽ phòng <kbd>R</kbd></button></div>}</div>
        <div className="mp-panel-heading mp-layers-heading"><strong>Đối tượng trên map</strong><span>{document.features.length}</span></div>
        <div className="mp-layers">{document.features.length ? [...document.features].reverse().map(feature => <button key={feature.id} aria-pressed={selectedId === feature.id} onClick={() => { setSelectedId(feature.id); chooseTool('select'); }}><ToolIcon name={feature.type} />{['ROOM', 'CORRIDOR'].includes(feature.type) && <span className="mp-layer-swatch" aria-hidden="true" style={{ backgroundColor: areaColor(feature, roomColors) }} />}<span>{feature.label || featureNames[feature.type]}</span><small>{featureNames[feature.type]}</small></button>) : <p>Chưa có đối tượng. Chọn công cụ để bắt đầu vẽ.</p>}</div>
        <details className="mp-map-options"><summary>Tùy chọn bản đồ</summary><label className="mp-field mp-color-field">Màu nền<input type="color" disabled={locked} value={document.backgroundColor} onChange={e => change({ ...document, backgroundColor: e.target.value })} /></label>{entry.published && <button className="mp-unpublish" disabled={busy} onClick={() => action('unpublish')}>Ngừng xuất bản</button>}</details>
      </aside>
    </div>
  </div>;
}
