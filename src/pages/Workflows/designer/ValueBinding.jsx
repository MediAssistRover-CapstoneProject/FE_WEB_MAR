import { Field } from './DesignerControls.jsx';
import { JsonField } from './DesignerFields.jsx';
import ReferencePicker from './ReferencePicker.jsx';
import { inputRef } from '../../../features/workflows/designer/designerModel.js';
import { variableFitsField } from '../../../features/workflows/designer/stepCatalog.js';
import { parseReference } from '../../../features/workflows/designer/referenceOptions.js';

export default function ValueBinding({ field, value, onChange, document, nodeId, disabled, renderFixed, onCreate, raw, onJsonChange }) {
  const ref = typeof value?.$ref === 'string' ? value.$ref : null;
  const source = ref ? parseReference(ref).source : 'fixed';
  const variables = document.variables.filter(v => variableFitsField(v, field));
  const variableKey = ref ? parseReference(ref).key : '';
  const jsonChange = onJsonChange ?? ((next, invalid) => onChange(invalid === undefined ? next : { __invalidJSON: invalid }));
  return <section className="wfd-param"><div className="wfd-param-title"><strong>{field.label}{field.required ? ' *' : ''}</strong>{!field.fixed && <select aria-label={`Nguồn ${field.label}`} disabled={disabled} value={source} onChange={e => {
    if (e.target.value === 'fixed') onChange(field.kind === 'object' ? {} : field.kind === 'array' ? [] : field.kind === 'boolean' ? false : ['number', 'integer'].includes(field.kind) ? 0 : field.options?.[0] ?? '');
    else if (e.target.value === 'input') onChange(inputRef(variables[0]?.key ?? ''));
    else onChange({ $ref: e.target.value === 'context' ? '/vars/' : '/outputs/' });
  }}><option value="fixed">Cố định</option><option value="input">Biến đầu vào</option><option value="output">Kết quả bước trước</option><option value="context">Biến ngữ cảnh</option>{source === 'custom' && <option value="custom">Tham chiếu hiện có</option>}</select>}</div>
  {source === 'input' ? <>
    <Field label={`Biến cho ${field.label}`}><select value={variableKey} disabled={disabled} onChange={e => onChange(inputRef(e.target.value))}><option value="">Chọn biến</option>{variableKey && !variables.some(v => v.key === variableKey) && <option value={variableKey} disabled>Biến không phù hợp · {variableKey}</option>}{variables.map(v => <option key={v.key} value={v.key}>{v.label} · {v.key}</option>)}</select></Field>
    {!variables.length && <p className="wfd-muted">Chưa có biến đúng kiểu cho trường này.</p>}
    {onCreate && <button className="wfd-link" disabled={disabled} type="button" onClick={onCreate}>{field.key === 'service_request_id' ? '+ Dùng biến service_request_id' : '+ Tạo biến tại đây'}</button>}
  </> : ref ? <ReferencePicker document={document} nodeId={nodeId} field={field} sourceOnly={source === 'custom' ? undefined : source} value={ref} disabled={disabled} label={`Tham chiếu cho ${field.label}`} onChange={path => onChange({ $ref: path })} /> : renderFixed ? renderFixed() : ['object', 'array'].includes(field.kind) ?
    <JsonField label={field.label + ' (JSON)'} value={value?.__invalidJSON !== undefined ? undefined : value} raw={raw ?? value?.__invalidJSON} disabled={disabled} onChange={jsonChange} /> :
    <Field label={field.label}>{field.options || field.kind === 'boolean' ? <select value={value === undefined ? '' : String(value)} disabled={disabled} onChange={e => onChange(e.target.value === '' ? undefined : field.kind === 'boolean' ? e.target.value === 'true' : e.target.value)}><option value="">Chưa đặt</option>{(field.options ?? ['true', 'false']).map(o => <option key={o} value={o}>{o}</option>)}</select> : <input disabled={disabled} type={['number', 'integer'].includes(field.kind) ? 'number' : 'text'} step={field.kind === 'integer' ? 1 : 'any'} min={field.min ?? field.exclusiveMin} max={field.max} maxLength={field.maxLength} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : ['number', 'integer'].includes(field.kind) ? Number(e.target.value) : e.target.value)} />}</Field>}
  </section>;
}
