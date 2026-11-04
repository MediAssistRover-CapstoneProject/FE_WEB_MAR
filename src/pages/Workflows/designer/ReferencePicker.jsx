import { useState } from 'react';
import { Field } from './DesignerControls.jsx';
import { parseReference, pointerEscape, referenceOptions } from '../../../features/workflows/designer/referenceOptions.js';
import { variableFitsField } from '../../../features/workflows/designer/stepCatalog.js';

export default function ReferencePicker({ document, nodeId, value = '', onChange, disabled, includeSelf = false, field, sourceOnly, label = 'Đường dẫn dữ liệu' }) {
  const options = referenceOptions(document, nodeId, includeSelf);
  const [custom, setCustom] = useState(false);
  const parsed = parseReference(value || '/inputs/');
  const source = sourceOnly ?? (custom ? 'custom' : parsed.source);
  const chosenStep = options.outputs.find(n => n.id === parsed.key);
  const fits = item => !field || variableFitsField({ ...item, kind: item.kind === 'unknown' ? field.kind : item.kind }, field);
  const inputs = options.inputs.filter(fits), context = options.context.filter(fits);
  const outputFields = chosenStep?.fields.filter(fits) ?? [];
  const customOutput = parsed.field && !outputFields.some(f => f.path === parsed.field);
  const chooseSource = next => {
    setCustom(next === 'custom');
    if (next === 'input') onChange('/inputs/' + pointerEscape(inputs[0]?.key ?? ''));
    else if (next === 'output') { const step = [...options.outputs].reverse().find(n => n.fields.some(fits)); const output = step?.fields.find(fits); onChange(`/outputs/${pointerEscape(step?.id ?? '')}${output?.path ? '/' + output.path : ''}`); }
    else if (next === 'context') onChange('/vars/' + pointerEscape(context[0]?.key ?? ''));
    else onChange(value || '/');
  };
  return <div className="wfd-reference-picker">
    {!sourceOnly && <Field label="Nguồn dữ liệu"><select value={source} disabled={disabled} onChange={e => chooseSource(e.target.value)}>
      <option value="input">Đầu vào quy trình</option><option value="output">Kết quả bước trước</option><option value="context">Biến ngữ cảnh</option><option value="custom">Đường dẫn tùy chỉnh</option>
    </select></Field>}
    {source === 'input' && <><Field label="Biến đầu vào"><select value={parsed.key} disabled={disabled} onChange={e => onChange('/inputs/' + pointerEscape(e.target.value))}><option value="">Chọn biến đầu vào</option>{parsed.key && !inputs.some(v => v.key === parsed.key) && <option value={parsed.key} disabled>Biến chưa khai báo / không phù hợp · {parsed.key}</option>}{inputs.map(v => <option key={v.key} value={v.key}>{v.label || v.key} · {v.key}</option>)}</select></Field>{!inputs.length && <p className="wfd-muted">Chưa có biến đầu vào phù hợp. Khai báo tại Thông tin & biến.</p>}</>}
    {source === 'output' && <>
      <Field label="Bước cung cấp dữ liệu"><select disabled={disabled} value={parsed.key} onChange={e => { const step = options.outputs.find(n => n.id === e.target.value); const output = step?.fields.find(fits); onChange(`/outputs/${pointerEscape(e.target.value)}/${output?.path ?? ''}`); }}><option value="">Chọn bước đã chạy thành công</option>{parsed.key && !options.outputs.some(n => n.id === parsed.key) && <option value={parsed.key} disabled>Bước chưa có trên mọi đường chạy · {parsed.key}</option>}{options.outputs.map(n => <option value={n.id} key={n.id}>Bước {n.sequence} · {n.name} · {n.stepType}</option>)}</select></Field>
      <Field label="Trường kết quả"><select disabled={disabled || !chosenStep} value={parsed.field} onChange={e => onChange(`/outputs/${pointerEscape(parsed.key)}/${e.target.value}`)}><option value="">{field?.kind === 'object' ? 'Toàn bộ kết quả (kiểm tra cấu trúc trước khi dùng)' : 'Chọn trường kết quả'}</option>{customOutput && <option value={parsed.field}>Đường dẫn hiện có · {parsed.field}</option>}{outputFields.map(f => <option key={f.path} value={f.path}>{f.label} · {f.path} ({f.kind}){f.optional ? ' (tùy kết quả)' : ''}{f.nullable ? ' (có thể null)' : ''}</option>)}</select></Field>
      {!options.outputs.length && <p className="wfd-muted">Chưa có output khả dụng. Nối đường Thành công từ bước cung cấp dữ liệu tới bước này; output chỉ có sau khi bước đó hoàn tất.</p>}
    </>}
    {source === 'context' && <><Field label="Biến ngữ cảnh"><select disabled={disabled} value={parsed.key} onChange={e => onChange('/vars/' + pointerEscape(e.target.value))}><option value="">Chọn biến đã được gán</option>{parsed.key && !context.some(v => v.key === parsed.key) && <option value={parsed.key}>Đường dẫn hiện có · {parsed.key}</option>}{context.map(v => <option value={v.key} key={v.key}>{v.label}</option>)}</select></Field>{!context.length && <p className="wfd-muted">Thêm bước Ghi ngữ cảnh và nối trước bước này để chọn biến.</p>}</>}
    <Field label={label} help={source === 'custom' ? 'Dùng /inputs/…, /outputs/MÃ_BƯỚC/TRƯỜNG hoặc /vars/…; hệ thống sẽ kiểm tra trước khi lưu.' : 'Đường dẫn tự tạo từ lựa chọn; không cần tự gõ mã bước.'}><input value={value} readOnly={source !== 'custom'} disabled={disabled} onChange={e => onChange(e.target.value)} placeholder="Chọn nguồn dữ liệu ở trên" /></Field>
  </div>;
}
