import { apiRequest } from '../api/client.js';

export const robotVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];

const messages = {
  TTS_DISABLED: 'Máy chủ chưa bật giọng nói robot.',
  TTS_API_KEY_MISSING: 'Máy chủ chưa cấu hình dịch vụ giọng nói.',
  TTS_PROVIDER_AUTH_FAILED: 'Máy chủ chưa xác thực được dịch vụ giọng nói.',
  TTS_PROVIDER_QUOTA: 'Dịch vụ giọng nói đã hết hạn mức hoặc đang quá tải.',
  TTS_MODEL_UNAVAILABLE: 'Mô hình giọng nói chưa khả dụng trên máy chủ.',
  TTS_BUSY: 'Máy chủ đang tạo nhiều đoạn giọng nói. Hãy thử lại sau.',
};

export function speechFailure(error) {
  return messages[error.body?.code] || error.message;
}

export function speechProfileError(profile) {
  if (!robotVoices.includes(profile.voice)) return 'Hãy chọn giọng được hỗ trợ.';
  if (!Number.isFinite(profile.speedMultiplier) || profile.speedMultiplier < 0.25 || profile.speedMultiplier > 4)
    return 'Tốc độ nói phải từ 0.25 đến 4 lần.';
  if (typeof profile.instructions !== 'string' || profile.instructions.length > 1000)
    return 'Hướng dẫn cách đọc tối đa 1000 ký tự.';
  return '';
}

function pause(signal) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 1000);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export const robotSpeechApi = {
  get: signal => apiRequest('/api/v1/admin/speech-settings', { signal }),
  status: signal => apiRequest('/api/v1/pi/speech/status', { signal }),
  save: (profile, signal) => apiRequest('/api/v1/admin/speech-settings', {
    method: 'PUT', signal,
    body: { voice: profile.voice, speedMultiplier: profile.speedMultiplier, instructions: profile.instructions },
  }),
  async preview(text, languageCode, signal) {
    while (true) {
      signal.throwIfAborted();
      const response = await apiRequest('/api/v1/pi/speech/synthesize', {
        method: 'POST', body: { text, languageCode, speedWpm: 150 }, responseType: 'response', signal,
      });
      if (response.status === 200 && response.headers.get('Content-Type')?.split(';')[0].trim() === 'audio/wav')
        return response.blob();
      if (response.status !== 202) throw new Error('Máy chủ chưa trả về âm thanh hợp lệ. Hãy thử lại.');
      await pause(signal);
    }
  },
};
