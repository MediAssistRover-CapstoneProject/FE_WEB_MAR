import { apiRequest } from '../api/client.js';

const PUBLIC_MEDIA = /^https?:\/\//i;
const STORED_MEDIA = /^(?:s3:\/\/[^/]+\/)?(images|videos)\/[0-9a-f-]{36}\.(?:jpe?g|png|webp|mp4|webm|mov)$/i;

export function listMedia({ mediaType = '', cursor = '', size = 12, signal } = {}) {
  const query = new URLSearchParams({ size: String(size) });
  if (mediaType) query.set('mediaType', mediaType);
  if (cursor) query.set('cursor', cursor);
  return apiRequest(`/api/v1/media?${query}`, { signal });
}

export function mediaKind(value = '') {
  return /\.(?:mp4|webm|mov)(?:$|[?#])/i.test(value) ? 'VIDEO' : 'IMAGE';
}

export function collectMediaReferences(value, output = new Set()) {
  if (typeof value === 'string') {
    const reference = value.trim();
    if (PUBLIC_MEDIA.test(reference) || STORED_MEDIA.test(reference)) output.add(reference);
  } else if (Array.isArray(value)) {
    value.forEach(item => collectMediaReferences(item, output));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(item => collectMediaReferences(item, output));
  }
  return [...output];
}

export async function resolveMediaReference(reference, { signal } = {}) {
  if (PUBLIC_MEDIA.test(reference)) return { url: reference, mediaType: mediaKind(reference), objectKey: reference };
  const objectKey = reference.replace(/^s3:\/\/[^/]+\//i, '');
  if (!STORED_MEDIA.test(objectKey)) throw Error('Tham chiếu media không hợp lệ.');
  return apiRequest(`/api/v1/media/url?objectKey=${encodeURIComponent(objectKey)}`, { signal });
}
