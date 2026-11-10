import { useEffect, useState } from 'react';
import { readCatalog } from '../api/backendApi.js';
import { nextRoomCode } from './roomDefaults.js';

export function useRoomCodeSuggestion(enabled) {
  const [result, setResult] = useState({ code: '', loading: enabled, error: '' });
  useEffect(() => {
    if (!enabled) { setResult({ code: '', loading: false, error: '' }); return; }
    const controller = new AbortController();
    setResult({ code: '', loading: true, error: '' });
    readCatalog('GET /api/v1/rooms', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }).then(rooms => {
      if (!controller.signal.aborted) setResult({ code: nextRoomCode(rooms), loading: false, error: '' });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ code: '', loading: false, error: 'Chưa tự tạo được mã phòng. Bạn có thể nhập mã thủ công.' });
    });
    return () => controller.abort();
  }, [enabled]);
  return result;
}
