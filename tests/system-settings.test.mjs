import assert from 'node:assert/strict';
import test from 'node:test';
import { mqttChange, retentionSpec, settingPayload, settingSpecs } from '../src/features/admin/systemSettings.js';
import { createSystemSettingsApi } from '../src/features/admin/systemSettingsApi.js';

test('numeric overrides respect the bounds the backend actually reads', () => {
  const key = 'operations.robot_offline_threshold_seconds', spec = settingSpecs[key];
  for (const input of ['', '9', '3601', '30.5', 'NaN']) assert.throws(() => settingPayload(null, key, spec, input));
  const row = { category: 'OPERATIONS', description: 'Existing description', publicSetting: true, settingValue: { value: 30 } };
  assert.deepEqual(settingPayload(row, key, spec, '60'), { settingValue: { value: 60 }, dataType: 'NUMBER', category: 'OPERATIONS', description: row.description, publicSetting: true });
  assert.equal(settingPayload(null, key, spec, 10).settingKey, key);
  assert.equal(settingPayload(null, key, spec, 3600).settingValue.value, 3600);
  assert.equal(settingPayload({ ...row, description: null }, key, spec, 60).description, null);
});

test('retention recipients share the Alert policy rather than creating an unused key', () => {
  assert.equal(retentionSpec('alert_recipient', 'days').key, 'retention.alert_days');
  assert.equal(retentionSpec('alert_recipient', 'mode').key, 'retention.alert_mode');
  assert.throws(() => retentionSpec('unknown', 'days'));
  assert.throws(() => settingPayload(null, 'retention.default_mode', settingSpecs['retention.default_mode'], 'INVALID'));
  assert.throws(() => settingPayload(null, 'retention.execution_enabled', settingSpecs['retention.execution_enabled'], 'false'));
});

test('MQTT writes carry the current revision, require a reason and only move forward one stage', () => {
  const status = { rollout: { mode: 'LEGACY_COMPATIBLE', revision: 7 }, mqttEnabled: true, robots: [{}], legacyJobsBlockingCutover: 0 };
  assert.deepEqual(mqttChange(status, 'DRAINING', true, ' Maintenance '), { mode: 'DRAINING', dispatchHalted: true, expectedRevision: 7, note: 'Maintenance' });
  assert.throws(() => mqttChange(status, 'MQTT_ONLY', false, 'Cutover'));
  assert.throws(() => mqttChange(status, 'DRAINING', false, '  '));
  const draining = { ...status, rollout: { mode: 'DRAINING', revision: 8 } };
  assert.throws(() => mqttChange(draining, 'LEGACY_COMPATIBLE', false, 'Rollback'));
  assert.throws(() => mqttChange({ ...draining, legacyJobsBlockingCutover: 1 }, 'MQTT_ONLY', false, 'Cutover'));
  assert.equal(mqttChange(draining, 'MQTT_ONLY', false, 'Cutover').expectedRevision, 8);
});

test('settings adapter uses the controller methods, pagination, body wrapper and retention query', async () => {
  const calls = [];
  const api = createSystemSettingsApi(async (path, options) => {
    calls.push({ path, options });
    if (path.includes('system-settings?page=0')) return { content: Array.from({ length: 100 }, (_, i) => ({ systemSettingId: `${i}` })), totalPages: 2 };
    if (path.includes('system-settings?page=1')) return { content: [{ systemSettingId: 'last' }], last: true };
    return {};
  });
  assert.equal((await api.listSettings()).length, 101);
  const body = settingPayload(null, 'retention.batch_size', settingSpecs['retention.batch_size'], 200);
  await api.saveSetting(null, body);
  await api.saveSetting({ systemSettingId: 'setting-id' }, body);
  await api.mqttStatus();
  await api.changeMqtt({ mode: 'DRAINING', dispatchHalted: true, expectedRevision: 4, note: 'Maintenance' });
  await api.retentionPolicies();
  await api.runRetention(true);
  await api.runRetention(false);
  assert.deepEqual(calls.slice(2).map(call => [call.path, call.options.method || 'GET']), [
    ['/api/v1/admin/system-settings', 'POST'], ['/api/v1/admin/system-settings/setting-id', 'PUT'],
    ['/api/v1/admin/mqtt-rollout', 'GET'], ['/api/v1/admin/mqtt-rollout', 'PUT'],
    ['/api/v1/admin/operations/retention/policies', 'GET'], ['/api/v1/admin/operations/retention/runs?dryRun=true', 'POST'],
    ['/api/v1/admin/operations/retention/runs?dryRun=false', 'POST'],
  ]);
  assert.equal(calls.at(-1).options.body, undefined);
  assert.equal(calls.at(-1).options.retry, false);
  await api.runRetention();
  assert.equal(calls.at(-1).path, '/api/v1/admin/operations/retention/runs?dryRun=true');
});
