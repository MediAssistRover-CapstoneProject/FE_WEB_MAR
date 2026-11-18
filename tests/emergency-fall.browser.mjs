import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5199';
const output = '.workstation-build/emergency-fall'; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const sdk = `
export const RoomEvent=Object.fromEntries(['TrackSubscribed','TrackUnsubscribed','TrackMuted','TrackUnmuted','Reconnecting','Reconnected','Disconnected'].map(x=>[x,x]));
export const Track={Kind:{Video:'video',Audio:'audio'},Source:{Camera:'camera'}};
export const DisconnectReason={DUPLICATE_IDENTITY:2};
export class Room {
 constructor(){this.events=new Map();window.fakeRooms.push(this);this.localParticipant={setMicrophoneEnabled:async value=>{window.microphoneChanges.push(value);}};}
 on(event,handler){this.events.set(event,handler);return this;}
 emit(event,...args){this.events.get(event)?.(...args);}
 removeAllListeners(){this.events.clear();}
 async connect(url,token){
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const c=canvas.getContext('2d');let frame=0;
  this.draw=()=>{c.fillStyle='#18334c';c.fillRect(0,0,640,360);c.fillStyle='#d4e3ee';c.font='23px Arial';c.fillText('CAMERA KIEM THU - KHONG PHAI ROBOT THAT',25,160);c.font='15px Arial';c.fillText('Video frame '+(++frame),25,195);};
  this.draw();this.animation=setInterval(this.draw,70);this.stream=canvas.captureStream(15);
  this.track={kind:'video',sid:'video',isMuted:false,attach:element=>{element.srcObject=this.stream;},detach:element=>{element.srcObject=null;}};
  this.emit('TrackSubscribed',this.track,{source:'camera'},{identity:'robot-'+token.slice('fixture-'.length)});
 }
 async disconnect(){clearInterval(this.animation);this.stream?.getTracks().forEach(t=>t.stop());}
}`;

async function fixture(role = 'ADMIN', actorId = id(50)) {
  const account = { accountId: actorId, role, fullName: role === 'ADMIN' ? 'Quản trị viên kiểm thử' : 'Nhân viên trực kiểm thử' };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(account => {
    localStorage.setItem('mediassist-rover.session', JSON.stringify({ account, tokens: { accessToken: 'fixture-only' } }));
    window.fakeRooms = []; window.microphoneChanges = []; window.captureRequests = 0;
    navigator.mediaDevices.getUserMedia = async () => { window.captureRequests++; throw Error('Unexpected local capture'); };
  }, account);
  const page = await context.newPage(); page.setDefaultTimeout(9000);
  const errors = [], reads = [], writes = [];
  page.on('pageerror', e => errors.push(e.message));
  const makeIncident = n => ({ incidentId: id(n), robotId: id(20), mapId: id(21), endpointId: null, incidentType: 'AI_SUSPECTED_FALL', status: 'OPEN', severity: 'WARNING',
    description: `Robot ghi nhận dấu hiệu nghi té ngã ${n}. Cần xác minh.`, xM: 0, yM: 0, occurredAt: new Date().toISOString(),
    sosResponderAccountId: id(50), sosRoutingStatus: 'ASSIGNED', acknowledgedByAccountId: null, acknowledgedAt: null, resolvedAt: null, closedAt: null, rowVersion: 1 });
  const state = { enabled: true, failLocation: false, sessions: [], rows: [
    { ...makeIncident(1), incidentType: 'SOS', description: 'Người dùng bấm nút SOS tại sảnh.', severity: 'CRITICAL', endpointId: id(22) },
    makeIncident(2), makeIncident(3), { ...makeIncident(4), xM: null, yM: null },
  ] };
  const source = { mapId: id(21), assetHash: 'a'.repeat(64), widthM: 10, heightM: 6, widthPx: 200, heightPx: 120, resolutionMPerPixel: .05, originXM: -5, originYM: -3, originYawRad: 0, frameId: 'map' };
  const metadata = { map_id: id(21), asset_hash: source.assetHash, width_m: 10, height_m: 6, width_px: 200, height_px: 120, resolution_m_per_pixel: .05, origin_x_m: -5, origin_y_m: -3, origin_yaw_rad: 0, frame_id: 'map', pixel_center_to_map: [[.05, 0, -4.975], [0, -.05, 2.975], [0, 0, 1]] };
  const area = (label, x, y, w, h, color) => ({ id: label, type: 'ROOM', label, color, points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], fontSizeM: .23, lineWidthM: .03 });
  const presentation = { source, document: { schemaVersion: 1, rotationDegrees: 0, backgroundColor: '#fff', features: [area('Phòng khám', 1, 1, 3, 1.5, '#91b0d7'), area('Phòng trực', 1, 4, 2, 1.5, '#85b6af'), area('Sảnh', 5, 2.5, 3, 2, '#b5c7da')] } };
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64');
  const paged = (rows, url) => { const page = Number(url.searchParams.get('page') || 0), size = Number(url.searchParams.get('size') || 10); return { content: rows.slice(page * size, (page + 1) * size), totalElements: rows.length, totalPages: Math.ceil(rows.length / size), last: (page + 1) * size >= rows.length }; };
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (path.includes('/node_modules/.vite/deps/livekit-client.js')) return route.fulfill({ contentType: 'application/javascript', body: sdk });
    if (!path.startsWith('/api/v1/')) return url.origin === base ? route.continue() : route.abort();
    const json = (value, status = 200) => route.fulfill({ status, json: value });
    assert.equal(request.headers().authorization, 'Bearer fixture-only');
    const post = request.method() === 'POST', body = request.postData() ? request.postDataJSON() : null;
    (post ? writes : reads).push(post ? { path, body } : path + url.search);
    if (path === '/api/v1/auth/me') return json(account);
    if (path === '/api/v1/media/configuration') return json({ enabled: state.enabled });
    if (path === '/api/v1/media-sessions') {
      if (!post) return json(state.sessions.filter(s => s.state !== 'ENDED'));
      assert.deepEqual(Object.keys(body).sort(), ['incidentId', 'mode', 'robotId']);
      const row = state.rows.find(r => r.incidentId === body.incidentId);
      assert.equal(body.mode, row.incidentType === 'SOS' ? 'ASSIST' : 'MONITOR');
      const session = { sessionId: id(100 + Number(row.incidentId.slice(0, 8))), incidentId: row.incidentId, robotId: row.robotId, mode: body.mode, state: 'CONNECTING', staffAccountId: actorId, expiresAt: new Date(Date.now() + 60000).toISOString(), deviceSeenAt: new Date().toISOString() };
      state.sessions.push(session); return json(session);
    }
    if (path.startsWith('/api/v1/media-sessions/')) {
      const session = state.sessions.find(s => path.includes(s.sessionId));
      if (!session) return json({ message: 'Missing session' }, 404);
      if (path.endsWith('/accept')) { session.staffAccountId = actorId; session.state = 'CONNECTING'; return json(session); }
      if (path.endsWith('/join-token')) {
        session.state = 'ACTIVE'; session.deviceSeenAt = new Date().toISOString();
        return json({ url: 'wss://camera.example.test', room: `mar-${session.sessionId}`, identity: `staff-${actorId}`, token: `fixture-${session.robotId}`, session, expiresAt: session.expiresAt });
      }
      if (path.endsWith('/end')) { session.state = 'ENDED'; return json(session); }
      return json(session);
    }
    if (path === '/api/v1/emergency-incidents') {
      return json(paged(state.rows.filter(r => ['status', 'severity'].every(k => !url.searchParams.get(k) || r[k] === url.searchParams.get(k)) && (!url.searchParams.get('type') || r.incidentType === url.searchParams.get('type'))), url));
    }
    if (path.startsWith('/api/v1/emergency-incidents/')) {
      const row = state.rows.find(r => path.split('/')[4] === r.incidentId);
      if (!row) return json({ message: 'Missing incident' }, 404);
      if (path.endsWith('/location') || path.endsWith('/response-route')) {
        if (state.failLocation) return json({ message: 'Vị trí đang gián đoạn' }, 503);
        const noPatient = row.incidentId === id(4);
        return json({ status: path.endsWith('/response-route') ? 'FOUND' : 'PREVIEW', mapId: row.mapId, mapAssetHash: source.assetHash, unit: 'cm',
          destinationBasis: noPatient ? 'ROBOT_VIEWPOINT' : 'PATIENT_RGBD', patientLocation: noPatient ? null : { xCm: 0, yCm: 0 }, robotObservationLocation: { xCm: 120, yCm: 100 },
          destination: noPatient ? { xCm: 120, yCm: 100 } : { xCm: 0, yCm: 0 }, points: [{ xCm: -100, yCm: -100 }, { xCm: 0, yCm: -100 }, { xCm: 0, yCm: 0 }], distanceCm: 200 });
      }
      if (!post) return json(row);
      const action = path.split('/').at(-1);
      if (action === 'confirm') {
        const review = state.sessions.find(s => s.incidentId === row.incidentId && s.mode === 'MONITOR' && s.state === 'ACTIVE' && s.staffAccountId === actorId);
        if (!review) return json({ message: 'MEDIA_FALL_REVIEW_NOT_ACTIVE' }, 400);
      }
      assert.notEqual(action === 'start' && row.incidentType === 'AI_SUSPECTED_FALL', true, 'fall must use confirm, never start');
      row.status = { acknowledge: 'ACKNOWLEDGED', confirm: 'IN_PROGRESS', start: 'IN_PROGRESS', resolve: 'RESOLVED', close: 'CLOSED', 'false-alarm': 'FALSE_ALARM' }[action];
      assert.ok(row.status, path); row.rowVersion++;
      if (action === 'acknowledge') { row.acknowledgedByAccountId = actorId; row.acknowledgedAt = new Date().toISOString(); }
      if (['resolve', 'false-alarm'].includes(action)) { row.resolutionNote = body.resolutionNote; row.resolvedAt = new Date().toISOString(); }
      if (['close', 'false-alarm'].includes(action)) row.closedAt = new Date().toISOString();
      return json(row);
    }
    if (path.endsWith('/image-metadata')) return json(metadata);
    if (path.endsWith('/image.png')) return route.fulfill({ contentType: 'image/png', body: png });
    if (path.endsWith('/presentation/published')) return json(presentation);
    if (path.endsWith('/snapshot')) return json({ robot: { robotId: id(20), robotName: 'MAR-01', status: 'BUSY' }, mqttConnected: true, heartbeatFresh: true, observedAt: new Date().toISOString() });
    if (path === '/api/v1/robots') return json(paged([{ robotId: id(20), robotName: 'MAR-01' }], url));
    if (path === '/api/v1/maps') return json(paged([{ mapId: id(21), mapName: 'Tầng 1 · Khu khám bệnh' }], url));
    if (path === '/api/v1/endpoints') return json(paged([{ endpointId: id(22), endpointName: 'Sảnh tiếp đón' }], url));
    if (path === '/api/v1/admin/staff') return json(paged([{ account: { accountId: id(50), fullName: 'Nhân viên trực' } }], url));
    return json(paged([], url));
  });
  const open = async (n = 2) => { await page.goto(`${base}/admin/emergency-center?incidentId=${id(n)}`); await expect(page.locator('.ec-detail-header')).toBeVisible(); };
  return { page, context, state, reads, writes, errors, open };
}
async function submitDialog(page, note) {
  const dialog = page.getByRole('dialog');
  if (note) await dialog.getByLabel('Ghi chú xử lý').fill(note);
  await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  return dialog;
}

try {
  const f = await fixture(); await f.open();
  await expect(f.page.locator('.ec-detail-header h3')).toHaveText('AI phát hiện nghi té ngã');
  await expect(f.page.locator('.ec-source-tabs')).toContainText('SOS bấm nút');
  await expect(f.page.locator('.ec-observation-marker')).toHaveCount(1);
  assert.equal(f.writes.length, 0, 'opening a detail never accepts or creates media automatically');
  await f.page.locator('.ec-source-tabs').getByRole('button', { name: /AI nghi té ngã/ }).click();
  await expect(f.page.locator('.ec-incident')).toHaveCount(3);
  await f.page.locator(`[data-incident-id="${id(2)}"]`).click();
  await f.page.getByRole('button', { name: 'Tiếp nhận sự cố', exact: true }).click();
  await (await submitDialog(f.page)).waitFor({ state: 'hidden' });
  const confirm = f.page.getByRole('button', { name: 'Xác nhận cần hỗ trợ', exact: true });
  await expect(confirm).toBeDisabled();
  const session = { sessionId: id(102), incidentId: id(2), robotId: id(20), mode: 'MONITOR', state: 'RINGING', staffAccountId: null, expiresAt: new Date(Date.now() + 60000).toISOString(), deviceSeenAt: new Date().toISOString() };
  f.state.sessions.push(session);
  await f.page.getByRole('button', { name: 'Mở camera xác minh', exact: true }).click();
  await expect(confirm).toBeEnabled();
  assert.equal(f.writes.filter(w => w.path.endsWith('/accept')).length, 1);
  assert.equal(f.writes.some(w => w.path === '/api/v1/media-sessions'), false, 'reuse the incident ringing session');
  assert.equal(await f.page.evaluate(() => window.captureRequests), 0);
  await f.page.evaluate(() => clearInterval(window.fakeRooms.at(-1).animation));
  await expect(confirm).toBeDisabled({ timeout: 9000 });
  await f.page.evaluate(() => { const room = window.fakeRooms.at(-1); room.animation = setInterval(room.draw, 70); });
  await expect(confirm).toBeEnabled();
  await f.page.screenshot({ path: `${output}/desktop-review.png`, fullPage: true });
  await confirm.click(); session.state = 'RECONNECTING';
  const dialog = await submitDialog(f.page);
  await expect(dialog.getByRole('alert')).toContainText('Cần mở camera');
  assert.equal(f.writes.some(w => w.path.endsWith('/confirm')), false, 'preflight must block a lost backend review');
  session.state = 'ACTIVE';
  await f.page.waitForTimeout(3200);
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await expect(f.page.getByRole('button', { name: 'Xác nhận xử lý xong', exact: true })).toBeVisible();
  await expect(f.page.locator('.ec-response-route')).toHaveCount(1);
  assert.equal(f.reads.some(r => r.endsWith(`/${id(2)}/response-route`)), true);
  await f.page.getByRole('button', { name: 'Xác nhận xử lý xong', exact: true }).click();
  await (await submitDialog(f.page, 'Đã kiểm tra trực tiếp và hoàn thành hỗ trợ người cần trợ giúp.')).waitFor({ state: 'hidden' });
  await expect(f.page.getByRole('button', { name: 'Đóng hồ sơ', exact: true })).toBeVisible();
  await f.page.getByRole('button', { name: 'Đóng hồ sơ', exact: true }).click();
  await (await submitDialog(f.page)).waitFor({ state: 'hidden' });
  await expect(f.page.locator('.ec-detail-kicker')).toContainText('Đã đóng');
  assert.deepEqual(f.writes.filter(w => w.path.startsWith('/api/v1/emergency-incidents/')).map(w => w.path.split('/').at(-1)), ['acknowledge', 'confirm', 'resolve', 'close']);
  await f.page.locator('.ec-tabs').getByRole('button', { name: 'Lịch sử', exact: true }).click();
  await f.page.locator('.ec-source-tabs').getByRole('button', { name: /AI nghi té ngã/ }).click();
  await expect.poll(() => f.reads.some(r => r.includes('type=AI_SUSPECTED_FALL') && r.includes('status=CLOSED'))).toBe(true);
  await f.page.locator('.ec-tabs').getByRole('button', { name: /^Đang diễn ra/ }).click();
  await f.page.locator(`[data-incident-id="${id(4)}"]`).click();
  await expect(f.page.locator('.ec-observation-marker')).toHaveCount(1);
  await expect(f.page.locator('.ec-sos-marker')).toHaveCount(0);
  await expect(f.page.locator('.ec-map-card')).toContainText('Chưa xác định vị trí người cần hỗ trợ');
  f.state.enabled = false;
  await f.page.getByRole('button', { name: 'Mở camera xác minh', exact: true }).click();
  await expect(f.page.locator('.ec-camera')).toContainText('Máy chủ chưa bật dịch vụ camera');
  await f.page.getByRole('button', { name: 'Đánh dấu báo động nhầm', exact: true }).click();
  await (await submitDialog(f.page, 'Nhân viên đã kiểm tra trực tiếp, người đang chủ động ngồi nghỉ.')).waitFor({ state: 'hidden' });
  await expect(f.page.locator('.ec-detail-kicker')).toContainText('Báo động nhầm');
  await f.page.locator(`[data-incident-id="${id(3)}"]`).click();
  for (const width of [1440, 1024, 390]) {
    await f.page.setViewportSize({ width, height: 950 });
    assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `no overflow at ${width}px`);
    const placeholder = f.page.locator('.ec-camera-placeholder');
    assert.equal(await placeholder.evaluate(el => el.scrollWidth > el.clientWidth + 1), false, `camera instructions fit at ${width}px`);
    const cameraBox = await f.page.locator('.ec-camera-view').boundingBox(), placeholderBox = await placeholder.boundingBox();
    assert.ok(placeholderBox.x >= cameraBox.x - 1 && placeholderBox.x + placeholderBox.width <= cameraBox.x + cameraBox.width + 1, `camera instructions stay inside viewport at ${width}px`);
    if (width === 390) await f.page.locator('.ec-camera').screenshot({ path: `${output}/camera-mobile-final.png` });
    await f.page.screenshot({ path: `${output}/layout-${width}.png`, fullPage: true });
  }
  await f.page.locator(`[data-incident-id="${id(1)}"]`).click();
  await expect(f.page.locator('.ec-detail-header h3')).toHaveText('Yêu cầu hỗ trợ khẩn cấp');
  await expect(f.page.locator('.ec-next-step button')).toHaveCount(0);
  assert.deepEqual(f.errors, []); await f.context.close();

  const other = await fixture('STAFF', id(99)); await other.open();
  await expect(other.page.getByRole('button', { name: 'Mở camera xác minh', exact: true })).toHaveCount(0);
  await expect(other.page.locator('.ec-next-step button')).toHaveCount(0);
  assert.equal(other.writes.length, 0); assert.deepEqual(other.errors, []); await other.context.close();

  const sos = await fixture('STAFF'); await sos.open(1);
  await sos.page.getByRole('button', { name: 'Kết nối hỗ trợ SOS', exact: true }).click();
  await expect(sos.page.locator('.ec-camera-state')).toContainText('Trực tiếp');
  assert.equal(sos.writes.find(w => w.path === '/api/v1/media-sessions').body.mode, 'ASSIST');
  assert.equal(await sos.page.evaluate(() => window.captureRequests), 0);
  await sos.page.getByRole('button', { name: 'Bật micro trao đổi', exact: true }).click();
  await expect.poll(() => sos.page.evaluate(() => window.microphoneChanges)).toEqual([true]);
  await sos.page.getByRole('button', { name: 'Ngắt camera', exact: true }).click();
  await expect.poll(() => sos.writes.some(w => w.path.endsWith('/end'))).toBe(true);
  assert.deepEqual(sos.errors, []); await sos.context.close();
  console.log('PASS: canonical AI source and history filter; admin fall acknowledgement, scoped MONITOR accept/join, live-frame guard, stale camera preflight, confirm/resolve/close; fallback position, offline/manual false alarm, assigned staff, ASSIST SOS microphone and responsive 1440/1024/390 layouts. All APIs and LiveKit mocked.');
} finally { await browser.close(); }
