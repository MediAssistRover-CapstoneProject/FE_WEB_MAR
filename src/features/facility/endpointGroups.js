export const API_SELECTION_POLICIES = { PRIORITY: 'Theo thứ tự ưu tiên', NEAREST_REACHABLE: 'Gần robot trước' };
export const SELECTION_POLICIES = { ...API_SELECTION_POLICIES, FURTHEST: 'Xa robot trước', BALANCED: 'Cân bằng lượt phục vụ' };
export const POLICY_HELP = {
  PRIORITY:'Ưu tiên thành viên có số thứ tự nhỏ hơn; bỏ qua điểm tắt, không tiếp cận được hoặc đang bận.',
  NEAREST_REACHABLE:'Xếp theo khoảng cách thẳng gần nhất, rồi kiểm tra đường đi. Không dùng chiều dài tuyến để thay thế khoảng cách thẳng.',
  FURTHEST:'Xếp theo khoảng cách thẳng xa nhất, rồi kiểm tra đường đi. Áp dụng trong mô phỏng trình duyệt.',
  BALANCED:'Chọn điểm có ít lượt phục vụ hoàn tất nhất trong phiên này; hòa thì theo thứ tự thành viên. Kiểm tra tuyến không làm tăng lượt. Tải lại trang sẽ bắt đầu phiên mới.',
};

// Keep old browser drafts usable; never discard a user's endpoint configuration.
export function groupsFor(map) {
  if (Array.isArray(map.endpointGroups)) return map.endpointGroups;
  return [...new Set(map.endpoints.map(e => e.group?.trim()).filter(Boolean))].map((name, i) => ({
    id: name, code: `LEGACY_${i + 1}`, name, active: true, selectionPolicy: 'NEAREST_REACHABLE', allowFallback: true,
    description: 'Chuyển từ nhóm cũ trong bản nháp.',
    members: map.endpoints.filter(e => e.group?.trim() === name).map((e, n) => ({ endpointId: e.id, sequenceNo: n + 1, active: true })),
  }));
}
export function groupError(group, groups, endpoints) {
  if (!group.code?.trim() || group.code.length > 64) return 'Mã nhóm bắt buộc, tối đa 64 ký tự.';
  if (!group.name?.trim() || group.name.length > 160) return 'Tên nhóm bắt buộc, tối đa 160 ký tự.';
  if (groups.some(g => g.id !== group.id && g.code.toLowerCase() === group.code.trim().toLowerCase())) return 'Mã nhóm đã tồn tại trên bản đồ.';
  if (!SELECTION_POLICIES[group.selectionPolicy]) return 'Chọn chính sách chọn điểm hợp lệ.';
  if (!Array.isArray(group.members)) return 'Danh sách thành viên không hợp lệ.';
  const ids = new Set(), sequences = new Set();
  for (const member of group.members) {
    if (!endpoints.some(e => e.id === member.endpointId)) return 'Thành viên phải là điểm đích trên cùng bản đồ.';
    if (ids.has(member.endpointId)) return 'Một điểm không được lặp trong cùng nhóm.';
    if (!Number.isInteger(member.sequenceNo) || member.sequenceNo < 1 || sequences.has(member.sequenceNo)) return 'Thứ tự thành viên phải là số nguyên dương, không trùng nhau.';
    ids.add(member.endpointId); sequences.add(member.sequenceNo);
  }
  return '';
}
export function groupCandidates(map, group, current, visits = {}) {
  if (!group || group.active === false) return [];
  const result = group.members.filter(m => m.active !== false).sort((a,b) => a.sequenceNo - b.sequenceNo)
    .map(m => map.endpoints.find(e => e.id === m.endpointId))
    .filter(e => e && e.enabled !== false && e.accessible !== false && e.occupancy !== 'BUSY');
  // BE initially orders NEAREST_REACHABLE by straight-line distance; the navigation
  // runtime confirms reachability. Do not substitute route length for that contract.
  if (group.selectionPolicy === 'NEAREST_REACHABLE') result.sort((a,b) => Math.hypot(a.x-current.x,a.y-current.y)-Math.hypot(b.x-current.x,b.y-current.y));
  if (group.selectionPolicy === 'FURTHEST') result.sort((a,b) => Math.hypot(b.x-current.x,b.y-current.y)-Math.hypot(a.x-current.x,a.y-current.y));
  if (group.selectionPolicy === 'BALANCED') result.sort((a,b) => (visits[a.id]||0)-(visits[b.id]||0));
  return result;
}
