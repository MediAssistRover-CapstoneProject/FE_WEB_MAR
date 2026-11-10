import test from 'node:test';
import assert from 'node:assert/strict';
import { JobFeed } from '../src/features/operations/jobFeed.js';
const detail = version => ({ job: { jobId: 'job', rowVersion: version, status: 'RUNNING' }, tasks: [{ name: `task-${version}` }], steps: [{ jobStepId: 'step', rowVersion: version, status: version > 1 ? 'SUCCEEDED' : 'RUNNING' }] });

test('shared reads coalesce and retain existing detail while the next read is delayed or fails', async () => {
  let reads = 0, resolve, fail = false;
  const feed = new JobFeed('job', { read: async () => { reads++; if (reads === 1) return detail(1); if (fail) throw Error('offline'); return new Promise(done => { resolve = done; }); } });
  try {
    await feed.refresh(); const before = feed.value.detail;
    const first = feed.refresh(), second = feed.refresh();
    assert.equal(first, second); assert.equal(reads, 2);
    assert.equal(feed.value.detail, before); assert.equal(feed.value.loading, false);
    resolve(detail(2)); await first; assert.equal(feed.value.detail.job.rowVersion, 2);
    fail = true; await feed.refresh(); assert.equal(feed.value.detail.job.rowVersion, 2); assert.equal(feed.value.error, 'offline');
  } finally { feed.stop(); }
});

test('a newer stream observation wins over a delayed REST result, including unversioned task fields', async () => {
  let resolve, publish;
  const feed = new JobFeed('job', { read: () => new Promise(done => { resolve = done; }), watch: async (_, { signal, onEvent }) => {
    publish = onEvent; await new Promise(done => signal.addEventListener('abort', done, { once: true }));
  } });
  try {
    const read = feed.refresh(); feed.setAuto(true);
    publish({ type: 'job-state', data: detail(3) });
    resolve(detail(1)); await read;
    assert.equal(feed.value.detail.job.rowVersion, 3); assert.deepEqual(feed.value.detail.tasks, detail(3).tasks);
    assert.equal(feed.value.error, ''); assert.equal(feed.value.liveStatus, 'Đang theo dõi trực tiếp');
    feed.accept({ ...detail(4), job: { ...detail(4).job, status: 'SUCCEEDED' } });
    assert.equal(feed.stream.signal.aborted, true);
  } finally { feed.stop(); }
});

test('repeated unchanged stream data preserves detail identity, and a late read failure does not mark a newer stream stale', async () => {
  let reject, publish;
  const feed = new JobFeed('job', { read: () => new Promise((_, fail) => { reject = fail; }), watch: async (_, { signal, onEvent }) => {
    publish = onEvent; await new Promise(done => signal.addEventListener('abort', done, { once: true }));
  } });
  try {
    const read = feed.refresh(); feed.setAuto(true); publish({ type: 'job-state', data: detail(1) });
    const before = feed.value.detail; publish({ type: 'job-state', data: detail(1) });
    assert.equal(feed.value.detail, before);
    reject(Error('late offline')); await read; assert.equal(feed.value.error, '');
  } finally { feed.stop(); }
});
