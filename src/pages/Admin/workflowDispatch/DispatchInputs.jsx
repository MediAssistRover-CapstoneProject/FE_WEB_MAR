import { availableDestinations } from '../../../features/workflows/designer/designerModel.js';
import { dispatchVariables } from '../../../features/workflows/dispatchModel.js';
import { Field, JsonField } from '../../Workflows/designer/DesignerFields.jsx';

export default function DispatchInputs({ workflow, values, rooms, setRooms, catalog, errors, jsonErrors, onChange, disabled }) {
  return <div className="wd-inputs">{dispatchVariables(workflow).map(variable => {
    const value = values[variable.key], mapId = values[variable.mapVariable];
    const points = availableDestinations(catalog, mapId, rooms[variable.key]);
    const map = catalog.maps.find(item => item.mapId === mapId);
    const matchingRooms = catalog.rooms.filter(room => room.active && (!map?.floorId || room.floorId === map.floorId));
    const label = variable.label + (variable.required ? ' *' : '');
    const select = (options, placeholder, extraDisabled = false) => <select value={value === undefined ? '' : String(value)} disabled={disabled || extraDisabled} onChange={event => {
      const option = options.find(item => String(item.value) === event.target.value);
      onChange(variable, option?.value);
    }}><option value="">{placeholder}</option>{options.map(option => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select>;
    return <div key={variable.key}>
      {variable.kind === 'endpoint' && variable.selection === 'room-endpoint' && <Field label={'Phòng · ' + variable.label}><select value={rooms[variable.key] || ''} disabled={disabled || !mapId} onChange={event => { setRooms(previous => ({ ...previous, [variable.key]: event.target.value })); onChange(variable, undefined); }}><option value="">Chọn phòng</option>{matchingRooms.map(room => <option key={room.roomId} value={room.roomId}>{room.roomName}</option>)}</select></Field>}
      {['object', 'array'].includes(variable.kind) ? <JsonField label={label} value={value} raw={jsonErrors[variable.key]} disabled={disabled} help={variable.description} onChange={(next, raw) => onChange(variable, next, raw)} /> : <Field label={label} help={variable.description}>
        {variable.kind === 'map' ? select(catalog.maps.filter(item => item.status === 'ACTIVE').map(item => ({ value: item.mapId, label: item.mapName })), 'Chọn bản đồ')
          : variable.kind === 'endpoint' ? select(points.map(point => ({ value: point.endpointId, label: `${point.endpointName} · ${point.endpointCode}` })), mapId ? 'Chọn điểm đến' : 'Chọn bản đồ trước', !mapId || variable.selection === 'room-endpoint' && !rooms[variable.key])
          : variable.kind === 'boolean' ? select([{ value: true, label: 'Có' }, { value: false, label: 'Không' }], 'Chọn giá trị')
          : variable.kind === 'select' ? select((variable.options ?? []).map(option => typeof option === 'object' ? option : { value: option, label: String(option) }), 'Chọn giá trị')
          : <input type={['integer', 'number'].includes(variable.kind) ? 'number' : 'text'} step={variable.kind === 'integer' ? '1' : 'any'} min={variable.schema.minimum} max={variable.schema.maximum} maxLength={variable.schema.maxLength} value={value ?? ''} disabled={disabled} onChange={event => onChange(variable, event.target.value === '' ? undefined : ['integer', 'number'].includes(variable.kind) ? Number(event.target.value) : event.target.value)} />}
      </Field>}
      {errors[variable.key] && <small className="wd-field-error" role="alert">{errors[variable.key]}</small>}
    </div>;
  })}{!dispatchVariables(workflow).length && <p className="wd-muted">Quy trình này sử dụng cấu hình mặc định, không cần nhập thêm thông tin.</p>}</div>;
}
