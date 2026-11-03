export const INCIDENT_STATUSES = {
  OPEN: { label: 'Chờ tiếp nhận', tone: 'danger' },
  ACKNOWLEDGED: { label: 'Đã tiếp nhận', tone: 'amber' },
  IN_PROGRESS: { label: 'Đang xử lý', tone: 'blue' },
  RESOLVED: { label: 'Chờ đóng hồ sơ', tone: 'green' },
  CLOSED: { label: 'Đã đóng', tone: 'muted' },
  FALSE_ALARM: { label: 'Báo động nhầm', tone: 'muted' },
};
export const INCIDENT_TYPES = { SOS: 'Yêu cầu hỗ trợ khẩn cấp', SUSPECTED_FALL: 'Nghi ngờ có người ngã' };
export const INCIDENT_ACTIONS = {
  acknowledge: { title: 'Tiếp nhận sự cố', description: 'Ghi nhận bạn là người tiếp nhận và xác nhận các cảnh báo liên quan.', next: 'ACKNOWLEDGED' },
  start: { title: 'Bắt đầu xử lý', description: 'Ghi nhận sự cố đang được xử lý. Thao tác này không phát lệnh cho robot.', next: 'IN_PROGRESS' },
  resolve: { title: 'Xác nhận xử lý xong', description: 'Ghi rõ kết quả kiểm tra và cách xử lý. Sự cố sẽ chuyển sang chờ đóng hồ sơ.', next: 'RESOLVED', note: true },
  close: { title: 'Đóng hồ sơ', description: 'Kết thúc hồ sơ sự cố đã được xử lý và đóng các cảnh báo liên quan.', next: 'CLOSED' },
  'false-alarm': { title: 'Báo động nhầm', description: 'Chỉ dùng sau khi xác minh. Máy chủ sẽ đóng sự cố, đóng cảnh báo và xử lý hủy yêu cầu/công việc liên quan.', next: 'FALSE_ALARM', note: true },
};

export function incidentActions(incident, account) {
  // Admin uses this page for monitoring. Staff reception/routing is managed
  // separately by BE; do not expose incident mutations in the admin view.
  if (account?.role !== 'STAFF') return [];
  const owner = !!account.accountId && account.accountId === incident.acknowledgedByAccountId;
  if (incident.status === 'OPEN') return ['acknowledge', ...(!incident.acknowledgedByAccountId || owner ? ['false-alarm'] : [])];
  if (incident.status === 'ACKNOWLEDGED') return owner ? ['start', 'false-alarm'] : [];
  if (incident.status === 'IN_PROGRESS') return owner ? ['resolve'] : [];
  if (incident.status === 'RESOLVED') return ['close'];
  return [];
}

export function assertIncidentAction(action, expected, fresh, account) {
  if (expected.incidentId !== fresh.incidentId || expected.status !== fresh.status || !incidentActions(fresh, account).includes(action)
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
    resolver: incident.resolvedByAccountId ? person(incident.resolvedByAccountId) : null,
    coordinates: typeof incident.xM === 'number' && typeof incident.yM === 'number' ? `${incident.xM.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m · ${incident.yM.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m` : null,
  };
}

export function incidentQuery(filters) {
  const query = { status: filters.status, severity: filters.severity, type: filters.type, mapId: filters.mapId };
  if (filters.from && filters.to && filters.from > filters.to) throw Error('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
  if (filters.from) query.from = new Date(`${filters.from}T00:00:00`).toISOString();
  if (filters.to) query.to = new Date(`${filters.to}T23:59:59.999`).toISOString();
  return query;
}

export function incidentTimeline(incident) {
  const rows = [{ label: 'Ghi nhận sự cố', at: incident.occurredAt, done: !!incident.occurredAt }];
  if (incident.acknowledgedAt) rows.push({ label: 'Tiếp nhận', at: incident.acknowledgedAt, done: true });
  else if (incident.status === 'OPEN') rows.push({ label: 'Chờ nhân viên tiếp nhận', done: false });
  if (incident.status === 'IN_PROGRESS') rows.push({ label: 'Đang xử lý', done: false, current: true });
  if (incident.resolvedAt) rows.push({ label: incident.status === 'FALSE_ALARM' ? 'Xác nhận báo động nhầm' : 'Đã xử lý xong', at: incident.resolvedAt, done: true });
  if (incident.closedAt) rows.push({ label: 'Đóng hồ sơ', at: incident.closedAt, done: true });
  else if (incident.status === 'RESOLVED') rows.push({ label: 'Chờ đóng hồ sơ', done: false, current: true });
  return rows;
}
