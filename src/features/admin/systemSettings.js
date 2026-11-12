export const settingSpecs = {
  'operations.robot_offline_threshold_seconds': { title: 'Thời gian báo robot mất kết nối', hint: 'Robot được đánh dấu ngoại tuyến khi không có heartbeat trong khoảng thời gian này.', type: 'NUMBER', category: 'OPERATIONS', min: 10, max: 3600, unit: 'giây' },
  'sos.monitoring-room-id': { title: 'Phòng tiếp nhận SOS', hint: 'Được quản lý qua loại phòng SOS trong danh mục phòng.', type: 'STRING', category: 'SOS', managed: true },
  'retention.execution_enabled': { title: 'Cho phép xử lý dữ liệu hết hạn', hint: 'Cho phép máy chủ thực hiện lưu trữ hoặc xóa theo chính sách. Bật mục này chưa tự chạy xử lý.', type: 'BOOLEAN', category: 'RETENTION' },
  'retention.default_mode': { title: 'Cách xử lý mặc định', hint: 'Áp dụng cho nhóm dữ liệu chưa có cách xử lý riêng.', type: 'STRING', category: 'RETENTION', options: { DISABLED: 'Không xử lý', ARCHIVE: 'Lưu trữ rồi xóa bản gốc', DELETE: 'Xóa dữ liệu hết hạn' } },
  'retention.batch_size': { title: 'Số bản ghi mỗi đợt', type: 'NUMBER', category: 'RETENTION', min: 1, max: 5000, unit: 'bản ghi' },
  'retention.max_batches_per_run': { title: 'Số đợt tối đa mỗi nhóm dữ liệu', type: 'NUMBER', category: 'RETENTION', min: 1, max: 1000, unit: 'đợt' },
};

export const datasetLabels = {
  alert_recipient: 'Người nhận cảnh báo', alert: 'Cảnh báo', emergency_incident: 'Sự cố khẩn cấp', detection_event: 'Sự kiện phát hiện',
  job_event: 'Sự kiện công việc', robot_status_history: 'Lịch sử trạng thái robot', robot_location_history: 'Lịch sử vị trí robot',
  crowd_density_record: 'Dữ liệu mật độ người', heatmap_record: 'Bản đồ mật độ', audit_log: 'Nhật ký kiểm toán',
};
export const retentionModes = { DISABLED: 'Không xử lý', ARCHIVE: 'Lưu trữ', DELETE: 'Xóa hết hạn' };
export const mqttModes = { LEGACY_COMPATIBLE: 'Tương thích hệ thống cũ', DRAINING: 'Hoàn tất công việc cũ', MQTT_ONLY: 'Chỉ dùng MQTT' };

export function retentionSpec(dataset, field) {
  // AlertRecipient and Alert deliberately share the same backend policy keys.
  const base = dataset === 'alert_recipient' ? 'alert' : dataset;
  if (!Object.hasOwn(datasetLabels, dataset)) throw Error('Nhóm dữ liệu không được hỗ trợ.');
  return { key: `retention.${base}_${field}`, ...(field === 'days'
    ? { title: 'Thời hạn lưu', type: 'NUMBER', category: 'RETENTION', min: 1, max: 36500, unit: 'ngày' }
    : { title: 'Cách xử lý riêng', type: 'STRING', category: 'RETENTION', options: settingSpecs['retention.default_mode'].options }) };
}

export function settingPayload(row, key, spec, input) {
  if (spec.managed) throw Error('Đổi phòng tiếp nhận SOS trong danh mục phòng.');
  let value = input;
  if (spec.type === 'NUMBER') {
    if (String(input).trim() === '') throw Error('Vui lòng nhập giá trị.');
    value = Number(input);
    if (!Number.isInteger(value) || value < spec.min || value > spec.max) throw Error(`Nhập số nguyên từ ${spec.min} đến ${spec.max}.`);
  } else if (spec.type === 'BOOLEAN') {
    if (typeof value !== 'boolean') throw Error('Giá trị bật/tắt không hợp lệ.');
  } else {
    value = String(input).trim();
    if (spec.room && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw Error('Chọn phòng tiếp nhận SOS.');
    if (spec.options && !Object.hasOwn(spec.options, value)) throw Error('Chọn một giá trị hợp lệ.');
  }
  return {
    ...(!row ? { settingKey: key } : {}),
    settingValue: { ...row?.settingValue, value }, dataType: spec.type,
    category: row?.category || spec.category, description: row ? row.description ?? null : spec.hint ?? spec.title,
    publicSetting: row?.publicSetting ?? false,
  };
}

export function mqttChange(status, mode, dispatchHalted, note) {
  const current = status?.rollout, order = Object.keys(mqttModes);
  if (!current || !Number.isInteger(current.revision) || current.revision < 0) throw Error('Tải lại trạng thái MQTT trước khi thay đổi.');
  const from = order.indexOf(current.mode), to = order.indexOf(mode);
  if (from < 0 || to < from || to > from + 1 || typeof dispatchHalted !== 'boolean') throw Error('Chế độ MQTT chỉ được chuyển tiếp từng bước.');
  if (mode === 'MQTT_ONLY' && current.mode !== mode && (status.legacyJobsBlockingCutover > 0 || !status.mqttEnabled || !status.robots?.length)) throw Error('Cần hoàn tất công việc cũ và cấu hình robot MQTT trước khi chuyển đổi.');
  if (!note.trim() || note.trim().length > 1000) throw Error('Nhập lý do thay đổi, tối đa 1.000 ký tự.');
  return { mode, dispatchHalted, expectedRevision: current.revision, note: note.trim() };
}
