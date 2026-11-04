import { copy, effectiveParams, inputRef } from '../../../features/workflows/designer/designerModel.js';
import { variableFitsField } from '../../../features/workflows/designer/stepCatalog.js';
import { Field, ConditionFields } from './DesignerFields.jsx';
import ValueBinding from './ValueBinding.jsx';
import StructuredEditor from './StructuredEditors.jsx';

export default function ParameterField({ field, value, document, node, onSet, change, readOnly, catalog, onError, jsonChange }) {
  const set = next => onSet(next, typeof next?.$ref === 'string' ? 'reference' : 'fixed');
  const addVariable = () => {
    const service = field.key === 'service_request_id';
    const proposed = field.key === 'endpoint_id' ? `destination_${document.variables.length}_endpoint_id` : field.key;
    const key = service ? 'service_request_id' : window.prompt('Khóa biến mới (chữ, số và dấu _):', proposed);
    if (!key) return;
    const existing = document.variables.find(v => v.key === key);
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) || existing && (!service || !variableFitsField(existing, field))) { onError('Khóa biến đã tồn tại hoặc không đúng kiểu. Dùng một khóa khác hoặc sửa kiểu biến.'); return; }
    change(doc => {
      const next = copy(doc), kind = field.widget ?? (field.kind === 'enum' ? 'select' : field.kind);
      if (!existing) next.variables.push({ key, label: field.label, kind, required: field.required, options: field.options, ...(field.format ? { schema: { type: kind === 'select' ? 'string' : kind, format: field.format } } : {}), ...(kind === 'endpoint' ? { mapVariable: next.variables.find(v => v.kind === 'map')?.key ?? '', selection: 'endpoint' } : {}) });
      const target = next.nodes.find(n => n.id === node.id);
      delete target.data.params[field.key]; target.data.mapping[field.key] = inputRef(key);
      return next;
    });
  };
  const jsonKey = `${node.id}:field:${field.key}`;
  const jsonUpdate = jsonChange(jsonKey, (next, parsed) => {
    const target = next.nodes.find(n => n.id === node.id); delete target.data.mapping[field.key];
    if (parsed === undefined) delete target.data.params[field.key]; else target.data.params[field.key] = parsed;
  });
  let renderFixed;
  if (field.kind === 'condition') renderFixed = () => <ConditionFields value={value} document={document} currentNode={node.id} disabled={readOnly} onChange={set} />;
  else if (field.editor) renderFixed = () => <StructuredEditor field={field} value={value} document={document} nodeId={node.id} disabled={readOnly} onChange={set} raw={document.invalidJson?.[jsonKey]} onJsonChange={jsonUpdate} />;
  else if (field.widget === 'map') renderFixed = () => <Field label={field.label}><select disabled={readOnly} value={value ?? ''} onChange={e => set(e.target.value || undefined)}><option value="">Chọn bản đồ</option>{value && !catalog.maps.some(m => m.mapId === value && m.status === 'ACTIVE') && <option value={value} disabled>Bản đồ hiện tại không khả dụng</option>}{catalog.maps.filter(m => m.status === 'ACTIVE').map(m => <option key={m.mapId} value={m.mapId}>{m.mapName}</option>)}</select></Field>;
  else if (field.widget === 'endpoint') renderFixed = () => {
    const params = effectiveParams(node), mapId = typeof params.map_id === 'string' ? params.map_id : '';
    const points = catalog.endpoints.filter(e => e.mapId === mapId && e.active && e.accessible);
    return <Field label={field.label}><select disabled={readOnly || !mapId} value={value ?? ''} onChange={e => set(e.target.value || undefined)}><option value="">{mapId ? 'Chọn điểm đến' : 'Cố định bản đồ trước khi chọn điểm'}</option>{value && !points.some(e => e.endpointId === value) && <option value={value} disabled>Điểm hiện tại không khả dụng</option>}{points.map(e => <option key={e.endpointId} value={e.endpointId}>{e.endpointName}</option>)}</select></Field>;
  };
  return <ValueBinding field={field} value={value} document={document} nodeId={node.id} disabled={readOnly} onChange={set} onCreate={addVariable} renderFixed={renderFixed} raw={document.invalidJson?.[jsonKey]} onJsonChange={jsonUpdate} />;
}
