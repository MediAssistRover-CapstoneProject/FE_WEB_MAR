import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readOpenJobs } from '../src/features/operations/liveOperationsData.js';
const originalFetch = globalThis.fetch;
globalThis.localStorage = { getItem: () => null };
globalThis.sessionStorage = globalThis.localStorage;
afterEach(() => { globalThis.fetch = originalFetch; });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('open-job polls filter on BE, preserve history, discover new work and resolve jobs that leave active lists', async () => {
  const reads = [];
  const previous = [
    { jobId: 'ended', status: 'RUNNING', rowVersion: 1 },
    { jobId: 'live', status: 'RUNNING', rowVersion: 9 },
    { jobId: 'history', status: 'SUCCEEDED', rowVersion: 5 },
  ];
  globalThis.fetch = async url => {
    const parsed = new URL(url); reads.push(parsed);
    if (parsed.pathname.endsWith('/jobs/ended')) return json({ job: { ...previous[0], status: 'SUCCEEDED', rowVersion: 2 } });
    const status = parsed.searchParams.get('status');
    assert.ok(status, 'never traverse the full history during a frequent poll');
    const rows = status === 'RUNNING' ? [{ ...previous[1], rowVersion: 8 }, { jobId: 'new', status: 'RUNNING', rowVersion: 1 }] : [];
    return json({ content: rows, last: true, totalPages: 1 });
  };
  const result = await readOpenJobs(previous);
  assert.equal(result.find(job => job.jobId === 'ended').status, 'SUCCEEDED');
  assert.equal(result.find(job => job.jobId === 'live').rowVersion, 9);
  assert.equal(result.find(job => job.jobId === 'history'), previous[2]);
  assert.ok(result.some(job => job.jobId === 'new'));
  assert.equal(reads.filter(url => url.pathname.endsWith('/jobs/ended')).length, 1);
});

test('partial state-list failure cannot silently replace the last complete snapshot', async () => {
  globalThis.fetch = async url => new URL(url).searchParams.get('status') === 'RUNNING' ? json({ message: 'List failed' }, 503) : json({ content: [], last: true });
  await assert.rejects(readOpenJobs([{ jobId: 'live', status: 'RUNNING' }]), /List failed/);
});
