import test from 'node:test';
import assert from 'node:assert/strict';
import contract from '../src/features/api/backendContract.json' with { type: 'json' };
import { vi } from '../src/i18n/vi.js';
import { fieldLabels, fieldLabel, recordTitle, recordStatus, settingDisplayValue, statusTone, resources } from '../src/features/api/workspaceCatalog.js';
import { buildRequest } from '../src/features/api/contract.js';

test('retention policies and metadata lists have distinct domain titles and correct identities', () => {
  const datasets = ['alert_recipient', 'alert', 'emergency_incident', 'detection_event', 'job_event', 'robot_status_history', 'robot_location_history', 'crowd_density_record', 'heatmap_record', 'audit_log'];
  const titles = datasets.map(dataset => recordTitle({ dataset, retentionDays: 365, mode: 'DISABLED' }));
  assert.equal(new Set(titles).size, 10);
  assert.ok(titles.every(title => !title.includes('_') && title !== 'Bản ghi'));
  assert.equal(recordTitle({ voiceCommandId: '1', sequenceNo: 2 }), 'Lệnh giọng nói · Lượt 2');
  assert.equal(recordTitle({}, { title: 'Ca trực' }), 'Ca trực');
  for (const [name, id] of Object.entries({ detections: 'detectionEventId', interactions: 'voiceInteractionId', commands: 'voiceCommandId' })) assert.equal(resources.find(r => r.id === name).idField, id);
  assert.ok(!resources.some(r => ['crowd', 'heatmaps'].includes(r.id)));
});

test('all known response fields and enum values have display labels', () => {
  const fields = new Set(), enums = new Set();
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.properties) Object.keys(value.properties).forEach(key => fields.add(key));
    value.enum?.forEach(key => enums.add(key));
    Object.values(value).forEach(walk);
  }
  walk(contract);
  assert.deepEqual([...fields].filter(key => !fieldLabels[key]), []);
  assert.deepEqual([...enums].filter(key => vi(key) === key), []);
  assert.equal(fieldLabel('jobsByStatus'), 'Công việc theo trạng thái');
});

test('friendly labels do not change API enum or setting identifiers', () => {
  assert.equal(vi('RECOVERY_REQUIRED'), 'Cần phục hồi');
  assert.equal(statusTone('RECOVERY_REQUIRED'), 'danger');
  const request = buildRequest('GET /api/v1/service-requests', { query: { status: 'RECOVERY_REQUIRED' } });
  assert.ok(request.url.includes('status=RECOVERY_REQUIRED'));
  assert.equal(resources.find(row => row.id === 'settings').idField, 'systemSettingId');
});

test('settings display typed zero and false with units, without raw keys', () => {
  const setting = { settingKey: 'operations.robot_offline_threshold_seconds', settingValue: { value: 0 } };
  assert.equal(settingDisplayValue(setting), '0 giây');
  assert.ok(!recordTitle(setting).includes('_'));
  assert.equal(settingDisplayValue({ settingValue: { value: false } }), 'Tắt');
  assert.equal(settingDisplayValue({ settingKey: 'retention.audit_log_days', settingValue: { value: 1095 } }), '1095 ngày');
});

test('audit and job titles are useful while missing statuses remain empty', () => {
  assert.equal(recordTitle({ actionCode: 'LOGIN_SUCCEEDED' }), 'Đăng nhập thành công');
  assert.equal(recordTitle({ jobCode: 'JOB-123', workflowName: 'Giao thuốc' }), 'Giao thuốc');
  assert.equal(recordTitle({ jobCode: 'JOB-123' }), 'Công việc robot');
  assert.equal(recordStatus({ actionCode: 'LOGIN_SUCCEEDED' }), undefined);
  assert.equal(recordStatus({ active: false }), 'INACTIVE');
});
