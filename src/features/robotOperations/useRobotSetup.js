import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, API_BASE_URL } from '../api/client.js';
import { getSession } from '../auth/session.js';
import { allRows, request } from './api.js';
import { isOperator } from './model.js';
import { loadSavedMap } from './savedMap.js';
import { mapGeometry, insideMap } from '../facility/mapCoordinates.js';
import { consumeSetupEvents, newerSetupPose } from './robotSetupStream.js';
import { openSetupSession, sameHash, setupContext, setupPendingResolved, setupSeed, setupWriteBlock } from './robotSetup.js';

export function useRobotSetup(initialRobot = '', initialMap = '') {
  const [catalog, setCatalog] = useState({ robots: [], maps: [], endpoints: [] });
  const [loading, setLoading] = useState(true), [catalogError, setCatalogError] = useState('');
  const [robotId, setRobotId] = useState(initialRobot), [mapId, setMapId] = useState(initialMap);
  const [asset, setAsset] = useState(null), [assetError, setAssetError] = useState(''), [assetRevision, setAssetRevision] = useState(0);
  const [live, setLive] = useState({ snapshot: null, receivedAt: 0, profile: null, profileContext: '', error: '' });
  const [busy, setBusy] = useState(''), [notice, setNotice] = useState(''), [error, setError] = useState(''), [pending, setPending] = useState(null);
  const scope = useRef({ robotId, mapId }); scope.current = { robotId, mapId };
  const sequence = useRef(0), writeLock = useRef(false), mutation = useRef(null), mounted = useRef(true);
  const liveRef = useRef(live);
  const account = getSession()?.account;
  const pendingKey = useCallback(id => `mar-robot-setup:${encodeURIComponent(API_BASE_URL)}:${encodeURIComponent(account?.accountId || account?.username || '')}:${id}`, [account?.accountId, account?.username]);
  const storePending = useCallback((value, id) => {
    try { if (value) sessionStorage.setItem(pendingKey(id), JSON.stringify(value)); else sessionStorage.removeItem(pendingKey(id)); } catch { /* In-memory locking still applies. */ }
    if (mounted.current && scope.current.robotId === id) setPending(value);
  }, [pendingKey]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; sequence.current++; mutation.current?.abort(); }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(['/api/v1/robots', '/api/v1/maps', '/api/v1/endpoints'].map(path => allRows(path, controller.signal))).then(([robots, maps, endpoints]) => {
      if (controller.signal.aborted) return;
      setCatalog({ robots, maps, endpoints }); setRobotId(id => id || robots[0]?.robotId || '');
    }).catch(e => { if (!controller.signal.aborted) setCatalogError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    setAsset(null); setAssetError('');
    if (!mapId) return;
    const controller = new AbortController(); let url;
    loadSavedMap(mapId, request, controller.signal).then(({ metadata, blob }) => {
      const geometry = mapGeometry(metadata);
      if (!sameHash(metadata.asset_hash, metadata.asset_hash) || !metadata.frame_id) throw Error('Bản đồ thiếu phiên bản dữ liệu hoặc hệ tọa độ đã xác minh.');
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob); setAsset({ mapId, metadata, geometry, url, loaded: false });
    }).catch(e => { if (!controller.signal.aborted) setAssetError(e.message); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [mapId, assetRevision]);
  const updateLive = useCallback(update => {
    const value = typeof update === 'function' ? update(liveRef.current) : update;
    liveRef.current = value; setLive(value);
  }, []);
  const acceptSnapshot = useCallback((snapshot, receivedAt, id) => {
    if (!mounted.current || scope.current.robotId !== id) return null;
    if (snapshot?.robot?.robotId !== id || !Number.isFinite(Date.parse(snapshot.observedAt))) throw Error('Trạng thái trả về không đúng robot đã chọn hoặc thiếu thời điểm ghi nhận.');
    const previous = liveRef.current;
    if (previous.snapshot?.robot?.robotId === id && Date.parse(snapshot.observedAt) < Date.parse(previous.snapshot.observedAt)) return { snapshot: previous.snapshot, receivedAt: previous.receivedAt };
    const sameContext = setupContext(previous.snapshot) === setupContext(snapshot);
    updateLive({ ...previous, snapshot, receivedAt, error: '', ...(sameContext ? {} : { profile: null, profileContext: '', profileReceivedAt: 0, profileError: '', livePose: null }) });
    const stored = (() => { try { return JSON.parse(sessionStorage.getItem(pendingKey(id)) || 'null'); } catch { return null; } })();
    if (setupPendingResolved(stored, snapshot)) { storePending(null, id); setError(''); setNotice('Đã đối chiếu yêu cầu trước với trạng thái mới của robot.'); }
    return { snapshot, receivedAt };
  }, [pendingKey, storePending, updateLive]);
  // REST remains the explicit preflight for writes. Profile reads never delay it.
  const refresh = useCallback(async signal => {
    const id = robotId; if (!id || !isOperator(getSession())) return null;
    const serial = ++sequence.current;
    try {
      const snapshot = await request('/api/v1/robots/' + encodeURIComponent(id) + '/snapshot', { signal });
      if (signal?.aborted || serial !== sequence.current) return null;
      return acceptSnapshot(snapshot, Date.now(), id);
    } catch (e) {
      if (!signal?.aborted && mounted.current && serial === sequence.current && scope.current.robotId === id) {
        // A failed REST request must not invalidate a newer stream observation.
        if (Date.now() - (liveRef.current.streamAt || 0) > 5000) updateLive(value => ({ ...value, error: e.message }));
      }
      if (signal?.aborted) return null;
      throw e;
    }
  }, [robotId, acceptSnapshot, updateLive]);
  useEffect(() => {
    const controller = new AbortController(); let pollTimer, retryTimer, streamController;
    let lastStateAt = 0, streamStartedAt = 0;
    updateLive({ snapshot: null, receivedAt: 0, profile: null, profileContext: '', error: '', livePose: null, streamAt: 0 }); setNotice(''); setError('');
    try { setPending(JSON.parse(sessionStorage.getItem(pendingKey(robotId)) || 'null')); } catch { setPending(null); }
    if (!robotId || !isOperator(getSession())) return () => controller.abort();
    const stream = async () => {
      streamStartedAt = Date.now();
      streamController = new AbortController();
      const signal = AbortSignal.any([controller.signal, streamController.signal]);
      try {
        const response = await apiRequest('/api/v1/robots/' + encodeURIComponent(robotId) + '/stream', { responseType: 'response', headers: { Accept: 'text/event-stream' }, signal });
        await consumeSetupEvents(response, (value, event) => {
          if (signal.aborted || !mounted.current || scope.current.robotId !== robotId || writeLock.current) return;
          if (event === 'robot-pose') {
            if (newerSetupPose(liveRef.current.livePose?.value, value, robotId)) updateLive(previous => ({ ...previous, livePose: { value, receivedAt: Date.now() } }));
          } else {
            const accepted = acceptSnapshot(value, Date.now(), robotId);
            if (accepted && accepted.snapshot === value && Date.now() - Date.parse(value.observedAt) <= 5000) {
              lastStateAt = Date.now(); updateLive(previous => ({ ...previous, streamAt: lastStateAt }));
            }
          }
        });
      } catch { /* Stream failure is not evidence that MQTT is disconnected. REST stays active. */ }
      finally { if (!controller.signal.aborted) retryTimer = setTimeout(stream, 5000); }
    };
    const poll = async () => {
      const started = Date.now();
      if (!writeLock.current && Date.now() - lastStateAt > 4000) {
        // Restart a silent connection as well as keeping REST fallback alive.
        if (Date.now() - Math.max(lastStateAt, streamStartedAt) > 10000) streamController?.abort();
        await refresh(controller.signal).catch(() => {});
      }
      if (!controller.signal.aborted) pollTimer = setTimeout(poll, Math.max(250, 1500 - (Date.now() - started)));
    };
    stream(); poll();
    return () => { controller.abort(); streamController?.abort(); clearTimeout(pollTimer); clearTimeout(retryTimer); sequence.current++; };
  }, [robotId, refresh, pendingKey, acceptSnapshot, updateLive]);
  const profileScope = setupContext(live.snapshot);
  const profileEligible = live.snapshot?.robot?.robotId === robotId && openSetupSession(live.snapshot?.navigationSession) && live.snapshot.navigationSession.state !== 'WAITING_FOR_PI';
  useEffect(() => {
    if (!robotId || !profileEligible) {
      updateLive(value => ({ ...value, profile: null, profileContext: '', profileReceivedAt: 0, profileError: '' }));
      return;
    }
    const controller = new AbortController(); let timer;
    const checkProfile = async () => {
      const started = Date.now();
      try {
        const profile = await request('/api/v1/robots/' + encodeURIComponent(robotId) + '/navigation-zones', { signal: controller.signal });
        if (!controller.signal.aborted && mounted.current && scope.current.robotId === robotId && setupContext(liveRef.current.snapshot) === profileScope) updateLive(value => ({ ...value, profile, profileContext: profileScope, profileReceivedAt: Date.now(), profileError: '' }));
      } catch (e) {
        if (!controller.signal.aborted && scope.current.robotId === robotId && setupContext(liveRef.current.snapshot) === profileScope) updateLive(value => ({ ...value, profile: null, profileContext: '', profileError: e.message }));
      } finally { if (!controller.signal.aborted) timer = setTimeout(checkProfile, Math.max(250, 5000 - (Date.now() - started))); }
    };
    checkProfile();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [robotId, profileScope, profileEligible, updateLive]);
  useEffect(() => {
    if (!robotId || mapId || !catalog.maps.length) return;
    const snapshot = live.snapshot;
    if (snapshot?.robot?.robotId !== robotId) return;
    const preferred = openSetupSession(snapshot.navigationSession) ? snapshot.navigationSession.mapId : snapshot.robot.currentMapId;
    setMapId(catalog.maps.some(map => map.mapId === preferred) ? preferred : catalog.maps.find(map => map.status === 'ACTIVE')?.mapId || '');
  }, [robotId, mapId, catalog.maps, live.snapshot]);

  const perform = async (kind, { seed, endpointId, confirmed, durationSec = 7200, expectedSessionId } = {}) => {
    if (writeLock.current || pending || !isOperator(getSession())) return;
    writeLock.current = true; setBusy(kind); setNotice(''); setError(''); sequence.current++;
    const controller = new AbortController(); mutation.current = controller;
    const id = robotId, selectedMap = mapId, selectedAsset = asset;
    let sent = false, acknowledged = false, previousSessionId, restartClosed = false, operation = kind;
    try {
      // Keep one write lock across close -> create. A successful close ends the
      // old lease immediately; expiresAt does not delay the next session.
      for (const next of kind === 'restart' ? ['close', 'open'] : [kind]) {
        operation = next; sent = false; acknowledged = false; setBusy(operation);
        const before = await refresh(controller.signal);
        if (!before || scope.current.robotId !== id || scope.current.mapId !== selectedMap) throw Error('Lựa chọn robot hoặc bản đồ đã thay đổi. Kiểm tra lại trạng thái.');
        const block = setupWriteBlock(before.snapshot, before.receivedAt); if (block) throw Error(block);
        const session = before.snapshot.navigationSession;
        let body, suffix = '';
        if (operation === 'close') {
          if (!openSetupSession(session)) throw Error('Không còn phiên đang mở để đóng.');
          if (expectedSessionId && session.sessionId !== expectedSessionId) throw Error('Phiên đã thay đổi. Kiểm tra lại trước khi dừng phiên.');
          if (kind === 'restart') {
            if (selectedAsset?.mapId !== selectedMap || !selectedAsset.loaded || session.mapId !== selectedMap) throw Error('Chọn và tải xong bản đồ của phiên trước khi tạo lại phiên.');
            const metadata = await request(`/api/v1/maps/${encodeURIComponent(selectedMap)}/image-metadata`, { signal: controller.signal });
            if (metadata.map_id !== selectedMap || !sameHash(metadata.asset_hash, selectedAsset.metadata.asset_hash) || !sameHash(session.mapAssetHash, metadata.asset_hash)) throw Error('Bản đồ đã thay đổi. Tải lại bản đồ trước khi tạo lại phiên.');
            if (catalog.maps.find(map => map.mapId === selectedMap)?.status !== 'ACTIVE' || metadata.navigation_reload_safe !== true || ![7200, 14400, 28800].includes(durationSec)) throw Error('Chọn bản đồ đang hoạt động, tương thích dẫn đường và thời gian phiên hợp lệ.');
            previousSessionId = session.sessionId;
          }
          body = { sessionId: session.sessionId }; suffix = '/close';
        } else {
          if (selectedAsset?.mapId !== selectedMap || !selectedAsset.loaded) throw Error('Chờ tải xong ảnh và thông tin bản đồ.');
          const metadata = await request(`/api/v1/maps/${encodeURIComponent(selectedMap)}/image-metadata`, { signal: controller.signal });
          if (metadata.map_id !== selectedMap || !sameHash(metadata.asset_hash, selectedAsset.metadata.asset_hash)) throw Error('Bản đồ đã thay đổi. Tải lại ảnh và chọn lại vị trí.');
          if (operation === 'open') {
            if (openSetupSession(session)) throw Error('Robot đã có phiên đang mở. Dùng lại hoặc đóng phiên trước khi đổi bản đồ.');
            if (kind === 'restart' && (session?.sessionId !== previousSessionId || !['CLOSED', 'EXPIRED'].includes(session.state))) throw Error('Chưa xác minh phiên cũ đã đóng hoặc phiên đã thay đổi. Kiểm tra lại trạng thái.');
            if (catalog.maps.find(map => map.mapId === selectedMap)?.status !== 'ACTIVE' || metadata.navigation_reload_safe !== true) throw Error('Chọn bản đồ đang hoạt động và tương thích dẫn đường.');
            if (![7200, 14400, 28800].includes(durationSec)) throw Error('Thời gian phiên không hợp lệ.');
            body = { mapId: selectedMap, durationSec };
          } else {
            if (!openSetupSession(session) || session.mapId !== selectedMap || !sameHash(session.mapAssetHash, metadata.asset_hash)) throw Error('Phiên không còn khớp với bản đồ. Kiểm tra lại trước khi định vị.');
            if (operation === 'seed') {
              if (!confirmed) throw Error('Xác nhận robot đang đứng đúng vị trí và hướng đã chọn.');
              if (endpointId) {
                const point = await request(`/api/v1/endpoints/${encodeURIComponent(endpointId)}`, { signal: controller.signal });
                const latest = setupSeed(point, { mapId: selectedMap, ...selectedAsset.geometry });
                if (point.endpointId !== endpointId || JSON.stringify(latest) !== JSON.stringify(seed)) throw Error('Điểm đã thay đổi. Chọn lại điểm khởi tạo trước khi xác nhận.');
              }
              if (![seed?.xM, seed?.yM, seed?.yawRad].every(Number.isFinite) || Math.abs(seed.yawRad) > Math.PI || !insideMap(selectedAsset.geometry, seed.xM, seed.yM)) throw Error('Vị trí khởi tạo nằm ngoài bản đồ hoặc thiếu hướng hợp lệ.');
            }
            body = { sessionId: session.sessionId, mode: operation === 'seed' ? 'SEED' : 'GLOBAL', ...(operation === 'seed' ? seed : {}) }; suffix = '/initialization';
          }
        }
        const latest = await refresh(controller.signal);
        if (!latest || setupContext(latest.snapshot) !== setupContext(before.snapshot)) throw Error('Phiên hoặc lần khởi tạo đã thay đổi. Kiểm tra lại trước khi gửi.');
        const latestBlock = setupWriteBlock(latest.snapshot, latest.receivedAt); if (latestBlock) throw Error(latestBlock);
        if (operation !== 'open' && !openSetupSession(latest.snapshot.navigationSession)) throw Error('Phiên đã hết hạn hoặc đã đóng.');
        if (controller.signal.aborted || scope.current.robotId !== id || scope.current.mapId !== selectedMap) throw Error('Thiết lập đã thay đổi. Kiểm tra lại trước khi gửi.');
        const intent = { kind: operation, robotId: id, mapId: selectedMap, assetHash: selectedAsset?.metadata.asset_hash, sessionId: session?.sessionId, previousSessionId, revision: session?.initialization?.revision || 0 };
        storePending(intent, id); sent = true;
        const result = await apiRequest(`/api/v1/robots/${encodeURIComponent(id)}/navigation-session${suffix}`, { method: 'POST', body, retry: false, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        if (result?.robotId !== id || !setupPendingResolved(intent, { robot: { robotId: id }, navigationSession: result })) throw Error('Chưa đối chiếu được phản hồi của thao tác.');
        acknowledged = true; storePending(null, id);
        if (kind === 'restart' && operation === 'close') restartClosed = true;
        if (!mounted.current) return;
        updateLive(value => ({ ...value, snapshot: null, profile: null, profileContext: '', profileReceivedAt: 0, livePose: null, receivedAt: 0 }));
        setNotice(operation === 'open' ? kind === 'restart' ? 'Đã đóng phiên cũ và mở phiên mới. Sao chép lệnh chạy Pi với mã phiên mới trong phần Kết nối, sau đó xác nhận lại vị trí.' : 'Đã mở phiên. Khởi động navigation trên Pi bằng lệnh trong phần Kết nối.' : operation === 'close' ? kind === 'restart' ? 'Đã đóng phiên cũ. Đang tạo phiên mới…' : 'Đã đóng phiên vận hành. Dừng tiến trình navigation trên Pi khi kết thúc sử dụng.' : 'Đã gửi yêu cầu định vị. Đang chờ robot xác minh vị trí và cấu hình.');
        await refresh(controller.signal);
      }
    } catch (e) {
      const rejected = e.status >= 400 && e.status < 500 && e.status !== 408;
      if (sent && !acknowledged && rejected) storePending(null, id);
      if (restartClosed && mounted.current && !controller.signal.aborted) setNotice(sent && !acknowledged && !rejected ? 'Phiên cũ đã đóng. Đang đối chiếu kết quả tạo phiên mới.' : 'Phiên cũ đã đóng. Có thể thử mở phiên mới ngay sau khi kiểm tra trạng thái.');
      if (mounted.current && !controller.signal.aborted) setError(sent && !acknowledged && !rejected ? 'Chưa xác định kết quả yêu cầu. Trang sẽ đối chiếu trạng thái; không gửi lại thao tác.' : restartClosed ? `Đã đóng phiên cũ nhưng chưa tạo được phiên mới. ${e.message} Bạn có thể mở phiên lại ngay khi kiểm tra xong trạng thái.` : e.message);
    } finally {
      writeLock.current = false; mutation.current = null;
      if (mounted.current) setBusy('');
    }
  };
  const chooseRobot = id => { if (writeLock.current) return; sequence.current++; setRobotId(id); setMapId(''); setError(''); };
  const chooseMap = id => { if (!writeLock.current) { setMapId(id); setError(''); } };
  const reloadAsset = () => { if (!writeLock.current) setAssetRevision(value => value + 1); };
  const markImageLoaded = () => setAsset(value => value ? { ...value, loaded: true } : value);
  return { catalog, loading, catalogError, robotId, mapId, chooseRobot, chooseMap, asset, assetError, markImageLoaded, reloadAsset, live, busy, notice, error, pending, perform, refresh };
}
