import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../features/api/client.js';
import { allFacilityPages, facilityApi } from '../../features/facility/facilityApi.js';
import { insideMap, mapPresentationApi, newFeature, presentationIssues } from '../../features/facility/mapPresentation.js';
import { fromView, normalizeRotation, rotationBounds, straightenRotation, viewRectangle } from '../../features/facility/mapPresentationView.js';
import { doorFitsMap, doorGeometry } from '../../features/facility/doorGeometry.js';
import MapPresentationWorkspace from './MapPresentationWorkspace.jsx';
import './mapPresentation.css';

export default function MapPresentationEditor({ mapId, onOpenLibrary, onDirtyChange }) {
  const [entry, setEntry] = useState(null), [document, setDocument] = useState(null), [saved, setSaved] = useState('');
  const [endpoints, setEndpoints] = useState([]), [imageUrl, setImageUrl] = useState(''), [imageError, setImageError] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [tool, setTool] = useState('select'), [selectedId, setSelectedId] = useState(''), [opacity, setOpacity] = useState(1), [preview, setPreview] = useState(false), [points, setPoints] = useState([]);
  const [history, setHistory] = useState([]), [future, setFuture] = useState([]), [reload, setReload] = useState(0);
  const [view, setView] = useState(null);
  const [expanded, setExpanded] = useState(false), [spacePanning, setSpacePanning] = useState(false), [showEndpoints, setShowEndpoints] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const svgRef = useRef(null), contentRef = useRef(null), drag = useRef(null), current = useRef(document), rotationGesture = useRef(null);
  current.current = document;
  const dirty = document && JSON.stringify(document) !== saved;
  const selected = document?.features.find(f => f.id === selectedId);
  const rotation = document?.rotationDegrees ?? 0;
  const fitBounds = entry ? rotationBounds(entry.source, rotation) : null;
  useEffect(() => { onDirtyChange?.(!!dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!mapId) { setLoading(false); return; }
    const controller = new AbortController(); let url;
    setLoading(true); setError(''); setImageError(''); setEntry(null); setDocument(null); setImageUrl(''); setPoints([]); setSelectedId(''); setHistory([]); setFuture([]);
    Promise.all([mapPresentationApi.get(mapId, controller.signal), allFacilityPages(facilityApi.listEndpoints)]).then(([value, rows]) => {
      if (controller.signal.aborted) return;
      setEntry(value); setDocument(value.draft); setSaved(JSON.stringify(value.draft)); setEndpoints(rows.filter(e => e.mapId === mapId));
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
  const change = next => { const previous = current.current; setHistory(h => [...h.slice(-49), previous]); setFuture([]); current.current = next; setDocument(next); setNotice(''); };
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
    const next = { ...current.current, rotationDegrees: angle };
    drag.current = null; setPoints([]);
    if (rotationGesture.current) { current.current = next; setDocument(next); setNotice(''); }
    else change(next);
  };
  const update = patch => {
    let next = { ...selected, ...patch };
    if (next.type === 'DOOR' && patch.points) {
      const door = doorGeometry(next, entry.source);
      if (!doorFitsMap(door, entry.source)) { setNotice('Cánh cửa phải nằm trong map. Chọn vị trí hoặc hướng mở khác.'); return; }
      next = { ...next, points: [door.hinge, door.closed, door.open] };
    }
    change({ ...document, features: document.features.map(f => f.id === selectedId ? next : f) });
  };
  const add = (type, values) => {
    const feature = newFeature(type, values, entry.source);
    if (type === 'DOOR') {
      const door = doorGeometry(feature, entry.source);
      if (!doorFitsMap(door, entry.source)) { setNotice('Chọn hai mép cửa cách nhau và đủ chỗ cho cánh cửa mở trong map.'); return; }
      feature.points = [door.hinge, door.closed, door.open];
    }
    change({ ...current.current, features: [...current.current.features, feature] }); setSelectedId(feature.id); setPoints([]); setTool('select');
  };
  const finish = () => { if (points.length >= 3) add('ROOM', points); };
  const undo = () => { if (!history.length) return; setFuture(f => [document, ...f]); setDocument(history.at(-1)); setHistory(h => h.slice(0, -1)); setPoints([]); };
  const redo = () => { if (!future.length) return; setHistory(h => [...h, document]); setDocument(future[0]); setFuture(f => f.slice(1)); };
  const localPoint = event => {
    const matrix = contentRef.current?.getScreenCTM(); if (!matrix) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const local = fromView(p, entry.source, 0);
    return insideMap(local, entry.source) ? local : null;
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
    const p = localPoint(event); if (!p) return;
    if (tool === 'align') {
      if (!points.length) { setPoints([p]); return; }
      const angle = straightenRotation(points[0], p, entry.source, rotation);
      if (angle === null) { setNotice('Chọn hai điểm cách xa nhau trên cùng một đoạn tường thẳng.'); return; }
      rotate(angle); setPoints([]); setTool('select');
      setNotice('Đã căn tường theo chiều ngang/dọc. Lưu nháp để giữ góc xoay.');
      return;
    }
    if (tool === 'select') { setSelectedId(''); return; }
    if (['ROOM', 'CORRIDOR'].includes(tool)) { svgRef.current.setPointerCapture(event.pointerId); drag.current = { rectangle: tool, start: p }; setPoints(viewRectangle(p, p, entry.source, rotation)); }
    else if (['LABEL', 'LANDMARK'].includes(tool)) add(tool, [p]);
    else if (['WALL', 'DOOR'].includes(tool)) { if (points.length) add(tool, [points[0], p]); else setPoints([p]); }
    else setPoints(values => [...values, p]);
  };
  const pointerMove = event => {
    const active = drag.current; if (!active) return;
    if (active.pan) {
      const bounds = rotationBounds(entry.source, rotation);
      setView({ ...active.view, x: Math.max(bounds.x, Math.min(bounds.x + bounds.width - active.view.width, active.view.x - (event.clientX - active.start.x) / active.scale)), y: Math.max(bounds.y, Math.min(bounds.y + bounds.height - active.view.height, active.view.y - (event.clientY - active.start.y) / active.scale)) });
      return;
    }
    const p = localPoint(event); if (!p) return;
    if (active.rectangle) { setPoints(viewRectangle(active.start, p, entry.source, rotation)); return; }
    const original = active.before.features.find(f => f.id === active.id);
    let values = original.points.map((point, i) => active.vertex === null ? { x: point.x + p.x - active.start.x, y: point.y + p.y - active.start.y } : i === active.vertex ? p : point);
    if (original.type === 'DOOR') {
      const door = doorGeometry({ ...original, points: values }, entry.source);
      if (!doorFitsMap(door, entry.source)) return;
      values = [door.hinge, door.closed, door.open];
    }
    if (values.some(point => !insideMap(point, entry.source))) return;
    const next = { ...active.before, features: active.before.features.map(f => f.id === active.id ? { ...f, points: values } : f) };
    current.current = next; setDocument(next);
  };
  const pointerUp = event => {
    const active = drag.current; if (!active) return;
    drag.current = null;
    if (active.pan) return;
    if (active.rectangle) {
      const p = localPoint(event), values = p && viewRectangle(active.start, p, entry.source, rotation);
      const area = values && Math.abs(values.reduce((sum, a, i) => { const b = values[(i + 1) % values.length]; return sum + a.x * b.y - b.x * a.y; }, 0));
      if (values && area > .000001 && values.every(point => insideMap(point, entry.source))) add(active.rectangle, values);
      else { setPoints([]); if (values && area > .000001) setNotice('Vùng vẽ vượt ra ngoài ảnh quét. Kéo vùng nhỏ hơn hoặc dùng Đa giác sát mép map.'); }
    } else if (JSON.stringify(active.before) !== JSON.stringify(current.current)) { setHistory(h => [...h.slice(-49), active.before]); setFuture([]); }
  };
  const action = async name => {
    setBusy(true); setError(''); setNotice('');
    try {
      const snapshot = current.current, changed = JSON.stringify(snapshot) !== saved;
      const issues = presentationIssues(snapshot, entry.source); if (issues.length) throw Error(issues[0]);
      let value = entry;
      if (name !== 'unpublish' && (changed || !entry.revision)) value = await mapPresentationApi.save(mapId, { expectedRevision: entry.revision, sourceAssetHash: entry.source.assetHash, document: snapshot });
      // Commit save acknowledgement before publishing so a failed publish can be retried.
      setEntry(value);
      if (name !== 'unpublish' && Math.abs((value.draft.rotationDegrees ?? 0) - (snapshot.rotationDegrees ?? 0)) > .000001) throw Error('Máy chủ chưa lưu được góc xoay. Cập nhật backend hỗ trợ căn hướng bản đồ rồi lưu lại.');
      if (name !== 'unpublish') setSaved(JSON.stringify(snapshot));
      if (name === 'publish') value = await mapPresentationApi.publish(mapId, value.revision);
      if (name === 'unpublish') value = await mapPresentationApi.unpublish(mapId, value.revision);
      setEntry(value); setNotice(name === 'publish' ? 'Đã áp dụng bản đồ đã chỉnh.' : name === 'unpublish' ? 'Đã bỏ áp dụng bản vẽ, giữ lại bản nháp.' : 'Đã lưu bản nháp trên máy chủ.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const discardReload = () => { if (!dirty || window.confirm('Bỏ các chỉnh sửa chưa lưu và tải lại?')) setReload(v => v + 1); };
  const pointerCancel = () => {
    if (drag.current?.before) { current.current = drag.current.before; setDocument(drag.current.before); }
    drag.current = null; setPoints([]);
  };
  const duplicateSelected = () => {
    if (!selected || busy || preview || entry.sourceChanged) return;
    if (document.features.length >= 500) { setError('Tối đa 500 đối tượng.'); return; }
    const dx = Math.min(.15, entry.source.widthM - Math.max(...selected.points.map(p => p.x)));
    const dy = Math.min(.15, entry.source.heightM - Math.max(...selected.points.map(p => p.y)));
    const clone = { ...selected, id: crypto.randomUUID(), label: selected.label ? (selected.label + ' (bản sao)').slice(0, 120) : '', points: selected.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    change({ ...document, features: [...document.features, clone] }); setSelectedId(clone.id);
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
      if (activatingControl && (event.code === 'Space' || event.code === 'Enter')) return;
      if (event.code === 'Space') { event.preventDefault(); setSpacePanning(true); return; }
      if (key === 'escape') { pointerCancel(); setTool('select'); if (!points.length) setExpanded(false); return; }
      if (key === 'enter' && tool === 'polygon' && !preview) { event.preventDefault(); finish(); return; }
      if (modifier && key === 'z' && !preview) { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
      if (modifier && key === 'y' && !preview) { event.preventDefault(); redo(); return; }
      if ((key === 'delete' || key === 'backspace') && selectedId && !preview) { event.preventDefault(); change({ ...document, features: document.features.filter(f => f.id !== selectedId) }); setSelectedId(''); return; }
      const shortcuts = { v: 'select', h: 'pan', r: 'ROOM', g: 'CORRIDOR', p: 'polygon', w: 'WALL', d: 'DOOR', t: 'LABEL', l: 'LANDMARK' };
      if (!modifier && !event.altKey && !preview && shortcuts[key]) { event.preventDefault(); setTool(shortcuts[key]); setPoints([]); }
    };
    const keyup = event => { if (event.code === 'Space') setSpacePanning(false); };
    const blur = () => setSpacePanning(false);
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); };
  }, [entry, document, busy, preview, history, future, selectedId, tool, points]);
  if (!mapId) return <div className="mp-empty"><h3>Chọn bản đồ đã quét</h3><p>Mở một bản đồ trong thư viện để chỉnh giao diện bản đồ.</p><button className="ls-btn primary" onClick={onOpenLibrary}>Chọn bản đồ</button></div>;
  if (loading) return <p role="status">Đang tải bản đồ và bản vẽ…</p>;
  if (!entry || !document) return <div className="mp-empty" role="alert"><p>{error}</p><button className="ls-btn" onClick={discardReload}>Tải lại</button></div>;
  const locked = busy || entry.sourceChanged;
  return <MapPresentationWorkspace {...{
    entry, document, selected, selectedId, setSelectedId, tool, setTool, points, setPoints,
    busy, dirty, locked, preview, setPreview, opacity, setOpacity, endpoints, imageUrl, imageError,
    error, notice, history, future, undo, redo, action, discardReload, update, change,
    finish, zoom, view, setView, svgRef, pointerDown, pointerMove, pointerUp, featureDown,
    pointerCancel, expanded, setExpanded, spacePanning, showEndpoints, setShowEndpoints, duplicateSelected,
    rotation, rotate, beginRotation, endRotation, fitBounds, contentRef, showGrid, setShowGrid,
  }} />;
}
