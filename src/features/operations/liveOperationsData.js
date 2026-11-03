import { callBackend, readCatalog } from '../api/backendApi.js';
import { ACTIVE_STATUSES, newerJob } from './liveOperations.js';

// Poll open work frequently without walking the full historical catalog.
// Re-read work that left the open lists so its terminal result is retained.
export async function readOpenJobs(previous, { signal } = {}) {
  const statuses = [...ACTIVE_STATUSES, 'RECOVERY_REQUIRED'];
  const results = await Promise.allSettled(statuses.map(status => readCatalog('GET /api/v1/jobs', { signal, query: { status } })));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  const incoming = new Map(results.flatMap(result => result.value).map(job => [job.jobId, job]));
  const missing = previous.filter(job => statuses.includes(job.status) && !incoming.has(job.jobId));
  const completed = await Promise.all(missing.map(async job => (await callBackend('GET /api/v1/jobs/{id}', { path: { id: job.jobId } }, { signal })).job));
  const merged = new Map(previous.map(job => [job.jobId, job]));
  for (const job of [...incoming.values(), ...completed]) merged.set(job.jobId, newerJob(merged.get(job.jobId), job));
  return [...merged.values()];
}
