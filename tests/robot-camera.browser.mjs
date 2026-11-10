import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5187';
const id = n => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const accountId = id(2), robotId = id(1), otherRobot = id(4);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1050, height: 800 } });
let sessions = [], serial = 4, enabled = true, deviceOnline = true;
const writes = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(accountId => {
  localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { accountId, username: 'camera-test', role: 'ADMIN' }, tokens: { accessToken: 'fixture' } }));
  window.fakeRooms = []; window.captureRequests = 0;
  navigator.mediaDevices.getUserMedia = async () => { window.captureRequests++; throw Error('Local capture must never be requested'); };
}, accountId);
const sdk = `
export const RoomEvent = Object.fromEntries(['TrackSubscribed','TrackUnsubscribed','TrackMuted','TrackUnmuted','Reconnecting','Reconnected','Disconnected'].map(x=>[x,x]));
export const Track = {Kind:{Video:'video'},Source:{Camera:'camera'}};
export const DisconnectReason = {DUPLICATE_IDENTITY:2};
export class Room {
 constructor(){this.events=new Map();window.fakeRooms.push(this);this.localParticipant={setMicrophoneEnabled(){throw Error('Local microphone must stay off');}};}
 on(event,listener){this.events.set(event,listener);return this;}
 emit(event,...args){this.events.get(event)?.(...args);}
 removeAllListeners(){this.events.clear();}
 async connect(url,token){this.token=token;this.url=url;
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;const context=canvas.getContext('2d');
  let count=0;this.draw=()=>{context.fillStyle='#173e65';context.fillRect(0,0,320,240);context.fillStyle='white';context.font='20px Arial';context.fillText('Robot camera '+(++count),30,120);};
  this.draw();this.animation=setInterval(this.draw,70);this.stream=canvas.captureStream(15);
  this.track={kind:'video',attach:element=>{element.srcObject=this.stream;},detach:element=>{element.srcObject=null;}};
  this.emit('TrackSubscribed',this.track,{source:'camera'},{identity:'robot-'+token.slice('fixture-'.length)});
 }
 async disconnect(){this.disconnected=true;clearInterval(this.animation);this.stream?.getTracks().forEach(track=>track.stop());}
}`;
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  if (path === '/__camera-test') return route.fulfill({ contentType: 'text/html', body: '<div id="test-root" style="max-width:620px;margin:30px auto"></div>' });
  if (path.includes('/node_modules/.vite/deps/livekit-client.js')) return route.fulfill({ contentType: 'application/javascript', body: sdk });
  if (!path.startsWith('/api/v1/')) return url.origin === base ? route.continue() : route.abort();
  assert.equal(request.headers().authorization, 'Bearer fixture');
  const json = (body, status = 200) => route.fulfill({ json: body, status });
  const body = request.method() === 'POST' ? request.postDataJSON() : null;
  if (body) writes.push({ path, body });
  if (path === '/api/v1/media/configuration') return json({ enabled });
  if (path === '/api/v1/media-sessions' && !body) return json(sessions);
  if (path === '/api/v1/media-sessions') {
    assert.deepEqual(Object.keys(body).sort(), ['mode', 'robotId']); assert.equal(body.mode, 'MONITOR');
    if (!deviceOnline) return json({ message: 'MEDIA_DEVICE_NOT_CONNECTED' }, 400);
    const session = { sessionId: id(serial++), robotId: body.robotId, staffAccountId: accountId, mode: 'MONITOR', state: 'CONNECTING', expiresAt: new Date(Date.now() + 60000).toISOString() };
    sessions.push(session); return json(session);
  }
  const session = sessions.find(value => path.includes(value.sessionId));
  if (path.endsWith('/join-token')) return json({ url: 'wss://camera.example.test', token: 'fixture-' + session.robotId, room: 'mar-' + session.sessionId, identity: 'staff-' + accountId, session, expiresAt: session.expiresAt });
  if (path.endsWith('/end')) { assert.equal(body.reason, 'MONITOR_VIEW_CLOSED'); sessions = sessions.filter(value => value !== session); return json({ ...session, state: 'ENDED' }); }
  assert.ok(session, `Only media endpoints may be called: ${path}`); return json(session);
});
const count = suffix => writes.filter(value => value.path.endsWith(suffix)).length;
try {
  await page.goto(base + '/__camera-test');
  await page.evaluate(async ({ robotId }) => {
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const source = await fetch('/src/pages/Admin/robotOperations/RobotCamera.jsx').then(response => response.text());
    const routerModule = source.match(/["']([^"']*\/react-router-dom\.js[^"']*)["']/)[1];
    const { MemoryRouter } = await import(routerModule);
    const { default: Camera } = await import('/src/pages/Admin/robotOperations/RobotCamera.jsx');
    const root = ReactDOM.createRoot(document.getElementById('test-root'));
    window.renderCamera = (id, shared = false) => root.render(React.createElement(React.StrictMode, null,
      React.createElement(MemoryRouter, null, id ? React.createElement(React.Fragment, null,
        React.createElement(Camera, { key: id, robotId: id }), shared ? React.createElement(Camera, { key: id + '-second', robotId: id }) : null) : null)));
    window.renderCamera(robotId, true);
  }, { robotId });
  await expect(page.locator('.rc-live')).toHaveCount(2);
  assert.equal(count('/media-sessions'), 1, 'StrictMode and two panels share one MONITOR create');
  assert.equal(count('/join-token'), 1);
  assert.equal(await page.evaluate(() => window.captureRequests), 0);
  await mkdir('.workstation-build/robot-camera', { recursive: true });
  await page.screenshot({ path: '.workstation-build/robot-camera/live-camera.png', fullPage: true });
  await page.evaluate(() => clearInterval(window.fakeRooms.at(-1).animation));
  await expect(page.locator('.rc-live')).toHaveCount(0, { timeout: 8000 });
  await expect(page.locator('.rc-placeholder').first()).toContainText('chưa có khung hình mới');
  await page.evaluate(() => { const room = window.fakeRooms.at(-1); room.animation = setInterval(room.draw, 70); });
  await expect(page.locator('.rc-live')).toHaveCount(2);
  await page.evaluate(robotId => window.renderCamera(robotId), robotId);
  await expect(page.locator('.rc-live')).toHaveCount(1);
  assert.equal(count('/end'), 0, 'one remaining panel keeps the shared viewer alive');
  await page.getByRole('button', { name: 'Ngừng xem', exact: true }).click();
  await expect.poll(() => count('/end')).toBe(1);
  await expect(page.locator('video')).toBeHidden();
  await page.getByRole('button', { name: 'Mở camera', exact: true }).click();
  await expect(page.locator('.rc-live')).toHaveCount(1);
  await page.evaluate(id => window.renderCamera(id), otherRobot);
  await expect(page.locator('.rc-live')).toHaveCount(1);
  await expect.poll(() => count('/end')).toBe(2);
  assert.equal(await page.evaluate(() => window.fakeRooms.at(-1).token), 'fixture-' + otherRobot);
  await page.evaluate(() => window.renderCamera(null));
  await expect.poll(() => count('/end')).toBe(3);
  const beforeSos = writes.length;
  sessions = [{ sessionId: id(8), robotId, staffAccountId: accountId, incidentId: id(9), mode: 'ASSIST', state: 'RINGING', expiresAt: new Date(Date.now() + 60000).toISOString() }];
  await page.evaluate(id => window.renderCamera(id), robotId);
  await expect(page.locator('.rc-placeholder')).toContainText('hỗ trợ/SOS');
  assert.equal(writes.length, beforeSos, 'camera never accepts or ends an SOS call');
  await page.evaluate(() => window.renderCamera(null));
  sessions = []; deviceOnline = false;
  await page.waitForTimeout(400);
  await page.evaluate(id => window.renderCamera(id), robotId);
  await expect(page.locator('.rc-camera-card')).toContainText('Robot chưa kết nối dịch vụ camera');
  deviceOnline = true;
  await page.getByRole('button', { name: 'Kết nối lại', exact: true }).click();
  await expect(page.locator('.rc-live')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.equal(await page.evaluate(() => window.captureRequests), 0);
  assert.deepEqual(errors, []);
  await page.evaluate(() => window.renderCamera(null));
  console.log('PASS: automatic scoped MONITOR, authenticated join, actual video rendering, no local capture, shared StrictMode lifecycle, stale frames, pause/resume, robot switch, SOS protection and Pi reconnect. All APIs and media server mocked.');
} catch (error) {
  console.error('Camera page errors:', errors, 'URL:', page.url(), 'Panel:', await page.locator('body').innerText().catch(() => 'unavailable'));
  throw error;
} finally { await browser.close(); }
