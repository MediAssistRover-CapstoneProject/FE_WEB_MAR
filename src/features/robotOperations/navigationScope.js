const closedStates = new Set(['NONE', 'CLOSED', 'EXPIRED']);
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function navigationStorageKey(apiBase, account, scope) {
  const base = 'mar-navigation-request-' + encodeURIComponent(apiBase + ':' + (account?.accountId || account?.username || ''));
  return scope ? base + ':' + encodeURIComponent(scope.robotId + ':' + scope.mapId) : base;
}

function pendingValue(value) {
  try {
    const pending = JSON.parse(value || 'null');
    return pending && !pending.done && uuid.test(pending.key) && uuid.test(pending.body?.mapId) && uuid.test(pending.body?.robotId) ? pending : null;
  } catch { return null; }
}

export function migrateNavigationPending(storage, baseKey, scopedKey, scope) {
  try {
    if (pendingValue(storage.getItem(scopedKey))) return;
    const pending = pendingValue(storage.getItem(baseKey));
    if (pending?.body.mapId !== scope.mapId || pending?.body.robotId !== scope.robotId) return;
    storage.setItem(scopedKey, JSON.stringify(pending));
    storage.removeItem(baseKey);
  } catch { /* Retain the legacy receipt when browser storage is unavailable. */ }
}

export function navigationPendingScopes(storage, baseKey) {
  const result = [], seen = new Set();
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key !== baseKey && !key?.startsWith(baseKey + ':')) continue;
      const pending = pendingValue(storage.getItem(key));
      if (!pending || seen.has(pending.key)) continue;
      seen.add(pending.key);
      result.push({ mapId: pending.body.mapId, robotId: pending.body.robotId, key: pending.key });
    }
  } catch { /* Monitoring still works for the current in-memory request. */ }
  return result;
}

// Leaving this view stops monitoring, so require a recent, idle console receipt.
export function navigationScopeBlock(scope, receipt, now = Date.now()) {
  if (!scope) return '';
  if (!receipt || receipt.robotId !== scope.robotId || receipt.mapId !== scope.mapId) return 'Đang kiểm tra phiên điều phối.';
  const age = Number(receipt.snapshotAgeMs) + now - receipt.receivedAt;
  if (receipt.snapshotAgeMs == null || !Number.isFinite(age) || age < 0 || age > 5000) return 'Chưa có trạng thái mới. Kiểm tra lại kết nối trước khi đổi robot hoặc bản đồ.';
  if (receipt.busy) return 'Chờ thao tác hiện tại hoàn tất.';
  if (receipt.requestActive || receipt.activeJobId) return 'Yêu cầu đang được theo dõi. Chờ kết thúc hoặc hủy và đợi BE xác nhận.';
  if (!closedStates.has(receipt.sessionState)) return 'Đóng phiên dẫn đường ở bên dưới trước khi đổi robot hoặc bản đồ.';
  return '';
}
