import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.WORKFLOW_TEST_URL || 'http://127.0.0.1:5186';
const output = '.workstation-build/workflow-designer';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(10000);
const errors = [], calls = [], documents = new Map();
page.on('pageerror', e => errors.push(e.message));
const mapA = '11111111-1111-4111-8111-111111111111', mapB = '11111111-1111-4111-8111-111111111112';
const pointA = '22222222-2222-4222-8222-222222222221', pointB = '22222222-2222-4222-8222-222222222222';
const maps = [{ mapId: mapA, mapName: 'Tầng 1', floorId: 'floor-1', status: 'ACTIVE' }, { mapId: mapB, mapName: 'Tầng 2', floorId: 'floor-2', status: 'ACTIVE' }];
const endpoints = [{ endpointId: pointA, endpointName: 'Cửa phòng 101', endpointCode: 'P101-A', mapId: mapA, roomId: 'room-1', active: true, accessible: true }, { endpointId: pointB, endpointName: 'Điểm giao 101', endpointCode: 'P101-B', mapId: mapA, roomId: 'room-1', active: true, accessible: true }];
const rooms = [{ roomId: 'room-1', roomName: 'Phòng 101', roomCode: '101', floorId: 'floor-1', active: true }, { roomId: 'room-2', roomName: 'Phòng 102 chưa có điểm', roomCode: '102', floorId: 'floor-1', active: true }];
let failGraph = false, failPublish = false;
const paged = content => ({ content, last: true, totalPages: 1 });
function detail(body, id = 'wf-1', status = 'DRAFT') {
  return { workflow: { ...body.workflow, workflowId: id, startStepId: 'id-' + body.graph.startStepCode, status, rowVersion: 1 }, tasks: body.graph.tasks.map(t => ({ ...t, taskId: 'task-' + t.taskCode })), steps: body.graph.steps.map(s => ({ ...s, stepTypeCode: s.stepType, stepId: 'id-' + s.stepCode, taskId: 'task-' + s.taskCode, enabled: true })), transitions: body.graph.transitions.map((e, i) => ({ ...e, transitionId: 'edge-' + i, fromStepId: 'id-' + e.fromStepCode, toStepId: e.toStepCode ? 'id-' + e.toStepCode : null })) };
}
await page.addInitScript(() => {
  localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'workflow-admin', accountId: 'admin-test', role: 'ADMIN' }, tokens: { accessToken: 'mock-token' } }));
});
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
  if (!path.startsWith('/api/v1/')) { if (url.origin === base || url.protocol === 'data:') return route.continue(); return route.abort(); }
  const body = request.postData() ? request.postDataJSON() : null;
  calls.push({ path, method, body });
  const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
  if (path === '/api/v1/maps') return json(paged(maps));
  if (path === '/api/v1/endpoints') return json(paged(endpoints));
  if (path === '/api/v1/rooms') return json(paged(rooms));
  if (path === '/api/v1/workflows/step-types') return json([]);
  if (path === '/api/v1/admin/workflows' && method === 'GET') return json(paged([...documents.values()].map(d => d.workflow)));
  if (path === '/api/v1/admin/workflows/graph' && method === 'POST') { const d = detail(body); documents.set('wf-1', d); return json(d, 201); }
  const match = path.match(/^\/api\/v1\/admin\/workflows\/([^/]+)(?:\/(.*))?$/);
  if (match) {
    const [, id, operation] = match, value = documents.get(id);
    if (!value) return json({ message: 'Không có workflow' }, 404);
    if (!operation && method === 'GET') return json(value);
    if (!operation && method === 'PUT') { value.workflow = { ...value.workflow, ...body, status: 'DRAFT' }; return json(value.workflow); }
    if (operation === 'graph' && method === 'PUT') { if (failGraph) { failGraph = false; return json({ message: 'Graph thất bại giả lập' }, 500); } const d = detail({ workflow: value.workflow, graph: body }, id); documents.set(id, d); return json(d); }
    if (operation === 'validate') { value.workflow.status = 'VALIDATED'; return json({ workflowId: id, status: 'VALIDATED', definitionHash: 'hash', warnings: [] }); }
    if (operation === 'publish') { if (failPublish) { failPublish = false; return json({ message: 'Pi chưa sẵn sàng giả lập' }, 409); } value.workflow.status = 'PUBLISHED'; value.workflow.acceptsNewJobs = true; return json(value.workflow); }
    if (operation === 'archive') { value.workflow.status = 'ARCHIVED'; return json(value.workflow); }
    if (operation === 'clone') { const d = structuredClone(value); d.workflow = { ...d.workflow, workflowId: 'wf-2', versionNo: 2, status: 'DRAFT', acceptsNewJobs: false }; documents.set('wf-2', d); return json(d); }
  }
  return json({ message: `Unexpected mock ${method} ${path}` }, 500);
});
async function wire(source, handle, target) {
  const from = page.locator(`.react-flow__node[data-id="${source}"] .react-flow__handle.source[data-handleid="${handle}"]`);
  const to = page.locator(`.react-flow__node[data-id="${target}"] .react-flow__handle.target`);
  const a = await from.boundingBox(), b = await to.boundingBox();
  assert.ok(a && b, 'handles must be visible');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 16 }); await page.mouse.up();
}
try {
  await page.goto(base + '/workflows');
  await expect(page).toHaveURL(base + '/workflow');
  await page.getByRole('button', { name: '＋ Tạo quy trình', exact: true }).first().click();
  await page.getByLabel('Tên quy trình', { exact: true }).fill('Giao hàng có tham số');
  const canvas = await page.locator('.wfd-canvas').boundingBox();
  const palette = page.locator('.wfd-palette-list button').filter({ hasText: 'Di chuyển' }).first();
  // Real HTML drag/drop from palette, not direct document injection.
  await palette.dragTo(page.locator('.react-flow__pane'), { targetPosition: { x: canvas.width * .45, y: 150 } });
  await expect(page.locator('.wfd-node-top small', { hasText: 'MOVE' })).toHaveCount(1);
  const moveId = await page.locator('.react-flow__node').filter({ has: page.locator('.wfd-node-top small', { hasText: 'MOVE' }) }).getAttribute('data-id');
  await wire('start', 'SUCCESS', moveId);
  await wire(moveId, 'SUCCESS', 'end');
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await page.getByRole('button', { name: 'Lưu lên máy chủ', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu đầy đủ');
  assert.equal(documents.get('wf-1').steps[0].inputMappingJson.endpoint_id.$ref, '/inputs/destination_1_endpoint_id');
  assert.equal(documents.get('wf-1').transitions.length, 3);
  assert.ok(!calls.some(c => c.path.endsWith('/jobs') || c.path.endsWith('/navigation-requests')));
  await page.getByRole('button', { name: 'Thông tin & biến', exact: true }).click();
  await page.locator('.wfd-variable').filter({ hasText: 'destination_1_endpoint_id' }).locator('summary').click();
  await page.getByLabel('Cách chọn destination_1_endpoint_id').selectOption('room-endpoint');
  await page.getByRole('button', { name: 'Xem trước đầu vào', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Bản đồ *', { exact: true }).selectOption(mapA);
  await dialog.getByLabel('Phòng · Điểm đến 1', { exact: true }).selectOption('room-2');
  await expect(dialog).toContainText('Phòng này chưa có endpoint khả dụng');
  await dialog.getByLabel('Phòng · Điểm đến 1', { exact: true }).selectOption('room-1');
  await expect(dialog.getByLabel('Điểm đến 1 *', { exact: true }).locator('option')).toHaveCount(3);
  await dialog.getByLabel('Điểm đến 1 *', { exact: true }).selectOption(pointB);
  await dialog.getByRole('button', { name: 'Kiểm tra đầu vào' }).click();
  await expect(dialog.getByRole('status')).toContainText('Đầu vào hợp lệ');
  await dialog.getByLabel('Bản đồ *', { exact: true }).selectOption(mapB);
  await expect(dialog.getByLabel('Điểm đến 1 *', { exact: true })).toHaveValue('');
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Publish', exact: true }).isEnabled(), false);
  // Partial server save must preserve editor input and block publication.
  failGraph = true;
  await page.getByRole('button', { name: 'Lưu lên máy chủ', exact: true }).click();
  await expect(page.getByRole('alert').first()).toContainText('Chưa đồng bộ đầy đủ');
  await expect(page.getByLabel('Tên quy trình', { exact: true })).toHaveValue('Giao hàng có tham số');
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('BE đã xác thực');
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
  await expect(page.locator(`.react-flow__node[data-id="${moveId}"]`)).toBeInViewport();
  await expect(page.locator(`.react-flow__node[data-id="${moveId}"]`)).toBeVisible();
  await page.screenshot({ path: output + '/desktop.png', fullPage: true });
  failPublish = true;
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('alert').first()).toContainText('Pi chưa sẵn sàng');
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tạo phiên bản mới', exact: true })).toBeVisible();
  await expect(page.getByLabel('Tên quy trình', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Tạo phiên bản mới', exact: true }).click();
  await expect(page.getByLabel('Tên quy trình', { exact: true })).toBeEnabled();
  await expect(page.locator('.wfd-page-header p')).toContainText('Phiên bản 2');
  // Unsaved graph and invalid JSON survive local autosave/reload and restore.
  await page.locator('.wfd-palette-list button').filter({ has: page.locator('strong', { hasText: /^Chờ$/ }) }).click();
  await expect(page.locator('.wfd-node-top small', { hasText: 'WAIT' })).toHaveCount(1);
  await page.getByRole('button', { name: '↶ Hoàn tác', exact: true }).click();
  await expect(page.locator('.wfd-node-top small', { hasText: 'WAIT' })).toHaveCount(0);
  await page.getByRole('button', { name: '↷ Làm lại', exact: true }).click();
  await expect(page.locator('.wfd-node-top small', { hasText: 'WAIT' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Lưu trên thiết bị', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Mở quy trình', exact: true }).first().click();
  await expect(page.locator('.wfd-node-top small', { hasText: 'WAIT' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Lưu lên máy chủ', exact: true }).click();
  await expect(page.getByRole('alert').first()).toContainText('Cần sửa các lỗi');
  await expect(page.locator('.wfd-validation')).toContainText('chưa được nối');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output + '/mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile must not overflow horizontally');
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.getByRole('button', { name: '← Thư viện', exact: true }).click();
  await page.screenshot({ path: output + '/library.png', fullPage: true });
  const cyclic = structuredClone(documents.get('wf-1'));
  cyclic.workflow = { ...cyclic.workflow, workflowId: 'cycle', status: 'DRAFT' };
  cyclic.transitions[0].toStepId = cyclic.steps[0].stepId; cyclic.transitions[0].terminalStatus = null;
  documents.set('cycle', cyclic);
  await page.goto(base + '/workflow?workflowId=cycle');
  await expect(page.locator('.wfd-banner.warning')).toContainText('vòng lặp');
  await expect(page.getByLabel('Tên quy trình', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Lưu lên máy chủ', exact: true })).toHaveCount(0);
  // Old local patrol documents remain untouched, while conversion creates a new parameterized design.
  const local = structuredClone(documents.get('wf-1'));
  local.workflow = { ...local.workflow, workflowId: 'local-patrol-old', localOnly: true, status: 'DRAFT' };
  local.steps[0].paramsJson = { map_id: 'local-map-studio', endpoint_id: 'local-point', mode: 'PATROL', max_speed_mps: .08 }; local.steps[0].inputMappingJson = {};
  const original = JSON.stringify({ schema: 1, designs: [local] });
  await page.evaluate(raw => localStorage.setItem('mediassist.local-patrol-workflows.v1', raw), original);
  await page.goto(base + '/workflow?workflowId=local-patrol-old');
  await expect(page.getByRole('button', { name: 'Tạo bản chuyển đổi', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo bản chuyển đổi', exact: true }).click();
  await expect(page.getByLabel('Tên quy trình', { exact: true })).toBeEnabled();
  assert.equal(await page.evaluate(() => localStorage.getItem('mediassist.local-patrol-workflows.v1')), original);
  await expect(page.locator('.wfd-page-header h1')).toContainText('bản chuyển đổi');
  // Typed JSON editing stores invalid draft text and blocks graph writes rather than crashing.
  await page.getByText('Cấu hình nâng cao', { exact: true }).click();
  const tasksJson = page.getByLabel('Nhóm tác vụ (JSON)', { exact: true });
  await tasksJson.fill('[]');
  await expect(page.getByRole('alert').filter({ hasText: 'JSON chưa hợp lệ' })).toBeVisible();
  await page.getByRole('button', { name: 'Lưu lên máy chủ', exact: true }).click();
  await expect(page.locator('.wfd-validation')).toContainText('JSON chưa hợp lệ');
  await page.getByRole('button', { name: '← Thư viện', exact: true }).click();
  await page.getByRole('button', { name: '＋ Tạo quy trình', exact: true }).first().click();
  await page.locator('.wfd-palette-list button').filter({ has: page.locator('strong', { hasText: /^Chờ$/ }) }).click();
  const waitId = await page.locator('.react-flow__node').filter({ has: page.locator('.wfd-node-top small', { hasText: 'WAIT' }) }).getAttribute('data-id');
  await page.locator('.wfd-palette-list button').filter({ hasText: 'Kiểm tra điều kiện' }).click();
  const checkId = await page.locator('.react-flow__node').filter({ has: page.locator('.wfd-node-top small', { hasText: 'CHECK_CONDITION' }) }).getAttribute('data-id');
  await page.getByRole('button', { name: 'Vừa khung', exact: true }).click();
  await wire('start', 'SUCCESS', waitId);
  await wire(waitId, 'SUCCESS', checkId);
  await wire(checkId, 'false', 'end');
  await wire(checkId, 'true', 'end');
  await page.getByRole('button', { name: 'Lưu lên máy chủ', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu đầy đủ');
  const conditionalRoutes = calls.filter(c => c.path.endsWith('/workflows/graph')).at(-1).body.graph.transitions.filter(t => t.outcome === 'SUCCESS' && t.fromStepCode === checkId);
  assert.equal(conditionalRoutes.length, 2);
  assert.equal(conditionalRoutes.find(t => !t.defaultTransition).conditionJson.path, '/result/value');
  assert.equal(conditionalRoutes.find(t => t.defaultTransition).priority, 2);
  await page.locator(`.react-flow__node[data-id="${checkId}"] .wfd-node>strong`).click();
  await page.getByLabel('Phép so sánh', { exact: true }).selectOption('IN');
  await page.getByLabel('Kiểu giá trị', { exact: true }).selectOption('array');
  await page.getByLabel('Giá trị so sánh', { exact: true }).fill('[true,');
  await page.getByRole('button', { name: 'Lưu lên máy chủ', exact: true }).click();
  await expect(page.locator('.wfd-validation')).toContainText('JSON giá trị so sánh chưa hợp lệ');
  await page.getByLabel('Giá trị so sánh', { exact: true }).fill('[true, false]');
  await page.getByRole('button', { name: 'Lưu lên máy chủ', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu đầy đủ');
  // A request ID is available immediately; map/endpoint UUID variables are not interchangeable.
  await page.locator('.wfd-palette-list button').filter({ hasText: 'Di chuyển' }).first().click();
  await page.locator('.wfd-palette-list button').filter({ has: page.locator('strong', { hasText: /^Xác thực$/ }) }).first().click();
  await page.getByRole('button', { name: 'Thông tin & biến', exact: true }).click();
  const authNode = page.locator('.react-flow__node').filter({ has: page.locator('.wfd-node-top small', { hasText: 'AUTHENTICATE' }) }).first();
  await page.getByRole('button', { name: 'Vừa khung', exact: true }).click();
  await authNode.locator('.wfd-node>strong').click();
  const requestInput = page.getByLabel('Biến cho Yêu cầu dịch vụ', { exact: true });
  await expect(requestInput).toHaveValue('service_request_id');
  await expect(requestInput.locator('option')).toHaveCount(2);
  assert.ok(!(await requestInput.locator('option').allTextContents()).some(text => text.includes('Bản đồ') || text.includes('Điểm đến')));
  await page.getByRole('button', { name: 'Thông tin & biến', exact: true }).click();
  await page.locator('.wfd-variable').filter({ hasText: 'service_request_id' }).locator('summary').click();
  await page.getByRole('button', { name: 'Xóa biến', exact: true }).last().click();
  await expect(page.getByRole('alert').filter({ hasText: 'đang được sử dụng' })).toBeVisible();
  // Existing fixed-value auth steps can bind the shared input in one click without a prompt.
  await authNode.locator('.wfd-node>strong').click();
  await page.getByLabel('Nguồn Yêu cầu dịch vụ', { exact: true }).selectOption('fixed');
  await page.getByLabel('Nguồn Yêu cầu dịch vụ', { exact: true }).selectOption('input');
  await page.getByRole('button', { name: '+ Dùng biến service_request_id', exact: true }).click();
  await expect(requestInput).toHaveValue('service_request_id');
  // Guard shared component extraction: dispatch still renders independently.
  await page.goto(base + '/workstations?mode=local');
  await expect(page.getByRole('navigation', { name: 'Điều hướng quản trị' })).toBeVisible();
  assert.deepEqual(errors, [], 'no browser runtime exceptions');
  console.log('PASS: real palette drop/wiring, graph save, room/endpoint preview, map reset, partial failure, validate/publish readiness, cloning, undo/redo, local restore, mobile and dispatch shared components.');
} catch (error) {
  await page.screenshot({ path: output + '/failure.png', fullPage: true });
  console.error('Browser errors:', errors);
  throw error;
} finally { await browser.close(); }
