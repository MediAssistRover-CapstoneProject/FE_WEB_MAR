import { apiRequest } from '../api/client.js';

export const STAFF_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
const extensions = { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'] };

export function staffImageError(file) {
  if (!file || !file.size) return 'Vui lòng chọn ảnh có dữ liệu.';
  if (!extensions[file.type]?.includes(file.name.split('.').at(-1).toLowerCase())) return 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.';
  if (file.size > 20 * 1024 * 1024) return 'Ảnh không được vượt quá 20 MB.';
  return '';
}

export async function uploadStaffImage(file) {
  const invalid = staffImageError(file);
  if (invalid) throw Error(invalid);
  const body = new FormData();
  body.append('file', file);
  const media = await apiRequest('/api/v1/media', { method: 'POST', body });
  if (media?.mediaType !== 'IMAGE' || typeof media.url !== 'string' || !media.url.startsWith('https://')) throw Error('Máy chủ chưa trả về liên kết ảnh hợp lệ. Vui lòng thử lại.');
  return media.url;
}
