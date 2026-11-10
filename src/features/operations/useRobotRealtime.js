import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { request } from '../robotOperations/api.js';
import { consumeSetupEvents, newerSetupPose } from '../robotOperations/robotSetupStream.js';
import { setupContext } from '../robotOperations/robotSetup.js';

const initial = { snapshot: null, error: '', receivedAt: 0, livePose: null, streamAt: 0 };
export function useRobotRealtime(robotId, auto, revision) {
  const [state, setState] = useState({ robotId, ...initial });
  const value = useRef(initial), refresh = useRef(null);
  useEffect(() => {
    const controller = new AbortController(); let streamController, pollTimer, retryTimer, frame, queuedPose, streamStartedAt = 0, inFlight;
    let lastStateAt = 0;
    if (value.current.robotId !== robotId) value.current = { robotId, ...initial };
    setState(value.current);
    if (!robotId) return () => controller.abort();
    const update = patch => {
      if (controller.signal.aborted) return;
      value.current = { ...value.current, ...patch }; setState(value.current);
    };
    const accept = snapshot => {
      if (snapshot?.robot?.robotId !== robotId) throw Error('Chưa có snapshot hợp lệ của robot.');
      const previous = value.current.snapshot;
      if (previous && Date.parse(snapshot.observedAt) < Date.parse(previous.observedAt)) return false;
      const same = setupContext(previous) === setupContext(snapshot);
      update({ snapshot, receivedAt: Date.now(), error: '', ...(!same ? { livePose: null } : {}) }); return true;
    };
    const read = () => {
      if (inFlight) return inFlight;
      const start = Date.now();
      inFlight = request(`/api/v1/robots/${encodeURIComponent(robotId)}/snapshot`, { signal: controller.signal })
        .then(snapshot => { if (!controller.signal.aborted) accept(snapshot); })
        .catch(error => { if (!controller.signal.aborted && lastStateAt <= start) update({ error: error.message }); })
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
          if (event === 'robot-state') {
            const age = Date.now() - Date.parse(sample?.observedAt);
            if (Number.isFinite(age) && age >= -1000 && age <= 5000 && accept(sample)) { lastStateAt = Date.now(); update({ streamAt: lastStateAt }); }
          } else if (newerSetupPose(queuedPose?.value || value.current.livePose?.value, sample, robotId)) {
            queuedPose = { value: sample, receivedAt: Date.now() };
            // Coalesce bursts to the browser's paint cadence, never queue an
            // animation from estimated/interpolated physical positions.
            if (!frame) frame = requestAnimationFrame(() => { frame = null; update({ livePose: queuedPose }); queuedPose = null; });
          }
        });
      } catch { /* REST fallback is independent of stream availability. */ }
      finally { if (!controller.signal.aborted) retryTimer = setTimeout(stream, 5000); }
    };
    const poll = async () => {
      const started = Date.now();
      if (Date.now() - lastStateAt > 4000) {
        if (Date.now() - Math.max(lastStateAt, streamStartedAt) > 10000) streamController?.abort();
        await read();
      }
      if (!controller.signal.aborted && auto) pollTimer = setTimeout(poll, Math.max(500, 2000 - (Date.now() - started)));
    };
    read(); if (auto) { stream(); pollTimer = setTimeout(poll, 2000); }
    return () => { controller.abort(); streamController?.abort(); clearTimeout(pollTimer); clearTimeout(retryTimer); cancelAnimationFrame(frame); if (refresh.current === read) refresh.current = null; };
  }, [robotId, auto]);
  const lastRevision = useRef(revision);
  useEffect(() => { if (lastRevision.current !== revision) { lastRevision.current = revision; refresh.current?.(); } }, [revision]);
  return state.robotId === robotId ? state : initial;
}
