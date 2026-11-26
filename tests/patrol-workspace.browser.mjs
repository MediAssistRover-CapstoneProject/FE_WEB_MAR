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
let modernBackend = false, loseJobResponse = false, loseSubmitResponse = true, loseRetireResponse = true, metadataUnavailable = false;
const receipts = new Map();
const request = { serviceRequestId: id(93), requestCode: 'REQ-CROWD-01', requestType: 'CROWD_MONITORING', status: 'DRAFT' };
const templateId = id(91);
const template = { ...workflow, workflowId: templateId, workflowName: 'Tuần tra 3 điểm', workflowCode: 'WF_PATROL_TEMPLATE_3', defaultInputsJson: {}, inputUiJson: { patrol_template: { version: 1, checkpointCount: 3 } } };
const draftWorkflow = { ...workflow, workflowId: id(85), workflowName: 'Tuyến nháp', serviceType: 'patrol', status: 'DRAFT', acceptsNewJobs: false };
let savedRoutes = [], newTemplates = [], onlyDraft = false, robotCatalogFailure = false, noMaps = false, omitTemplateSummaries = false;
const savedTemplates = () => [...(modernBackend && !empty ? [template] : []), ...newTemplates];
const savedPublished = () => [...(empty ? [] : [workflow]), ...savedTemplates(), ...savedRoutes.map(item => item.workflow)];
const navigate = title => page.getByRole('navigation', { name: 'Điều hướng tuần tra' }).getByRole('link', { name: title, exact: true }).click();
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
    if (path === '/api/v1/schedules') { const schedule = { ...body, scheduleId: id(70 + schedules.length), status: 'PAUSED' }; schedules.push(schedule); if (failCreateResponse) { failCreateResponse = false; return route.abort('failed'); } return reply(schedule); }
    const schedule = schedules.find(item => path.startsWith(`/api/v1/schedules/${item.scheduleId}/`));
    if (schedule && path.endsWith('/activate')) { schedule.status = 'ACTIVE'; return reply(schedule); }
    if (schedule && path.endsWith('/pause')) { schedule.status = 'PAUSED'; return reply(schedule); }
    if (schedule && path.endsWith('/retire') && body.reason.trim().length >= 5) {
      schedule.status = 'RETIRED';
      if (loseRetireResponse) { loseRetireResponse = false; return route.abort('failed'); }
      return reply(schedule);
    }
    if (path === '/api/v1/admin/patrol-workflows/templates' && modernBackend) {
      const count = body.checkpointCount;
      const saved = { ...template, workflowId: id(300 + count), workflowCode: `WF_PATROL_TEMPLATE_${count}`, workflowName: `Tuần tra ${count} điểm`, inputUiJson: { patrol_template: { version: 1, checkpointCount: count } } };
      assert.ok(!savedTemplates().some(item => item.inputUiJson.patrol_template.checkpointCount === count), 'An existing template should be opened directly');
      newTemplates.push(saved);
      return reply({ workflowId: saved.workflowId, checkpointCount: count, available: true });
    }
    if (modernBackend && [workflowId, templateId].some(value => path === `/api/v1/workflows/${value}/jobs`)) {
      const key = req.headers()['idempotency-key'];
      assert.ok(key && !receipts.has(key));
      const job = { jobId: id(200 + receipts.size), jobCode: `PT-${receipts.size + 1}`, workflowId: path.split('/')[4], robotId, mapId, status: 'QUEUED', queuedAt: new Date().toISOString() };
      receipts.set(key, job); jobs.push(job);
      if (loseJobResponse) { loseJobResponse = false; return route.abort('failed'); }
      return reply(job);
    }
    if (path === `/api/v1/service-requests/${request.serviceRequestId}/submit` && request.status === 'DRAFT') {
      request.status = 'QUEUED';
      jobs.push({ jobId: id(94), jobCode: 'MON-01', workflowId: id(95), serviceRequestId: request.serviceRequestId, robotId, status: 'QUEUED' });
      if (loseSubmitResponse) { loseSubmitResponse = false; return route.abort('failed'); }
      return reply(request);
    }
    if (path === '/api/v1/admin/patrol-workflows/preview') return reply({ workflow: {}, graph: {} });
    if (path === '/api/v1/admin/patrol-workflows') {
      createdWorkflow = body;
      const saved = { ...workflow, workflowId: id(310 + savedRoutes.length), workflowCode: `WF_PATROL_${310 + savedRoutes.length}`, workflowName: body.name, defaultInputsJson: { map_id: body.mapId, patrol_repeat_count: body.repeatCount } };
      const routeSteps = body.checkpoints.flatMap((point, index) => [
        { ...steps[0], stepId: id(30 + index * 2), sequenceNo: index * 2 + 1, paramsJson: { ...steps[0].paramsJson, map_id: body.mapId, endpoint_id: point.endpointId } },
        { ...steps[1], stepId: id(31 + index * 2), sequenceNo: index * 2 + 2, paramsJson: { ...steps[1].paramsJson, sensing_type: point.sensingType, zone_id: point.zoneId } },
      ]);
      savedRoutes.push({ workflow: saved, steps: routeSteps, transitions: routeSteps.map((step, index) => ({ ...transitions[0], transitionId: id(50 + index), fromStepId: step.stepId, toStepId: routeSteps[index + 1]?.stepId || null, terminalStatus: index + 1 === routeSteps.length ? 'SUCCEEDED' : null })) });
      return reply({ workflowId: saved.workflowId, mapId: body.mapId, checkpointCount: body.checkpoints.length });
    }
    if (path === `/api/v1/jobs/${jobId}/suspend`) { jobs[0] = { ...jobs[0], status: 'SUSPENDING', rowVersion: jobs[0].rowVersion + 1 }; holds = [{ source: 'MANUAL', sourceId: null, createdAt: new Date().toISOString() }]; return reply(jobDetail(jobs[0])); }
    if (path === `/api/v1/jobs/${jobId}/resume`) { holds = holds.filter(h => h.source !== 'MANUAL'); jobs[0] = { ...jobs[0], status: holds.length ? 'SUSPENDED' : 'RUNNING', rowVersion: jobs[0].rowVersion + 1 }; return reply(jobDetail(jobs[0])); }
    if (path === `/api/v1/jobs/${jobId}/cancel`) { jobs[0] = { ...jobs[0], cancelRequestedAt: new Date().toISOString(), rowVersion: jobs[0].rowVersion + 1 }; return reply(jobs[0]); }
    unknownApis.push(`${method} ${path}`); return reply({ message: 'Unmocked mutation forbidden' }, 500);
  }
  reads.push({ path, query: Object.fromEntries(url.searchParams) });
  if (path.endsWith('/stream')) return reply({ message: 'Use mocked REST' }, 503);
  if (path === '/api/v1/auth/me') return reply({ accountId: 'patrol-test-admin', username: 'patrol-test', role: 'ADMIN' });
  if (path === '/api/v1/admin/workflows') return metadataUnavailable ? reply({ message: 'Catalog unavailable' }, 503) : list([...savedPublished(), ...(!empty || onlyDraft ? [draftWorkflow] : [])]);
  if (path === '/api/v1/workflows/published') return catalogFailure ? reply({ message: 'Máy chủ tạm mất kết nối' }, 503) : list(savedPublished().filter(item => !omitTemplateSummaries || !item.inputUiJson?.patrol_template).map(({ workflowId, workflowCode, workflowName, serviceType }) => ({ workflowId, workflowCode, workflowName, serviceType })));
  if (path === `/api/v1/workflows/published/${workflowId}` && !empty) return reply(detail);
  if (path.startsWith('/api/v1/workflows/published/')) {
    const selectedId = path.split('/').at(-1);
    const saved = savedRoutes.find(item => item.workflow.workflowId === selectedId);
    const savedTemplate = savedTemplates().find(item => item.workflowId === selectedId);
    return saved ? reply(saved) : savedTemplate ? reply({ workflow: savedTemplate, steps: [], transitions: [] }) : reply({ message: 'Không tìm thấy quy trình này' }, 404);
  }
  if (path === '/api/v1/admin/patrol-workflows/templates') return modernBackend ? reply(Array.from({ length: 9 }, (_, index) => {
    const count = index + 3;
    const saved = savedTemplates().find(item => item.inputUiJson.patrol_template.checkpointCount === count);
    return { workflowId: saved?.workflowId || null, checkpointCount: count, available: !!saved };
  })) : reply({ message: 'Route not found' }, 404);
  if (path.endsWith('/jobs/by-idempotency-key')) {
    if (!modernBackend) return reply({ message: 'Route not found' }, 404);
    const job = receipts.get(url.searchParams.get('key'));
    return job ? reply(job) : route.fulfill({ status: 204 });
  }
  if (path === '/api/v1/service-requests') return list(url.searchParams.get('requestType') === request.requestType ? [request] : []);
  if (path === `/api/v1/service-requests/${request.serviceRequestId}`) return reply(request);
  if (path === '/api/v1/maps') return list(noMaps ? [] : [map, { ...map, mapId: id(81), mapName: 'Khu nội trú' }]);
  if (path === '/api/v1/endpoints') return list(endpoints);
  if (path === '/api/v1/zones') return list(zones);
  if (path === '/api/v1/robots') return robotCatalogFailure ? reply({ message: 'Robot catalog unavailable' }, 503) : list([robot]);
  if (path === `/api/v1/robots/${robotId}/snapshot`) return reply({ observedAt: new Date().toISOString(), robot, mqttConnected: true, heartbeatFresh: true, dispatchReady: true, activeJobId: jobs.some(j => j.status === 'RUNNING') ? jobId : null, suspendedPatrolJobIds: jobs.some(j => j.status === 'SUSPENDED') ? [jobId] : [], navigationSession: { state: navigationState, sessionId: id(89), mapId }, latestPose: { robotId, mapId: poseMapId, xM: 2.8, yM: 3, yawRad: .35, frameId: 'map', fresh: true, capturedAt: new Date().toISOString() } });
  if (path === '/api/v1/jobs') return list(jobs.filter(job => (!url.searchParams.get('status') || job.status === url.searchParams.get('status')) && (!url.searchParams.get('workflowId') || job.workflowId === url.searchParams.get('workflowId')) && (!url.searchParams.get('robotId') || job.robotId === url.searchParams.get('robotId')) && (!url.searchParams.get('requestId') || job.serviceRequestId === url.searchParams.get('requestId'))));
  if (path.startsWith('/api/v1/jobs/')) {
    const job = jobs.find(item => path === `/api/v1/jobs/${item.jobId}`);
    return failJobDetail ? reply({ message: 'Chi tiết nhiệm vụ tạm gián đoạn' }, 503) : job ? reply(jobDetail(job)) : reply({ message: 'Nhiệm vụ không tồn tại' }, 404);
  }
  if (path === '/api/v1/schedules') return list(schedules.filter(item => (!url.searchParams.has('status') || item.status === url.searchParams.get('status')) && (url.searchParams.get('includeDeleted') === 'true' || item.status !== 'RETIRED')));
  if (path.startsWith('/api/v1/schedules/')) return reply(schedules.find(item => path.endsWith('/' + item.scheduleId)));
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
  await expect(page.locator('.pt-map-svg')).toBeVisible();
  await expect(page.locator('.pt-route-list')).not.toContainText('Tuyến nháp');
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
  await expect(page.locator('.pt-route-card[aria-pressed="true"]')).toContainText(createdWorkflow.name);
  await expect(page.locator('.pt-route-detail .pt-checkpoints li')).toHaveCount(5);
  await page.locator('.pt-route-list').getByRole('button', { name: new RegExp(workflow.workflowName) }).click();
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
  await navigate('Hàng đợi');
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
  await navigate('Tuyến tuần tra');
  await expect(page.locator('.pt-route-detail .pt-checkpoints li')).toHaveCount(3);
  await expect(page.locator('.pt-map [data-patrol-leg]')).toHaveCount(2);
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No horizontal overflow at ${width}px`);
    await page.screenshot({ path: `${output}/${width === 390 ? 'mobile' : 'tablet'}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1080 });

  await navigate('Hàng đợi');
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
  await navigate('Tuyến tuần tra');
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
  await expect(page.getByRole('alert')).toContainText('Không tìm thấy tuyến đã phát hành');
  await expect(page.locator('.pt-dispatch')).toHaveCount(0);
  assert.equal(writes.length, beforeUnknownLink, 'An unknown workflow link issues no commands');

  modernBackend = true; jobs = []; schedules = []; robot.status = 'OFFLINE';
  await page.goto(`${base}/admin/patrol?workflowId=${workflowId}`);
  await page.getByRole('button', { name: 'Lập lịch tuyến', exact: true }).click();
  const fixedSchedule = page.getByRole('dialog', { name: 'Lập lịch tuyến tuần tra' });
  await fixedSchedule.getByLabel('Robot tuần tra').selectOption(robotId);
  await fixedSchedule.getByLabel('Thời điểm thực hiện').selectOption('INTERVAL');
  const previousActivations = writes.filter(write => write.path.endsWith('/activate')).length;
  await fixedSchedule.getByRole('button', { name: 'Lưu lịch tạm dừng' }).click();
  await expect(fixedSchedule).not.toBeVisible();
  assert.equal(schedules[0].status, 'PAUSED');
  assert.deepEqual(schedules[0].inputTemplateJson, {});
  assert.equal(writes.filter(write => write.path.endsWith('/activate')).length, previousActivations);
  const scheduleList = page.getByRole('region', { name: 'Lịch tuần tra', exact: true });
  await scheduleList.getByRole('button', { name: 'Chi tiết lịch' }).click();
  await expect(page.getByRole('dialog')).toContainText(schedules[0].scheduleCode);
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).click();
  await scheduleList.getByRole('button', { name: 'Kích hoạt lịch' }).click();
  await scheduleList.getByRole('button', { name: 'Tạm dừng lịch' }).click();
  await expect(scheduleList.getByRole('button', { name: 'Kích hoạt lịch' })).toBeEnabled();
  await scheduleList.getByRole('button', { name: 'Ngừng sử dụng' }).click();
  const retire = page.getByRole('dialog', { name: 'Ngừng sử dụng lịch' });
  await expect(retire.getByRole('button', { name: 'Xác nhận ngừng sử dụng' })).toBeDisabled();
  await retire.getByLabel('Lý do ngừng sử dụng', { exact: false }).fill('Kết thúc lịch kiểm thử');
  await retire.getByRole('button', { name: 'Xác nhận ngừng sử dụng' }).click();
  await expect(retire).not.toBeVisible();
  await expect(scheduleList.locator('article')).toHaveCount(0);
  assert.equal(schedules[0].status, 'RETIRED');
  assert.deepEqual(writes.find(write => write.path.endsWith('/retire')).body, { reason: 'Kết thúc lịch kiểm thử' });
  assert.equal(writes.filter(write => write.path.endsWith('/retire')).length, 1);
  await scheduleList.getByRole('button', { name: 'Xem lịch đã ngừng' }).click();
  await expect(scheduleList.locator('article')).toContainText(schedules[0].scheduleName);
  await expect(scheduleList.locator('article').getByRole('button')).toHaveCount(1);
  assert.ok(reads.some(read => read.path === '/api/v1/schedules' && read.query.status === 'RETIRED' && read.query.includeDeleted === 'true'));
  await scheduleList.getByRole('button', { name: 'Xem lịch đang dùng' }).click();

  await navigate('Hàng đợi');
  const requestPanel = page.locator('.pt-monitoring-requests');
  await requestPanel.locator('summary').click();
  await requestPanel.getByLabel('Yêu cầu đã tạo').selectOption(request.serviceRequestId);
  await requestPanel.getByRole('button', { name: 'Gửi yêu cầu vào hàng đợi' }).click();
  await expect(requestPanel.getByRole('link', { name: 'MON-01' })).toHaveAttribute('href', `/admin/live-operations?jobId=${id(94)}`);
  await expect(requestPanel.getByRole('button', { name: 'Gửi yêu cầu vào hàng đợi' })).toHaveCount(0);
  assert.equal(writes.filter(write => write.path.endsWith('/submit')).length, 1);
  assert.ok(reads.some(read => read.path === '/api/v1/jobs' && read.query.requestId === request.serviceRequestId));
  await requestPanel.getByLabel('Loại yêu cầu giám sát').selectOption('RESTRICTED_AREA_MONITORING');
  await expect(requestPanel.getByRole('link', { name: 'MON-01' })).toHaveCount(0);

  await navigate('Tuyến tuần tra');
  robot.status = 'IDLE'; loseJobResponse = true;
  await page.getByLabel('Robot tuần tra', { exact: true }).selectOption(robotId);
  await page.getByRole('button', { name: 'Bắt đầu tuần tra', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận bắt đầu' }).click();
  await expect(page.locator('.pt-pending')).toBeVisible();
  modernBackend = false;
  await page.reload();
  await page.locator('.pt-pending').getByRole('button', { name: 'Kiểm tra lượt gửi' }).click();
  await expect(page.locator('.pt-page')).toContainText('Route not found');
  assert.equal(schedules.length, 1, 'A missing lookup during recovery must not create a legacy schedule');
  modernBackend = true;
  await page.locator('.pt-pending').getByRole('button', { name: 'Kiểm tra lượt gửi' }).click();
  await expect(page.locator('.pt-pending')).toHaveCount(0);
  const fixedWrites = writes.filter(write => write.path === `/api/v1/workflows/${workflowId}/jobs`);
  assert.equal(fixedWrites.length, 1);
  assert.deepEqual(fixedWrites[0].body, { robotId, mapId, navigationSessionId: id(89), inputs: {}, priority: 0 });
  assert.equal(schedules.length, 1, 'Recovering a direct job never switches to a schedule');

  const openTemplate = async () => {
    await navigate('Tuyến tuần tra');
    const routeList = page.locator('.pt-route-list');
    await expect(routeList.getByRole('button', { name: /Tuần tra 3 điểm/ })).toHaveCount(1);
    await routeList.getByRole('button', { name: /Tuần tra 3 điểm/ }).click();
    await page.getByRole('button', { name: 'Cấu hình & giao robot' }).click();
    const form = page.getByRole('dialog', { name: 'Tạo lượt tuần tra' });
    await form.getByLabel('Robot tuần tra').selectOption(robotId);
    for (let point = 0; point < 3; point++) await form.getByLabel(`Điểm đến ${point + 1}`).selectOption(endpoints[point].endpointId);
    return form;
  };
  const templateRun = await openTemplate();
  await expect(templateRun).toContainText('Robot sẵn sàng nhận lượt');
  await templateRun.getByRole('button', { name: 'Tạo nhiệm vụ tuần tra' }).click();
  await expect(templateRun).not.toBeVisible();
  const run = writes.find(write => write.path === `/api/v1/workflows/${templateId}/jobs`);
  assert.deepEqual(run.body.inputs.checkpoints, endpoints.slice(0, 3).map(point => ({ endpoint_id: point.endpointId })));
  const plannedTemplate = await openTemplate();
  await plannedTemplate.getByLabel('Thời điểm thực hiện').selectOption('ONCE');
  await plannedTemplate.getByLabel('Kích hoạt lịch ngay sau khi lưu').check();
  await plannedTemplate.getByRole('button', { name: 'Tạo & kích hoạt lịch' }).click();
  await expect(plannedTemplate).not.toBeVisible();
  assert.equal(schedules[1].status, 'ACTIVE');
  assert.equal(schedules[1].workflowId, templateId);
  assert.deepEqual(schedules[1].inputTemplateJson, run.body.inputs);

  const interruptedRun = await openTemplate();
  loseJobResponse = true;
  await interruptedRun.getByRole('button', { name: 'Tạo nhiệm vụ tuần tra' }).click();
  await expect(interruptedRun.getByRole('button', { name: 'Kiểm tra lượt gửi' })).toBeEnabled();
  const templatePosts = writes.filter(item => item.path === `/api/v1/workflows/${templateId}/jobs`).length;
  await interruptedRun.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.goto(`${base}/admin/patrol?workflowId=${workflowId}`);
  await page.getByRole('button', { name: 'Kiểm tra lượt đã gửi' }).click();
  await interruptedRun.getByRole('button', { name: 'Kiểm tra lượt gửi' }).click();
  await expect(interruptedRun).not.toBeVisible();
  await expect(page).toHaveURL(/view=queue/);
  assert.equal(writes.filter(item => item.path === `/api/v1/workflows/${templateId}/jobs`).length, templatePosts);

  metadataUnavailable = true; omitTemplateSummaries = true;
  await page.goto(`${base}/admin/patrol?workflowId=${workflowId}`);
  await expect(page.getByLabel('Lọc tuyến theo bản đồ')).toBeDisabled();
  await expect(page.locator('.pt-route-detail')).toContainText(workflow.workflowName);
  await expect(page.getByRole('button', { name: 'Lập lịch tuyến' })).toBeEnabled();
  await expect(page.locator('.pt-route-list').getByRole('button', { name: /Tuần tra 3 điểm/ })).toHaveCount(1);
  metadataUnavailable = false; omitTemplateSummaries = false;

  empty = true; savedRoutes = []; jobs = []; holds = []; schedules = [];
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${base}/admin/patrol`);
  const library = page.getByRole('region', { name: 'Tuyến đã phát hành' });
  const newRoute = () => library.getByRole('button', { name: 'Tạo tuyến tuần tra' }).click();
  await expect(library).toContainText('Chưa có tuyến tuần tra');
  await expect(library.getByRole('button')).toHaveCount(1);
  await expect(page.locator('.pt-route-detail, .pt-dispatch')).toHaveCount(0);
  await page.screenshot({ path: `${output}/empty.png`, fullPage: false });
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(library.getByRole('button', { name: 'Tạo tuyến tuần tra' })).toBeInViewport();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${output}/empty-mobile.png` });
  await page.setViewportSize({ width: 1440, height: 1080 });
  const writesBeforeEmpty = writes.length;
  onlyDraft = true;
  await page.reload();
  await expect(library.getByRole('link', { name: draftWorkflow.workflowName })).toHaveAttribute('href', `/workflow?workflowId=${draftWorkflow.workflowId}`);
  await expect(library).toContainText('Chưa có tuyến đã phát hành');
  await expect(page.locator('.pt-dispatch')).toHaveCount(0);
  onlyDraft = false; catalogFailure = true;
  await page.reload();
  await expect(library.getByRole('alert')).toContainText('Chưa tải được danh sách tuyến');
  await expect(library).not.toContainText('Chưa có tuyến tuần tra');
  await expect(library.getByRole('button', { name: 'Tạo tuyến tuần tra' })).toHaveCount(0);
  await page.screenshot({ path: `${output}/disconnected.png`, fullPage: false });
  catalogFailure = false; noMaps = true;
  await library.getByRole('button', { name: 'Thử lại' }).click();
  await expect(library).toContainText('Chưa có tuyến tuần tra');
  await newRoute();
  const noMapForm = page.getByRole('dialog');
  await expect(noMapForm.getByRole('link', { name: 'Mở trang Bản đồ' })).toHaveAttribute('href', '/admin/map');
  await expect(noMapForm.getByRole('button', { name: 'Tạo & phát hành tuyến' })).toBeDisabled();
  await noMapForm.getByLabel('Mẫu theo số điểm').check();
  await expect(noMapForm.getByRole('button', { name: 'Tạo & phát hành mẫu' })).toBeEnabled();
  noMaps = false;
  await noMapForm.getByRole('button', { name: 'Để sau' }).click();
  assert.equal(writes.length, writesBeforeEmpty, 'Empty, draft-only and failed reads issue no writes');

  await newRoute();
  const firstRoute = page.getByRole('dialog', { name: 'Tạo tuyến tuần tra' });
  await firstRoute.getByLabel('Tên tuyến', { exact: true }).fill('Tuần tra sảnh chính');
  await firstRoute.getByLabel('Điểm đến 1').selectOption(endpoints[0].endpointId);
  await firstRoute.getByLabel('Hoạt động tại điểm 1').selectOption('PATROL_FALL');
  await firstRoute.getByRole('button', { name: 'Tạo & phát hành tuyến' }).click();
  await expect(library.locator('button[aria-pressed="true"]')).toContainText('Tuần tra sảnh chính');
  await expect(page.locator('.pt-route-detail')).toContainText(endpoints[0].endpointName);
  await expect(page).toHaveURL(new RegExp(`workflowId=${savedRoutes[0].workflow.workflowId}`));
  assert.deepEqual(writes.slice(writesBeforeEmpty).map(write => write.path), ['/api/v1/admin/patrol-workflows']);

  await library.getByLabel('Lọc tuyến theo bản đồ').selectOption(id(81));
  await expect(library).toContainText('Không có tuyến phù hợp');
  await expect(page.locator('.pt-route-detail, .pt-dispatch')).toHaveCount(0);
  await library.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await library.getByLabel('Tìm tuyến tuần tra').fill('KHÔNG KHỚP');
  await expect(library).toContainText('Không có tuyến phù hợp');
  await expect(page.locator('.pt-dispatch')).toHaveCount(0);

  await newRoute();
  const makeTemplate = page.getByRole('dialog', { name: 'Tạo tuyến tuần tra' });
  await makeTemplate.getByRole('radio', { name: 'Mẫu theo số điểm' }).check();
  await makeTemplate.getByLabel('Số điểm mỗi vòng').selectOption('5');
  await makeTemplate.getByRole('button', { name: 'Tạo & phát hành mẫu' }).click();
  await expect(library.locator('button[aria-pressed="true"]')).toContainText('Tuần tra 5 điểm');
  await expect(page.locator('.pt-route-detail')).toContainText('5 điểm mỗi vòng');
  await expect(library.getByLabel('Tìm tuyến tuần tra')).toHaveValue('');
  await expect(library.locator('.pt-route-card')).toHaveCount(2);
  await newRoute();
  await makeTemplate.getByRole('radio', { name: 'Mẫu theo số điểm' }).check();
  await makeTemplate.getByLabel('Số điểm mỗi vòng').selectOption('5');
  await makeTemplate.getByRole('button', { name: 'Mở tuyến đã có' }).click();
  await expect(library.locator('button[aria-pressed="true"]')).toContainText('Tuần tra 5 điểm');
  assert.deepEqual(writes.slice(writesBeforeEmpty + 1).map(write => write.path), ['/api/v1/admin/patrol-workflows/templates'], 'Creating or reusing a route cannot start a job or schedule');
  assert.equal(writes.filter(write => write.path === '/api/v1/admin/patrol-workflows/templates').length, 1, 'Running and scheduling existing templates never prepares another workflow');

  await library.getByLabel('Tìm tuyến tuần tra').fill(savedRoutes[0].workflow.workflowCode);
  await expect(library.locator('button[aria-pressed="true"]')).toContainText('Tuần tra sảnh chính');
  await expect(page.locator('.pt-route-detail')).toContainText('Tuần tra sảnh chính');
  await library.getByLabel('Tìm tuyến tuần tra').fill('');

  await page.getByRole('button', { name: 'Ẩn thông báo' }).click();
  await expect(page.locator('.pt-route-detail')).toContainText('Tuần tra sảnh chính');
  await page.screenshot({ path: `${output}/routes-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(library.getByRole('button', { name: /Tuần tra sảnh chính/ })).toBeInViewport();
  await page.screenshot({ path: `${output}/routes-mobile.png` });
  await page.setViewportSize({ width: 1440, height: 1080 });

  robotCatalogFailure = true;
  await page.reload();
  await expect(page.locator('.pt-notice')).toContainText('Chưa tải được dữ liệu robot');
  await expect(library.locator('.pt-route-card')).toHaveCount(2);
  await expect(library).not.toContainText('Chưa có tuyến tuần tra');
  robotCatalogFailure = false;
  const custom = { ...workflow, workflowId: id(400), workflowCode: 'CUSTOM_PATROL', workflowName: 'Lượt kiểm tra buổi tối', serviceType: 'patrol' };
  savedRoutes.push({ ...detail, workflow: custom });
  await page.goto(`${base}/admin/patrol?workflowId=${custom.workflowId}`);
  await expect(library.locator('button[aria-pressed="true"]')).toContainText(custom.workflowName);
  await expect(page.getByRole('link', { name: 'Mở điều phối quy trình' })).toHaveAttribute('href', `/admin/workflow-dispatch?workflowId=${custom.workflowId}`);
  await expect(page.locator('.pt-dispatch')).toHaveCount(0);
  assert.deepEqual(errors, [], 'No browser runtime errors');
  assert.deepEqual(unknownApis, [], 'Every mutation is explicitly mocked');
  assert.deepEqual(simulationRequests, [], 'The removed simulation route never contacts the simulator');
  assert.ok(reads.some(read => read.path === '/api/v1/workflows/published' && read.query.serviceType === 'PATROL'));
  assert.ok(reads.some(read => read.path === `/api/v1/workflows/published/${workflowId}`));
  for (const resource of [`/api/v1/jobs/${id(5)}`, `/api/v1/schedules/${id(70)}`]) {
    assert.ok(reads.some(read => read.path === resource && read.query.includeDeleted === 'true'), `${resource} preserves archived/retired detail visibility`);
  }
  console.log('Patrol browser checks passed: saved and empty route libraries, publishing and reusing templates, filters, partial API failures, dispatch, schedules, monitoring, recovery and responsive layout.');
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  console.error({ errors, unknownApis });
  throw error;
} finally { await browser.close(); }
