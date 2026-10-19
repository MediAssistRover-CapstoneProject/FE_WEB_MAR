import { apiRequest } from './client.js';
import { buildRequest } from './contract.js';

export async function callBackend(key, input = {}, options = {}) {
  const { url, ...request } = buildRequest(key, input);
  return apiRequest(url, { ...request, ...options, headers: { ...request.headers, ...options.headers } });
}
export async function readCatalog(key, { signal } = {}) {
  const rows = [];
  for (let page = 0; page < 1000; page++) {
    const result = await callBackend(key, { query: { page, size: 100 } }, { signal });
    if (Array.isArray(result)) return result;
    if (!Array.isArray(result?.content)) throw Error('Danh mục không đúng định dạng.');
    rows.push(...result.content);
    if (result.last || page + 1 >= result.totalPages || result.content.length < 100) return rows;
  }
  throw Error('Danh mục quá lớn.');
}
// SSE uses the same bearer header and refresh path as REST. Credentials are
// never appended to the URL. The caller controls cancellation and reconnects.
export async function watchJob(jobId, { signal, onEvent }) {
  const response = await callBackend('GET /api/v1/jobs/{id}/stream', { path: { id: jobId } }, { signal, responseType: 'response', headers: { Accept: 'text/event-stream' } });
  if (!response.headers.get('content-type')?.includes('text/event-stream')) throw Error('Máy chủ chưa hỗ trợ cập nhật trực tiếp.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = '';
  try {
    while (!signal?.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      pending = pending.replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = pending.indexOf('\n\n')) >= 0) {
        const block = pending.slice(0, boundary); pending = pending.slice(boundary + 2);
        const lines = block.split('\n');
        const data = lines.filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
        if (!data) continue;
        const type = lines.find(l => l.startsWith('event:'))?.slice(6).trim() || 'message';
        let parsed; try { parsed = JSON.parse(data); } catch { continue; }
        onEvent({ type, data: parsed });
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
