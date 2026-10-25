import { useEffect, useId, useState } from 'react';
import { schemaOf, initialValue, operations, canUse } from '../../../features/api/contract.js';
import { callBackend, readCatalog } from '../../../features/api/backendApi.js';
import { fieldLabel, references, resources, valueAt, recordTitle } from '../../../features/api/workspaceCatalog.js';
import { vi } from '../../../i18n/vi.js';

function ReferenceField({ name, value, onChange, required, context, inputId, disabled }) {
  const reference = references[name];
  const [rows, setRows] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const local = context?.choices?.[name];
  const source = reference && resources.find(r => r.id === reference[0]);
  const op = source && operations[`GET ${source.root}`];
  useEffect(() => {
    if (local) { setRows(local); setLoading(false); return; }
    if (!op || !canUse(op, context?.role)) { setRows([]); setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setError('');
    readCatalog(op.key, { signal: controller.signal }).then(setRows).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [op?.key, local, context?.role, revision]);
  const allowQuickRoomCreate = name === 'roomId' && context?.quickRoomCreate === true && context?.role === 'ADMIN';
  const idKey = reference?.[1];
  const options = rows.filter(row => (!context?.mapId || !row.mapId || row.mapId === context.mapId || source?.id === 'maps') && (!allowQuickRoomCreate || row.active !== false)).map(row => local ? row : { value: valueAt(row, idKey), label: recordTitle(row) + (row.jobCode || row.requestCode ? ` · ${(row.jobCode || row.requestCode).slice(-6)}` : '') + (row.active === false ? ' · Ngừng hoạt động' : '') }).filter(row => row.value != null);
  return <>
    <select id={inputId} value={value || ''} required={required} disabled={disabled || loading} onChange={e => onChange(e.target.value)}>
      <option value="">{loading ? 'Đang tải…' : 'Chọn ' + fieldLabel(name).toLowerCase()}</option>
      {value && !options.some(o => String(o.value) === String(value)) && <option value={value}>Đang chọn: {value}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    {error && <small role="alert">{error} <button type="button" onClick={() => setRevision(v => v + 1)}>Thử tải lại</button></small>}
    {!loading && !error && !options.length && <small>{allowQuickRoomCreate ? 'Chưa có phòng đang hoạt động để chọn.' : 'Chưa có dữ liệu để chọn.'}</small>}
    {allowQuickRoomCreate && <QuickRoomCreate onCreated={room => { setRows(current => [room, ...current]); onChange(room.roomId); }} disabled={disabled} />}
  </>;
}

function QuickRoomCreate({ onCreated, disabled }) {
  const [open, setOpen] = useState(false), [floors, setFloors] = useState([]), [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [form, setForm] = useState({ floorId: '', roomCode: '', roomName: '', roomType: 'PHARMACY', departmentCode: '', description: '' });
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); setLoading(true); setError('');
    readCatalog('GET /api/v1/floors', { signal: controller.signal }).then(setFloors).catch(cause => {
      if (cause.name !== 'AbortError') setError(cause.message || 'Không tải được danh sách tầng.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open]);
  const set = (name, value) => setForm(current => ({ ...current, [name]: value }));
  const submit = async event => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      if (!form.floorId || !form.roomCode.trim() || !form.roomName.trim() || !form.roomType.trim()) throw Error('Vui lòng chọn tầng và nhập đủ mã, tên, loại phòng.');
      const room = await callBackend('POST /api/v1/rooms', { body: {
        floorId: form.floorId,
        roomCode: form.roomCode.trim().toUpperCase(),
        roomName: form.roomName.trim(),
        roomType: form.roomType.trim(),
        ...(form.departmentCode.trim() ? { departmentCode: form.departmentCode.trim() } : {}),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        active: true,
        publicVisible: false,
      } });
      onCreated(room); setOpen(false); setForm({ floorId: '', roomCode: '', roomName: '', roomType: 'PHARMACY', departmentCode: '', description: '' });
    } catch (cause) { setError(cause.message || 'Không thể tạo phòng.'); }
    finally { setSaving(false); }
  };
  return <><button type="button" className="be-create-inline" disabled={disabled} onClick={() => setOpen(true)}>+ Thêm phòng mới</button>
    {open && <dialog open className="be-dialog be-quick-room" aria-label="Thêm phòng mới">
      <header className="be-heading"><div><h2>Thêm phòng mới</h2><p>Phòng sẽ được lưu vào Danh mục bệnh viện và tự chọn cho ca trực này.</p></div><button type="button" disabled={saving} onClick={() => setOpen(false)}>Đóng</button></header>
      <form onSubmit={submit}><fieldset className="be-form-body" disabled={saving}>
        <div className="be-fields">
          <div className="be-field"><label>Tầng *</label><select required value={form.floorId} disabled={loading} onChange={event => set('floorId', event.target.value)}><option value="">{loading ? 'Đang tải tầng…' : 'Chọn tầng'}</option>{floors.filter(floor => floor.active !== false).map(floor => <option key={floor.floorId} value={floor.floorId}>{floor.floorCode} · {floor.floorName}</option>)}</select></div>
          <div className="be-field"><label>Mã phòng *</label><input required maxLength="64" value={form.roomCode} placeholder="VD: KHO_DUOC_F1" onChange={event => set('roomCode', event.target.value.toUpperCase())} /></div>
          <div className="be-field"><label>Tên phòng *</label><input required maxLength="160" value={form.roomName} placeholder="VD: Kho dược tầng 1" onChange={event => set('roomName', event.target.value)} /></div>
          <div className="be-field"><label>Loại phòng *</label><select value={form.roomType} onChange={event => set('roomType', event.target.value)}><option value="PHARMACY">Kho dược</option><option value="EXAMINATION">Phòng khám</option><option value="WARD">Phòng bệnh</option><option value="LABORATORY">Phòng xét nghiệm</option><option value="WAITING_AREA">Khu chờ</option><option value="OTHER">Khác</option></select></div>
          <div className="be-field"><label>Mã khoa/phòng ban</label><input maxLength="64" value={form.departmentCode} placeholder="VD: KHO_DUOC" onChange={event => set('departmentCode', event.target.value)} /></div>
          <div className="be-field be-wide"><label>Mô tả</label><textarea rows="3" value={form.description} onChange={event => set('description', event.target.value)} /></div>
        </div>
      </fieldset>{error && <p className="be-error" role="alert">{error}</p>}<footer className="be-actions"><button type="button" disabled={saving} onClick={() => setOpen(false)}>Hủy</button><button className="primary" type="submit" disabled={saving || loading}>{saving ? 'Đang lưu…' : 'Lưu phòng và chọn'}</button></footer></form>
    </dialog>}</>;
}

export default function SchemaFields({ schema, value = {}, onChange, context = {}, prefix = '', disabled = false }) {
  const s = schemaOf(schema);
  if (!s.properties) return <Field name="data" label="Cấu hình" definition={s} value={value} onChange={onChange} required context={context} disabled={disabled} />;
  return <div className="be-fields">{Object.entries(s.properties).filter(([name]) => {
    if (value.targetMode === 'ENDPOINT_GROUP' && ['destinationEndpointId', 'deliveryEndpointId'].includes(name)) return false;
    if (value.targetMode === 'ENDPOINT' && ['destinationGroupId', 'deliveryGroupId'].includes(name)) return false;
    return true;
  }).map(([name, def]) => <Field key={name} name={name} definition={def} label={prefix + fieldLabel(name)} value={value[name]} required={s.required?.includes(name)} disabled={disabled} context={{ ...context, mapId: value.mapId || context.mapId }} onChange={next => {
    const updated = { ...value, [name]: next };
    if (name === 'mapId' && next !== value.mapId) for (const field of ['zoneId', 'destinationEndpointId', 'destinationGroupId', 'pickupEndpointId', 'deliveryEndpointId', 'deliveryGroupId', 'originEndpointId', 'endpointId', 'endpointGroupId']) delete updated[field];
    onChange(updated);
  }} />)}</div>;
}

function Field({ name, definition, label = fieldLabel(name), value, onChange, required, context, disabled }) {
  const id = useId(), s = schemaOf(definition);
  const object = !!s.properties;
  const freeJson = !s.type && !s.enum || s.type === 'object' && !object;
  const [jsonDraft, setJsonDraft] = useState(() => typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value, null, 2));
  if (object) return <fieldset className="be-nested" disabled={disabled}><legend>{label}{required ? ' *' : ''}</legend><SchemaFields schema={s} value={value || {}} onChange={onChange} context={context} prefix={label + ' / '} disabled={disabled} /></fieldset>;
  if (s.type === 'array') {
    const rows = Array.isArray(value) ? value : [];
    return <fieldset className="be-nested" disabled={disabled}><legend>{label}{required ? ' *' : ''}</legend>{rows.map((row, i) => <div className="be-array-item" key={i}>
      <Field name={name} definition={s.items} label={`${label} ${i + 1}`} value={row} required context={context} disabled={disabled} onChange={v => onChange(rows.map((r, n) => n === i ? v : r))} />
      <button type="button" className="be-subtle" aria-label={`Gỡ ${label} ${i + 1}`} onClick={() => onChange(rows.filter((_, n) => n !== i))}>Gỡ mục</button>
    </div>)}<button type="button" onClick={() => onChange([...rows, initialValue(s.items) ?? ''])}>+ Thêm {label.toLowerCase()}</button></fieldset>;
  }
  if (s.type === 'boolean' && context.filter) return <div className="be-field"><label htmlFor={id}>{label}</label><select id={id} value={value === undefined ? '' : String(value)} disabled={disabled} onChange={e => onChange(e.target.value === '' ? undefined : e.target.value === 'true')}><option value="">Tất cả</option><option value="true">Có</option><option value="false">Không</option></select></div>;
  if (s.type === 'boolean') return <label className="be-check"><input type="checkbox" checked={value === true} disabled={disabled} onChange={e => onChange(e.target.checked)} />{label}{s.const === true && ' *'}</label>;
  const isReference = s.format === 'uuid' && (references[name] || context?.choices?.[name]);
  const numeric = ['integer', 'number'].includes(s.type);
  const long = freeJson || /description|note|content|answer|instruction/i.test(name);
  const localDate = value && s.format === 'date-time' && Number.isFinite(Date.parse(value)) ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : value;
  return <div className={'be-field' + (long ? ' be-wide' : '')}><label htmlFor={id}>{label}{required ? ' *' : ''}</label>
    {isReference ? <ReferenceField name={name} value={value} onChange={onChange} required={required} context={context} inputId={id} disabled={disabled} />
      : s.enum ? <select id={id} value={value ?? ''} required={required} disabled={disabled} onChange={e => onChange(e.target.value)}><option value="">{context.filter ? 'Tất cả' : `Chọn ${label.toLowerCase()}`}</option>{s.enum.map(v => <option key={v} value={v}>{vi(v)}</option>)}</select>
      : freeJson ? <><textarea id={id} rows={4} required={required} disabled={disabled} value={jsonDraft} placeholder="{}" spellCheck={false} onChange={e => { setJsonDraft(e.target.value); onChange(e.target.value); }} /><small>Cấu hình nâng cao dạng JSON; để trống nếu không sử dụng.</small></>
      : long ? <textarea id={id} rows={3} value={value ?? ''} maxLength={s.maxLength} required={required} disabled={disabled} onChange={e => onChange(e.target.value)} />
      : <input id={id} type={/password/i.test(name) ? 'password' : s.format === 'date-time' ? 'datetime-local' : s.format === 'email' ? 'email' : numeric ? 'number' : 'text'} autoComplete={/password/i.test(name) ? 'new-password' : 'off'} value={localDate ?? ''} required={required} disabled={disabled} min={s.minimum} max={s.maximum} step={s.type === 'integer' ? 1 : numeric ? 'any' : undefined} minLength={s.minLength} maxLength={s.maxLength} onChange={e => onChange(e.target.value)} />}
  </div>;
}
