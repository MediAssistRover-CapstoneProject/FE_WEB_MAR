import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, API_BASE_URL } from '../api/client.js';
import { getSession } from '../auth/session.js';
import { allRows, request } from './api.js';
import { isOperator } from './model.js';
import { loadSavedMap } from './savedMap.js';
import { mapGeometry, insideMap } from '../facility/mapCoordinates.js';
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
  const refresh = useCallback(async (signal) => {
    const id = robotId; if (!id || !isOperator(getSession())) return null;
    const serial = ++sequence.current, started = Date.now();
    try {
      let snapshot = await request(`/api/v1/robots/${encodeURIComponent(id)}/snapshot`, { signal });
      if (snapshot?.robot?.robotId !== id) throw Error('Trạng thái trả về không đúng robot đã chọn.');
      let profile = null, profileContext = '', profileError = '';
      if (openSetupSession(snapshot.navigationSession) && snapshot.navigationSession.state !== 'WAITING_FOR_PI') {
        const context = setupContext(snapshot);
        try {
          profile = await request(`/api/v1/robots/${encodeURIComponent(id)}/navigation-zones`, { signal });
          if (profile.profileAcknowledged) {
            snapshot = await request(`/api/v1/robots/${encodeURIComponent(id)}/snapshot`, { signal });
            if (snapshot?.robot?.robotId !== id) throw Error('Trạng thái trả về không đúng robot đã chọn.');
          }
          if (context === setupContext(snapshot)) profileContext = context; else profile = null;
        } catch (e) { profile = null; profileError = e.message; }
      }
      if (snapshot?.robot?.robotId !== id) throw Error('Trạng thái trả về không đúng robot đã chọn.');
      if (signal?.aborted || !mounted.current || serial !== sequence.current || scope.current.robotId !== id) return null;
      setLive({ snapshot, receivedAt: started, profile, profileContext, error: '', profileError });
      const stored = (() => { try { return JSON.parse(sessionStorage.getItem(pendingKey(id)) || 'null'); } catch { return null; } })();
      if (setupPendingResolved(stored, snapshot)) { storePending(null, id); setError(''); setNotice('Đã đối chiếu yêu cầu trước với trạng thái mới của robot.'); }
      return { snapshot, receivedAt: started };
    } catch (e) {
      if (!signal?.aborted && mounted.current && serial === sequence.current && scope.current.robotId === id) setLive(value => ({ ...value, profile: null, error: e.message }));
      if (signal?.aborted) return null;
      throw e;
    }
  }, [robotId, pendingKey, storePending]);
  useEffect(() => {
    const controller = new AbortController(); let timer;
    setLive({ snapshot: null, receivedAt: 0, profile: null, profileContext: '', error: '' }); setNotice(''); setError('');
    try { setPending(JSON.parse(sessionStorage.getItem(pendingKey(robotId)) || 'null')); } catch { setPending(null); }
    const poll = async () => { if (!writeLock.current) await refresh(controller.signal).catch(() => {}); if (!controller.signal.aborted) timer = setTimeout(poll, 1500); };
    poll();
    return () => { controller.abort(); clearTimeout(timer); sequence.current++; };
  }, [robotId, refresh, pendingKey]);
  useEffect(() => {
    if (!robotId || mapId || !catalog.maps.length) return;
    const snapshot = live.snapshot;
    if (snapshot?.robot?.robotId !== robotId) return;
    const preferred = openSetupSession(snapshot.navigationSession) ? snapshot.navigationSession.mapId : snapshot.robot.currentMapId;
    setMapId(catalog.maps.some(map => map.mapId === preferred) ? preferred : catalog.maps.find(map => map.status === 'ACTIVE')?.mapId || '');
  }, [robotId, mapId, catalog.maps, live.snapshot]);

  const perform = async (kind, { seed, endpointId, confirmed, durationSec = 7200 } = {}) => {
    if (writeLock.current || pending || !isOperator(getSession())) return;
    writeLock.current = true; setBusy(kind); setNotice(''); setError(''); sequence.current++;
    const controller = new AbortController(); mutation.current = controller;
    const id = robotId, selectedMap = mapId, selectedAsset = asset;
    let sent = false, acknowledged = false;
    try {
      const before = await refresh(controller.signal);
      if (!before || scope.current.robotId !== id || scope.current.mapId !== selectedMap) throw Error('Lựa chọn robot hoặc bản đồ đã thay đổi. Kiểm tra lại trạng thái.');
      const block = setupWriteBlock(before.snapshot, before.receivedAt); if (block) throw Error(block);
      const session = before.snapshot.navigationSession;
      let body, suffix = '';
      if (kind === 'close') {
        if (!openSetupSession(session)) throw Error('Không còn phiên đang mở để đóng.');
        body = { sessionId: session.sessionId }; suffix = '/close';
      } else {
        if (selectedAsset?.mapId !== selectedMap || !selectedAsset.loaded) throw Error('Chờ tải xong ảnh và thông tin bản đồ.');
        const metadata = await request(`/api/v1/maps/${encodeURIComponent(selectedMap)}/image-metadata`, { signal: controller.signal });
        if (metadata.map_id !== selectedMap || !sameHash(metadata.asset_hash, selectedAsset.metadata.asset_hash)) throw Error('Bản đồ đã thay đổi. Tải lại ảnh và chọn lại vị trí.');
        if (kind === 'open') {
          if (openSetupSession(session)) throw Error('Robot đã có phiên đang mở. Dùng lại hoặc đóng phiên trước khi đổi bản đồ.');
          if (catalog.maps.find(map => map.mapId === selectedMap)?.status !== 'ACTIVE' || metadata.navigation_reload_safe !== true) throw Error('Chọn bản đồ đang hoạt động và tương thích dẫn đường.');
          if (![7200, 14400, 28800].includes(durationSec)) throw Error('Thời gian phiên không hợp lệ.');
          body = { mapId: selectedMap, durationSec };
        } else {
          if (!openSetupSession(session) || session.mapId !== selectedMap || !sameHash(session.mapAssetHash, metadata.asset_hash)) throw Error('Phiên không còn khớp với bản đồ. Kiểm tra lại trước khi định vị.');
          if (kind === 'seed') {
            if (!confirmed) throw Error('Xác nhận robot đang đứng đúng vị trí và hướng đã chọn.');
            if (endpointId) {
              const point = await request(`/api/v1/endpoints/${encodeURIComponent(endpointId)}`, { signal: controller.signal });
              const latest = setupSeed(point, { mapId: selectedMap, ...selectedAsset.geometry });
              if (point.endpointId !== endpointId || JSON.stringify(latest) !== JSON.stringify(seed)) throw Error('Điểm đã thay đổi. Chọn lại điểm khởi tạo trước khi xác nhận.');
            }
            if (![seed?.xM, seed?.yM, seed?.yawRad].every(Number.isFinite) || Math.abs(seed.yawRad) > Math.PI || !insideMap(selectedAsset.geometry, seed.xM, seed.yM)) throw Error('Vị trí khởi tạo nằm ngoài bản đồ hoặc thiếu hướng hợp lệ.');
          }
          body = { sessionId: session.sessionId, mode: kind === 'seed' ? 'SEED' : 'GLOBAL', ...(kind === 'seed' ? seed : {}) }; suffix = '/initialization';
        }
      }
      const latest = await refresh(controller.signal);
      if (!latest || setupContext(latest.snapshot) !== setupContext(before.snapshot)) throw Error('Phiên hoặc lần khởi tạo đã thay đổi. Kiểm tra lại trước khi gửi.');
      const latestBlock = setupWriteBlock(latest.snapshot, latest.receivedAt); if (latestBlock) throw Error(latestBlock);
      if (kind !== 'open' && !openSetupSession(latest.snapshot.navigationSession)) throw Error('Phiên đã hết hạn hoặc đã đóng.');
      if (controller.signal.aborted || scope.current.robotId !== id || scope.current.mapId !== selectedMap) throw Error('Thiết lập đã thay đổi. Kiểm tra lại trước khi gửi.');
      const intent = { kind, robotId: id, mapId: selectedMap, assetHash: selectedAsset?.metadata.asset_hash, sessionId: session?.sessionId, revision: session?.initialization?.revision || 0 };
      storePending(intent, id); sent = true;
      const result = await apiRequest(`/api/v1/robots/${encodeURIComponent(id)}/navigation-session${suffix}`, { method: 'POST', body, retry: false, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
      if (result?.robotId !== id || !setupPendingResolved(intent, { robot: { robotId: id }, navigationSession: result })) throw Error('Chưa đối chiếu được phản hồi của thao tác.');
      acknowledged = true; storePending(null, id);
      if (!mounted.current) return;
      setLive(value => ({ ...value, snapshot: null, profile: null, receivedAt: 0 }));
      setNotice(kind === 'open' ? 'Đã mở phiên. Khởi động navigation trên Pi bằng lệnh trong phần Kết nối.' : kind === 'close' ? 'Đã đóng phiên vận hành. Dừng tiến trình navigation trên Pi khi kết thúc sử dụng.' : 'Đã gửi yêu cầu định vị. Đang chờ robot xác minh vị trí và cấu hình.');
      await refresh(controller.signal);
    } catch (e) {
      if (sent && !acknowledged && e.status >= 400) storePending(null, id);
      if (mounted.current && !controller.signal.aborted) setError(sent && !acknowledged && !(e.status >= 400) ? 'Chưa xác định kết quả yêu cầu. Trang sẽ đối chiếu trạng thái; không gửi lại thao tác.' : e.message);
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
