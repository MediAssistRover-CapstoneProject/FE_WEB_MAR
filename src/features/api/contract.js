import snapshot from './backendContract.json' with { type: 'json' };
import { requestOverrides } from './contractOverrides.js';

export const backendSource = snapshot.source;
export const operations = Object.fromEntries(Object.entries(snapshot.operations).map(([key, op]) => [key, { ...op, key }]));
export function schemaOf(schema = {}) {
  if (schema.$ref) return schemaOf(snapshot.schemas[schema.$ref.split('/').at(-1)] || {});
  if (schema.allOf) return schema.allOf.reduce((result, s) => {
    const part = schemaOf(s);
    return { ...result, ...part, properties: { ...result.properties, ...part.properties }, required: [...(result.required || []), ...(part.required || [])] };
  }, {});
  return schema;
}
export function requestSchema(key) {
  return requestOverrides[key] || schemaOf(operations[key]?.body?.content?.['application/json']?.schema);
}
export function canUse(operation, role) {
  return operation?.public || !!role && !!operation && (!operation.roles.length || operation.roles.includes(role));
}
export function buildRequest(key, { path = {}, query = {}, body, idempotencyKey } = {}) {
  const operation = operations[key];
  if (!operation) throw Error('Thao tác chưa được hỗ trợ.');
  const url = operation.path.replace(/\{([^}]+)\}/g, (_, name) => {
    if (path[name] == null || String(path[name]).trim() === '') throw Error(`Chưa chọn ${name}.`);
    return encodeURIComponent(path[name]);
  });
  const search = new URLSearchParams();
  for (const p of operation.parameters.filter(p => p.in === 'query')) {
    const v = query[p.name];
    if (v !== undefined && v !== null && v !== '') search.set(p.name, String(v));
    else if (p.required) throw Error(`Thiếu bộ lọc ${p.name}.`);
  }
  const headers = {};
  if (operation.parameters.some(p => p.in === 'header' && p.name.toLowerCase() === 'idempotency-key')) {
    if (!idempotencyKey) throw Error('Thiếu mã chống gửi trùng. Hãy mở lại biểu mẫu.');
    headers['Idempotency-Key'] = idempotencyKey;
  }
  return { url: url + (search.size ? `?${search}` : ''), method: operation.method, headers, body, skipAuth: operation.public };
}

// Keep values typed; false/zero must survive. Optional blanks are omitted.
export function prepareValue(input, definition, required = false, label = 'Dữ liệu') {
  const s = schemaOf(definition);
  if (input === undefined || input === null || input === '') {
    if (required) throw Error(`${label}: vui lòng nhập giá trị.`);
    return undefined;
  }
  if (s.type === 'array') {
    const value = typeof input === 'string' ? parseJson(input, label) : input;
    if (!Array.isArray(value)) throw Error(`${label}: cần danh sách.`);
    if (value.length < (s.minItems || 0)) throw Error(`${label}: cần ít nhất ${s.minItems} mục.`);
    return value.map((v, i) => prepareValue(v, s.items, true, `${label} ${i + 1}`));
  }
  if (s.type === 'object' || s.properties || !s.type && !s.enum) {
    const value = typeof input === 'string' ? parseJson(input, label) : input;
    if (!s.properties) {
      if (s.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) throw Error(`${label}: cần một đối tượng.`);
      if (s.minProperties && Object.keys(value).length < s.minProperties) throw Error(`${label}: không được để trống.`);
      return value;
    }
    if (typeof value !== 'object' || Array.isArray(value)) throw Error(`${label}: dữ liệu không hợp lệ.`);
    return Object.fromEntries(Object.entries(s.properties).map(([k, def]) => [k, prepareValue(value[k], def, s.required?.includes(k), `${label} / ${k}`)]).filter(([, v]) => v !== undefined));
  }
  if (s.type === 'boolean') {
    if (typeof input !== 'boolean') throw Error(`${label}: cần giá trị bật/tắt.`);
    if (s.const !== undefined && input !== s.const) throw Error(`${label}: cần xác nhận.`);
    return input;
  }
  if (s.type === 'number' || s.type === 'integer') {
    const n = Number(input);
    if (!Number.isFinite(n) || s.type === 'integer' && !Number.isInteger(n)) throw Error(`${label}: số không hợp lệ.`);
    if (s.minimum !== undefined && n < s.minimum || s.maximum !== undefined && n > s.maximum) throw Error(`${label}: số ngoài khoảng cho phép.`);
    return n;
  }
  let value = String(input);
  if (s.format === 'date-time') {
    if (!Number.isFinite(Date.parse(value))) throw Error(`${label}: ngày giờ không hợp lệ.`);
    return new Date(value).toISOString();
  }
  if (s.enum && !s.enum.includes(value)) throw Error(`${label}: lựa chọn không hợp lệ.`);
  if (s.format === 'uuid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw Error(`${label}: hãy chọn bản ghi hợp lệ.`);
  if (required && !value.trim()) throw Error(`${label}: không được để trống.`);
  if (s.minLength && value.length < s.minLength || s.maxLength && value.length > s.maxLength) throw Error(`${label}: độ dài không hợp lệ.`);
  if (s.pattern && !new RegExp(`^(?:${s.pattern})$`).test(value)) throw Error(`${label}: định dạng không hợp lệ.`);
  return value;
}
function parseJson(text, label) {
  try { return JSON.parse(text); } catch { throw Error(`${label}: cấu hình JSON không hợp lệ.`); }
}
export function prepareBody(key, input) {
  const value = prepareValue(input, requestSchema(key), true);
  if (value.targetMode === 'ENDPOINT_GROUP') {
    const field = key.includes('delivery-requests') ? 'deliveryGroupId' : 'destinationGroupId';
    if (!value[field]) throw Error('Chọn nhóm điểm đích.');
    delete value[key.includes('delivery-requests') ? 'deliveryEndpointId' : 'destinationEndpointId'];
  } else if (value.targetMode === 'ENDPOINT') {
    const field = key.includes('delivery-requests') ? 'deliveryEndpointId' : 'destinationEndpointId';
    if (!value[field]) throw Error('Chọn điểm đích.');
    delete value[key.includes('delivery-requests') ? 'deliveryGroupId' : 'destinationGroupId'];
  }
  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) throw Error('Thời gian kết thúc phải sau thời gian bắt đầu.');
  if (value.scheduleType === 'INTERVAL' && !value.intervalSec) throw Error('Nhập chu kỳ chạy.');
  if (value.scheduleType === 'CRON' && !value.cronExpression) throw Error('Nhập lịch lặp.');
  return value;
}
export function initialValue(definition, existing) {
  const s = schemaOf(definition);
  if (s.properties) return Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, initialValue(v, existing?.[k])]).filter(([, v]) => v !== undefined));
  if (existing !== undefined && existing !== null) return existing;
  if (s.default !== undefined) return s.default;
  if (s.type === 'boolean') return false; // Never pre-confirm physical evidence.
  if (s.type === 'array') return [];
  return undefined;
}
