// Completed schema-3 results: BE handlers, JobStepResponseService and Pi output schemas.
// A field describes a result, never an input that the operator has to invent.
const out = (path, label, kind = 'string', extra = {}) => ({ path, label, kind, ...extra });
const uuid = (path, label, extra = {}) => out(path, label, 'string', { format: 'uuid', ...extra });
const bool = (path, label, extra = {}) => out(path, label, 'boolean', extra);
const object = (path, label, extra = {}) => out(path, label, 'object', { open: true, ...extra });
const array = (path, label, extra = {}) => out(path, label, 'array', { open: true, ...extra });
export const closePrompts = ['CLOSE_SENDER', 'CLOSE_RECEIVER', 'CONFIRM_COMPARTMENT_CLOSED', 'STAFF_CLOSE_DOOR_AND_CLEAR_MECHANISM'];
export const lockPrompts = ['VERIFY_SENDER', 'VERIFY_RECEIVER', 'VERIFY_COMPARTMENT_LOCKED', 'STAFF_PHYSICALLY_VERIFY_LOCK'];
export function outputsForStep(data, schemaVersion = 3) {
  const p = { ...data.params, ...data.mapping };
  if (schemaVersion !== 3) return [];
  switch (data.stepType) {
    case 'MOVE': return [bool('reached', 'Đã tới điểm đích'), uuid('endpoint_id', 'Điểm đích'), out('action_status', 'Trạng thái di chuyển', 'integer'), object('last_feedback_pose', 'Vị trí phản hồi', { nullable: true }), out('distance_remaining_m', 'Khoảng cách còn lại', 'number', { nullable: true }), out('endpoint_group_id', 'Nhóm điểm (null)', 'null'), array('attempts', 'Các lần di chuyển'), object('verified_pose', 'Vị trí đã kiểm tra', { optional: true }), out('position_error_m', 'Sai số vị trí', 'number', { optional: true }), out('yaw_error_rad', 'Sai số góc', 'number', { optional: true })];
    case 'AUTHENTICATE': return [bool('verified', 'Xác thực hợp lệ'), uuid('verification_id', 'Mã xác thực', { nullable: true }), uuid('actor_account_id', 'Tài khoản xác thực', { nullable: true }), out('purpose', 'Mục đích xác thực'), uuid('service_request_id', 'Yêu cầu dịch vụ'), out('verified_at', 'Thời điểm xác thực', 'string', { nullable: true }), out('valid_until', 'Hiệu lực đến', 'string', { nullable: true })];
    case 'HANDLE_PAYLOAD': return [bool('confirmed', p.action === 'UNLOAD' ? 'Đã xác nhận lấy hàng ra' : 'Đã xác nhận đặt hàng vào'), out('action', 'Thao tác hàng hóa'), uuid('service_request_id', 'Yêu cầu dịch vụ'), out('compartment_id', 'Ngăn hàng'), array('items', 'Danh sách hàng đã xác nhận'), uuid('actor_account_id', 'Người xác nhận'), out('confirmed_at', 'Thời điểm xác nhận'), out('source', 'Nguồn xác nhận'), out('note', 'Ghi chú', 'string', { optional: true })];
    case 'CONTROL_HARDWARE': return [out('compartment_id', 'Ngăn hàng'), out('action', 'Lệnh phần cứng'), bool('published', 'Đã phát lệnh'), bool('controller_ack', 'Bộ điều khiển đã phản hồi'), bool('verified', 'Kết quả verified do Pi báo (không thay xác nhận khóa của staff)'), out('commanded_state', 'Trạng thái được ra lệnh'), out('position_raw', 'Giá trị servo', 'integer'), out('ros_servo_id', 'Mã servo', 'integer'), out('authorization_mode', 'Chế độ cấp quyền')];
    case 'INTERACT': {
      const fields = [bool('completed', 'Tương tác đã hoàn tất'), out('prompt_key', 'Mã lời nhắc'), out('action', 'Hành động'), out('source', 'Nguồn phản hồi'), uuid('actor_account_id', 'Người phản hồi', { nullable: true }), out('completed_at', 'Thời điểm hoàn tất')];
      if (p.action === 'CONFIRM' || p.action === 'CAPTURE_INPUT') fields.unshift(bool('confirmed', 'Đã xác nhận'));
      if (closePrompts.includes(p.prompt_key)) fields.unshift(bool('closed', 'Cửa ngăn hàng đã đóng'));
      if (lockPrompts.includes(p.prompt_key)) fields.unshift(bool('locked', 'Staff đã kiểm tra khóa chắc'));
      if (p.action === 'CAPTURE_INPUT') fields.push(object('values', 'Dữ liệu được nhập', { optional: true }));
      return fields;
    }
    case 'CHECK_CONDITION': return [bool('value', 'Kết quả điều kiện đúng / sai')];
    case 'NOTIFY': return [uuid('alert_id', 'Mã thông báo'), out('notification_type', 'Loại thông báo'), bool('persisted', 'Đã lưu thông báo'), bool('requires_ack', 'Có yêu cầu xác nhận')];
    case 'WAIT': return [bool('completed', 'Đã chờ xong'), out('wake_reason', 'Lý do tiếp tục'), out('elapsed_sec', 'Thời gian đã chờ', 'number'), ...(p.wait_type === 'EVENT' ? [object('event', 'Sự kiện nhận được'), out('event/event_type', 'Loại sự kiện'), out('event/correlation_key', 'Khóa sự kiện'), out('event/occurred_at', 'Thời điểm sự kiện'), object('event/data', 'Dữ liệu sự kiện')] : [out('event', 'Sự kiện (null)', 'null')])];
    case 'DATA_SERVICE': {
      const base = [out('request_id', 'Mã lần gọi dịch vụ'), object('data', 'Dữ liệu dịch vụ')];
      const services = {
        QUERY_HOSPITAL_INFORMATION: [bool('data/found', 'Tìm thấy thông tin'), out('data/answer', 'Câu trả lời'), out('data/language_code', 'Ngôn ngữ'), array('data/items', 'Các mục thông tin'), out('data/count', 'Số mục', 'integer'), object('data/source', 'Nguồn thông tin', { nullable: true }), out('data/fallback_code', 'Mã dự phòng', 'string', { optional: true })],
        RESOLVE_TARGETS: [array('data/targets', 'Danh sách điểm đích')],
        SELECT_TARGET: [bool('data/has_target', 'Có điểm tiếp theo'), object('data/target', 'Điểm được chọn', { optional: true }), uuid('data/endpoint_id', 'ID điểm được chọn', { optional: true })],
        CHECK_TARGET: [bool('data/is_valid', 'Điểm còn hợp lệ'), object('data/endpoint', 'Thông tin điểm', { optional: true })],
        CREATE_FALL_INCIDENT: [uuid('data/incident_id', 'Mã sự cố'), bool('data/created', 'Đã tạo sự cố mới')],
        COMMIT_MAP_ARTIFACT: [uuid('data/map_id', 'Bản đồ đã lưu'), uuid('data/artifact_id', 'Tệp bản đồ'), out('data/asset_hash', 'Hash tệp'), bool('data/created', 'Đã tạo bản đồ mới')],
      };
      return [...base, ...(services[p.service_key] ?? [])];
    }
    case 'EXECUTE_SENSING': {
      const ai = ['CROWD_DENSITY', 'RESTRICTED_ZONE', 'RESTRICTED_AREA_INTRUSION'].includes(p.sensing_type);
      const base = [out('sensing_type', 'Loại quan sát'), object('metrics', 'Chỉ số cảm biến'), out('captured_at', 'Thời điểm quan sát'), out('evidence_ref', 'Tham chiếu bằng chứng', ai ? 'string' : 'null', { nullable: ai, optional: ai })];
      if (['ROBOT_HEALTH', 'SIDE_CLEARANCE'].includes(p.sensing_type)) return [...base, bool('metrics/sensors_ready', 'Cảm biến đã sẵn sàng'), ...['left_m', 'right_m', 'left_age_sec', 'right_age_sec', 'battery_age_sec'].map(key => out('metrics/' + key, key, 'number', { nullable: true })), out('metrics/battery_raw', 'Giá trị pin thô', 'integer', { nullable: true }), out('metrics/battery_percent', 'Phần trăm pin (chưa xác minh)', 'null'), out('metrics/battery_unit', 'Đơn vị pin'), bool('metrics/left_fresh', 'Cảm biến trái còn mới'), bool('metrics/right_fresh', 'Cảm biến phải còn mới')];
      if (['CROWD_DENSITY', 'RESTRICTED_ZONE', 'RESTRICTED_AREA_INTRUSION'].includes(p.sensing_type)) return [...base, uuid('zone_id', 'Vùng quan sát'), uuid('map_id', 'Bản đồ quan sát'), out('model_version', 'Phiên bản mô hình'), out('frame_id', 'Hệ tọa độ', 'string', { optional: true }), p.sensing_type === 'CROWD_DENSITY' ? out('metrics/count', 'Số người', 'integer') : bool('metrics/intrusion_detected', 'Phát hiện xâm nhập')];
      return [...base, uuid('mapping_session_id', 'Phiên quét'), out('metrics/state', 'Trạng thái quét'), ...(p.action === 'SAVE' ? [uuid('metrics/artifact_id', 'Tệp đã lưu'), bool('metrics/saved_locally', 'Đã lưu cục bộ'), bool('metrics/uploaded', 'Đã tải tệp lên'), out('metrics/asset_hash', 'Hash tệp'), ...['width_px', 'height_px'].map(key => out('metrics/' + key, key, 'integer')), ...['resolution_m_per_pixel', 'width_m', 'height_m', 'origin_x_m', 'origin_y_m', 'origin_yaw_rad'].map(key => out('metrics/' + key, key, 'number')), out('metrics/frame_id', 'Hệ tọa độ')] : p.action === 'START' ? [bool('metrics/preview_ready', 'Preview đã sẵn sàng')] : [bool('metrics/stopped', 'Đã dừng quét')])];
    }
    case 'SET_CONTEXT': return [object('updated', 'Các biến được cập nhật'), ...(Array.isArray(p.operations) ? p.operations : []).filter(op => typeof op?.path === 'string' && op.path.startsWith('/vars/')).map(op => out('updated/' + op.path.slice(6), 'Giá trị ' + op.path.slice(6), op.operation === 'INCREMENT' ? 'number' : inferKind(op.value), { open: true }))];
    default: return [];
  }
}
export function inferKind(value) { return Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value === 'object' && value?.$ref ? 'unknown' : typeof value; }
export function defaultOutput(data) {
  const fields = outputsForStep(data);
  if (data.stepType === 'CONTROL_HARDWARE') return fields.find(f => f.path === 'published');
  return ['closed', 'locked', 'confirmed', 'verified', 'value', 'reached', 'completed', 'persisted', 'data/is_valid', 'data/has_target', 'data/found'].map(path => fields.find(f => f.path === path)).find(Boolean) ?? fields[0];
}
export function lookupOutput(data, path, version = 3) {
  if (!path) return { path: '', label: 'Toàn bộ kết quả', kind: 'object', open: true };
  const fields = outputsForStep(data, version), exact = fields.find(f => f.path === path);
  if (exact) return exact;
  // Open JSON objects/arrays can be explored with an explicit custom path.
  if (fields.some(f => f.open && path.startsWith(f.path + '/'))) return { path, kind: 'unknown', custom: true };
  return null;
}
