import { useEffect, useRef, useState } from 'react';
import { callBackend, readCatalog } from '../api/backendApi.js';

export function useMonitoringData(key, query = {}, { auto = false, enabled = true, merge, path = {} } = {}) {
  const signature = JSON.stringify({ query, path }), scope = `${key}:${signature}`;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ value: null, scope: '', receivedAt: null, error: '', loading: false });
  const mergeRef = useRef(merge); mergeRef.current = merge;
  const refresh = () => setRevision(value => value + 1);
  useEffect(() => {
    if (!enabled || !key) return;
    const controller = new AbortController(); let timer, running = false;
    const load = async () => {
      if (running || controller.signal.aborted) return;
      running = true; setState(previous => ({ ...previous, loading: true }));
      try {
        const value = await callBackend(key, JSON.parse(signature), { signal: controller.signal });
        if (!controller.signal.aborted) setState(previous => ({ value: previous.scope === scope && mergeRef.current ? mergeRef.current(previous.value, value) : value, scope, receivedAt: Date.now(), error: '', loading: false }));
      } catch (error) {
        if (!controller.signal.aborted) setState(previous => ({ ...previous, error: error.message || 'Chưa tải được dữ liệu.', loading: false }));
      } finally {
        running = false;
        if (auto && !controller.signal.aborted) timer = setTimeout(() => { if (document.visibilityState === 'visible') load(); else schedule(); }, 15000);
      }
    };
    const schedule = () => { timer = setTimeout(() => { if (document.visibilityState === 'visible') load(); else schedule(); }, 15000); };
    const onFocus = () => { if (auto && document.visibilityState === 'visible') { clearTimeout(timer); load(); } };
    load(); window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus);
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [key, signature, scope, enabled, auto, revision]);
  return { ...state, stale: !!state.error || state.scope !== scope, refresh,
    accept: value => setState(previous => ({ ...previous, value: mergeRef.current ? mergeRef.current(previous.value, value) : value, scope, receivedAt: Date.now(), error: '' })) };
}

export function useMonitoringCatalogs(keys) {
  const signature = keys.join('|');
  const [state, setState] = useState({ values: {}, warning: '' });
  useEffect(() => {
    const controller = new AbortController(), names = signature.split('|').filter(Boolean);
    Promise.allSettled(names.map(name => readCatalog(`GET /api/v1/${name}`, { signal: controller.signal }))).then(results => {
      if (controller.signal.aborted) return;
      setState({ values: Object.fromEntries(names.map((name, index) => [name, results[index].status === 'fulfilled' ? results[index].value : []])), warning: results.some(result => result.status === 'rejected') ? 'Một số tên trong danh mục chưa tải được; mã tham chiếu vẫn được giữ.' : '' });
    });
    return () => controller.abort();
  }, [signature]);
  return state;
}
