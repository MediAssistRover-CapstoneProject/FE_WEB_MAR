import { useState } from 'react';
import { Field } from './DesignerControls.jsx';
import { JsonField } from './DesignerFields.jsx';
import ValueBinding from './ValueBinding.jsx';
import { speechFields } from '../../../features/workflows/designer/stepCatalog.js';
import { referenceOptions, parseReference, referenceValueKind } from '../../../features/workflows/designer/referenceOptions.js';
import { authorizationFromStep, effectiveParams } from '../../../features/workflows/designer/designerModel.js';
import { inferKind } from '../../../features/workflows/designer/stepOutputs.js';

export default function StructuredEditor({ field, value, document, nodeId, disabled, onChange, raw, onJsonChange }) {
  const [error, setError] = useState('');
  const node = document.nodes.find(n => n.id === nodeId), params = effectiveParams(node);
  const common = { document, nodeId, disabled };
  const advanced = <details className="wfd-details"><summary>{field.label} · JSON nâng cao</summary><JsonField label={field.label + ' (JSON)'} value={value} raw={raw} disabled={disabled} onChange={onJsonChange} /></details>;
  if (field.editor === 'authorization') {
    const auths = referenceOptions(document, nodeId).outputs.filter(n => n.stepType === 'AUTHENTICATE').map(n => ({ ...n, purpose: document.nodes.find(v => v.id === n.id).data.params.purpose }));
    const selected = parseReference(value?.verification_id?.$ref).key;
    const chooseAuth = id => {
      try { onChange(id ? authorizationFromStep(document, nodeId, id) : undefined); setError(''); }
      catch (e) { setError(e.message); }
    };
    return <div className="wfd-structured"><Field label="Bước xác thực cấp quyền" help="Tạo đối tượng quyền theo đúng BE; người gửi và người nhận dùng xác thực riêng."><select disabled={disabled} value={selected} onChange={e => chooseAuth(e.target.value)}><option value="">Chọn bước Xác thực trước đó</option>{selected && !auths.some(a => a.id === selected) && <option value={selected} disabled>Xác thực chưa khả dụng · {selected}</option>}{auths.map(a => <option value={a.id} key={a.id}>{a.name} · {typeof a.purpose === 'string' ? a.purpose : 'Mục đích chưa cố định'}</option>)}</select></Field>{error && <p role="alert" className="wfd-error">{error}</p>}{!auths.length && <p className="wfd-muted">Nối Xác thực → Kiểm tra điều kiện → Mở ngăn hàng bằng các nhánh thành công/đúng để chọn nguồn quyền.</p>}{value && <p className="wfd-muted">{value.mode} · {value.purpose}. verification_id, tài khoản và thời hạn sẽ lấy từ output xác thực.</p>}{advanced}</div>;
  }
  if (field.editor === 'interaction-data') {
    const data = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const fields = params.action === 'SPEAK' ? speechFields : [{ key: 'text', label: 'Nội dung hiển thị / lời nhắc', kind: 'string' }];
    return <div className="wfd-structured">{fields.map(f => <ValueBinding key={f.key} {...common} field={f} value={data[f.key]} onChange={next => { const updated = { ...data }; if (next === undefined) delete updated[f.key]; else updated[f.key] = next; onChange(updated); }} />)}{advanced}</div>;
  }
  if (field.editor === 'items') {
    const items = Array.isArray(value) ? value : [];
    return <div className="wfd-structured">{items.map((item, i) => <div className="wfd-repeat-row" key={i}><ValueBinding {...common} field={{ key: 'item_code', label: `Mã hàng ${i + 1}`, kind: 'string', required: true }} value={item?.item_code} onChange={next => onChange(items.map((v, j) => i === j ? { ...v, item_code: next } : v))} /><ValueBinding {...common} field={{ key: 'quantity', label: `Số lượng ${i + 1}`, kind: 'integer', min: 1, required: true }} value={item?.quantity} onChange={next => onChange(items.map((v, j) => i === j ? { ...v, quantity: next } : v))} /><button type="button" disabled={disabled} onClick={() => onChange(items.filter((_, j) => i !== j))}>Xóa hàng {i + 1}</button></div>)}<button type="button" disabled={disabled} onClick={() => onChange([...items, { item_code: '', quantity: 1 }])}>+ Thêm hàng</button>{advanced}</div>;
  }
  if (field.editor === 'operations') {
    const ops = Array.isArray(value) ? value : [];
    return <div className="wfd-structured">{ops.map((op, i) => {
      op = op && typeof op === 'object' ? op : {}; const update = patch => onChange(ops.map((v, j) => i === j ? { ...v, ...patch } : v));
      const inferred = typeof op.value?.$ref === 'string' ? referenceValueKind(document, nodeId, op.value.$ref) : inferKind(op.value);
      const kind = op.operation === 'INCREMENT' || inferred === 'integer' ? 'number' : inferred === 'unknown' ? 'string' : inferred;
      return <div className="wfd-repeat-row" key={i}><Field label={`Biến ngữ cảnh ${i + 1}`} help="Chỉ nhập tên, ví dụ delivered_count."><input disabled={disabled} value={typeof op.path === 'string' ? op.path.replace(/^\/vars\//, '') : ''} onChange={e => update({ path: '/vars/' + e.target.value })} /></Field><Field label={`Phép cập nhật ${i + 1}`}><select disabled={disabled} value={op.operation ?? 'SET'} onChange={e => update({ operation: e.target.value, ...(e.target.value === 'INCREMENT' ? { value: 1 } : {}) })}><option>SET</option><option>INCREMENT</option></select></Field><Field label={`Kiểu giá trị ${i + 1}`}><select disabled={disabled || op.operation === 'INCREMENT'} value={['string', 'number', 'boolean', 'object', 'array'].includes(kind) ? kind : 'string'} onChange={e => update({ value: { string: '', number: 0, boolean: false, object: {}, array: [] }[e.target.value] })}>{['string', 'number', 'boolean', 'object', 'array'].map(k => <option key={k}>{k}</option>)}</select></Field><ValueBinding {...common} field={{ key: 'value', label: `Giá trị ${i + 1}`, kind, required: true }} value={op.value} onChange={next => update({ value: next })} /><button type="button" disabled={disabled} onClick={() => onChange(ops.filter((_, j) => i !== j))}>Xóa phép cập nhật {i + 1}</button></div>;
    })}<button type="button" disabled={disabled} onClick={() => onChange([...ops, { path: '/vars/variable_' + (ops.length + 1), operation: 'SET', value: '' }])}>+ Thêm phép cập nhật</button>{advanced}</div>;
  }
  if (field.editor === 'recipients') {
    const recipients = Array.isArray(value) ? value : [];
    return <div className="wfd-structured">{['STAFF', 'ADMIN'].map(role => <label className="wfd-check" key={role}><input type="checkbox" disabled={disabled} checked={recipients.includes(role)} onChange={e => onChange(e.target.checked ? [...recipients, role] : recipients.filter(v => v !== role))} />{role === 'STAFF' ? 'Nhân viên' : 'Quản trị viên'}</label>)}<p className="wfd-muted">Muốn chỉ định tài khoản cụ thể, nhập UUID tài khoản trong JSON nâng cao.</p>{advanced}</div>;
  }
  return advanced;
}
