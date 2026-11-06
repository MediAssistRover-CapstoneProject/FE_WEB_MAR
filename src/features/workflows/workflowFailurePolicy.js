export const defaultFailurePolicy = { version: 1, enabled: true, acknowledgeTimeoutSec: 120, resolutionTimeoutSec: 600, notifyAdminImmediately: false };
export function failurePolicy(workflow) {
  const saved = workflow?.inputUiJson?.failureHandling;
  return { ...defaultFailurePolicy, enabled: false, ...saved };
}
export function failurePolicyIssues(workflow) {
  const p = workflow?.inputUiJson?.failureHandling;
  if (p == null) return [];
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['Cấu hình xử lý lỗi phải là đối tượng.'];
  const errors = [];
  if (p.version !== undefined && p.version !== 1) errors.push('Phiên bản cấu hình xử lý lỗi chưa hỗ trợ.');
  for (const key of ['enabled', 'notifyAdminImmediately']) if (p[key] !== undefined && typeof p[key] !== 'boolean') errors.push(`Xử lý lỗi: ${key} phải là đúng/sai.`);
  for (const [key, min, max, label] of [['acknowledgeTimeoutSec', 30, 3600, 'Thời hạn tiếp nhận'], ['resolutionTimeoutSec', 60, 86400, 'Thời hạn xử lý']]) {
    if (p[key] !== undefined && (!Number.isInteger(p[key]) || p[key] < min || p[key] > max)) errors.push(`${label} phải là số giây nguyên trong ${min}–${max}.`);
  }
  return errors;
}
