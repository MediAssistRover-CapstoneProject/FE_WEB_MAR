import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../api/client.js';
import { callBackend, watchJob } from '../api/backendApi.js';
import { getSession } from '../auth/session.js';
import { JobFeed } from './jobFeed.js';

const entries = new Map();
const empty = { detail: null, error: '', loading: true, receivedAt: null, liveStatus: '' };
export function useJobFeed(job, auto, revision = 0) {
  const actor = getSession()?.account;
  const key = JSON.stringify([API_BASE_URL, actor?.accountId || actor?.username, job?.jobId]);
  const [state, setState] = useState({ key, ...empty });
  const lease = useRef(null), latest = useRef({ auto, job }); latest.current = { auto, job };
  useEffect(() => {
    if (!job?.jobId) return;
    let entry = entries.get(key);
    if (!entry) {
      entry = { feed: new JobFeed(job.jobId, { read: (id, signal) => callBackend('GET /api/v1/jobs/{id}', { path: { id } }, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) }), watch: watchJob }), users: new Map(), timer: null };
      entries.set(key, entry);
    }
    clearTimeout(entry.timer);
    const id = Symbol(); entry.users.set(id, latest.current.auto);
    const unsubscribe = entry.feed.subscribe(value => setState({ key, ...value }));
    lease.current = { entry, id, key };
    entry.feed.observe(latest.current.job); entry.feed.setAuto([...entry.users.values()].some(Boolean));
    return () => {
      unsubscribe(); entry.users.delete(id);
      if (lease.current?.id === id) lease.current = null;
      if (!entry.users.size) entry.timer = setTimeout(() => { entry.feed.stop(); if (entries.get(key) === entry) entries.delete(key); }, 300);
      else entry.feed.setAuto([...entry.users.values()].some(Boolean));
    };
  }, [key, job?.jobId]);
  useEffect(() => {
    const active = lease.current; if (!active || active.key !== key) return;
    active.entry.users.set(active.id, auto); active.entry.feed.setAuto([...active.entry.users.values()].some(Boolean));
    active.entry.feed.observe(job);
  }, [key, auto, job?.rowVersion, job?.status, job?.selectedJobStepId]);
  const lastRevision = useRef({ key, revision });
  useEffect(() => {
    const previous = lastRevision.current; lastRevision.current = { key, revision };
    if (previous.key === key && previous.revision !== revision) lease.current?.entry.feed.refresh();
  }, [key, revision]);
  const accept = useCallback(next => lease.current?.key === key ? lease.current.entry.feed.accept(next) : undefined, [key]);
  const refresh = useCallback(() => lease.current?.key === key ? lease.current.entry.feed.refresh() : Promise.resolve(), [key]);
  return { ...(state.key === key ? state : empty), accept, refresh };
}
