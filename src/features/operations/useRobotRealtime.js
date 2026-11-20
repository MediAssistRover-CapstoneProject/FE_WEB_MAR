import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { request } from '../robotOperations/api.js';
import { consumeSetupEvents, newerSetupPose } from '../robotOperations/robotSetupStream.js';
import { setupContext } from '../robotOperations/robotSetup.js';

const initial = { snapshot: null, error: '', receivedAt: 0, livePose: null, streamAt: 0, serverClockOffsetMs: null };
export function useRobotRealtime(robotId, auto, revision) {
  const [state, setState] = useState({ robotId, ...initial });
  const value = useRef(initial), refresh = useRef(null);
  useEffect(() => {
    const controller = new AbortController(); let streamController, pollTimer, retryTimer, frame, queuedPose, streamStartedAt = 0, inFlight;
    let lastStateAt = 0, lastEventAt = 0, lastReadAt = 0, failures = 0, retryDelay = 1000;
    if (value.current.robotId !== robotId) value.current = { robotId, ...initial };
    setState(value.current);
    if (!robotId) return () => controller.abort();
    const update = patch => {
      if (controller.signal.aborted) return;
      value.current = { ...value.current, ...patch }; setState(value.current);
    };
    const accept = (snapshot, requestStartedAt) => {
      if (snapshot?.robot?.robotId !== robotId) throw Error('Chưa có snapshot hợp lệ của robot.');
      const observedAt = Date.parse(snapshot.observedAt), receivedAt = Date.now();
      if (!Number.isFinite(observedAt)) throw Error('Snapshot chưa có thời gian máy chủ hợp lệ.');
      const previous = value.current.snapshot;
      if (previous && observedAt < Date.parse(previous.observedAt)) return false;
      const same = setupContext(previous) === setupContext(snapshot);
      // observedAt belongs to the server clock. Calibrate it against this REST
      // round trip instead of rejecting fresh data when the laptop clock differs.
      const serverClockOffsetMs = requestStartedAt !== undefined
        ? observedAt - (requestStartedAt + receivedAt) / 2
        : value.current.serverClockOffsetMs ?? observedAt - receivedAt;
      update({ snapshot, receivedAt, serverClockOffsetMs, error: '', ...(!same ? { livePose: null } : {}) }); return true;
    };
    const read = () => {
      if (inFlight) return inFlight;
      const start = Date.now();
      lastReadAt = start;
      inFlight = request(`/api/v1/robots/${encodeURIComponent(robotId)}/snapshot`, { signal: controller.signal })
        .then(snapshot => { if (!controller.signal.aborted && accept(snapshot, start)) failures = 0; })
        .catch(error => { if (!controller.signal.aborted && lastStateAt <= start) { failures++; update({ error: error.message }); } })
        .finally(() => { inFlight = null; });
      return inFlight;
    };
    refresh.current = read;
    const stream = async () => {
      streamController = new AbortController(); streamStartedAt = Date.now();
      const signal = AbortSignal.any([controller.signal, streamController.signal]);
      try {
        const response = await apiRequest(`/api/v1/robots/${encodeURIComponent(robotId)}/stream`, { responseType: 'response', headers: { Accept: 'text/event-stream' }, signal });
        await consumeSetupEvents(response, (sample, event) => {
          if (signal.aborted) return;
          lastEventAt = Date.now();
          if (event === 'robot-state') {
            const observedAt = Date.parse(sample?.observedAt);
            const offset = value.current.serverClockOffsetMs ?? observedAt - Date.now();
            const age = Date.now() + offset - observedAt;
            if (Number.isFinite(age) && age >= -1000 && age <= 5000 && accept(sample)) { lastStateAt = Date.now(); retryDelay = 1000; failures = 0; update({ streamAt: lastStateAt }); }
          } else if (newerSetupPose(queuedPose?.value || value.current.livePose?.value, sample, robotId)) {
            queuedPose = { value: sample, receivedAt: Date.now() };
            // Coalesce bursts to the browser's paint cadence, never queue an
            // animation from estimated/interpolated physical positions.
            if (!frame) frame = requestAnimationFrame(() => { frame = null; update({ livePose: queuedPose }); queuedPose = null; });
          }
        });
      } catch { /* REST fallback is independent of stream availability. */ }
      finally {
        if (!controller.signal.aborted) {
          // Recover state immediately; do not wait for the next polling window.
          if (Date.now() - lastReadAt >= 1000) read();
          retryTimer = setTimeout(stream, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30000);
        }
      }
    };
    const poll = async () => {
      const started = Date.now();
      const retryAfter = Math.min(5000 * 2 ** Math.min(failures, 3), 30000);
      if (!document.hidden && Date.now() - Math.max(lastStateAt, value.current.receivedAt) >= 5000
        && Date.now() - lastReadAt >= retryAfter) {
        // BE's quiet-stream keepalive runs every 20 seconds. Do not tear down
        // a valid SSE connection after only 10 seconds, or while poses arrive.
        if (Date.now() - Math.max(lastEventAt, streamStartedAt) > 30000) streamController?.abort();
        await read();
      }
      if (!controller.signal.aborted && auto) pollTimer = setTimeout(poll, Math.max(500, 2000 - (Date.now() - started)));
    };
    const resume = () => { if (!document.hidden && !controller.signal.aborted) read(); };
    if (auto) {
      window.addEventListener('online', resume);
      window.addEventListener('focus', resume);
      document.addEventListener('visibilitychange', resume);
    }
    const initialRead = read();
    if (auto) {
      initialRead.then(() => { if (!controller.signal.aborted) stream(); });
      pollTimer = setTimeout(poll, 2000);
    }
    return () => {
      controller.abort(); streamController?.abort(); clearTimeout(pollTimer); clearTimeout(retryTimer); cancelAnimationFrame(frame);
      window.removeEventListener('online', resume); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume);
      if (refresh.current === read) refresh.current = null;
    };
  }, [robotId, auto]);
  const lastRevision = useRef(revision);
  useEffect(() => { if (lastRevision.current !== revision) { lastRevision.current = revision; refresh.current?.(); } }, [revision]);
  return state.robotId === robotId ? state : initial;
}
