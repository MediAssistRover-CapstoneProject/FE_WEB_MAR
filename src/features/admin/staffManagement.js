export const normalizeStaffText = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
export const staffDisplayName = member => member?.account?.fullName || member?.account?.username || member?.staffCode || 'Chưa có tên';
export const sortStaff = members => [...members].sort((a, b) => String(a.staffCode || '').localeCompare(String(b.staffCode || ''), 'vi', { numeric: true }) || String(a.staffProfileId).localeCompare(String(b.staffProfileId)));

export function staffStatus(member) {
  if (member?.active === false || member?.account?.status === 'INACTIVE') return { key: 'INACTIVE', label: 'Ngừng hoạt động', tone: 'muted' };
  if (member?.account?.status === 'LOCKED') return { key: 'LOCKED', label: 'Đã khóa tài khoản', tone: 'amber' };
  if (member?.active === true && member?.account?.status === 'ACTIVE') return { key: 'ACTIVE', label: 'Đang hoạt động', tone: 'green' };
  return { key: 'UNKNOWN', label: 'Chưa xác định', tone: 'muted' };
}

export function staffActions(member, actorId) {
  const account = member?.account;
  const allowed = !!account?.accountId && account.role === 'STAFF' && account.accountId !== actorId && member.active === true;
  return {
    edit: allowed && ['ACTIVE', 'LOCKED'].includes(account.status),
    lock: allowed && account.status === 'ACTIVE',
    unlock: allowed && account.status === 'LOCKED',
    reset: allowed && ['ACTIVE', 'LOCKED'].includes(account.status),
    deactivate: allowed && ['ACTIVE', 'LOCKED'].includes(account.status),
  };
}

export function filterStaff(members, { search = '', status = '', department = '' }) {
  const needle = normalizeStaffText(search);
  return members.filter(member => (!status || staffStatus(member).key === status) && (!department || member.departmentCode === department)
    && (!needle || normalizeStaffText([member.staffCode, member.departmentCode, member.jobTitle, member.account?.fullName, member.account?.username, member.account?.email, member.account?.phone].join(' ')).includes(needle)));
}

export function staffFingerprint(member) {
  const a = member.account || {};
  return JSON.stringify([member.staffProfileId, member.active, member.staffCode, member.departmentCode, member.jobTitle, member.contactExtension, member.url, a.accountId, a.role, a.status, a.username, a.fullName, a.email, a.phone, a.mustChangePassword, a.updatedAt]);
}

export function passwordError(value) {
  if (value.length < 8 || value.length > 72) return 'Mật khẩu phải có từ 8 đến 72 ký tự.';
  if (new TextEncoder().encode(value).length > 72) return 'Mật khẩu vượt giới hạn 72 byte. Hãy dùng mật khẩu ngắn hơn.';
  return '';
}

export function staffError(error) {
  const message = error?.message || 'Không thực hiện được thao tác. Vui lòng thử lại.';
  return ({ 'Username already exists': 'Tên đăng nhập đã được sử dụng.', 'Email already exists': 'Email đã được sử dụng.', 'Phone already exists': 'Số điện thoại đã được sử dụng.', 'Staff code already exists': 'Mã nhân viên đã được sử dụng.', 'url must be a fixed image URL from the configured S3 bucket': 'Vui lòng dùng liên kết ảnh đã tải lên kho ảnh của hệ thống.' })[message] || message;
}
