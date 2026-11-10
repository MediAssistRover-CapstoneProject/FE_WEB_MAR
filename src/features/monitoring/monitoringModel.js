export const REPORT_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const alertStates = { OPEN: 'Đang mở', ACKNOWLEDGED: 'Đã tiếp nhận', RESOLVED: 'Đã xử lý', CLOSED: 'Đã đóng' };
export const severityLabels = { INFO: 'Thông tin', WARNING: 'Cần chú ý', CRITICAL: 'Khẩn cấp' };
export const notificationLabels = { DELIVERY_ARRIVED: 'Robot đã đến điểm giao', WORKFLOW_FAILURE: 'Công việc cần xử lý lỗi', SOS: 'Yêu cầu SOS', SOS_UNASSIGNED: 'SOS chưa có người phụ trách', LOW_BATTERY: 'Pin robot thấp', ROBOT_OFFLINE: 'Robot mất kết nối' };
export const detectionLabels = { SUSPECTED_FALL: 'Nghi ngờ té ngã', RESTRICTED_INTRUSION: 'Đi vào vùng hạn chế', SOS_SIGNAL: 'Tín hiệu SOS', OTHER: 'Sự kiện khác' };
export const isUuid = value => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value || '');

export function localDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function presetRange(days = 7, now = new Date()) {
  const to = localDay(now), start = new Date(`${to}T00:00:00+07:00`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { from: localDay(start), to };
}
export function dateQuery(value, { required = false, report = false } = {}) {
  if (required && (!value.from || !value.to)) throw Error('Vui lòng chọn đủ ngày bắt đầu và kết thúc.');
  const valid = day => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T12:00:00+07:00`)) && localDay(new Date(`${day}T12:00:00+07:00`)) === day;
  if ((value.from && !valid(value.from)) || (value.to && !valid(value.to))) throw Error('Ngày đã chọn chưa hợp lệ.');
  if (value.from && value.to && value.from > value.to) throw Error('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
  const from = value.from ? new Date(`${value.from}T00:00:00+07:00`).toISOString() : undefined;
  // Report endpoints use [from, to), while monitoring searches include to.
  const end = value.to ? Date.parse(`${value.to}T23:59:59.999+07:00`) : null;
  const to = end != null ? new Date(end + (report ? 1 : 0)).toISOString() : undefined;
  if (report && from && to) {
    const hours = (Date.parse(to) - Date.parse(from)) / 3600000;
    if (hours > 366 * 24) throw Error('Chọn khoảng thời gian tối đa 366 ngày.');
    if (value.interval === 'HOUR' && hours > 744) throw Error('Thống kê theo giờ chỉ hỗ trợ tối đa 31 ngày.');
  }
  return Object.fromEntries(Object.entries({ ...value, from, to }).filter(([, item]) => item !== '' && item != null));
}
export function newerAlert(previous, incoming) {
  if (previous?.alertId !== incoming?.alertId) return incoming;
  return Number(previous?.rowVersion) > Number(incoming?.rowVersion) ? previous : incoming;
}
export function availableAlertActions(alert, session, incident = null, now = Date.now()) {
  const account = session?.account;
  if (!alert || session?.mode === 'demo' || !session?.tokens?.accessToken || !account?.accountId || !['ADMIN', 'STAFF'].includes(account.role) || alert.notificationType === 'WORKFLOW_FAILURE') return [];
  const actions = [], mine = alert.recipients?.find(item => item.accountId === account.accountId);
  const unassignedSos = account.role === 'ADMIN' && incident?.incidentId === alert.incidentId && !!incident?.sosRoutingStatus && !incident.sosResponderAccountId;
  if (['OPEN', 'ACKNOWLEDGED'].includes(alert.status) && alert.requireAck === true && !mine?.acknowledgedAt
    && (unassignedSos || (!alert.expiresAt || Date.parse(alert.expiresAt) > now) && (mine || account.role === 'STAFF'))) actions.push('acknowledge');
  const incidentKnown = !alert.incidentId || incident?.incidentId === alert.incidentId;
  if (alert.status === 'ACKNOWLEDGED' && incidentKnown && (!alert.incidentId || ['RESOLVED', 'CLOSED', 'FALSE_ALARM'].includes(incident.status))) actions.push('resolve');
  if (alert.status === 'RESOLVED' && incidentKnown && (!alert.incidentId || ['CLOSED', 'FALSE_ALARM'].includes(incident.status))) actions.push('close');
  return actions;
}
export function alertSignature(alert) {
  return JSON.stringify([alert?.alertId, alert?.rowVersion, alert?.status, alert?.requireAck, alert?.expiresAt, alert?.ackPolicy, alert?.notificationType, alert?.incidentId, alert?.recipients]);
}
export function auditActors(previous, rows, account) {
  const choices = new Map(previous.map(item => [item.accountId, item]));
  if (account?.accountId) choices.set(account.accountId, { accountId: account.accountId, actorUsername: account.username || account.fullName || 'Tài khoản hiện tại' });
  for (const row of rows || []) if (row.accountId) choices.set(row.accountId, { accountId: row.accountId, actorUsername: row.actorUsername || row.accountId });
  return [...choices.values()].sort((a, b) => a.actorUsername.localeCompare(b.actorUsername, 'vi'));
}
export function evidenceUrl(value, apiBase) {
  if (typeof value !== 'string' || !value.trim() || !/^(https?:\/\/|\/[^/])/.test(value)) return null;
  try { const url = new URL(value, apiBase || window.location.origin); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function breakdownTarget(row, catalog, kind) {
  if (isUuid(row.key)) return row.key;
  const version = kind === 'workflow' ? row.label?.match(/ v(\d+)$/)?.[1] : null;
  const matches = (catalog || []).filter(item => item[`${kind}Code`] === row.key && (!version || String(item.versionNo) === version));
  return matches.length === 1 && isUuid(matches[0][`${kind}Id`]) ? matches[0][`${kind}Id`] : null;
}
