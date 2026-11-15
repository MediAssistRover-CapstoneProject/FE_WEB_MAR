import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKnowledgeDocuments, documentUploadBody, documentPending } from '../src/features/api/knowledgeDocuments.js';

test('loads all BE_MAR pages and forwards cancellation', async () => {
  const signal = new AbortController().signal;
  const calls = [];
  const docs = await loadKnowledgeDocuments(signal, async (path, options) => {
    calls.push(path);
    assert.equal(options.signal, signal);
    return { content: [{ id: calls.length }], page: calls.length - 1, size: 100, totalElements: 2 };
  });
  assert.deepEqual(docs.map(d => d.id), [1, 2]);
  assert.deepEqual(calls, ['/api/v1/knowledge/documents?page=0&size=100', '/api/v1/knowledge/documents?page=1&size=100']);
});

test('handles empty pages and rejects the incompatible admin API response', async () => {
  assert.deepEqual(await loadKnowledgeDocuments(undefined, async () => ({ content: [], totalElements: 0 })), []);
  await assert.rejects(loadKnowledgeDocuments(undefined, async () => []), /danh sách/);
});

test('upload sends only the file part and enforces backend file limits', () => {
  const file = new File(['Thông tin bệnh viện'], 'hospital.TXT', { type: 'text/plain' });
  const body = documentUploadBody(file);
  assert.deepEqual([...body.keys()], ['file']);
  assert.equal(body.get('file').name, file.name);
  assert.throws(() => documentUploadBody(null), /Chọn tài liệu/);
  assert.throws(() => documentUploadBody(new File([], 'empty.txt')), /Chọn tài liệu/);
  assert.throws(() => documentUploadBody(new File(['image'], 'image.png')), /Chỉ hỗ trợ/);
  assert.throws(() => documentUploadBody({ name: 'large.pdf', size: 20 * 1024 * 1024 + 1 }), /20 MB/);
});

test('polls all processing states and stops for terminal or reconciliation states', () => {
  for (const status of ['QUEUED', 'ATTACHING', 'PROCESSING']) assert.equal(documentPending({ status }), true);
  for (const status of ['COMPLETED', 'FAILED', 'CANCELLED', 'RECONCILIATION_REQUIRED']) assert.equal(documentPending({ status }), false);
});
