import { useEffect, useState } from 'react';
import { normalizeRotation } from '../../features/facility/mapPresentationView.js';

const angleText = value => String(Number(value.toFixed(2)));

export default function MapRotationControls({ rotation, rotate, beginRotation, endRotation, disabled, aligning, onAlign, showGrid, setShowGrid }) {
  const [text, setText] = useState(angleText(rotation));
  useEffect(() => { setText(angleText(rotation)); }, [rotation]);
  const commit = () => {
    if (text === angleText(rotation)) return;
    const value = Number(text);
    if (text.trim() && Number.isFinite(value)) { const normalized = normalizeRotation(value); setText(angleText(normalized)); rotate(normalized); }
    else setText(angleText(rotation));
  };
  return <div className="mp-rotation-controls" role="group" aria-label="Căn hướng bản đồ">
    <span className="mp-rotation-title">Xoay map</span>
    <div className="mp-rotation-angle">
      <button type="button" aria-label="Xoay trái 1 độ" title="Xoay trái 1°" disabled={disabled} onClick={() => rotate(rotation - 1)}>↶</button>
      <label><input aria-label="Góc xoay bản đồ" title="Nhập góc rồi nhấn Enter để áp dụng" type="number" step=".1" value={text} disabled={disabled} onChange={event => setText(event.target.value)} onBlur={commit} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') commit(); if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } if (event.key === 'Escape') { setText(angleText(rotation)); event.stopPropagation(); } }}/><span>°</span></label>
      <button type="button" aria-label="Xoay phải 1 độ" title="Xoay phải 1°" disabled={disabled} onClick={() => rotate(rotation + 1)}>↷</button>
    </div>
    <input className="mp-rotation-slider" aria-label="Thanh trượt xoay bản đồ" type="range" min="-180" max="180" step=".1" value={rotation} disabled={disabled} onPointerDown={beginRotation} onPointerUp={endRotation} onPointerCancel={endRotation} onKeyDown={event => { if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)) beginRotation(); }} onKeyUp={endRotation} onBlur={endRotation} onChange={event => rotate(Number(event.target.value))}/>
    <div className="mp-rotation-actions"><button type="button" aria-label="Xoay trái 90 độ" title="Xoay trái 90°" disabled={disabled} onClick={() => rotate(rotation - 90)}>−90°</button><button type="button" aria-label="Xoay phải 90 độ" title="Xoay phải 90°" disabled={disabled} onClick={() => rotate(rotation + 90)}>+90°</button><button type="button" disabled={disabled || rotation === 0} onClick={() => rotate(0)}>Về 0°</button></div>
    <button type="button" className={'mp-align-button' + (aligning ? ' is-active' : '')} aria-label="Căn theo tường" aria-pressed={aligning} disabled={disabled} onClick={onAlign}>⌖ Căn theo tường</button>
    <label className="mp-grid-toggle"><input type="checkbox" checked={showGrid} onChange={event => setShowGrid(event.target.checked)}/>Lưới căn</label>
  </div>;
}
