import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { getSession } from '../auth/session.js';

// Server sends periodic snapshots. Refresh only when the alert content changes.
export function useStaffAlertEvents(onAlerts, enabled = true) {
  const callback = useRef(onAlerts); callback.current = onAlerts;
  const [connection, setConnection] = useState('idle');
  const account = getSession()?.account;
  useEffect(() => {
    if (!enabled || account?.role !== 'STAFF') return;
    const controller = new AbortController();
    let timer, last = '', delay = 2000;
    const connect = async () => {
      try {
        setConnection('connecting');
        const response = await apiRequest('/api/v1/staff/notifications/events', {
          signal: controller.signal, responseType: 'response', headers: { Accept: 'text/event-stream' },
        });
        if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) throw Error('SSE unavailable');
        if (controller.signal.aborted) return;
        setConnection('live'); delay = 2000;
        const reader = response.body.getReader(), decoder = new TextDecoder();
        let pending = '';
        try {
          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            pending += decoder.decode(value, { stream: true });
            pending = pending.replace(/\r\n/g, '\n');
            let boundary;
            while ((boundary = pending.indexOf('\n\n')) >= 0) {
              const block = pending.slice(0, boundary); pending = pending.slice(boundary + 2);
              const lines = block.split('\n');
              const type = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
              if (type !== 'alerts') continue;
              const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
              let parsed; try { parsed = JSON.parse(data); } catch { continue; }
              const signature = JSON.stringify(parsed);
              if (signature !== last && !controller.signal.aborted) { last = signature; callback.current(parsed); }
            }
            if (pending.length > 1024 * 1024) throw Error('Notification event too large');
          }
        } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      } catch (error) {
        if (controller.signal.aborted) return;
        if ([401, 403].includes(error.status)) { setConnection('unavailable'); return; }
      }
      if (!controller.signal.aborted) {
        setConnection('reconnecting');
        timer = setTimeout(connect, delay); delay = Math.min(delay * 2, 30000);
      }
    };
    connect();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [enabled, account?.role, account?.accountId]);
  return account?.role === 'STAFF' ? connection : 'idle';
}
