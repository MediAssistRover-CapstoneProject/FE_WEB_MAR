export const INCIDENT_STATUSES = {
  OPEN: { label: 'Chờ tiếp nhận', tone: 'danger' },
  ACKNOWLEDGED: { label: 'Đã tiếp nhận', tone: 'amber' },
  IN_PROGRESS: { label: 'Đang xử lý', tone: 'blue' },
  RESOLVED: { label: 'Chờ đóng hồ sơ', tone: 'green' },
  CLOSED: { label: 'Đã đóng', tone: 'muted' },
  FALSE_ALARM: { label: 'Báo động nhầm', tone: 'muted' },
};
export const FALL_INCIDENT_TYPE = 'AI_SUSPECTED_FALL';
export const isFallIncident = incident => [FALL_INCIDENT_TYPE, 'SUSPECTED_FALL'].includes(incident?.incidentType);
export const incidentSource = incident => isFallIncident(incident) ? 'AI nghi té ngã' : incident?.incidentType === 'SOS' ? 'SOS bấm nút' : incident?.incidentType || 'Nguồn khác';
export const INCIDENT_TYPES = { SOS: 'Yêu cầu hỗ trợ khẩn cấp', AI_SUSPECTED_FALL: 'AI phát hiện nghi té ngã', SUSPECTED_FALL: 'AI phát hiện nghi té ngã' };
export function canReviewIncident(incident, account) {
  if (!account?.accountId || !incident?.robotId) return false;
  if (account.role === 'ADMIN') return isFallIncident(incident);
  if (account.role !== 'STAFF') return false;
  return incident.sosRoutingStatus ? incident.sosResponderAccountId === account.accountId
    : !incident.acknowledgedByAccountId || incident.acknowledgedByAccountId === account.accountId;
}
export const INCIDENT_ACTIONS = {
  acknowledge: { title: 'Tiếp nhận sự cố', description: 'Ghi nhận bạn là người tiếp nhận và xác nhận các cảnh báo liên quan.', next: 'ACKNOWLEDGED' },
  start: { title: 'Bắt đầu xử lý', description: 'Ghi nhận sự cố đang được xử lý. Thao tác này không phát lệnh cho robot.', next: 'IN_PROGRESS' },
  confirm: { title: 'Xác nhận cần hỗ trợ', description: 'Bạn đã xem camera trực tiếp của sự cố này và xác nhận cần hỗ trợ. Máy chủ sẽ ghi nhận sự cố đang được xử lý.', next: 'IN_PROGRESS' },
  resolve: { title: 'Xác nhận xử lý xong', description: 'Ghi rõ kết quả kiểm tra và cách xử lý. Sự cố sẽ chuyển sang chờ đóng hồ sơ.', next: 'RESOLVED', note: true },
  close: { title: 'Đóng hồ sơ', description: 'Kết thúc hồ sơ sự cố đã được xử lý và đóng các cảnh báo liên quan.', next: 'CLOSED' },
  'false-alarm': { title: 'Báo động nhầm', description: 'Chỉ dùng sau khi xác minh. Máy chủ sẽ đóng sự cố, đóng cảnh báo và xử lý hủy yêu cầu/công việc liên quan.', next: 'FALSE_ALARM', note: true },
};

export function incidentActions(incident, account) {
  const adminFall = account?.role === 'ADMIN' && isFallIncident(incident);
  if (!account?.accountId || account.role !== 'STAFF' && !adminFall) return [];
  if (!adminFall && incident.sosRoutingStatus && incident.sosResponderAccountId !== account.accountId) return [];
  const owner = !!account.accountId && account.accountId === incident.acknowledgedByAccountId;
  if (incident.status === 'OPEN') return ['acknowledge', ...(!incident.acknowledgedByAccountId || owner || adminFall ? ['false-alarm'] : [])];
  if (incident.status === 'ACKNOWLEDGED') return owner || adminFall ? [isFallIncident(incident) ? 'confirm' : 'start', 'false-alarm'] : [];
  if (incident.status === 'IN_PROGRESS') return owner || adminFall ? ['resolve'] : [];
  if (incident.status === 'RESOLVED') return ['close'];
  return [];
}

export function assertIncidentAction(action, expected, fresh, account) {
  if (expected.incidentId !== fresh.incidentId || expected.status !== fresh.status || expected.incidentType !== fresh.incidentType
    || expected.robotId !== fresh.robotId || expected.sosResponderAccountId !== fresh.sosResponderAccountId
    || expected.acknowledgedByAccountId !== fresh.acknowledgedByAccountId || !incidentActions(fresh, account).includes(action)
    || Number.isFinite(expected.rowVersion) && Number.isFinite(fresh.rowVersion) && expected.rowVersion !== fresh.rowVersion) {
    throw Error('Sự cố đã thay đổi hoặc bạn không còn quyền thực hiện thao tác này. Đóng biểu mẫu và kiểm tra thông tin mới.');
  }
}

export function newerIncident(previous, incoming) {
  return previous?.incidentId === incoming.incidentId && Number.isFinite(previous.rowVersion) && Number.isFinite(incoming.rowVersion) && previous.rowVersion > incoming.rowVersion ? previous : incoming;
}

export function incidentPresentation(incident, catalogs = {}, account = {}) {
  const robot = catalogs.robots?.find(row => row.robotId === incident.robotId);
  const map = catalogs.maps?.find(row => row.mapId === incident.mapId);
  const endpoint = catalogs.endpoints?.find(row => row.endpointId === incident.endpointId);
  const person = id => {
    if (!id) return 'Chưa có người tiếp nhận';
    if (account.accountId === id) return account.fullName || account.username || 'Bạn';
    const staff = catalogs.staff?.find(row => (row.account?.accountId || row.accountId) === id);
    return staff?.account?.fullName || staff?.fullName || staff?.account?.username || `Tài khoản · ${id.slice(0, 8)}`;
  };
  return {
    title: INCIDENT_TYPES[incident.incidentType] || incident.incidentType || 'Sự cố khẩn cấp',
    robot: robot?.robotName || robot?.robotCode || (incident.robotId ? `Robot · ${incident.robotId.slice(0, 8)}` : 'Chưa ghi nhận robot'),
    map: map?.mapName || map?.mapCode || (incident.mapId ? `Bản đồ · ${incident.mapId.slice(0, 8)}` : 'Chưa ghi nhận bản đồ'),
    endpoint: endpoint?.endpointName || endpoint?.endpointCode || (incident.endpointId ? `Điểm · ${incident.endpointId.slice(0, 8)}` : 'Chưa ghi nhận điểm cụ thể'),
    owner: person(incident.acknowledgedByAccountId),
    responder: incident.sosResponderAccountId ? person(incident.sosResponderAccountId) : null,
    resolver: incident.resolvedByAccountId ? person(incident.resolvedByAccountId) : null,
    coordinates: typeof incident.xM === 'number' && typeof incident.yM === 'number' ? `${incident.xM.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m · ${incident.yM.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m` : null,
  };
}

export const ACTIVE_INCIDENT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED'];
export const HISTORY_INCIDENT_STATUSES = ['CLOSED', 'FALSE_ALARM'];
export const WAIT_WARNING_MINUTES = 5;
export const SOS_ROUTING_LABELS = {
  ASSIGNED: 'Đã tìm được nhân viên trực',
  NO_MONITORING_ROOM: 'Chưa cấu hình phòng trực SOS',
  ROOM_UNAVAILABLE: 'Phòng trực SOS không khả dụng',
  NO_ACTIVE_SHIFT: 'Chưa có nhân viên trong ca trực',
  AMBIGUOUS_SHIFT: 'Ca trực bị trùng, cần kiểm tra',
};
export const hasIncidentResponder = incident => !!(incident.acknowledgedByAccountId || incident.sosResponderAccountId);
export const canRetryIncidentRouting = (incident, account) => account?.role === 'ADMIN'
  && ['SOS', FALL_INCIDENT_TYPE].includes(incident?.incidentType) && !!incident.sosRoutingStatus
  && incident.status === 'OPEN' && !hasIncidentResponder(incident);

export const SOS_ROUTING_REASONS = {
  READY: 'Đã tìm được đúng một nhân viên đang trực và đã check-in. Có thể điều phối lại.',
  MONITORING_ROOM_MISSING: 'Chưa cấu hình phòng tiếp nhận SOS. Chọn một phòng trên map đang publish và lưu loại phòng SOS.',
  MONITORING_ROOM_INVALID: 'Cấu hình phòng SOS không hợp lệ. Chọn và lưu lại phòng tiếp nhận SOS.',
  ROOM_MISSING: 'Phòng SOS đã cấu hình không còn tồn tại. Chọn lại phòng trên map đang publish.',
  ROOM_INACTIVE: 'Phòng SOS đang bị tắt. Bật hoạt động hoặc chọn phòng SOS khác trên map đang publish.',
  FLOOR_INACTIVE: 'Tầng của phòng SOS đang không hoạt động. Kiểm tra lại tầng và phòng tiếp nhận.',
  DIFFERENT_HOSPITAL: 'Phòng SOS và bản đồ của sự cố thuộc hai cơ sở khác nhau. Cần kiểm tra cấu hình phòng tiếp nhận.',
  NO_ENDPOINT_ON_ACTIVE_MAP: 'Phòng SOS chưa có điểm đang bật trên map đang publish. Nếu vừa đổi map, hãy gắn điểm cho phòng hoặc chọn lại phòng SOS trên map mới.',
  NO_ENDPOINT_ON_INCIDENT_MAP: 'Phòng SOS không có điểm đang bật trên đúng map của sự cố, hoặc map đó đã ngừng hoạt động. Kiểm tra ID map và phòng tiếp nhận.',
  NO_CHECKED_IN_STAFF: 'Chưa có nhân viên đủ điều kiện tại phòng SOS: cần ca đang hoạt động, còn giờ, đã check-in, chưa check-out và tài khoản Staff đang hoạt động.',
  MULTIPLE_CHECKED_IN_STAFF: 'Có nhiều nhân viên đủ điều kiện tại phòng SOS. Kiểm tra phân công trùng trước khi điều phối lại.',
};
export const incidentOverdue = (incident, now = Date.now()) => incident.status === 'OPEN'
  && Number.isFinite(Date.parse(incident.occurredAt)) && now - Date.parse(incident.occurredAt) >= WAIT_WARNING_MINUTES * 60000;

export function prioritizeIncidents(rows, now = Date.now()) {
  const rank = row => row.status === 'OPEN' ? (incidentOverdue(row, now) ? 0 : 1) : row.status === 'RESOLVED' ? 3 : 2;
  return [...rows].sort((a, b) => rank(a) - rank(b)
    || (a.severity === 'CRITICAL' ? 0 : 1) - (b.severity === 'CRITICAL' ? 0 : 1)
    || (a.status === 'OPEN' && b.status === 'OPEN' ? Date.parse(a.occurredAt) - Date.parse(b.occurredAt) : Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    || a.incidentId.localeCompare(b.incidentId));
}

export function filterActiveIncidents(rows, filters, quick, now = Date.now()) {
  const query = incidentQuery(filters);
  return prioritizeIncidents(rows.filter(row => (!filters.status || row.status === filters.status)
    && (!filters.severity || row.severity === filters.severity) && (!filters.type || (filters.type === FALL_INCIDENT_TYPE || filters.type === 'SUSPECTED_FALL' ? isFallIncident(row) : row.incidentType === filters.type))
    && (!filters.mapId || row.mapId === filters.mapId)
    && (!query.from || Date.parse(row.occurredAt) >= Date.parse(query.from))
    && (!query.to || Date.parse(row.occurredAt) <= Date.parse(query.to))
    && (!quick || quick === 'open' && row.status === 'OPEN'
      || quick === 'handling' && ['ACKNOWLEDGED', 'IN_PROGRESS'].includes(row.status)
      || quick === 'unassigned' && !hasIncidentResponder(row) && row.status !== 'RESOLVED'
      || quick === 'overdue' && incidentOverdue(row, now))), now);
}

// BE accepts one status per request. Merge the first N rows of each terminal
// stream so history remains globally ordered and paginated without loading it all.
export async function loadIncidentHistory(fetchPage, filters, page, size = 10) {
  const statuses = filters.status ? [filters.status] : HISTORY_INCIDENT_STATUSES;
  const streams = await Promise.all(statuses.map(async status => {
    const first = await fetchPage({ ...incidentQuery(filters), status, page: 0, size });
    if (!Array.isArray(first?.content) || !Number.isFinite(first.totalElements)) throw Error('Danh sách sự cố không đúng định dạng.');
    const parts = [first];
    for (let index = 1; index <= page && index < first.totalPages; index++) {
      const value = await fetchPage({ ...incidentQuery(filters), status, page: index, size });
      if (!Array.isArray(value?.content)) throw Error('Danh sách sự cố không đúng định dạng.');
      parts.push(value);
    }
    return { rows: parts.flatMap(part => part.content), total: first.totalElements };
  }));
  const rows = streams.flatMap(stream => stream.rows).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.incidentId.localeCompare(b.incidentId));
  const totalElements = streams.reduce((sum, stream) => sum + stream.total, 0);
  return { content: rows.slice(page * size, (page + 1) * size), totalElements, totalPages: Math.ceil(totalElements / size) };
}

export function incidentQuery(filters) {
  const query = { status: filters.status, severity: filters.severity, type: filters.type === 'SUSPECTED_FALL' ? FALL_INCIDENT_TYPE : filters.type, mapId: filters.mapId };
  if (filters.from && filters.to && filters.from > filters.to) throw Error('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
  if (filters.from) query.from = new Date(`${filters.from}T00:00:00`).toISOString();
  if (filters.to) query.to = new Date(`${filters.to}T23:59:59.999`).toISOString();
  return query;
}

export function incidentTimeline(incident) {
  const rows = [{ label: 'Ghi nhận sự cố', at: incident.occurredAt, done: !!incident.occurredAt }];
  if (incident.acknowledgedAt) rows.push({ label: isFallIncident(incident) ? 'Tiếp nhận để xác minh' : 'Tiếp nhận', at: incident.acknowledgedAt, done: true });
  else if (incident.status === 'OPEN') rows.push({ label: 'Chờ nhân viên tiếp nhận', done: false });
  if (isFallIncident(incident) && incident.status === 'ACKNOWLEDGED') rows.push({ label: 'Chờ xác minh qua camera', done: false, current: true });
  if (incident.status === 'IN_PROGRESS') rows.push({ label: isFallIncident(incident) ? 'Đã xác nhận cần hỗ trợ · Đang xử lý' : 'Đang xử lý', done: false, current: true });
  if (incident.resolvedAt) rows.push({ label: incident.status === 'FALSE_ALARM' ? 'Xác nhận báo động nhầm' : 'Đã xử lý xong', at: incident.resolvedAt, done: true });
  if (incident.closedAt) rows.push({ label: 'Đóng hồ sơ', at: incident.closedAt, done: true });
  else if (incident.status === 'RESOLVED') rows.push({ label: 'Chờ đóng hồ sơ', done: false, current: true });
  return rows;
}
