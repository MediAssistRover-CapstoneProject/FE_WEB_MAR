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
