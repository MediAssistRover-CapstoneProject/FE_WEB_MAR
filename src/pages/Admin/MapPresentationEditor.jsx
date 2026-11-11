import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../features/api/client.js';
import { allFacilityPages, facilityApi } from '../../features/facility/facilityApi.js';
import { insideMap, mapPresentationApi, newFeature, presentationIssues } from '../../features/facility/mapPresentation.js';
import { fromView, normalizeRotation, rotationBounds, straightenRotation, viewRectangle } from '../../features/facility/mapPresentationView.js';
import { doorFitsMap, doorGeometry } from '../../features/facility/doorGeometry.js';
import { doorOnWall, getDoorWall, getWallEdge, snapDrawingPoint } from '../../features/facility/mapDrawingAssist.js';
import { nextRoomColor, nextRoomName, persistRoomColors, preserveRoomColors } from '../../features/facility/roomAppearance.js';
import { nextRoomCode } from '../../features/facility/roomDefaults.js';
import MapPresentationWorkspace from './MapPresentationWorkspace.jsx';
import './mapPresentation.css';

function hydrateRoomFeatures(document, endpoints, rooms) {
  return { ...document, features: document.features.map(feature => {
    if (feature.type !== 'ROOM') return feature;
    const endpoint = endpoints.find(value => value.endpointId === feature.endpointId);
    const room = rooms.find(value => value.roomId === feature.roomId || value.roomId === endpoint?.roomId);
    if (!room) return { ...feature, endpointName: feature.endpointName ?? endpoint?.endpointName ?? '' };
    return { ...feature, roomId: room.roomId, roomCode: feature.roomCode || room.roomCode,
      roomName: feature.roomName || room.roomName, label: feature.label || room.roomName,
      roomType: feature.roomType || room.roomType, departmentCode: feature.departmentCode ?? room.departmentCode ?? '',
      roomDescription: feature.roomDescription ?? room.description ?? '', roomPublicVisible: feature.roomPublicVisible ?? room.publicVisible,
      endpointName: feature.endpointName ?? endpoint?.endpointName ?? '' };
  }) };
}

export default function MapPresentationEditor({ mapId, onOpenLibrary, onDirtyChange }) {
  const [entry, setEntry] = useState(null), [document, setDocument] = useState(null), [saved, setSaved] = useState('');
  const [endpoints, setEndpoints] = useState([]), [rooms, setRooms] = useState([]), [imageUrl, setImageUrl] = useState(''), [imageError, setImageError] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [tool, setTool] = useState('select'), [selectedId, setSelectedId] = useState(''), [opacity, setOpacity] = useState(1), [preview, setPreview] = useState(false), [points, setPoints] = useState([]);
  const [history, setHistory] = useState([]), [future, setFuture] = useState([]), [reload, setReload] = useState(0);
  const [view, setView] = useState(null);
  const [expanded, setExpanded] = useState(false), [spacePanning, setSpacePanning] = useState(false), [showEndpoints, setShowEndpoints] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true), [drawingAssist, setDrawingAssist] = useState(null);
  const [drawingPreview, setDrawingPreview] = useState([]), [doorPreview, setDoorPreview] = useState(null);
  const svgRef = useRef(null), contentRef = useRef(null), drag = useRef(null), current = useRef(document), rotationGesture = useRef(null);
  const doorEdge = useRef(null), lastPointer = useRef(null), roomCatalog = useRef([]);
  current.current = document;
  const dirty = document && JSON.stringify(document) !== saved;
  const selected = document?.features.find(f => f.id === selectedId);
  const rotation = document?.rotationDegrees ?? 0;
  const fitBounds = entry ? rotationBounds(entry.source, rotation) : null;
  const clearDrawingHints = () => { setDrawingAssist(null); setDrawingPreview(values => values.length ? [] : values); setDoorPreview(null); };
  useEffect(() => {
    doorEdge.current = null; lastPointer.current = null; clearDrawingHints();
  }, [tool, preview, snapEnabled, rotation, mapId, reload]);
  useEffect(() => { lastPointer.current = null; clearDrawingHints(); }, [spacePanning]);
  useEffect(() => { onDirtyChange?.(!!dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!mapId) { setLoading(false); return; }
    const controller = new AbortController(); let url;
    setLoading(true); setError(''); setImageError(''); setEntry(null); setDocument(null); setImageUrl(''); setPoints([]); setSelectedId(''); setHistory([]); setFuture([]);
    Promise.all([mapPresentationApi.get(mapId, controller.signal), allFacilityPages(facilityApi.listEndpoints), allFacilityPages(facilityApi.listRooms), allFacilityPages(facilityApi.listMaps)]).then(([value, rows, roomRows, maps]) => {
      if (controller.signal.aborted) return;
      const mapEndpoints = rows.filter(e => e.mapId === mapId);
      const floorId = maps.find(map => map.mapId === mapId)?.floorId;
      const mapRooms = roomRows.filter(room => !floorId || room.floorId === floorId);
      roomCatalog.current = roomRows;
      const hydratedDraft = hydrateRoomFeatures(value.draft, mapEndpoints, mapRooms);
      setEntry(value); setDocument(hydratedDraft); setSaved(JSON.stringify(value.draft)); setEndpoints(mapEndpoints); setRooms(mapRooms);
      setView(rotationBounds(value.source, value.draft.rotationDegrees ?? 0));
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    apiRequest(`/api/v1/maps/${encodeURIComponent(mapId)}/image.png`, { signal: controller.signal, responseType: 'blob' }).then(blob => {
      if (!controller.signal.aborted) { url = URL.createObjectURL(blob); setImageUrl(url); }
    }).catch(e => { if (!controller.signal.aborted) setImageError(e.message); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [mapId, reload]);
  useEffect(() => {
    if (entry) setView(rotationBounds(entry.source, rotation));
  }, [entry?.source.widthM, entry?.source.heightM, rotation]);
  useEffect(() => {
    if (!dirty) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const change = next => { const previous = current.current, normalized = preserveRoomColors(previous, next); setHistory(h => [...h.slice(-49), previous]); setFuture([]); current.current = normalized; setDocument(normalized); setNotice(''); };
  const beginRotation = () => { if (!rotationGesture.current) rotationGesture.current = current.current; };
  const endRotation = () => {
    const before = rotationGesture.current;
    rotationGesture.current = null;
    if (before && JSON.stringify(before) !== JSON.stringify(current.current)) { setHistory(h => [...h.slice(-49), before]); setFuture([]); }
  };
  const rotate = value => {
    if (busy || preview || entry.sourceChanged || !Number.isFinite(value)) return;
    const angle = normalizeRotation(value);
    if (angle === (current.current.rotationDegrees ?? 0)) return;
    const next = preserveRoomColors(current.current, { ...current.current, rotationDegrees: angle });
    drag.current = null; setPoints([]);
    if (rotationGesture.current) { current.current = next; setDocument(next); setNotice(''); }
    else change(next);
  };
  const update = patch => {
    let next = { ...selected, ...patch };
    if (patch.color && ['ROOM', 'CORRIDOR'].includes(next.type)) next.color = patch.color.toUpperCase();
    if (next.type === 'DOOR' && patch.points) {
      const door = doorGeometry(next, entry.source);
      if (!doorFitsMap(door, entry.source)) { setNotice('Cánh cửa phải nằm trong map. Chọn vị trí hoặc hướng mở khác.'); return; }
      next = { ...next, points: [door.hinge, door.closed, door.open] };
    }
    change({ ...document, features: document.features.map(f => f.id === selectedId ? next : f) });
  };
  const add = (type, values, { continueDrawing = false } = {}) => {
    if (current.current.features.length >= 500) { setError('Tối đa 500 đối tượng.'); return false; }
    if (values.some(point => !insideMap(point, entry.source))) return false;
    if (type === 'WALL' && Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y) < 1e-8) return false;
    const feature = newFeature(type, values, entry.source);
    if (type === 'ROOM') {
      feature.color = nextRoomColor(values, current.current.features); feature.label = nextRoomName(current.current.features);
      feature.roomCode = nextRoomCode([...roomCatalog.current, ...current.current.features]); feature.roomName = feature.label;
      feature.roomType = 'GENERAL'; feature.roomDescription = ''; feature.roomPublicVisible = true;
    }
    if (type === 'WALL') feature.label = '';
    if (type === 'DOOR') {
      const door = doorGeometry(feature, entry.source);
      if (!doorFitsMap(door, entry.source)) { setNotice('Chọn hai mép cửa cách nhau và đủ chỗ cho cánh cửa mở trong map.'); return false; }
      feature.points = [door.hinge, door.closed, door.open];
    }
    change({ ...current.current, features: [...current.current.features, feature] }); setSelectedId(feature.id);
    setPoints(continueDrawing ? [values.at(-1)] : []); if (!continueDrawing) setTool('select');
    doorEdge.current = null; clearDrawingHints(); return true;
  };
  const finish = () => {
    if (tool === 'WALL') { setPoints([]); setTool('select'); clearDrawingHints(); }
    else if (points.length >= 3) add('ROOM', points);
  };
  const restoreHistory = next => {
    drag.current = null; current.current = next; setDocument(next); setPoints([]); doorEdge.current = null; clearDrawingHints();
    setSelectedId(id => next.features.some(feature => feature.id === id) ? id : '');
  };
  const undo = () => {
    const before = drag.current?.before || current.current;
    if (!history.length) { if (drag.current) restoreHistory(before); return; }
    setFuture(f => [before, ...f]); restoreHistory(history.at(-1)); setHistory(h => h.slice(0, -1));
  };
  const redo = () => {
    const before = drag.current?.before || current.current;
    if (!future.length) { if (drag.current) restoreHistory(before); return; }
    setHistory(h => [...h, before]); restoreHistory(future[0]); setFuture(f => f.slice(1));
  };
  const localPoint = event => {
    const matrix = contentRef.current?.getScreenCTM(); if (!matrix) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const local = fromView(p, entry.source, 0);
    return insideMap(local, entry.source) ? local : null;
  };
  const snapTolerance = () => {
    const matrix = contentRef.current?.getScreenCTM();
    const scale = matrix && Math.hypot(matrix.a, matrix.b);
    return scale > 0 ? 10 / scale : 0;
  };
  const assistedPoint = (event, { anchor = null, excludeId = null, orthogonal = true, point = null } = {}) => {
    const raw = point || localPoint(event); if (!raw) return null;
    const enabled = snapEnabled && !event.altKey;
    const result = snapDrawingPoint(raw, { features: enabled ? current.current.features : [], source: entry.source,
      rotation, tolerance: enabled ? snapTolerance() : 0, anchor, orthogonal: orthogonal && !!event.shiftKey, excludeId });
    return insideMap(result.point, entry.source) ? result : null;
  };
  const drawingPoint = event => {
    const result = assistedPoint(event, { anchor: points.at(-1) }); if (!result) return null;
    if (tool !== 'DOOR' || !snapEnabled || event.altKey) return result;
    if (points.length && doorEdge.current) {
      const values = doorOnWall(points[0], localPoint(event), doorEdge.current, entry.source);
      return values ? { point: values[1], kind: 'edge', guides: [{ a: doorEdge.current.a, b: doorEdge.current.b }], edge: doorEdge.current, doorPoints: values } : null;
    }
    if (!points.length) {
      const edge = getWallEdge(result.kind === 'vertex' ? result.point : localPoint(event), current.current.features, snapTolerance());
      if (edge) return { point: edge.point, kind: 'edge', guides: [{ a: edge.a, b: edge.b }], edge };
      return { ...result, edge: null };
    }
    return result;
  };
  const showDrawingHover = event => {
    if (preview || busy || entry.sourceChanged || spacePanning || !['WALL', 'DOOR', 'polygon', 'ROOM', 'CORRIDOR', 'LABEL', 'LANDMARK'].includes(tool)) { clearDrawingHints(); return; }
    const result = drawingPoint(event);
    if (!result) { clearDrawingHints(); return; }
    setDrawingAssist(result.kind ? result : null);
    if (points.length && ['WALL', 'polygon'].includes(tool) && Math.hypot(result.point.x - points.at(-1).x, result.point.y - points.at(-1).y) > 1e-8) setDrawingPreview([points.at(-1), result.point]);
    else setDrawingPreview(values => values.length ? [] : values);
    if (tool === 'DOOR' && points.length) {
      const values = result.doorPoints || [points[0], result.point];
      const geometry = doorGeometry({ points: values }, entry.source);
      setDoorPreview(doorFitsMap(geometry, entry.source) ? [geometry.hinge, geometry.closed, geometry.open] : null);
    } else setDoorPreview(null);
  };
  const zoom = (factor, anchor = null) => setView(previous => {
    const bounds = rotationBounds(entry.source, current.current.rotationDegrees ?? 0);
    const width = Math.min(bounds.width, Math.max(bounds.width / 12, previous.width * factor));
    const height = width * bounds.height / bounds.width;
    const xRatio = anchor ? (anchor.x - previous.x) / previous.width : .5, yRatio = anchor ? (anchor.y - previous.y) / previous.height : .5;
    return { width, height, x: Math.max(bounds.x, Math.min(bounds.x + bounds.width - width, previous.x + (previous.width - width) * xRatio)), y: Math.max(bounds.y, Math.min(bounds.y + bounds.height - height, previous.y + (previous.height - height) * yRatio)) };
  });
  const featureDown = (event, feature, vertex = null) => {
    if (tool !== 'select' || spacePanning || preview || busy || entry.sourceChanged || event.button !== 0) return;
    event.stopPropagation(); event.preventDefault(); setSelectedId(feature.id);
    svgRef.current.focus({ preventScroll: true });
    const start = localPoint(event); if (!start) return;
    svgRef.current.setPointerCapture(event.pointerId);
    drag.current = { id: feature.id, vertex, start, before: current.current };
  };
  const pointerDown = event => {
    svgRef.current.focus({ preventScroll: true });
    if (tool === 'pan' || spacePanning || event.button === 1) {
      event.preventDefault();
      svgRef.current.setPointerCapture(event.pointerId);
      drag.current = { pan: true, start: { x: event.clientX, y: event.clientY }, view, scale: svgRef.current.getScreenCTM().a };
      return;
    }
    if (preview || busy || entry.sourceChanged || event.button !== 0) return;
    if (tool === 'select') { setSelectedId(''); clearDrawingHints(); return; }
    const result = tool === 'align' ? { point: localPoint(event) } : drawingPoint(event);
    const p = result?.point;
    if (!p) {
      if (tool === 'DOOR' && points.length && localPoint(event)) setNotice('Ký hiệu cửa chưa vừa trong map. Chọn chiều rộng nhỏ hơn hoặc vị trí khác.');
      return;
    }
    if (tool === 'align') {
      if (!points.length) { setPoints([p]); return; }
      const angle = straightenRotation(points[0], p, entry.source, rotation);
      if (angle === null) { setNotice('Chọn hai điểm cách xa nhau trên cùng một đoạn tường thẳng.'); return; }
      rotate(angle); setPoints([]); setTool('select');
      setNotice('Đã căn tường theo chiều ngang/dọc. Lưu nháp để giữ góc xoay.');
      return;
    }
    if (['ROOM', 'CORRIDOR'].includes(tool)) { svgRef.current.setPointerCapture(event.pointerId); drag.current = { rectangle: tool, start: p }; setPoints(viewRectangle(p, p, entry.source, rotation)); }
    else if (['LABEL', 'LANDMARK'].includes(tool)) add(tool, [p]);
    else if (tool === 'WALL') {
      if (points.length) add('WALL', [points[0], p], { continueDrawing: true });
      else { setPoints([p]); clearDrawingHints(); }
    } else if (tool === 'DOOR') {
      if (points.length) add('DOOR', result.doorPoints || [points[0], p]);
      else { setPoints([p]); doorEdge.current = result.edge || null; clearDrawingHints(); }
    }
    else setPoints(values => [...values, p]);
  };
  const pointerMove = event => {
    lastPointer.current = { clientX: event.clientX, clientY: event.clientY, altKey: event.altKey, shiftKey: event.shiftKey };
    const active = drag.current; if (!active) { showDrawingHover(event); return; }
    if (active.pan) {
      const bounds = rotationBounds(entry.source, rotation);
      setView({ ...active.view, x: Math.max(bounds.x, Math.min(bounds.x + bounds.width - active.view.width, active.view.x - (event.clientX - active.start.x) / active.scale)), y: Math.max(bounds.y, Math.min(bounds.y + bounds.height - active.view.height, active.view.y - (event.clientY - active.start.y) / active.scale)) });
      return;
    }
    const raw = localPoint(event); if (!raw) { clearDrawingHints(); return; }
    if (active.rectangle) {
      const result = assistedPoint(event, { orthogonal: false }); if (!result) return;
      setDrawingAssist(result.kind ? result : null);
      setPoints(viewRectangle(active.start, result.point, entry.source, rotation)); return;
    }
    const original = active.before.features.find(f => f.id === active.id);
    const first = original.points[0];
    const moving = active.vertex === null;
    const target = moving ? { x: first.x + raw.x - active.start.x, y: first.y + raw.y - active.start.y } : raw;
    const previousVertex = original.points[(active.vertex + original.points.length - 1) % original.points.length];
    const anchor = moving ? (event.shiftKey ? first : null) : original.type === 'DOOR' && active.vertex === 2 ? null : previousVertex;
    const result = ['LABEL', 'LANDMARK'].includes(original.type) ? { point: target, kind: null } : assistedPoint(event, { excludeId: original.id, point: target, anchor,
      orthogonal: original.type !== 'DOOR' });
    if (!result) return;
    setDrawingAssist(result.kind ? result : null);
    const p = result.point;
    let values = original.points.map((point, i) => active.vertex === null ? { x: point.x + p.x - first.x, y: point.y + p.y - first.y } : i === active.vertex ? p : point);
    if (original.type === 'DOOR' && active.vertex === 1 && snapEnabled && !event.altKey) {
      // An existing threshold on a drawn wall stays on that wall while resizing.
      const epsilon = Math.max(1, entry.source.widthM, entry.source.heightM) * 1e-8;
      const edge = getDoorWall(original, active.before.features, epsilon);
      if (edge) {
        const end = getWallEdge(raw, [{ id: edge.featureId, type: 'WALL', points: [edge.a, edge.b] }]).point;
        values = [original.points[0], end, ...(original.points[2] ? [original.points[2]] : [])];
        setDrawingAssist({ point: end, kind: 'edge', guides: [{ a: edge.a, b: edge.b }] });
      }
    }
    if (original.type === 'DOOR') {
      const door = doorGeometry({ ...original, points: values }, entry.source);
      if (!doorFitsMap(door, entry.source)) return;
      values = [door.hinge, door.closed, door.open];
    }
    if (values.some(point => !insideMap(point, entry.source))) return;
    const next = preserveRoomColors(active.before, { ...active.before, features: active.before.features.map(f => f.id === active.id ? { ...f, points: values } : f) });
    current.current = next; setDocument(next);
  };
  const pointerUp = event => {
    const active = drag.current; if (!active) return;
    drag.current = null; clearDrawingHints();
    if (active.pan) return;
    if (active.rectangle) {
      const result = assistedPoint(event, { orthogonal: false });
      const values = result && viewRectangle(active.start, result.point, entry.source, rotation);
      const area = values && Math.abs(values.reduce((sum, a, i) => { const b = values[(i + 1) % values.length]; return sum + a.x * b.y - b.x * a.y; }, 0));
      if (values && area > .000001 && values.every(point => insideMap(point, entry.source))) add(active.rectangle, values);
      else { setPoints([]); if (values && area > .000001) setNotice('Vùng vẽ vượt ra ngoài ảnh quét. Kéo vùng nhỏ hơn hoặc dùng Đa giác sát mép map.'); }
    } else if (JSON.stringify(active.before) !== JSON.stringify(current.current)) { setHistory(h => [...h.slice(-49), active.before]); setFuture([]); }
  };
  const action = async name => {
    setBusy(true); setError(''); setNotice('');
    try {
      const snapshot = name === 'unpublish' ? current.current : persistRoomColors(current.current), changed = JSON.stringify(snapshot) !== saved;
      const issues = presentationIssues(snapshot, entry.source); if (issues.length) throw Error(issues[0]);
      if (name === 'publish') {
        const incomplete = snapshot.features.find(feature => feature.type === 'ROOM' && (!feature.endpointId || !feature.endpointName?.trim() || !feature.roomCode?.trim() || !(feature.roomName || feature.label)?.trim() || !feature.roomType?.trim()));
        if (incomplete) throw Error(`Phòng "${incomplete.roomName || incomplete.label || 'chưa đặt tên'}" cần đủ mã phòng, tên, loại phòng, điểm đích và tên endpoint trước khi áp dụng.`);
      }
      let value = entry;
      if (name !== 'unpublish' && (changed || !entry.revision)) value = await mapPresentationApi.save(mapId, { expectedRevision: entry.revision, sourceAssetHash: entry.source.assetHash, document: snapshot });
      // Commit save acknowledgement before publishing so a failed publish can be retried.
      setEntry(value);
      if (name !== 'unpublish' && Math.abs((value.draft.rotationDegrees ?? 0) - (snapshot.rotationDegrees ?? 0)) > .000001) throw Error('Máy chủ chưa lưu được góc xoay. Cập nhật backend hỗ trợ căn hướng bản đồ rồi lưu lại.');
      if (name !== 'unpublish') { current.current = snapshot; setDocument(snapshot); setSaved(JSON.stringify(snapshot)); }
      if (name === 'publish') value = await mapPresentationApi.publish(mapId, value.revision);
      if (name === 'unpublish') value = await mapPresentationApi.unpublish(mapId, value.revision);
      setEntry(value);
      if (name === 'publish') {
        current.current = value.draft; setDocument(value.draft); setSaved(JSON.stringify(value.draft));
        const synchronized = value.draft.features.filter(feature => feature.type === 'ROOM' && feature.roomId).map(feature => ({
          roomId: feature.roomId, roomCode: feature.roomCode, roomName: feature.roomName || feature.label,
          roomType: feature.roomType, departmentCode: feature.departmentCode, description: feature.roomDescription,
          publicVisible: feature.roomPublicVisible !== false, active: true,
        }));
        roomCatalog.current = [...roomCatalog.current.filter(room => !synchronized.some(value => value.roomId === room.roomId)), ...synchronized];
        setRooms(previous => [...previous.filter(room => !synchronized.some(value => value.roomId === room.roomId)), ...synchronized]);
        setEndpoints(previous => previous.map(endpoint => {
          const feature = value.draft.features.find(item => item.type === 'ROOM' && item.endpointId === endpoint.endpointId);
          return feature ? { ...endpoint, endpointName: (feature.endpointName || endpoint.endpointName || '').trim(), roomId: feature.roomId, publicVisible: feature.roomPublicVisible !== false || endpoint.publicVisible } : endpoint;
        }));
      }
      setNotice(name === 'publish' ? 'Đã áp dụng bản đồ và đồng bộ phòng, điểm đích vào database.' : name === 'unpublish' ? 'Đã bỏ áp dụng bản vẽ, giữ lại bản nháp.' : 'Đã lưu bản nháp trên máy chủ.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const discardReload = () => { if (!dirty || window.confirm('Bỏ các chỉnh sửa chưa lưu và tải lại?')) setReload(v => v + 1); };
  const pointerCancel = () => {
    if (drag.current?.before) { current.current = drag.current.before; setDocument(drag.current.before); }
    drag.current = null; setPoints([]); doorEdge.current = null; lastPointer.current = null; clearDrawingHints();
  };
  const pointerLeave = () => { if (!drag.current) { lastPointer.current = null; clearDrawingHints(); } };
  const duplicateSelected = () => {
    if (!selected || busy || preview || entry.sourceChanged) return;
    if (document.features.length >= 500) { setError('Tối đa 500 đối tượng.'); return; }
    const dx = Math.min(.15, entry.source.widthM - Math.max(...selected.points.map(p => p.x)));
    const dy = Math.min(.15, entry.source.heightM - Math.max(...selected.points.map(p => p.y)));
    const clone = { ...selected, id: crypto.randomUUID(), label: selected.label ? (selected.label + ' (bản sao)').slice(0, 120) : '', points: selected.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    if (clone.type === 'ROOM') {
      clone.color = nextRoomColor(clone.points, document.features); clone.roomId = null; clone.endpointId = null; clone.endpointName = '';
      clone.roomCode = nextRoomCode([...roomCatalog.current, ...document.features]); clone.roomName = clone.label; clone.roomPublicVisible = true;
    }
    change({ ...document, features: [...document.features, clone] }); setSelectedId(clone.id);
  };
  const removeSelected = () => {
    if (!selected || busy || preview) return;
    if (selected.type === 'ROOM' && selected.roomId && !window.confirm('Chỉ xóa hình phòng khỏi giao diện. Phòng và lịch sử đang dùng phòng này vẫn được giữ trong database. Tiếp tục?')) return;
    change({ ...document, features: document.features.filter(feature => feature.id !== selected.id) }); setSelectedId('');
  };
  useEffect(() => {
    const svg = svgRef.current; if (!svg || !entry) return;
    const wheel = event => {
      if (!event.deltaY) return;
      event.preventDefault();
      const matrix = svg.getScreenCTM(); if (!matrix) return;
      const anchor = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      zoom(event.deltaY > 0 ? 1.15 : 1 / 1.15, anchor);
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => svg.removeEventListener('wheel', wheel);
  }, [entry, loading]);
  useEffect(() => {
    const keydown = event => {
      if (!entry || !document || busy || entry.sourceChanged) return;
      const editing = event.target instanceof HTMLElement && (event.target.matches('input,select,textarea') || event.target.isContentEditable);
      const activatingControl = event.target instanceof HTMLElement && event.target.matches('button,summary,a');
      const modifier = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
      if (modifier && key === 's') { event.preventDefault(); if (!event.repeat) action('save'); return; }
      if (editing) return;
      if ((key === 'alt' || key === 'shift') && lastPointer.current) {
        const pointer = { ...lastPointer.current, altKey: event.altKey, shiftKey: event.shiftKey };
        pointerMove(pointer);
      }
      if (activatingControl && (event.code === 'Space' || event.code === 'Enter')) return;
      if (event.code === 'Space') { event.preventDefault(); setSpacePanning(true); return; }
      if (key === 'escape') {
        pointerCancel(); setTool('select');
        if (!points.length) setExpanded(false);
        return;
      }
      if (key === 'enter' && ['polygon', 'WALL'].includes(tool) && !preview) { event.preventDefault(); finish(); return; }
      if (modifier && key === 'z' && !preview) { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
      if (modifier && key === 'y' && !preview) { event.preventDefault(); redo(); return; }
      if ((key === 'delete' || key === 'backspace') && selectedId && !preview) { event.preventDefault(); removeSelected(); return; }
      const shortcuts = { v: 'select', h: 'pan', r: 'ROOM', g: 'CORRIDOR', p: 'polygon', w: 'WALL', d: 'DOOR', t: 'LABEL', l: 'LANDMARK' };
      if (!modifier && !event.altKey && !preview && shortcuts[key]) { event.preventDefault(); setTool(shortcuts[key]); setPoints([]); }
    };
    const keyup = event => {
      if (event.code === 'Space') setSpacePanning(false);
      if ((event.key === 'Alt' || event.key === 'Shift') && lastPointer.current) pointerMove({ ...lastPointer.current, altKey: event.altKey, shiftKey: event.shiftKey });
    };
    const blur = () => setSpacePanning(false);
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); };
  }, [entry, document, busy, preview, history, future, selectedId, tool, points, snapEnabled, spacePanning]);
  if (!mapId) return <div className="mp-empty"><h3>Chọn bản đồ đã quét</h3><p>Mở một bản đồ trong thư viện để chỉnh giao diện bản đồ.</p><button className="ls-btn primary" onClick={onOpenLibrary}>Chọn bản đồ</button></div>;
  if (loading) return <p role="status">Đang tải bản đồ và bản vẽ…</p>;
  if (!entry || !document) return <div className="mp-empty" role="alert"><p>{error}</p><button className="ls-btn" onClick={discardReload}>Tải lại</button></div>;
  const locked = busy || entry.sourceChanged;
  return <MapPresentationWorkspace {...{
    entry, document, selected, selectedId, setSelectedId, tool, setTool, points, setPoints,
    busy, dirty, locked, preview, setPreview, opacity, setOpacity, endpoints, rooms, imageUrl, imageError,
    error, notice, history, future, undo, redo, action, discardReload, update, change,
    finish, zoom, view, setView, svgRef, pointerDown, pointerMove, pointerUp, featureDown,
    pointerCancel, pointerLeave, expanded, setExpanded, spacePanning, showEndpoints, setShowEndpoints, duplicateSelected,
    rotation, rotate, beginRotation, endRotation, fitBounds, contentRef, showGrid, setShowGrid,
    snapEnabled, setSnapEnabled, drawingAssist, drawingPreview, doorPreview, removeSelected,
  }} />;
}
