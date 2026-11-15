import { apiRequest } from './client.js';

export const KNOWLEDGE_DOCUMENTS = '/api/v1/knowledge/documents';
export const documentStatuses = {
  QUEUED: 'Chờ xử lý', ATTACHING: 'Đang đưa vào kho AI', PROCESSING: 'Đang xử lý',
  COMPLETED: 'Sẵn sàng', FAILED: 'Xử lý lỗi', CANCELLED: 'Đã hủy',
  RECONCILIATION_REQUIRED: 'Cần kiểm tra xử lý',
};
export const documentPending = doc => ['QUEUED', 'ATTACHING', 'PROCESSING'].includes(doc.status);

export async function loadKnowledgeDocuments(signal, request = apiRequest) {
  const documents = [];
  for (let page = 0; ; page++) {
    const result = await request(`${KNOWLEDGE_DOCUMENTS}?page=${page}&size=100`, { signal });
    if (!Array.isArray(result?.content) || !Number.isInteger(result.totalElements) || result.totalElements < 0) {
      throw new Error('Không đọc được danh sách tài liệu từ máy chủ.');
    }
    documents.push(...result.content);
    if (!result.content.length || documents.length >= result.totalElements) return documents;
  }
}

export function documentUploadBody(file) {
  if (!file || !file.size) throw new Error('Chọn tài liệu có nội dung để tải lên.');
  if (!/\.(pdf|docx|txt|md)$/i.test(file.name)) throw new Error('Chỉ hỗ trợ PDF, DOCX, TXT hoặc MD.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Tệp phải nhỏ hơn hoặc bằng 20 MB.');
  const body = new FormData();
  body.append('file', file);
  return body;
}
