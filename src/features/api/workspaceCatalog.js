import { operations } from './contract.js';
import { vi } from '../../i18n/vi.js';
import { backendFieldLabels, settingLabels } from '../../i18n/backendLabels.js';

const resource = (id, title, section, root, idField, extra = {}) => ({ id, title, section, root: `/api/v1/${root}`, idField, ...extra });
export const resources = [
  resource('requests', 'Yêu cầu dịch vụ', 'Missions', 'service-requests', 'serviceRequestId'),
  resource('deliveries', 'Giao nhận', 'Missions', 'delivery-requests', 'serviceRequestId'),
  resource('jobs', 'Công việc', 'Live Operations', 'jobs', 'jobId'),
  resource('schedules', 'Lịch tự động', 'Patrol', 'schedules', 'scheduleId'),
  resource('robots', 'Robot', 'Robot Status', 'robots', 'robotId'),
  resource('hospitals', 'Thông tin bệnh viện', 'Facility Management', 'hospital-information', 'hospitalInformationId', { description: 'Hồ sơ nội bộ của bệnh viện. API quản trị chỉ hỗ trợ phân trang; không có bộ lọc máy chủ.' }),
  resource('articles', 'Bài hướng dẫn', 'Facility Management', 'hospital-information/{hospitalId}/articles', 'articleId', { parentCatalogKey: 'GET /api/v1/hospital-information', parentLabel: 'Bệnh viện', description: 'Chọn một hồ sơ bệnh viện để quản lý bài hướng dẫn. API hỗ trợ lọc trạng thái bài viết.' }),
  resource('floors', 'Tầng', 'Facility Management', 'floors', 'floorId'),
  resource('maps', 'Bản đồ máy chủ', 'Facility Management', 'maps', 'mapId'),
  resource('zones', 'Vùng', 'Facility Management', 'zones', 'zoneId'),
  resource('rooms', 'Phòng', 'Facility Management', 'rooms', 'roomId'),
  resource('endpoints', 'Điểm đích', 'Facility Management', 'endpoints', 'endpointId'),
  resource('groups', 'Nhóm điểm đích', 'Facility Management', 'endpoint-groups', 'endpointGroupId'),
  resource('members', 'Thành viên nhóm', 'Facility Management', 'endpoint-group-members', 'endpointId'),
  resource('workflows', 'Định nghĩa quy trình', 'Workflow Management', 'admin/workflows', 'workflowId', { adminOnly: true }),
  resource('published', 'Quy trình đã phát hành', 'Workflow Management', 'workflows/published', 'workflowId'),
  resource('steps', 'Thư viện bước', 'Workflow Management', 'workflows/step-types', 'stepTypeCode'),
  resource('alerts', 'Cảnh báo', 'Alerts', 'alerts', 'alertId'),
  resource('incidents', 'Sự cố khẩn cấp', 'Emergency Center', 'emergency-incidents', 'incidentId'),
  resource('staff', 'Nhân viên', 'Users & Roles', 'admin/staff', 'staffProfileId', { adminOnly: true }),
  resource('shifts', 'Phân ca trực', 'Staff Shifts', 'admin/shifts', 'shiftId', { adminOnly: true }),
  resource('my-shifts', 'Ca trực của tôi', 'Staff Shifts', 'staff/shifts', 'shiftId', { staffOnly: true }),
  resource('profile', 'Tài khoản', 'My Account', 'auth/me', 'accountId'),
  resource('staff-profile', 'Hồ sơ nhân viên', 'My Account', 'staff/me', 'staffProfileId', { staffOnly: true }),
  resource('settings', 'Cài đặt hệ thống', 'System Settings', 'admin/system-settings', 'systemSettingId', { adminOnly: true }),
  resource('mqtt', 'Kết nối robot', 'System Settings', 'admin/mqtt-rollout', 'revision', { adminOnly: true }),
  resource('retention', 'Lưu trữ dữ liệu', 'System Settings', 'admin/operations/retention/policies', 'dataset', { adminOnly: true }),
  resource('audit', 'Nhật ký kiểm toán', 'Audit Logs', 'admin/audit-logs', 'auditLogId', { adminOnly: true }),
  resource('detections', 'Sự kiện phát hiện', 'History & Replay', 'admin/monitoring/detections', 'detectionEventId', { adminOnly: true }),
  resource('crowd', 'Mật độ người', 'Crowd Heatmap', 'admin/monitoring/crowd-density', 'crowdDensityRecordId', { adminOnly: true }),
  resource('heatmaps', 'Bản đồ mật độ', 'Crowd Heatmap', 'admin/monitoring/heatmaps', 'heatmapRecordId', { adminOnly: true }),
  resource('reports', 'Tổng quan vận hành', 'Analytics', 'admin/reports/overview', '', { adminOnly: true }),
  resource('analytics', 'Phân tích', 'Analytics', 'admin/reports/analytics', '', { adminOnly: true }),
  resource('job-reports', 'Báo cáo công việc', 'Analytics', 'admin/reports/jobs', 'jobId', { adminOnly: true }),
  resource('interactions', 'Hội thoại', 'Voice & Scripts', 'voice/interactions', 'voiceInteractionId'),
  resource('commands', 'Lệnh giọng nói', 'Voice & Scripts', 'voice/commands', 'voiceCommandId'),
  resource('public-hospital-information', 'Thông tin bệnh viện', 'Public Catalog', 'public/hospital-information', 'hospitalInformationId', { description: 'Chỉ hiển thị thông tin đã phát hành và công khai.', filterHint: 'Tìm theo từ khóa, danh mục hoặc mã ngôn ngữ.' }),
  resource('public-articles', 'Bài hướng dẫn', 'Public Catalog', 'public/hospital-information/{hospitalId}/articles', 'articleId', { parentCatalogKey: 'GET /api/v1/public/hospital-information', parentLabel: 'Bệnh viện công khai', description: 'Chỉ hiển thị bài hướng dẫn đã phát hành của bệnh viện đã chọn.', filterHint: 'Tìm theo từ khóa, danh mục hoặc mã ngôn ngữ.' }),
  resource('public-floors', 'Tầng', 'Public Catalog', 'public/floors', 'floorId', { description: 'Chỉ hiển thị tầng đang hoạt động và được phép công khai.', filterHint: 'Có thể lọc theo bệnh viện hoặc từ khóa.' }),
  resource('public-rooms', 'Phòng', 'Public Catalog', 'public/rooms', 'roomId', { description: 'Chỉ hiển thị phòng đang hoạt động và công khai.', filterHint: 'Có thể lọc theo tầng, loại phòng, khoa hoặc từ khóa.' }),
  resource('public-zones', 'Vùng', 'Public Catalog', 'public/zones', 'zoneId', { description: 'Chỉ hiển thị vùng đang hoạt động và công khai.', filterHint: 'Có thể lọc theo bản đồ, loại vùng hoặc từ khóa.' }),
  resource('public-endpoints', 'Điểm đích', 'Public Catalog', 'public/endpoints', 'endpointId', { description: 'Chỉ hiển thị điểm đích đang hoạt động, công khai.', filterHint: 'Có thể lọc theo bản đồ, phòng, loại điểm, khả năng tiếp cận hoặc từ khóa.' }),
  resource('public-endpoint-groups', 'Nhóm điểm đích', 'Public Catalog', 'public/endpoint-groups', 'endpointGroupId', { description: 'Chỉ hiển thị nhóm điểm đích đang hoạt động và công khai.', filterHint: 'Có thể lọc theo bản đồ hoặc từ khóa.' }),
];
export const managedOperations = new Set(['POST /api/v1/auth/login', 'POST /api/v1/auth/logout', 'POST /api/v1/auth/refresh']);
export function resourceFor(operation) {
  const path = operation.path;
  if (/^\/api\/v1\/(information|navigation|escort|operational)-requests$/.test(path)) return resources.find(r => r.id === 'requests');
  if (path === '/api/v1/mapping-jobs') return resources.find(r => r.id === 'maps');
  if (path.startsWith('/api/v1/job-steps/') || path.startsWith('/api/v1/auth-verifications/')) return resources.find(r => r.id === 'jobs');
  if (path.startsWith('/api/v1/admin/accounts/')) return resources.find(r => r.id === 'staff');
  if (path.includes('/ai-profile')) return resources.find(r => r.id === 'robots');
  if (path.includes('/retention/')) return resources.find(r => r.id === 'retention');
  if (path === '/api/v1/auth/change-password') return resources.find(r => r.id === 'profile');
  return [...resources].sort((a, b) => b.root.length - a.root.length).find(r => path === r.root || path.startsWith(r.root + '/'));
}
export function resourceOperations(id) {
  return Object.values(operations).filter(o => resourceFor(o)?.id === id && !o.deprecated);
}
export const screenTitles = {
  'Facility Management': 'Danh mục bệnh viện', 'Workflow Management': 'Quản lý quy trình', 'Staff Shifts': 'Ca trực',
  'My Account': 'Tài khoản của tôi', 'Public Catalog': 'Thông tin công khai',
};
export const fieldLabels = {
  ...backendFieldLabels,
  id: 'Bản ghi', status: 'Trạng thái', active: 'Đang hoạt động', enabled: 'Kích hoạt', accessible: 'Có thể tiếp cận', publicVisible: 'Hiển thị công khai',
  name: 'Tên', code: 'Mã', title: 'Tiêu đề', description: 'Mô tả', note: 'Ghi chú', reason: 'Lý do', from: 'Từ ngày', to: 'Đến ngày', page: 'Trang', size: 'Số bản ghi mỗi trang',
  username: 'Tên đăng nhập', password: 'Mật khẩu', temporaryPassword: 'Mật khẩu tạm thời', currentPassword: 'Mật khẩu hiện tại', newPassword: 'Mật khẩu mới',
  fullName: 'Họ tên', email: 'Email', phone: 'Số điện thoại', role: 'Vai trò', accountId: 'Tài khoản', staffProfileId: 'Nhân viên', staffAccountId: 'Tài khoản nhân viên',
  staffCode: 'Mã nhân viên', departmentCode: 'Mã khoa', jobTitle: 'Chức danh', contactExtension: 'Số máy lẻ', mustChangePassword: 'Cần đổi mật khẩu',
  hospitalInformationId: 'Thông tin bệnh viện', hospitalId: 'Bệnh viện', articleId: 'Bài hướng dẫn', infoCategory: 'Danh mục thông tin', content: 'Nội dung', languageCode: 'Ngôn ngữ', keywordsJson: 'Từ khóa',
  articleCode: 'Mã bài viết', category: 'Danh mục', canonicalQuestion: 'Câu hỏi', answer: 'Câu trả lời', effectiveFrom: 'Có hiệu lực từ', effectiveUntil: 'Hết hiệu lực lúc',
  floorId: 'Tầng', floorCode: 'Mã tầng', floorName: 'Tên tầng', levelNo: 'Tầng số', displayOrder: 'Thứ tự hiển thị',
  mapId: 'Bản đồ', mapName: 'Tên bản đồ', mapCode: 'Mã bản đồ', currentMapId: 'Bản đồ hiện tại', versionNo: 'Phiên bản', widthM: 'Chiều rộng (m)', heightM: 'Chiều cao (m)',
  resolutionMPerPixel: 'Độ phân giải (m/ô)', originXM: 'Gốc X (m)', originYM: 'Gốc Y (m)', originYawRad: 'Góc gốc (rad)', frameId: 'Khung tọa độ', mapFileUri: 'Tệp bản đồ', assetHash: 'Mã xác minh bản đồ',
  zoneId: 'Vùng', zoneCode: 'Mã vùng', zoneName: 'Tên vùng', zoneType: 'Loại vùng', polygonJson: 'Đa giác vùng', speedLimitMps: 'Giới hạn tốc độ (m/s)', capacityLimit: 'Sức chứa', calibratedAreaM2: 'Diện tích (m²)', cameraSourceRef: 'Nguồn camera', cameraRoiJson: 'Vùng quan sát camera',
  roomId: 'Phòng', roomCode: 'Mã phòng', roomName: 'Tên phòng', roomType: 'Loại phòng', defaultEndpointGroupId: 'Nhóm điểm mặc định',
  endpointId: 'Điểm đích', endpointCode: 'Mã điểm đích', endpointName: 'Tên điểm đích', endpointType: 'Loại điểm đích', xM: 'Vị trí X (m)', yM: 'Vị trí Y (m)', yawRad: 'Hướng (rad)',
  groupId: 'Nhóm điểm đích', endpointGroupId: 'Nhóm điểm đích', groupCode: 'Mã nhóm', groupName: 'Tên nhóm', selectionPolicy: 'Chính sách chọn điểm', allowFallback: 'Thử điểm tiếp theo khi không có đường', sequenceNo: 'Thứ tự',
  robotId: 'Robot', robotCode: 'Mã robot', robotName: 'Tên robot', model: 'Mẫu robot', serialNumber: 'Số sê-ri', protocolVersion: 'Phiên bản giao tiếp', capabilitiesJson: 'Khả năng robot', batteryPercent: 'Pin (%)', batteryLevel: 'Mức pin',
  workflowId: 'Quy trình', workflowCode: 'Mã quy trình', workflowName: 'Tên quy trình', serviceType: 'Loại dịch vụ', schemaVersion: 'Phiên bản dữ liệu', graphVersion: 'Phiên bản đồ thị',
  taskId: 'Tác vụ', taskCode: 'Mã tác vụ', taskName: 'Tên tác vụ', stepId: 'Bước', stepCode: 'Mã bước', stepName: 'Tên bước', stepTypeCode: 'Loại bước', transitionId: 'Liên kết bước', fromStepId: 'Từ bước', toStepId: 'Đến bước', startStepId: 'Bước bắt đầu', startStepCode: 'Mã bước bắt đầu',
  defaultTransition: 'Liên kết mặc định', terminalStatus: 'Trạng thái kết thúc', timeoutSec: 'Thời gian chờ (giây)', maxAttempts: 'Số lần thử tối đa', retryDelaySec: 'Khoảng thử lại (giây)', maxVisits: 'Số lần đi qua tối đa', auditLevel: 'Mức ghi nhật ký', maxDurationSec: 'Thời gian tối đa (giây)', maxTotalVisits: 'Tổng lượt tối đa',
  inputSchemaJson: 'Cấu trúc đầu vào', inputUiJson: 'Giao diện đầu vào', defaultInputsJson: 'Đầu vào mặc định', outputMappingJson: 'Ánh xạ đầu ra', requiredCapabilitiesJson: 'Khả năng cần có', configJson: 'Cấu hình', paramsJson: 'Tham số', inputMappingJson: 'Ánh xạ đầu vào', retryCodesJson: 'Mã lỗi cho phép thử lại', conditionJson: 'Điều kiện',
  serviceRequestId: 'Yêu cầu dịch vụ', requestId: 'Yêu cầu', requestCode: 'Mã yêu cầu', requestType: 'Loại yêu cầu', priority: 'Độ ưu tiên', data: 'Dữ liệu bổ sung',
  originRoomId: 'Phòng xuất phát', destinationRoomId: 'Phòng đến', pickupRoomId: 'Phòng nhận hàng', deliveryRoomId: 'Phòng giao hàng', originEndpointId: 'Điểm xuất phát', destinationEndpointId: 'Điểm đến', destinationGroupId: 'Nhóm điểm đến', pickupEndpointId: 'Điểm nhận hàng', deliveryEndpointId: 'Điểm giao hàng', deliveryGroupId: 'Nhóm điểm giao hàng', targetMode: 'Chọn đích theo',
  navigationMode: 'Chế độ dẫn đường', routePreference: 'Ưu tiên tuyến', patientReference: 'Mã tham chiếu người cần hỗ trợ', escortMode: 'Chế độ hộ tống', walkingSpeedMps: 'Tốc độ đi bộ (m/s)', confirmationTimeoutSec: 'Thời gian chờ xác nhận (giây)', escortNote: 'Ghi chú hộ tống',
  recipientName: 'Người nhận', recipientContact: 'Liên hệ người nhận', requiresConfirmation: 'Yêu cầu xác nhận giao nhận', temperatureRequirement: 'Yêu cầu nhiệt độ', deliveryDeadline: 'Hạn giao', deliveryNote: 'Ghi chú giao nhận', items: 'Danh sách hàng', itemCode: 'Mã hàng', itemName: 'Tên hàng', itemCategory: 'Loại hàng', quantity: 'Số lượng', unit: 'Đơn vị', sensitive: 'Hàng nhạy cảm', handlingInstruction: 'Hướng dẫn xử lý', itemNote: 'Ghi chú hàng',
  jobId: 'Công việc', jobCode: 'Mã công việc', jobStepId: 'Bước đang chạy', authJobStepId: 'Bước xác thực', selectedJobStepId: 'Bước hiện tại', assignedStaffAccountId: 'Nhân viên phụ trách',
  verificationId: 'Xác thực giao nhận', method: 'Phương thức', purpose: 'Mục đích', validForSeconds: 'Hiệu lực (giây)', proof: 'Mã QR đã quét', responseType: 'Loại xác nhận', compartmentClosed: 'Đã kiểm tra cửa đóng', compartmentLocked: 'Đã kiểm tra khóa chốt',
  resolutionNote: 'Nội dung xử lý', evidence: 'Bằng chứng', outcome: 'Kết quả xử lý', confirmedStopped: 'Đã xác nhận robot dừng', commandId: 'Lệnh', operationKey: 'Mã thao tác', transportSessionId: 'Phiên kết nối', correlationKey: 'Mã liên kết sự kiện', eventId: 'Mã sự kiện', eventType: 'Loại sự kiện', occurredAt: 'Thời điểm xảy ra',
  scheduleId: 'Lịch', scheduleCode: 'Mã lịch', scheduleName: 'Tên lịch', scheduleType: 'Kiểu lịch', timezone: 'Múi giờ', startsAt: 'Bắt đầu', endsAt: 'Kết thúc', intervalSec: 'Chu kỳ (giây)', cronExpression: 'Biểu thức lịch lặp', inputTemplateJson: 'Đầu vào quy trình', misfirePolicy: 'Khi lỡ lịch',
  shiftId: 'Ca trực', shiftCode: 'Mã ca', shiftName: 'Tên ca', slots: 'Khung giờ', slotId: 'Khung giờ',
  settingId: 'Cài đặt', settingKey: 'Mã cài đặt', settingValue: 'Giá trị cài đặt', dataType: 'Kiểu dữ liệu', publicSetting: 'Cài đặt công khai',
  mode: 'Chế độ', dispatchHalted: 'Dừng điều phối mới', expectedRevision: 'Phiên bản cấu hình hiện tại', revision: 'Phiên bản', dryRun: 'Chỉ xem trước',
  sensingType: 'Loại giám sát', modelVersion: 'Phiên bản mô hình', producerRef: 'Nguồn giám sát', personPositionsEnabled: 'Theo dõi vị trí người', commissioningNote: 'Ghi chú nghiệm thu',
  heatmapType: 'Loại bản đồ mật độ', periodStart: 'Đầu kỳ', periodEnd: 'Cuối kỳ', cellSizeM: 'Kích thước ô (m)', gridData: 'Dữ liệu lưới', imageUri: 'Ảnh', maxValue: 'Giá trị lớn nhất', sourceRecordCount: 'Số bản ghi nguồn',
  createdAt: 'Ngày tạo', updatedAt: 'Cập nhật', requestedAt: 'Ngày yêu cầu', queuedAt: 'Vào hàng đợi', startedAt: 'Bắt đầu', endedAt: 'Kết thúc', completedAt: 'Hoàn tất', recordedAt: 'Thời điểm ghi', capturedAt: 'Thời điểm quan sát',
  incidentId: 'Sự cố', incidentType: 'Loại sự cố', severity: 'Mức độ', alertId: 'Cảnh báo', alertType: 'Loại cảnh báo', message: 'Nội dung', errorCode: 'Mã lỗi', failureReason: 'Lý do thất bại',
};
export function fieldLabel(key) { return fieldLabels[key] || (vi(key) !== key ? vi(key) : key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')); }
const verbs = { activate: 'Kích hoạt', deactivate: 'Ngừng hoạt động', archive: 'Lưu trữ', publish: 'Phát hành', retire: 'Ngừng sử dụng', pause: 'Tạm dừng', submit: 'Gửi xử lý', cancel: 'Hủy', acknowledge: 'Tiếp nhận', start: 'Bắt đầu xử lý', resolve: 'Xử lý xong', close: 'Đóng', 'false-alarm': 'Báo động nhầm', reconcile: 'Đối soát phục hồi', 'assign-robot': 'Phân robot', 'assign-staff': 'Phân nhân viên', 'rotate-secret': 'Đổi khóa thiết bị', 'provision-secret': 'Cấp khóa thiết bị', maintenance: 'Bảo trì', 'qr-challenges': 'Cấp mã QR', 'qr-verifications': 'Xác thực mã QR', 'auth-verifications': 'Xác nhận nhân viên', responses: 'Xác nhận bước', 'confirm-pickup': 'Xác nhận nhận hàng (luồng cũ)', 'confirm-delivery': 'Xác nhận giao hàng (luồng cũ)', validate: 'Kiểm tra quy trình', clone: 'Tạo phiên bản mới', 'start-step': 'Chọn bước bắt đầu', graph: 'Lưu đồ thị quy trình', 'change-password': 'Đổi mật khẩu', transition: 'Đổi trạng thái', lock: 'Khóa tài khoản', unlock: 'Mở khóa tài khoản', 'reset-password': 'Đặt lại mật khẩu', 'ai-profile': 'Cấu hình giám sát', runs: 'Chạy lưu trữ', stream: 'Theo dõi trực tiếp', events: 'Sự kiện', recovery: 'Bằng chứng phục hồi', 'mapping-session': 'Phiên quét', 'artifact-metadata': 'Dữ liệu bản quét', 'status-history': 'Lịch sử trạng thái', 'location-history': 'Lịch sử vị trí', 'export.csv': 'Xuất CSV', tasks: 'Tác vụ', steps: 'Bước', transitions: 'Liên kết bước', slots: 'Khung giờ', members: 'Thành viên', articles: 'Bài hướng dẫn' };
export function actionLabel(op) {
  const r = resourceFor(op), suffix = op.path.split('/').at(-1);
  if (op.path === '/api/v1/mapping-jobs') return 'Tạo phiên quét';
  if (/^\/api\/v1\/(information|navigation|escort|operational)-requests$/.test(op.path)) return ({ information: 'Yêu cầu thông tin', navigation: 'Yêu cầu dẫn đường', escort: 'Yêu cầu hộ tống', operational: 'Yêu cầu vận hành' })[suffix.split('-')[0]];
  if (op.method === 'GET') return op.path === r?.root ? 'Danh sách' : verbs[suffix] || 'Xem chi tiết';
  if (op.method === 'DELETE') return 'Gỡ / ngừng sử dụng';
  if (op.path === r?.root) return op.method === 'POST' ? 'Tạo mới' : 'Cập nhật';
  if (suffix.startsWith('{')) return 'Chỉnh sửa ' + (verbs[op.path.split('/').at(-2)] || 'thông tin');
  return verbs[suffix] || 'Lưu thông tin';
}
export const references = {
  robotId: ['robots', 'robotId'], workflowId: ['published', 'workflowId'], floorId: ['floors', 'floorId'], hospitalId: ['hospitals', 'hospitalInformationId'], hospitalInformationId: ['hospitals', 'hospitalInformationId'],
  mapId: ['maps', 'mapId'], currentMapId: ['maps', 'mapId'], zoneId: ['zones', 'zoneId'], roomId: ['rooms', 'roomId'],
  staffProfileId: ['staff', 'staffProfileId'], staffAccountId: ['staff', 'account.accountId'], accountId: ['staff', 'account.accountId'],
  endpointId: ['endpoints', 'endpointId'], endpointGroupId: ['groups', 'endpointGroupId'], groupId: ['groups', 'endpointGroupId'], defaultEndpointGroupId: ['groups', 'endpointGroupId'],
  jobId: ['jobs', 'jobId'], requestId: ['requests', 'serviceRequestId'], serviceRequestId: ['requests', 'serviceRequestId'],
};
for (const key of ['originRoomId', 'destinationRoomId', 'pickupRoomId', 'deliveryRoomId']) references[key] = references.roomId;
for (const key of ['originEndpointId', 'destinationEndpointId', 'pickupEndpointId', 'deliveryEndpointId']) references[key] = references.endpointId;
for (const key of ['destinationGroupId', 'deliveryGroupId']) references[key] = references.endpointGroupId;
references.assignedStaffAccountId = references.staffAccountId;
export function valueAt(row, path) { return path.split('.').reduce((v, k) => v?.[k], row); }
export function recordTitle(row, resource) {
  if (row?.dataset) return vi(row.dataset);
  if (row?.settingKey) return settingLabels[row.settingKey] || 'Cài đặt tùy chỉnh';
  if (row?.actionCode) return vi(row.actionCode) !== row.actionCode ? vi(row.actionCode) : 'Hoạt động hệ thống';
  const name = row?.workflowName || row?.robotName || row?.endpointName || row?.groupName || row?.roomName || row?.floorName || row?.mapName || row?.zoneName || row?.shiftName || row?.scheduleName || row?.account?.fullName || row?.fullName || row?.title || row?.itemName || row?.stepName || row?.taskName || row?.displayName || row?.stepTypeCode || row?.username || row?.incidentType || row?.alertType || row?.name;
  if (name) return vi(name);
  if (row?.requestType || row?.serviceType) return vi(row.requestType || row.serviceType);
  if (row?.jobCode || row?.jobId) return 'Công việc robot';
  if (row?.requestCode || row?.serviceRequestId) return 'Yêu cầu dịch vụ';
  if (row?.eventType) return vi(row.eventType);
  if (row?.crowdDensityRecordId) return `Mật độ người · ${row.personCount ?? '—'} người`;
  if (row?.heatmapRecordId) return 'Bản đồ mật độ';
  if (row?.voiceCommandId) return row.normalizedText || row.rawText || `Lệnh giọng nói${row.sequenceNo != null ? ` · Lượt ${row.sequenceNo}` : ''}`;
  if (row?.voiceInteractionId) return row.transcriptSummary || 'Hội thoại với robot';
  if (row?.endpointGroupId && row?.endpointId) return `Điểm thành viên${row.sequenceNo != null ? ` · Thứ tự ${row.sequenceNo}` : ''}`;
  return resource?.title || 'Thông tin chưa có tên';
}

export function recordTimestamp(row) {
  return row?.requestedAt || row?.createdAt || row?.queuedAt || row?.startsAt || row?.occurredAt || row?.recordedAt || row?.publishedAt || row?.capturedAt || row?.detectedAt || row?.receivedAt || row?.startedAt || row?.generatedAt || row?.updatedAt;
}

export function recordStatus(row) {
  return row?.status ?? (row?.active === undefined ? row?.severity || row?.category || row?.entityType || row?.serviceType || row?.mode || row?.densityLevel : row.active ? 'ACTIVE' : 'INACTIVE');
}

export function settingDisplayValue(row) {
  const value = row?.settingValue?.value;
  if (value == null || typeof value === 'object') return '';
  const text = typeof value === 'boolean' ? (value ? 'Bật' : 'Tắt') : vi(String(value));
  return `${text}${row.settingKey?.endsWith('_days') ? ' ngày' : row.settingKey?.endsWith('_seconds') ? ' giây' : ''}`;
}

export function statusTone(value) {
  if (['FAILED', 'ERROR', 'CRITICAL', 'RECOVERY_REQUIRED', 'REJECTED'].includes(value)) return 'danger';
  if (['OPEN', 'WARNING', 'HIGH', 'PENDING', 'QUEUED', 'RETRYING'].includes(value)) return 'warning';
  if (['RUNNING', 'IN_PROGRESS', 'ACTIVE', 'SUCCEEDED', 'COMPLETED', 'ONLINE', 'RESOLVED'].includes(value)) return 'primary';
  return 'neutral';
}
