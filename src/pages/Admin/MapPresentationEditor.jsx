import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../features/api/client.js';
import { allFacilityPages, facilityApi } from '../../features/facility/facilityApi.js';
import { insideMap, mapPresentationApi, newFeature, presentationIssues, rectangle } from '../../features/facility/mapPresentation.js';
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
  const svgRef = useRef(null), drag = useRef(null), current = useRef(document);
  current.current = document;
  const dirty = document && JSON.stringify(document) !== saved;
  const selected = document?.features.find(f => f.id === selectedId);
  useEffect(() => { onDirtyChange?.(!!dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!mapId) { setLoading(false); return; }
    const controller = new AbortController(); let url;
    setLoading(true); setError(''); setImageError(''); setEntry(null); setDocument(null); setImageUrl(''); setPoints([]); setSelectedId(''); setHistory([]); setFuture([]);
    Promise.all([mapPresentationApi.get(mapId, controller.signal), allFacilityPages(facilityApi.listEndpoints)]).then(([value, rows]) => {
      if (controller.signal.aborted) return;
      setEntry(value); setDocument(value.draft); setSaved(JSON.stringify(value.draft)); setEndpoints(rows.filter(e => e.mapId === mapId));
      setView({ x: 0, y: 0, width: value.source.widthM, height: value.source.heightM });
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    apiRequest(`/api/v1/maps/${encodeURIComponent(mapId)}/image.png`, { signal: controller.signal, responseType: 'blob' }).then(blob => {
      if (!controller.signal.aborted) { url = URL.createObjectURL(blob); setImageUrl(url); }
    }).catch(e => { if (!controller.signal.aborted) setImageError(e.message); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [mapId, reload]);
  useEffect(() => {
    if (!dirty) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const change = next => { const previous = current.current; setHistory(h => [...h.slice(-49), previous]); setFuture([]); current.current = next; setDocument(next); setNotice(''); };
  const update = patch => change({ ...document, features: document.features.map(f => f.id === selectedId ? { ...f, ...patch } : f) });
  const add = (type, values) => {
    const feature = newFeature(type, values, entry.source);
    change({ ...current.current, features: [...current.current.features, feature] }); setSelectedId(feature.id); setPoints([]); setTool('select');
  };
  const finish = () => { if (points.length >= 3) add('ROOM', points); };
  const undo = () => { if (!history.length) return; setFuture(f => [document, ...f]); setDocument(history.at(-1)); setHistory(h => h.slice(0, -1)); setPoints([]); };
  const redo = () => { if (!future.length) return; setHistory(h => [...h, document]); setDocument(future[0]); setFuture(f => f.slice(1)); };
  const localPoint = event => {
    const svg = svgRef.current, matrix = svg?.getScreenCTM(); if (!matrix) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const local = { x: p.x, y: entry.source.heightM - p.y };
    return insideMap(local, entry.source) ? local : null;
  };
  const zoom = (factor, anchor = null) => setView(previous => {
    const width = Math.min(entry.source.widthM, Math.max(entry.source.widthM / 12, previous.width * factor));
    const height = width * entry.source.heightM / entry.source.widthM;
    const xRatio = anchor ? (anchor.x - previous.x) / previous.width : .5, yRatio = anchor ? (anchor.y - previous.y) / previous.height : .5;
    return { width, height, x: Math.max(0, Math.min(entry.source.widthM - width, previous.x + (previous.width - width) * xRatio)), y: Math.max(0, Math.min(entry.source.heightM - height, previous.y + (previous.height - height) * yRatio)) };
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
    if (tool === 'select') { setSelectedId(''); return; }
    if (['ROOM', 'CORRIDOR'].includes(tool)) { svgRef.current.setPointerCapture(event.pointerId); drag.current = { rectangle: tool, start: p }; setPoints(rectangle(p, p)); }
    else if (['LABEL', 'LANDMARK'].includes(tool)) add(tool, [p]);
    else if (['WALL', 'DOOR'].includes(tool)) { if (points.length) add(tool, [points[0], p]); else setPoints([p]); }
    else setPoints(values => [...values, p]);
  };
  const pointerMove = event => {
    const active = drag.current; if (!active) return;
    if (active.pan) {
      setView({ ...active.view, x: Math.max(0, Math.min(entry.source.widthM - active.view.width, active.view.x - (event.clientX - active.start.x) / active.scale)), y: Math.max(0, Math.min(entry.source.heightM - active.view.height, active.view.y - (event.clientY - active.start.y) / active.scale)) });
      return;
    }
    const p = localPoint(event); if (!p) return;
    if (active.rectangle) { setPoints(rectangle(active.start, p)); return; }
    const original = active.before.features.find(f => f.id === active.id);
    const values = original.points.map((point, i) => active.vertex === null ? { x: point.x + p.x - active.start.x, y: point.y + p.y - active.start.y } : i === active.vertex ? p : point);
    if (values.some(point => !insideMap(point, entry.source))) return;
    const next = { ...active.before, features: active.before.features.map(f => f.id === active.id ? { ...f, points: values } : f) };
    current.current = next; setDocument(next);
  };
  const pointerUp = event => {
    const active = drag.current; if (!active) return;
    drag.current = null;
    if (active.pan) return;
    if (active.rectangle) {
      const p = localPoint(event), values = p && rectangle(active.start, p);
      if (values && Math.abs((p.x - active.start.x) * (p.y - active.start.y)) > .000001) add(active.rectangle, values);
      else setPoints([]);
    } else if (JSON.stringify(active.before) !== JSON.stringify(current.current)) { setHistory(h => [...h.slice(-49), active.before]); setFuture([]); }
  };
  const action = async name => {
    setBusy(true); setError(''); setNotice('');
    try {
      const issues = presentationIssues(document, entry.source); if (issues.length) throw Error(issues[0]);
      let value = entry;
      if (name !== 'unpublish' && (dirty || !entry.revision)) value = await mapPresentationApi.save(mapId, { expectedRevision: entry.revision, sourceAssetHash: entry.source.assetHash, document });
      // Commit save acknowledgement before publishing so a failed publish can be retried.
      setEntry(value); if (name !== 'unpublish') setSaved(JSON.stringify(document));
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
    const clone = { ...selected, id: crypto.randomUUID(), label: (selected.label + ' (bản sao)').slice(0, 120), points: selected.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
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
  }} />;
}
