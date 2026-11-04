import { useEffect, useState } from 'react';
import { operators } from '../../../features/workflows/designer/stepCatalog.js';
import { Field } from './DesignerControls.jsx';
import ReferencePicker from './ReferencePicker.jsx';
import { referenceValueKind } from '../../../features/workflows/designer/referenceOptions.js';
export { Field } from './DesignerControls.jsx';

export function JsonField({ label, value, raw, onChange, disabled, help }) {
  const canonical = JSON.stringify(value, null, 2) ?? '';
  const [text, setText] = useState(raw ?? canonical), [error, setError] = useState('');
  useEffect(() => { if (raw !== undefined) { setText(raw); setError('JSON chưa hợp lệ'); return; } setText(current => { try { return JSON.stringify(JSON.parse(current)) === JSON.stringify(value) ? current : canonical; } catch { return canonical; } }); setError(''); }, [canonical, raw]);
  return <Field label={label} help={help}><textarea aria-label={label} className="wfd-json" spellCheck={false} value={text} disabled={disabled} onChange={event => {
    const next = event.target.value; setText(next);
    try { const parsed = next.trim() ? JSON.parse(next) : undefined; setError(''); onChange(parsed, undefined); }
    catch { setError('JSON chưa hợp lệ'); onChange(value, next); }
  }} />{error && <small role="alert" className="wfd-error">{error}</small>}</Field>;
}

export function ConditionFields({ value = {}, onChange, disabled, document, currentNode, includeSelf = false }) {
  value = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const update = patch => {
    const next = { ...value, ...patch };
    delete next.__invalidValue;
    onChange(next);
  };
  return <div className="wfd-condition">
    <ReferencePicker document={document} nodeId={currentNode} value={value.path ?? ''} includeSelf={includeSelf} disabled={disabled} onChange={path => {
      const kind = referenceValueKind(document, currentNode, path), patch = { path };
      if (value.operator !== 'EXISTS' && value.operator !== 'IN' && kind !== 'unknown') {
        const defaults = { boolean: true, string: '', number: 0, integer: 0, array: [], object: {}, null: null };
        const compatible = kind === 'integer' || kind === 'number' ? typeof value.value === 'number' : kind === 'array' ? Array.isArray(value.value) : kind === 'null' ? value.value === null : kind === 'object' ? !!value.value && typeof value.value === 'object' && !Array.isArray(value.value) : typeof value.value === kind;
        patch.value = compatible ? value.value : Object.hasOwn(defaults, kind) ? defaults[kind] : value.value;
        if (['GT', 'GTE', 'LT', 'LTE'].includes(value.operator) && !['number', 'integer'].includes(kind)) patch.operator = 'EQ';
      }
      update(patch);
    }} />
    <Field label="Phép so sánh">
      <select value={value.operator ?? 'EQ'} disabled={disabled} onChange={e => {
        const next = { ...value, operator: e.target.value }; delete next.__invalidValue;
        if (e.target.value === 'EXISTS') delete next.value;
        else if (e.target.value === 'IN' && !Array.isArray(next.value)) next.value = [];
        else if (['GT', 'GTE', 'LT', 'LTE'].includes(e.target.value) && typeof next.value !== 'number') next.value = 0;
        else if (!Object.hasOwn(next, 'value')) next.value = true;
        onChange(next);
      }}>{operators.map(operator => <option key={operator}>{operator}</option>)}</select>
    </Field>
    {value.operator !== 'EXISTS' && <ConditionValue value={value.value} raw={value.__invalidValue} disabled={disabled}
      onChange={next => update({ value: next })}
      onJsonChange={(next, raw) => {
        const wrongShape = Array.isArray(value.value) ? !Array.isArray(next) : !next || typeof next !== 'object' || Array.isArray(next);
        if (raw !== undefined || wrongShape) onChange({ ...value, __invalidValue: raw ?? JSON.stringify(next) ?? '' });
        else update({ value: next });
      }} />}
  </div>;
}
function ConditionValue({ value, raw, onChange, onJsonChange, disabled }) {
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'object' ? 'object' : typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
  return <>
    <Field label="Kiểu giá trị"><select value={type} disabled={disabled} onChange={e => onChange({ array: [], object: {}, null: null, number: 0, boolean: true, string: '' }[e.target.value])}>
      <option value="string">Chuỗi</option><option value="number">Số</option><option value="boolean">Đúng / sai</option><option value="array">Mảng</option><option value="object">Đối tượng JSON</option><option value="null">null</option>
    </select></Field>
    {['array', 'object'].includes(type) ? <JsonField label="Giá trị so sánh" value={value} raw={raw} disabled={disabled} onChange={onJsonChange} /> : type === 'null' ? <p className="wfd-muted">So sánh với null.</p> :
      <Field label="Giá trị so sánh">{type === 'boolean' ?
        <select disabled={disabled} value={String(value)} onChange={e => onChange(e.target.value === 'true')}><option value="true">Đúng</option><option value="false">Sai</option></select> :
        <input disabled={disabled} type={type === 'number' ? 'number' : 'text'} value={value ?? ''} onChange={e => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />}
      </Field>}
  </>;
}
