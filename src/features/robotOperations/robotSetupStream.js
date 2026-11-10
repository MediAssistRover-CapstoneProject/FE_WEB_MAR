// The same authenticated events as BE's map-navigation.js. Keep the reader
// bounded, and cancel it when the selected robot or page changes.
export async function consumeSetupEvents(response, onEvent) {
  if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) throw Error('Stream trạng thái chưa khả dụng.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      if (pending.length > 1048576) throw Error('Stream trạng thái vượt giới hạn.');
      let separator;
      while ((separator = /\r?\n\r?\n/.exec(pending))) {
        const block = pending.slice(0, separator.index); pending = pending.slice(separator.index + separator[0].length);
        const lines = block.split(/\r?\n/);
        const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
        const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
        if (['robot-state', 'robot-pose'].includes(event) && data) onEvent(JSON.parse(data), event);
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export function newerSetupPose(previous, sample, robotId) {
  return sample?.robotId === robotId && sample.messageType === 'NAVIGATION_POSE'
    && Number.isFinite(sample.sequenceNo)
    && (!previous || sample.transportSessionId !== previous.transportSessionId || sample.sequenceNo > previous.sequenceNo);
}

// Pose packets repaint the map, without putting every coordinate in the form's
// React state. Expiry also notifies subscribers, so retained data never grants
// readiness after the live sample has gone stale.
export function createSetupPoseFeed() {
  const listeners = new Set();
  let sample = null, queued = null, previous = null, frame = null, expiry;
  const notify = () => listeners.forEach(listener => listener());
  const clear = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    clearTimeout(expiry); frame = null; sample = queued = previous = null;
    notify();
  };
  return {
    getSnapshot: () => sample,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    push(value, robotId) {
      if (!newerSetupPose(previous, value, robotId)) return;
      previous = value; queued = { value, receivedAt: Date.now() };
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null; sample = queued; queued = null; clearTimeout(expiry);
        const age = Date.parse(sample.value.receivedAt) - Date.parse(sample.value.capturedAt) + Date.now() - sample.receivedAt;
        expiry = setTimeout(() => { sample = null; notify(); }, Number.isFinite(age) ? Math.max(0, 1501 - age) : 0);
        notify();
      });
    },
    clear,
  };
}
