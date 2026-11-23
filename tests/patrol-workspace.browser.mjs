import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_BASE_URL || 'http://localhost:5173';
const output = '.workstation-build/patrol-workspace';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const mapId = id(1), robotId = id(2), workflowId = id(3), jobId = id(4), hash = 'a'.repeat(64);
const endpoints = ['Sảnh tiếp đón', 'Hành lang khu khám', 'Khu điều dưỡng', 'Phòng chờ', 'Cửa khu nội trú', 'Điểm bổ sung'].map((endpointName, index) => ({ endpointId: id(10 + index), endpointName, endpointCode: `EP-${index + 1}`, mapId, xM: [1.5, 5, 8, 8, 5, 1.5][index], yM: [3, 3, 3, 4.5, 4.5, 4.5][index], yawRad: 0, active: true, accessible: true }));
const map = { mapId, mapName: 'Khu khám bệnh · Tầng 1', status: 'ACTIVE', versionNo: 2, widthM: 10, heightM: 6, resolutionMPerPixel: .01, originXM: 0, originYM: 0, originYawRad: 0 };
const zones = [{ zoneId: id(20), mapId, zoneName: 'Khu khám bệnh', zoneType: 'CROWD', active: true, polygonJson: { points: [[1, 2], [9, 2], [9, 4], [1, 4]] } }, { zoneId: id(21), mapId, zoneName: 'Khu nội bộ', zoneType: 'KEEP_OUT', active: true, polygonJson: { points: [[6, 4], [9, 4], [9, 5], [6, 5]] } }];
const workflow = { workflowId, workflowCode: 'WF_PATROL_DEMO', workflowName: 'Tuần tra khu khám bệnh', serviceType: 'PATROL', versionNo: 1, status: 'PUBLISHED', acceptsNewJobs: true, schemaVersion: 3, startStepId: id(30), defaultInputsJson: { map_id: mapId, patrol_repeat_count: 3 } };
const steps = endpoints.slice(0, 3).flatMap((point, index) => [
  { stepId: id(30 + index * 2), stepTypeCode: 'MOVE', stepCode: `MOVE_${index + 1}`, stepName: `Di chuyển ${index + 1}`, sequenceNo: index * 2 + 1, enabled: true, paramsJson: { map_id: mapId, endpoint_id: point.endpointId, max_speed_mps: .25 }, inputMappingJson: {} },
  { stepId: id(31 + index * 2), stepTypeCode: 'EXECUTE_SENSING', stepCode: `SENSE_${index + 1}`, stepName: `Quan sát ${index + 1}`, sequenceNo: index * 2 + 2, enabled: true, paramsJson: { sensing_type: 'CROWD_DENSITY', zone_id: zones[0].zoneId, window_sec: 12 }, inputMappingJson: {} },
]);
const transitions = steps.map((step, index) => ({ transitionId: id(50 + index), fromStepId: step.stepId, toStepId: steps[index + 1]?.stepId ?? null, outcome: 'SUCCESS', defaultTransition: true, conditionJson: null, terminalStatus: index === steps.length - 1 ? 'SUCCEEDED' : null }));
const detail = { workflow, tasks: [], steps, transitions };
const robot = { robotId, robotName: 'MediAssist 01', robotCode: 'MAR-01', status: 'IDLE', currentMapId: mapId, mapAssetHash: hash, batteryPercent: 82 };
const published = {
  source: { mapId, assetHash: hash, widthPx: 1000, heightPx: 600, widthM: 10, heightM: 6, resolutionMPerPixel: .01, originXM: 0, originYM: 0, originYawRad: 0, frameId: 'map' },
  revision: 3,
  document: { schemaVersion: 1, backgroundColor: '#f8fafc', rotationDegrees: 0, features: [
    { id: 'hospital-room', type: 'ROOM', label: 'Phòng tiếp đón', color: '#dbeafe', points: [{ x: .7, y: .6 }, { x: 3, y: .6 }, { x: 3, y: 2 }, { x: .7, y: 2 }], fontSizeM: .2, lineWidthM: .04 },
    { id: 'hospital-wall', type: 'WALL', label: '', color: '#334155', points: [{ x: .7, y: .6 }, { x: 9.3, y: .6 }, { x: 9.3, y: 5.4 }], fontSizeM: .2, lineWidthM: .06 },
    { id: 'robot-alignment', type: 'LANDMARK', label: 'Vị trí robot', color: '#64748b', points: [{ x: 2.8, y: 3 }], fontSizeM: .12, lineWidthM: .03 },
    { id: 'checkpoint-alignment', type: 'LANDMARK', label: 'Điểm tiếp đón', color: '#64748b', points: [{ x: 1.5, y: 3 }], fontSizeM: .12, lineWidthM: .03 },
  ] },
};
let catalogFailure = false, empty = false, jobs = [], schedules = [], holds = [], round = 1, failCreateResponse = false, createdWorkflow = null;
let navigationState = 'READY', poseMapId = mapId, failJobDetail = false;
let presentationStatus = 200;
const writes = [], reads = [], errors = [], unknownApis = [], simulationRequests = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { accountId: 'patrol-test-admin', username: 'patrol-test', fullName: 'Quản trị viên', role: 'ADMIN' }, tokens: { accessToken: 'fixture' } })));
const png = Buffer.from(await page.evaluate(() => {
  const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 600;
  const c = canvas.getContext('2d'); c.fillStyle = '#e8edf2'; c.fillRect(0, 0, 1000, 600);
  c.fillStyle = '#fff'; c.fillRect(70, 60, 860, 480); c.strokeStyle = '#596877'; c.lineWidth = 6; c.strokeRect(70, 60, 860, 480);
  c.font = '17px Arial'; c.textAlign = 'center';
  const labels = ['Tiếp đón', 'Phòng khám 101', 'Phòng khám 102', 'Khu điều dưỡng', 'Phòng chờ', 'Khu nội trú'];
  for (let i = 0; i < 6; i++) { const x = 70 + i % 3 * 286, y = i < 3 ? 60 : 380; c.fillStyle = '#f5f8fb'; c.fillRect(x + 4, y + 4, 278, 152); c.strokeRect(x, y, 286, 160); c.fillStyle = '#75869a'; c.fillText(labels[i], x + 143, y + 85); }
  c.fillStyle = '#fff'; c.fillRect(74, 224, 852, 152); c.fillStyle = '#9eacbb'; c.fillText('HÀNH LANG · TẦNG 1', 500, 315);
  return canvas.toDataURL().split(',')[1];
}), 'base64');
const jobDetail = job => ({ job, tasks: [], steps: [], patrol: { round, repeatCount: 3, continuous: false, resumeRequested: job.status === 'SUSPENDED', phase: job.status === 'SUSPENDED' ? 'SUSPENDED' : 'MOVE', targetEndpointId: endpoints[1].endpointId, holds, resumeBlockedReason: holds.some(h => h.source !== 'MANUAL') ? 'Priority work is still active' : null } });
await page.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url()), path = url.pathname;
  if (path.startsWith('/api/v1/simulation')) simulationRequests.push(`${req.method()} ${path}`);
  if (!path.startsWith('/api/')) return url.origin === new URL(base).origin ? route.continue() : route.abort();
  const reply = (json, status = 200) => route.fulfill({ status, json });
  const list = content => reply({ content, totalElements: content.length, totalPages: 1, last: true });
  const method = req.method();
  if (method !== 'GET') {
    const body = req.postDataJSON(); writes.push({ path, method, body });
    if (path === '/api/v1/schedules') { const schedule = { ...body, scheduleId: id(70), status: 'PAUSED' }; schedules.push(schedule); if (failCreateResponse) { failCreateResponse = false; return route.abort('failed'); } return reply(schedule); }
    if (path === `/api/v1/schedules/${id(70)}/activate`) { schedules[0].status = 'ACTIVE'; return reply(schedules[0]); }
    if (path === '/api/v1/admin/patrol-workflows/preview') return reply({ workflow: {}, graph: {} });
    if (path === '/api/v1/admin/patrol-workflows') { createdWorkflow = body; return reply({ workflowId, mapId, checkpointCount: body.checkpoints.length }); }
    if (path === `/api/v1/jobs/${jobId}/suspend`) { jobs[0] = { ...jobs[0], status: 'SUSPENDING', rowVersion: jobs[0].rowVersion + 1 }; holds = [{ source: 'MANUAL', sourceId: null, createdAt: new Date().toISOString() }]; return reply(jobDetail(jobs[0])); }
    if (path === `/api/v1/jobs/${jobId}/resume`) { holds = holds.filter(h => h.source !== 'MANUAL'); jobs[0] = { ...jobs[0], status: holds.length ? 'SUSPENDED' : 'RUNNING', rowVersion: jobs[0].rowVersion + 1 }; return reply(jobDetail(jobs[0])); }
    if (path === `/api/v1/jobs/${jobId}/cancel`) { jobs[0] = { ...jobs[0], cancelRequestedAt: new Date().toISOString(), rowVersion: jobs[0].rowVersion + 1 }; return reply(jobs[0]); }
    unknownApis.push(`${method} ${path}`); return reply({ message: 'Unmocked mutation forbidden' }, 500);
  }
  reads.push({ path, query: Object.fromEntries(url.searchParams) });
  if (path.endsWith('/stream')) return reply({ message: 'Use mocked REST' }, 503);
  if (path === '/api/v1/auth/me') return reply({ accountId: 'patrol-test-admin', username: 'patrol-test', role: 'ADMIN' });
  if (path === '/api/v1/admin/workflows') return catalogFailure ? reply({ message: 'Máy chủ tạm mất kết nối' }, 503) : list(empty ? [] : [workflow]);
  if (path === `/api/v1/admin/workflows/${workflowId}`) return reply(detail);
  if (path.startsWith('/api/v1/admin/workflows/')) return reply({ message: 'Không tìm thấy quy trình này' }, 404);
  if (path === '/api/v1/workflows/published') return list([workflow]);
  if (path === '/api/v1/maps') return list(empty ? [] : [map]);
  if (path === '/api/v1/endpoints') return list(empty ? [] : endpoints);
  if (path === '/api/v1/zones') return list(empty ? [] : zones);
  if (path === '/api/v1/robots') return list(empty ? [] : [robot]);
  if (path === `/api/v1/robots/${robotId}/snapshot`) return reply({ observedAt: new Date().toISOString(), robot, mqttConnected: true, heartbeatFresh: true, dispatchReady: true, activeJobId: jobs.some(j => j.status === 'RUNNING') ? jobId : null, suspendedPatrolJobIds: jobs.some(j => j.status === 'SUSPENDED') ? [jobId] : [], navigationSession: { state: navigationState, mapId }, latestPose: { robotId, mapId: poseMapId, xM: 2.8, yM: 3, yawRad: .35, frameId: 'map', fresh: true, capturedAt: new Date().toISOString() } });
  if (path === '/api/v1/jobs') return list(jobs.filter(job => (!url.searchParams.get('status') || job.status === url.searchParams.get('status')) && (!url.searchParams.get('workflowId') || job.workflowId === url.searchParams.get('workflowId')) && (!url.searchParams.get('robotId') || job.robotId === url.searchParams.get('robotId'))));
  if (path.startsWith('/api/v1/jobs/')) {
    const job = jobs.find(item => path === `/api/v1/jobs/${item.jobId}`);
    return failJobDetail ? reply({ message: 'Chi tiết nhiệm vụ tạm gián đoạn' }, 503) : job ? reply(jobDetail(job)) : reply({ message: 'Nhiệm vụ không tồn tại' }, 404);
  }
  if (path === '/api/v1/schedules') return list(schedules);
  if (path === `/api/v1/schedules/${id(70)}`) return reply(schedules[0]);
  if (path.endsWith('/presentation/published')) return reply(presentationStatus === 200 ? published : { message: 'Chưa có bản vẽ đã áp dụng' }, presentationStatus);
  if (path.endsWith('/image-metadata')) return reply({ map_id: mapId, asset_hash: hash, width_m: 10, height_m: 6, width_px: 1000, height_px: 600, resolution_m_per_pixel: .01, origin_x_m: 0, origin_y_m: 0, origin_yaw_rad: 0, frame_id: 'map', pixel_center_to_map: [[.01, 0, .005], [0, -.01, 5.995], [0, 0, 1]] });
  if (path.endsWith('/image.png')) return route.fulfill({ contentType: 'image/png', body: png });
  return list([]);
});

try {
  await mkdir(output, { recursive: true });
  // Interaction assertions are kept with the fixture so no real robot service
  // or authenticated mutation can be reached during this browser check.
  await page.goto(`${base}/admin/patrol?view=simulation&workflowId=${workflowId}`);
  await expect(page.locator('.pt-page')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/admin/patrol\\?workflowId=${workflowId}$`));
  await expect(page.getByRole('button', { name: 'Mô phỏng', exact: true })).toHaveCount(0);
  await expect(page.locator('.gazebo-panel, .gazebo-desktop')).toHaveCount(0);
  await expect(page.locator('.pt-page')).toContainText(workflow.workflowName);
  await expect(page.locator('.pt-map svg')).toBeVisible();
  await expect(page.locator('.pt-map-canvas')).toHaveAttribute('data-map-view', 'published');
  await expect(page.locator('.pt-map [data-feature-id="hospital-room"]')).toBeVisible();
  await expect(page.locator('.pt-map [data-feature-id="hospital-wall"]')).toBeVisible();
  assert.equal(writes.length, 0, 'Loading the page never issues commands');

  await page.getByRole('button', { name: 'Tạo tuyến tuần tra', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Tạo tuyến tuần tra', exact: true });
  await expect(create).toBeVisible();
  await create.getByLabel('Tên tuyến', { exact: true }).fill('Tuần tra kiểm thử theo thứ tự');
  await create.getByRole('button', { name: 'Thêm Sảnh tiếp đón vào tuyến', exact: true }).click();
  await expect(create.getByLabel('Điểm đến 1')).toHaveValue(endpoints[0].endpointId);
  for (let i = 0; i < 5; i++) {
    if (i) await create.getByRole('button', { name: 'Thêm điểm đến', exact: true }).click();
    await create.getByLabel(`Điểm đến ${i + 1}`).selectOption(endpoints[i].endpointId);
    await create.getByLabel(`Hoạt động tại điểm ${i + 1}`).selectOption('CROWD_DENSITY');
    await create.getByLabel(`Vùng kiểm tra ${i + 1}`).selectOption(zones[0].zoneId);
  }
  await expect(create.getByRole('button', { name: 'Thêm điểm đến', exact: true })).toBeDisabled();
  await create.getByRole('button', { name: 'Đưa điểm 2 lên', exact: true }).click();
  await expect(create.getByLabel('Điểm đến 1')).toHaveValue(endpoints[1].endpointId);
  await expect(create.getByLabel('Điểm đến 2')).toHaveValue(endpoints[0].endpointId);
  await page.screenshot({ path: `${output}/create-route.png`, fullPage: true });
  await create.getByRole('button', { name: 'Tạo & phát hành tuyến', exact: true }).click();
  await expect(create).not.toBeVisible();
  assert.equal(createdWorkflow.checkpoints.length, 5);
  assert.deepEqual(createdWorkflow.checkpoints.map(point => point.endpointId), [endpoints[1].endpointId, endpoints[0].endpointId, ...endpoints.slice(2, 5).map(point => point.endpointId)]);
  assert.equal(createdWorkflow.repeatCount, 3);
  assert.equal(createdWorkflow.mapId, mapId);
  assert.ok(createdWorkflow.checkpoints.every(point => point.zoneId === zones[0].zoneId && point.sensingType === 'CROWD_DENSITY'));
  await page.getByLabel('Robot tuần tra').selectOption(robotId);
  await expect(page.getByRole('button', { name: 'Bắt đầu tuần tra', exact: true })).toBeEnabled();
  await expect(page.locator('.pt-map [data-patrol-robot] [data-map-robot-marker]')).toHaveAttribute('data-live', 'true');
  const alignment = await page.locator('.pt-map-canvas').evaluate(node => {
    const at = (selector, x, y) => {
      const element = node.querySelector(selector), point = node.querySelector('svg').createSVGPoint();
      point.x = x; point.y = y;
      const result = point.matrixTransform(element.getScreenCTM());
      return { x: result.x, y: result.y };
    };
    return {
      robot: at('[data-patrol-robot]', 0, 0), robotMarker: at('[data-feature-id="robot-alignment"]', 2.8, 3),
      checkpoint: at('[aria-label="Điểm 1: Sảnh tiếp đón"]', 0, 0), checkpointMarker: at('[data-feature-id="checkpoint-alignment"]', 1.5, 3),
    };
  });
  for (const [a, b] of [[alignment.robot, alignment.robotMarker], [alignment.checkpoint, alignment.checkpointMarker]]) {
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .01, 'Patrol live coordinates align with the same published floorplan used in Live Operations');
  }
  const mapSvg = page.locator('.pt-map-svg');
  const fittedView = await mapSvg.getAttribute('viewBox');
  await page.getByRole('button', { name: 'Phóng to bản đồ', exact: true }).click();
  assert.notEqual(await mapSvg.getAttribute('viewBox'), fittedView, 'Zoom changes the actual saved-map viewport');
  await page.getByRole('button', { name: 'Vừa khung bản đồ', exact: true }).click();
  assert.equal(await mapSvg.getAttribute('viewBox'), fittedView);
  poseMapId = id(99);
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.locator('.pt-map')).toContainText('Chưa có vị trí robot hợp lệ');
  await expect(page.locator('.pt-map [data-patrol-robot]')).toHaveCount(0);
  poseMapId = mapId;
  navigationState = 'LOCALIZING';
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.locator('.pt-readiness')).toContainText('Phiên điều hướng chưa sẵn sàng');
  await expect(page.getByRole('button', { name: 'Bắt đầu tuần tra', exact: true })).toBeDisabled();
  navigationState = 'READY'; robot.currentMapId = id(99);
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.locator('.pt-readiness')).toContainText('Robot chưa sử dụng bản đồ của tuyến');
  await expect(page.getByRole('button', { name: 'Bắt đầu tuần tra', exact: true })).toBeDisabled();
  robot.currentMapId = mapId;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bắt đầu tuần tra', exact: true })).toBeEnabled();
  assert.equal(writes.filter(write => write.path === '/api/v1/schedules').length, 0, 'Map/readiness checks never dispatch');
  failCreateResponse = true;
  await page.getByRole('button', { name: 'Bắt đầu tuần tra', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Bắt đầu tuần tra?', exact: true });
  await expect(review).toContainText('3 điểm · 3 vòng');
  await review.getByRole('button', { name: 'Xác nhận bắt đầu', exact: true }).click();
  await expect(page.locator('.pt-pending')).toBeVisible();
  await expect(page.locator('.pt-page')).toContainText('Cannot reach the MediAssistRover API');
  assert.equal(schedules.length, 1, 'The server accepted the first dispatch before the response was lost');
  await page.locator('.pt-pending').getByRole('button', { name: 'Kiểm tra lượt gửi', exact: true }).click();
  await expect.poll(() => schedules[0]?.status).toBe('ACTIVE');
  assert.equal(writes.filter(write => write.path === '/api/v1/schedules').length, 1, 'Recovery never creates a second schedule');
  const dispatch = writes.find(write => write.path === '/api/v1/schedules').body;
  assert.equal(dispatch.robotId, robotId); assert.equal(dispatch.workflowId, workflowId);
  assert.deepEqual(dispatch.inputTemplateJson, {}); assert.equal(dispatch.priority, 0);
  await expect(page.locator('.pt-pending')).toContainText('Chưa xác nhận robot đã bắt đầu');
  const dispatchStorageKey = await page.evaluate(() => Object.keys(sessionStorage).find(item => item.startsWith('mediassist.patrol.dispatch.v1:')));
  assert.ok(dispatchStorageKey);

  jobs = [
    { jobId, workflowId, robotId, mapId, scheduleId: schedules[0].scheduleId, jobCode: 'PATROL-20261116-001', status: 'QUEUED', rowVersion: 1, schemaVersion: 3, beOrchestrated: true, queuedAt: new Date().toISOString() },
    { jobId: id(5), workflowId, robotId: id(90), mapId, jobCode: 'PATROL-HISTORY-002', status: 'SUCCEEDED', rowVersion: 3, queuedAt: new Date().toISOString(), startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), archivedAt: new Date().toISOString() },
  ];
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  const queue = page.getByRole('region', { name: 'Hàng đợi và hoạt động tuần tra' });
  await expect(page.locator('.pt-job-detail')).toContainText('Đang chờ');
  await page.getByRole('tab', { name: /^Chờ robot/ }).click();
  await expect(page.locator('.pt-job-list [data-patrol-job-id]')).toHaveCount(1);
  await expect(page.locator(`.pt-job-list [data-patrol-job-id="${jobId}"]`)).toContainText('Đang chờ');
  await page.getByRole('tab', { name: /^Đã kết thúc/ }).click();
  await expect(page.locator('.pt-job-list [data-patrol-job-id]')).toHaveCount(1);
  await page.locator(`.pt-job-list [data-patrol-job-id="${id(5)}"]`).click();
  await expect(page.locator('.pt-job-detail')).toContainText('Đã hoàn thành');
  await expect(page.locator('.pt-job-detail .pt-action-group button')).toHaveCount(0);
  await page.getByLabel('Lọc robot trong hàng đợi', { exact: true }).selectOption(robotId);
  await expect(page.locator('.pt-job-list')).toContainText('Robot này chưa có lượt phù hợp');
  await page.getByLabel('Lọc robot trong hàng đợi', { exact: true }).selectOption('');
  await page.getByRole('tab', { name: /^Đang mở/ }).click();
  await page.locator(`.pt-job-list [data-patrol-job-id="${jobId}"]`).click();
  jobs[0] = { ...jobs[0], status: 'RUNNING', rowVersion: 2, startedAt: new Date().toISOString() };
  robot.status = 'BUSY';
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.locator('.pt-job-detail')).toContainText('Đang tuần tra');
  await expect(page.locator('.pt-route-detail .pt-checkpoints li')).toHaveCount(3);
  await expect(page.locator('.pt-map [data-patrol-leg]')).toHaveCount(2);
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No horizontal overflow at ${width}px`);
    await page.screenshot({ path: `${output}/${width === 390 ? 'mobile' : 'tablet'}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1080 });

  failJobDetail = true;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.locator('.pt-job-detail')).toContainText('Chi tiết nhiệm vụ tạm gián đoạn');
  await expect(page.locator('.pt-job-detail .pt-action-group button')).toHaveCount(0);
  failJobDetail = false;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.locator('.pt-job-detail').getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible();

  await page.locator('.pt-job-detail').getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  let action = page.getByRole('dialog');
  await action.getByLabel('Lý do', { exact: true }).fill('Tạm dừng để kiểm tra điều phối');
  await action.getByRole('button', { name: 'Yêu cầu tạm dừng', exact: true }).click();
  await expect(action).not.toBeVisible();
  await expect(page.locator('.pt-job-detail')).toContainText('Đang dừng an toàn');
  assert.equal(writes.filter(write => write.path.endsWith('/suspend')).length, 1);
  assert.equal(writes.filter(write => write.path.endsWith('/cancel')).length, 0, 'Suspend never invokes cancellation');

  jobs[0] = { ...jobs[0], status: 'SUSPENDED', rowVersion: jobs[0].rowVersion + 1 };
  holds.push({ source: 'VOICE', sourceId: id(80), createdAt: new Date().toISOString() }, { source: 'INCIDENT', sourceId: id(81), createdAt: new Date().toISOString() });
  round = 2;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.locator('.pt-job-detail')).toContainText('Đang giao tiếp với bệnh nhân');
  await expect(page.locator('.pt-job-detail')).toContainText('Đang xử lý SOS');
  await page.locator('.pt-job-detail').getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  action = page.getByRole('dialog');
  await action.getByLabel('Lý do', { exact: true }).fill('Cho phép tự tiếp tục sau công việc ưu tiên');
  await action.getByRole('button', { name: 'Yêu cầu tiếp tục', exact: true }).click();
  await expect(action).not.toBeVisible();
  assert.equal(jobs[0].jobId, jobId, 'Resume keeps the same patrol job');
  assert.equal(jobs[0].status, 'SUSPENDED', 'External holds keep the patrol suspended');
  assert.ok(holds.every(hold => hold.source !== 'MANUAL'));
  assert.equal(holds.length, 2, 'Resume never clears SOS or voice holds');
  await expect(page.locator('.pt-job-detail')).toContainText('Đang xử lý SOS');
  await page.screenshot({ path: `${output}/suspended.png`, fullPage: true });

  await page.locator('.pt-job-detail').getByRole('button', { name: 'Kết thúc lượt', exact: true }).click();
  action = page.getByRole('dialog');
  await action.getByLabel('Lý do', { exact: true }).fill('Kết thúc lượt kiểm thử');
  await action.getByRole('button', { name: 'Kết thúc lượt', exact: true }).click();
  await expect(action).not.toBeVisible();
  await expect(page.locator('.pt-job-detail')).toContainText('Đang chờ kết thúc an toàn');
  assert.equal(writes.filter(write => write.path.endsWith('/cancel')).length, 1);
  await expect(page.locator('.pt-job-detail').getByRole('button', { name: 'Tiếp tục', exact: true })).toHaveCount(0);

  jobs[0] = { ...jobs[0], status: 'CANCELLED', stopStatus: 'PENDING', endedAt: new Date().toISOString(), rowVersion: jobs[0].rowVersion + 1 };
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.locator('.pt-job-detail')).toContainText('Đang chờ kết thúc an toàn');
  await page.getByRole('tab', { name: /^Tạm dừng/ }).click();
  await expect(page.locator(`.pt-job-list [data-patrol-job-id="${jobId}"]`)).toBeVisible();
  await page.getByRole('tab', { name: /^Đã kết thúc/ }).click();
  await expect(page.locator(`.pt-job-list [data-patrol-job-id="${jobId}"]`)).toHaveCount(0);
  jobs[0] = { ...jobs[0], stopStatus: 'CONFIRMED', stopConfirmedAt: new Date().toISOString(), rowVersion: jobs[0].rowVersion + 1 };
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.locator(`.pt-job-list [data-patrol-job-id="${jobId}"]`)).toContainText('Đã kết thúc');
  await expect(page.locator('.pt-job-detail')).not.toContainText('Đang chờ kết thúc an toàn');
  await expect(page.locator('.pt-job-detail .pt-action-group button')).toHaveCount(0);

  // A run can finish while the page is closed. Recover its terminal job rather
  // than leaving a retired schedule labelled as an unconfirmed dispatch.
  jobs[0] = { ...jobs[0], status: 'SUCCEEDED', cancelRequestedAt: null, endedAt: new Date().toISOString(), rowVersion: jobs[0].rowVersion + 1 };
  holds = []; schedules[0].status = 'RETIRED'; robot.status = 'IDLE';
  await page.evaluate(({ schedule, name, key }) => {
    sessionStorage.setItem(key, JSON.stringify({ code: schedule.scheduleCode, body: schedule, scheduleId: schedule.scheduleId, workflowName: name }));
  }, { schedule: schedules[0], name: workflow.workflowName, key: dispatchStorageKey });
  await page.reload();
  await expect(page.locator('.pt-job-detail')).toContainText('Đã hoàn thành');
  await expect(page.locator('.pt-pending')).toHaveCount(0);

  // The drawing is optional and must match the exact raster identity.
  presentationStatus = 404;
  await page.reload();
  await expect(page.locator('.pt-map-canvas')).toHaveAttribute('data-map-view', 'original');
  await expect(page.locator('.pt-map image')).toHaveCount(1);
  await expect(page.locator('.pt-map [data-feature-id]')).toHaveCount(0);
  presentationStatus = 200; published.source.assetHash = 'b'.repeat(64);
  await page.reload();
  await expect(page.locator('.pt-map-canvas')).toHaveAttribute('data-map-view', 'original');
  await expect(page.locator('.pt-map [data-feature-id]')).toHaveCount(0);
  published.source.assetHash = hash;
  await page.reload();
  await expect(page.locator('.pt-map-canvas')).toHaveAttribute('data-map-view', 'published');
  await expect(page.locator('.pt-map [data-feature-id="hospital-room"]')).toBeVisible();

  const beforeUnknownLink = writes.length;
  await page.goto(`${base}/admin/patrol?workflowId=${id(99)}`);
  await expect(page.locator('.pt-route-detail')).toContainText('Không tìm thấy quy trình này');
  await expect(page.getByRole('button', { name: 'Bắt đầu tuần tra', exact: true })).toBeDisabled();
  assert.equal(writes.length, beforeUnknownLink, 'An unknown workflow link issues no commands');

  empty = true; jobs = []; holds = []; schedules = [];
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${base}/admin/patrol`);
  await expect(page.locator('.pt-page')).toContainText('Chưa có tuyến tuần tra');
  await expect(page.getByRole('button', { name: 'Bắt đầu tuần tra', exact: true })).toBeDisabled();
  await page.screenshot({ path: `${output}/empty.png`, fullPage: true });
  catalogFailure = true;
  await page.reload();
  await expect(page.locator('.pt-page')).toContainText('Chưa tải được dữ liệu tuần tra');
  await expect(page.getByRole('button', { name: 'Bắt đầu tuần tra', exact: true })).toBeDisabled();
  await page.screenshot({ path: `${output}/disconnected.png`, fullPage: true });
  assert.deepEqual(errors, [], 'No browser runtime errors');
  assert.deepEqual(unknownApis, [], 'Every mutation is explicitly mocked');
  assert.deepEqual(simulationRequests, [], 'The removed simulation route never contacts the simulator');
  for (const resource of [`/api/v1/admin/workflows/${workflowId}`, `/api/v1/jobs/${id(5)}`, `/api/v1/schedules/${id(70)}`]) {
    assert.ok(reads.some(read => read.path === resource && read.query.includeDeleted === 'true'), `${resource} preserves archived/retired detail visibility`);
  }
  console.log('Patrol workspace browser checks passed: map, live pose, readiness, queue/history, stop confirmation, dispatch recovery, controls and responsive UI');
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  console.error({ errors, unknownApis });
  throw error;
} finally { await browser.close(); }
