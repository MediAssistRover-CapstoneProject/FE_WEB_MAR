// Business fields follow BE StepInputContractValidator and StepExecutionPolicy.
const f = (key, label, kind = 'string', extra = {}) => ({ key, label, kind, ...extra });
const fixed = { fixed: true, required: true };
const choice = (key, label, options, extra = {}) => f(key, label, 'enum', { options, ...extra });
const uuid = (key, label, extra = {}) => f(key, label, 'string', { format: 'uuid', ...extra });
const modern = (_, version) => version === 3;
const ai = p => ['CROWD_DENSITY', 'RESTRICTED_ZONE', 'RESTRICTED_AREA_INTRUSION'].includes(p.sensing_type);
const mapping = p => p.sensing_type === 'MAPPING';
const nonSpeech = p => p.action !== 'SPEAK';
const commit = p => p.service_key === 'COMMIT_MAP_ARTIFACT';
const regularService = p => !commit(p);
export const operators = ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'EXISTS'];
export const terminalStatuses = ['SUCCEEDED', 'FAILED', 'CANCELLED', 'RECOVERY_REQUIRED'];
export const interactionPresets = [
  { key: 'SPEAK', label: 'Phát lời nói', params: { action: 'SPEAK', prompt_key: 'CUSTOM', data: { text: '', language_code: 'vi' } } },
  { key: 'CLOSE_SENDER', label: 'Người gửi xác nhận đóng cửa', params: { action: 'CONFIRM', prompt_key: 'CLOSE_SENDER', data: { text: 'Đóng cửa ngăn hàng, đưa tay ra khỏi cơ cấu rồi xác nhận.' } } },
  { key: 'VERIFY_SENDER', label: 'Người gửi kiểm tra khóa', params: { action: 'CONFIRM', prompt_key: 'VERIFY_SENDER', data: { text: 'Kiểm tra ngăn hàng đã khóa chắc rồi xác nhận.' } } },
  { key: 'CLOSE_RECEIVER', label: 'Người nhận xác nhận đóng cửa', params: { action: 'CONFIRM', prompt_key: 'CLOSE_RECEIVER', data: { text: 'Đóng cửa ngăn hàng sau khi lấy hàng rồi xác nhận.' } } },
  { key: 'VERIFY_RECEIVER', label: 'Người nhận kiểm tra khóa', params: { action: 'CONFIRM', prompt_key: 'VERIFY_RECEIVER', data: { text: 'Kiểm tra ngăn hàng đã khóa chắc rồi xác nhận.' } } },
];
export const speechFields = [f('text', 'Nội dung nói', 'string', { required: true, maxLength: 500 }), choice('language_code', 'Ngôn ngữ', ['vi', 'en']), f('speed_wpm', 'Tốc độ đọc (từ/phút)', 'integer', { min: 80, max: 220 }), f('volume', 'Âm lượng', 'integer', { min: 0, max: 100 })];
export const stepCatalog = {
  MOVE: {
    label: 'Di chuyển', icon: '↗', description: 'Đi tới endpoint thuộc bản đồ đã chọn.', defaults: { mode: 'NORMAL', max_speed_mps: 0.08 }, timeout: 180,
    fields: [uuid('map_id', 'Bản đồ', { required: true, widget: 'map', help: 'Dùng chung biến map_id cho các bước di chuyển trên cùng bản đồ.' }), uuid('endpoint_id', 'Điểm đến', { required: true, widget: 'endpoint', help: 'Chỉ truyền UUID endpoint. BE kiểm tra bản đồ, Pi tra điểm để di chuyển. Chọn rõ điểm A/B; dây nối không tự đổi điểm đến.' }), choice('mode', 'Chế độ', ['NORMAL', 'ESCORT', 'PATROL'], { required: modern }), f('max_speed_mps', 'Tốc độ tối đa (m/s)', 'number', { required: modern, exclusiveMin: 0, max: .8 })],
  },
  INTERACT: {
    label: 'Tương tác', icon: '☏', description: 'Phát lời nói hoặc chờ phản hồi: đóng cửa, kiểm tra khóa, nhập dữ liệu.', defaults: { action: 'SPEAK', prompt_key: 'CUSTOM', data: { text: '', language_code: 'vi' } }, timeout: 300,
    fields: [choice('action', 'Hành động', ['SPEAK', 'DISPLAY', 'CAPTURE_INPUT', 'CONFIRM'], { fixed: true, required: modern }), f('prompt_key', 'Mã lời nhắc', 'string', { required: true }), f('data', 'Dữ liệu tương tác', 'object', { required: modern, editor: 'interaction-data' }), choice('actor', 'Đối tượng tương tác', ['STAFF', 'ADMIN', 'PATIENT', 'USER', 'DEVICE'], { when: nonSpeech }), choice('required_role', 'Vai trò yêu cầu', ['STAFF', 'ADMIN'], { when: nonSpeech }), f('compartment_id', 'Ngăn hàng', 'string', { when: nonSpeech }), f('patient_reference', 'Tham chiếu người bệnh', 'string', { when: nonSpeech }), uuid('endpoint_id', 'Điểm tương tác', { when: nonSpeech }), f('question', 'Câu hỏi', 'string', { when: nonSpeech }), f('items', 'Hàng liên quan', 'array', { when: nonSpeech, editor: 'items' }), f('message', 'Thông điệp', 'string', { when: nonSpeech }), uuid('incident_id', 'Sự cố', { when: nonSpeech }), uuid('detection_event_id', 'Sự kiện phát hiện', { when: nonSpeech })],
  },
  DATA_SERVICE: {
    label: 'Dịch vụ dữ liệu', icon: '▤', description: 'Tra cứu, chọn điểm đích, xác minh điểm hoặc lưu bản đồ.', defaults: { service_key: 'QUERY_HOSPITAL_INFORMATION', question: '' },
    fields: [choice('service_key', 'Dịch vụ', ['QUERY_HOSPITAL_INFORMATION', 'RESOLVE_TARGETS', 'SELECT_TARGET', 'CHECK_TARGET', 'CREATE_FALL_INCIDENT', 'COMMIT_MAP_ARTIFACT'], fixed), choice('operation', 'Thao tác', ['QUERY', 'CREATE', 'UPDATE'], { when: regularService }), f('question', 'Câu hỏi', 'string', { required: true, when: p => p.service_key === 'QUERY_HOSPITAL_INFORMATION' }), f('language_code', 'Ngôn ngữ', 'string', { when: p => p.service_key === 'QUERY_HOSPITAL_INFORMATION' }), uuid('map_id', 'Bản đồ', { when: regularService, widget: 'map' }), uuid('endpoint_id', 'Điểm đến', { required: true, when: p => p.service_key === 'CHECK_TARGET' }), uuid('endpoint_group_id', 'Nhóm điểm', { required: true, when: p => p.service_key === 'RESOLVE_TARGETS' }), f('targets', 'Danh sách điểm', 'array', { required: true, when: p => p.service_key === 'SELECT_TARGET' }), f('index', 'Chỉ số', 'integer', { min: 0, when: p => p.service_key === 'SELECT_TARGET' }), uuid('detection_event_id', 'Sự kiện phát hiện', { required: true, when: p => p.service_key === 'CREATE_FALL_INCIDENT' }), uuid('mapping_session_id', 'Phiên quét', { required: true, when: commit }), uuid('artifact_id', 'Tệp bản đồ', { required: true, when: commit }), uuid('floor_id', 'Tầng', { required: true, when: commit }), f('map_name', 'Tên bản đồ', 'string', { required: true, when: commit, maxLength: 160 })],
  },
  AUTHENTICATE: {
    label: 'Xác thực', icon: '◇', description: 'Chờ xác minh người gửi/người nhận của yêu cầu giao hàng.', defaults: { purpose: 'DELIVERY_SENDER', method: 'STAFF_CONFIRMATION' }, timeout: 300,
    fields: [choice('purpose', 'Mục đích', ['DELIVERY_SENDER', 'DELIVERY_RECEIVER'], fixed), choice('method', 'Phương thức', ['QR_CODE', 'STAFF_CONFIRMATION']), uuid('service_request_id', 'Yêu cầu dịch vụ', { required: true })],
  },
  CONTROL_HARDWARE: {
    label: 'Điều khiển phần cứng', icon: '⌘', description: 'Khóa hoặc mở servo; quyền mở được lấy từ xác thực của BE.', defaults: { action: 'LOCK_COMPARTMENT', compartment_id: 'CART_MAIN' }, timeout: 15,
    fields: [choice('action', 'Hành động', ['LOCK_COMPARTMENT', 'UNLOCK_COMPARTMENT'], fixed), choice('compartment_id', 'Ngăn hàng', ['CART_MAIN'], { required: true }), f('authorization', 'Quyền mở ngăn hàng', 'object', { editor: 'authorization', required: (p, version) => version === 3 && ['UNLOCK_COMPARTMENT', 'UNLOCK'].includes(p.action) }), uuid('service_request_id', 'Yêu cầu dịch vụ (metadata)')],
  },
  HANDLE_PAYLOAD: {
    label: 'Xử lý hàng', icon: '□', description: 'LOAD nhận hàng / UNLOAD giao hàng; chờ staff xác nhận đúng danh sách hàng.', defaults: { action: 'LOAD', compartment_id: 'CART_MAIN' }, timeout: 300,
    fields: [choice('action', 'Hành động', ['LOAD', 'UNLOAD'], { fixed: true, required: modern }), uuid('service_request_id', 'Yêu cầu dịch vụ', { required: true }), f('compartment_id', 'Ngăn hàng', 'string', { required: true }), f('items', 'Hàng hóa', 'array', { required: modern, minItems: 1, editor: 'items' })],
  },
  EXECUTE_SENSING: {
    label: 'Đọc cảm biến', icon: '◉', description: 'Sức khỏe robot, khoảng cách hai bên, quan sát vùng hoặc phiên quét.', defaults: { sensing_type: 'ROBOT_HEALTH' },
    fields: [choice('sensing_type', 'Loại quan sát', ['ROBOT_HEALTH', 'SIDE_CLEARANCE', 'CROWD_DENSITY', 'RESTRICTED_ZONE', 'RESTRICTED_AREA_INTRUSION', 'MAPPING'], fixed), uuid('zone_id', 'Vùng', { required: ai, when: ai }), f('window_sec', 'Thời gian quan sát (giây)', 'number', { min: 0, max: 30, when: ai }), choice('action', 'Thao tác quét', ['START', 'SAVE', 'STOP'], { fixed: true, required: true, when: mapping }), uuid('mapping_session_id', 'Phiên quét', { required: true, when: mapping }), uuid('artifact_id', 'Tệp bản đồ', { required: true, when: p => mapping(p) && p.action === 'SAVE' }), f('preview_rate_hz', 'Tần số xem trước', 'number', { min: .2, max: 1, when: p => mapping(p) && p.action === 'START' })],
  },
  NOTIFY: {
    label: 'Thông báo', icon: '♧', description: 'Gửi thông báo, ghi cảnh báo và yêu cầu xác nhận nếu cần.', defaults: { notification_type: 'WORKFLOW_NOTICE', severity: 'INFO', recipients: ['STAFF'], data: {}, require_ack: false },
    fields: [f('notification_type', 'Loại thông báo', 'string', { required: true }), choice('severity', 'Mức độ', ['INFO', 'WARNING', 'CRITICAL'], { required: modern }), f('message', 'Nội dung'), f('recipients', 'Người nhận', 'array', { editor: 'recipients' }), f('data', 'Dữ liệu', 'object', { required: modern }), f('require_ack', 'Yêu cầu xác nhận', 'boolean', { required: modern }), choice('ack_policy', 'Chính sách xác nhận', ['ANY', 'ALL']), ...['incident_id', 'robot_id', 'charge_request_id', 'recovery_request_id', 'endpoint_id', 'detection_event_id', 'zone_id', 'map_id'].map(key => uuid(key, key, { when: (_, version) => version === 2 })), ...['metrics', 'staff_event', 'health'].map(key => f(key, key, 'object', { when: (_, version) => version === 2 }))],
  },
  WAIT: {
    label: 'Chờ', icon: '◷', description: 'Chờ đủ thời gian hoặc nhận sự kiện có khóa liên kết.', defaults: { wait_type: 'DURATION', duration_sec: 5 },
    fields: [choice('wait_type', 'Kiểu chờ', ['DURATION', 'EVENT'], fixed), f('duration_sec', 'Thời gian chờ (giây)', 'number', { min: 1, max: 3600, when: p => p.wait_type === 'DURATION', required: true }), f('event_type', 'Loại sự kiện', 'string', { when: p => p.wait_type === 'EVENT', required: true }), f('correlation_key', 'Khóa liên kết sự kiện', 'string', { when: p => p.wait_type === 'EVENT', required: true }), uuid('incident_id', 'Sự cố', { when: p => p.wait_type === 'EVENT' })],
  },
  CHECK_CONDITION: {
    label: 'Kiểm tra điều kiện', icon: '⑂', description: 'Chọn output thật của bước trước, đầu vào hoặc biến ngữ cảnh để so sánh.', defaults: { expression: { path: '', operator: 'EQ', value: true } },
    fields: [f('expression', 'Điều kiện', 'condition', { required: true, fixed: true })],
  },
  SET_CONTEXT: {
    label: 'Ghi ngữ cảnh', icon: '›_', description: 'Gán SET hoặc cộng INCREMENT vào /vars/tên_biến.', defaults: { operations: [] },
    fields: [f('operations', 'Các phép cập nhật', 'array', { required: true, minItems: 1, maxItems: 128, editor: 'operations' })],
  },
};
// Mirror BE HardwareCommissioningWorkflow; the persisted workflow flag is explicit.
export function commissioningUnlock(data, workflow) {
  return workflow?.schemaVersion === 3 && workflow.defaultInputsJson?.hardware_test_mode === 'COMMISSIONING_ONLY'
    && data.stepType === 'CONTROL_HARDWARE' && ['UNLOCK', 'UNLOCK_COMPARTMENT'].includes(data.params?.action)
    && !Object.hasOwn(data.mapping ?? {}, 'action') && !Object.hasOwn(data.params ?? {}, 'authorization') && !Object.hasOwn(data.mapping ?? {}, 'authorization');
}
export function fieldsForStep(data, version = 3, workflow) {
  const p = { ...data.params, ...data.mapping };
  return (stepCatalog[data.stepType]?.fields ?? []).filter(field => !field.when || field.when(p, version)).map(field => ({ ...field, required: field.key === 'authorization' && commissioningUnlock(data, workflow) ? false : typeof field.required === 'function' ? field.required(p, version) : !!field.required }));
}
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identityKeys = ['map_id', 'endpoint_id', 'service_request_id', 'zone_id', 'floor_id', 'artifact_id', 'mapping_session_id', 'actor_account_id', 'verification_id', 'incident_id', 'detection_event_id', 'endpoint_group_id'];
function variableIdentity(variable) {
  const key = variable.key ?? variable.path?.split('/').at(-1);
  return identityKeys.find(id => key === id || key?.endsWith('_' + id))
    ?? ({ map: 'map_id', endpoint: 'endpoint_id' })[variable.kind];
}
export function variableFitsField(variable, field) {
  const kind = ['map', 'endpoint', 'select'].includes(variable.kind) ? 'string' : variable.kind;
  const expected = field.kind === 'enum' ? 'string' : field.kind;
  if (kind !== expected && !(expected === 'number' && kind === 'integer')) return false;
  if (field.key === 'service_request_id' && ['map', 'endpoint'].includes(variable.kind)) return false;
  if (field.widget === 'map' && variable.kind === 'endpoint' || field.widget === 'endpoint' && variable.kind === 'map') return false;
  const identity = variableIdentity(variable);
  if (field.format === 'uuid' && identityKeys.includes(field.key) && identity && identity !== field.key) return false;
  return true;
}
export function variableValueError(value, variable) {
  const schema = variable.schema ?? {};
  const error = valueError(value, { ...variable, format: ['map', 'endpoint'].includes(variable.kind) ? 'uuid' : schema.format, min: schema.minimum, max: schema.maximum, minItems: schema.minItems, maxItems: schema.maxItems, maxLength: schema.maxLength });
  if (error || value === undefined) return error;
  if (Array.isArray(value) && schema.items?.type === 'object') {
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return 'Mỗi mục phải là đối tượng JSON';
      for (const [key, child] of Object.entries(schema.items.properties ?? {})) {
        const childError = valueError(item[key], { kind: child.type, label: key, required: schema.items.required?.includes(key), min: child.minimum, max: child.maximum, format: child.format });
        if (childError) return `${key}: ${childError}`;
      }
      if (schema.items.additionalProperties === false && Object.keys(item).some(key => !Object.hasOwn(schema.items.properties ?? {}, key))) return 'Có trường hàng hóa không thuộc cấu trúc cho phép';
    }
  }
  return '';
}
export function valueError(value, field) {
  if (value === undefined || value === '' || value === null) return field.required ? 'Bắt buộc nhập' : '';
  if (value && typeof value === 'object' && Object.hasOwn(value, '$ref')) return '';
  const kind = field.kind;
  if (['string', 'enum', 'map', 'endpoint', 'select'].includes(kind) && typeof value !== 'string') return 'Cần giá trị chuỗi';
  if (field.format === 'uuid' && !uuidPattern.test(value)) return 'Cần UUID hợp lệ';
  if (['number', 'integer'].includes(kind) && (typeof value !== 'number' || !Number.isFinite(value) || kind === 'integer' && !Number.isInteger(value))) return 'Cần giá trị số hợp lệ';
  if (typeof value === 'number' && (field.min !== undefined && value < field.min || field.exclusiveMin !== undefined && value <= field.exclusiveMin || field.max !== undefined && value > field.max)) return 'Giá trị nằm ngoài giới hạn cho phép';
  if (typeof value === 'string' && field.maxLength && value.length > field.maxLength) return `Tối đa ${field.maxLength} ký tự`;
  if (kind === 'boolean' && typeof value !== 'boolean') return 'Cần giá trị đúng/sai';
  if (kind === 'array' && !Array.isArray(value)) return 'Cần mảng JSON';
  if (Array.isArray(value) && (field.minItems && value.length < field.minItems || field.maxItems && value.length > field.maxItems)) return `Cần ${field.minItems ?? 0}–${field.maxItems ?? 'nhiều'} mục`;
  if (['object', 'condition'].includes(kind) && (!value || typeof value !== 'object' || Array.isArray(value))) return 'Cần đối tượng JSON';
  const options = (field.options ?? []).map(o => typeof o === 'object' ? o.value : o);
  if (options.length && !options.includes(value)) return 'Giá trị không thuộc danh sách cho phép';
  return '';
}
