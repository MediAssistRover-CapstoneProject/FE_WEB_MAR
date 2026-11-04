import { fieldsForStep, speechFields, stepCatalog, uuidPattern, valueError } from './stepCatalog.js';
const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const ref = value => isObject(value) && typeof value.$ref === 'string';
export function stepContractIssues(data, version = 3) {
  const p = { ...data.params, ...data.mapping }, errors = [], add = message => errors.push(message);
  const allowed = new Set((stepCatalog[data.stepType]?.fields ?? []).map(f => f.key));
  const limit = keys => {
    for (const key of Object.keys(p)) if (!keys.includes(key)) add(`Trường ${key} không thuộc cấu hình hành động đang chọn.`);
  };
  for (const key of Object.keys(p)) if (!allowed.has(key)) add(`Trường ${key} không có trong contract ${data.stepType}.`);
  for (const field of fieldsForStep(data, version)) if (['string', 'enum'].includes(field.kind) && typeof p[field.key] === 'string' && !p[field.key].trim()) add(`${field.label} không được là chuỗi rỗng; xóa trường nếu không sử dụng.`);
  for (const f of fieldsForStep(data, version).filter(f => f.fixed)) if (Object.hasOwn(data.mapping ?? {}, f.key) || ref(p[f.key])) add(`${f.label} phải cố định trong tham số, không ánh xạ động.`);
  function typed(value, field) { const error = valueError(value, field); if (error) add(`${field.label}: ${error}`); }
  switch (data.stepType) {
    case 'INTERACT':
      if (p.action === 'SPEAK') {
        limit(['action', 'prompt_key', 'data']);
        if (isObject(p.data) && !ref(p.data)) {
          for (const field of speechFields) typed(p.data[field.key], field);
          for (const key of Object.keys(p.data)) if (!speechFields.some(f => f.key === key)) add(`data.${key} không thuộc cấu hình phát lời nói.`);
        }
      }
      break;
    case 'CONTROL_HARDWARE': {
      if (data.maxAttempts !== 1) add('Lệnh servo không được thử lại tự động; số lần thử phải là 1.');
      const auth = p.authorization, unlock = ['UNLOCK_COMPARTMENT', 'UNLOCK'].includes(p.action);
      if (version === 3 && unlock && (ref(auth) || !isObject(auth))) add('Mở ngăn hàng cần đối tượng quyền gồm mode, purpose và ba tham chiếu output xác thực; không dùng toàn bộ output làm quyền.');
      if (isObject(auth) && !ref(auth)) {
        if (auth.mode !== 'STAFF_VERIFIED') add('authorization.mode phải là STAFF_VERIFIED.');
        if (!['DELIVERY_SENDER', 'DELIVERY_RECEIVER'].includes(auth.purpose)) add('authorization.purpose phải là mục đích người gửi/người nhận cố định.');
        for (const key of ['verification_id', 'actor_account_id']) typed(auth[key], { kind: 'string', format: 'uuid', required: true, label: `authorization.${key}` });
        typed(auth.valid_until, { kind: 'string', required: true, label: 'authorization.valid_until' });
        if (typeof auth.valid_until === 'string' && (!/([zZ]|[+-]\d\d:\d\d)$/.test(auth.valid_until) || !Number.isFinite(Date.parse(auth.valid_until)))) add('authorization.valid_until phải là thời gian ISO có múi giờ hoặc tham chiếu từ xác thực.');
        for (const key of Object.keys(auth)) if (!['mode', 'purpose', 'verification_id', 'actor_account_id', 'valid_until'].includes(key)) add(`authorization.${key} không thuộc contract.`);
      }
      break;
    }
    case 'HANDLE_PAYLOAD':
      break;
    case 'DATA_SERVICE':
      if (p.service_key === 'COMMIT_MAP_ARTIFACT') limit(['service_key', 'mapping_session_id', 'artifact_id', 'floor_id', 'map_name']);
      break;
    case 'WAIT':
      if (p.wait_type === 'DURATION') { limit(['wait_type', 'duration_sec']); if (typeof p.duration_sec === 'number' && data.timeoutSec <= p.duration_sec) add('Timeout phải lớn hơn thời gian chờ.'); }
      else if (p.wait_type === 'EVENT') limit(['wait_type', 'event_type', 'correlation_key', 'incident_id']);
      break;
    case 'EXECUTE_SENSING':
      if (p.sensing_type === 'MAPPING') {
        // The existing Java template validator excludes MAPPING while the Pi validator allows it.
        add('BE hiện chưa chấp nhận MAPPING trong template step; dùng màn Quét bản đồ hoặc đồng bộ contract BE trước khi publish.');
        const min = { START: 55, SAVE: 60, STOP: 15 }[p.action];
        if (min && data.timeoutSec < min) add(`Quét ${p.action} cần timeout ít nhất ${min} giây.`);
        if (data.maxAttempts !== 1) add('Quét bản đồ chỉ được thử một lần.');
        if (p.action === 'START') limit(['sensing_type', 'action', 'mapping_session_id', 'preview_rate_hz']);
        if (p.action === 'SAVE') limit(['sensing_type', 'action', 'mapping_session_id', 'artifact_id']);
        if (p.action === 'STOP') limit(['sensing_type', 'action', 'mapping_session_id']);
      } else if (['CROWD_DENSITY', 'RESTRICTED_ZONE', 'RESTRICTED_AREA_INTRUSION'].includes(p.sensing_type)) {
        limit(['sensing_type', 'zone_id', 'window_sec']);
        if (version === 3 && p.sensing_type === 'RESTRICTED_AREA_INTRUSION') add('Pi schema 3 dùng RESTRICTED_ZONE; RESTRICTED_AREA_INTRUSION chỉ thuộc contract cũ.');
        if (typeof p.window_sec === 'number' && data.timeoutSec <= p.window_sec) add('Timeout phải lớn hơn cửa sổ quan sát.');
      } else limit(['sensing_type']);
      break;
    case 'NOTIFY':
      if (Array.isArray(p.recipients)) p.recipients.forEach(value => {
        if (typeof value !== 'string' || !value.trim() || version === 3 && !['STAFF', 'ADMIN'].includes(value) && !uuidPattern.test(value)) add('Người nhận phải là STAFF, ADMIN hoặc UUID tài khoản hợp lệ.');
      });
      break;
    case 'SET_CONTEXT': {
      const ops = p.operations, seen = new Set();
      if (Array.isArray(ops)) for (const op of ops) {
        if (ref(op)) continue;
        if (!isObject(op)) { add('Mỗi phép cập nhật phải là một đối tượng.'); continue; }
        if (typeof op.path !== 'string' || !/^\/vars\/[A-Za-z][A-Za-z0-9_]*$/.test(op.path)) add('Phép cập nhật chỉ được ghi /vars/tên_biến.');
        if (seen.has(op.path)) add('Không cập nhật trùng một biến trong cùng bước.'); seen.add(op.path);
        if (version === 3 && ['/vars/mapping_session_id', '/vars/artifact_id'].includes(op.path)) add('Định danh quét bản đồ do BE cấp, không được tự ghi.');
        if (op.operation && !['SET', 'INCREMENT'].includes(op.operation)) add('Phép cập nhật phải là SET hoặc INCREMENT.');
        if (!Object.hasOwn(op, 'value')) add('Phép cập nhật cần giá trị.');
        if (op.operation === 'INCREMENT' && !ref(op.value) && typeof op.value !== 'number') add('INCREMENT cần giá trị số.');
        for (const key of Object.keys(op)) if (!['path', 'operation', 'value'].includes(key)) add(`operations.${key} không thuộc contract.`);
      }
      break;
    }
  }
  if (Object.hasOwn(p, 'items') && !ref(p.items)) {
    const items = p.items;
    if (!Array.isArray(items) || !items.length) add('Danh sách hàng phải có ít nhất một mục.');
    else {
      const codes = new Set();
      for (const item of items) {
        if (ref(item)) continue;
        if (!isObject(item)) { add('Mỗi hàng phải là đối tượng có item_code và quantity.'); continue; }
        typed(item.item_code, { kind: 'string', required: true, label: 'Mã hàng' });
        typed(item.quantity, { kind: 'integer', min: 1, required: true, label: 'Số lượng hàng' });
        if (typeof item.item_code === 'string' && codes.has(item.item_code)) add('Không được trùng mã hàng.'); codes.add(item.item_code);
        for (const key of Object.keys(item)) if (!['item_code', 'quantity'].includes(key)) add(`items.${key} không thuộc contract.`);
      }
    }
  }
  return [...new Set(errors)];
}
