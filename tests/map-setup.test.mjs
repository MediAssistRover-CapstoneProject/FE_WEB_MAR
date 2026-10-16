import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraft, removeEndpoint, removeEndpointGroup, saveMap, mapIssues, loadDraft, pointAllowed } from '../src/pages/Admin/mapStudioModel.js';
import { ZONE_TYPES, ZONE_SETUP_TYPES, ZONE_ROBOT_POLICY } from '../src/pages/Admin/zoneCatalog.js';

test('setup offers exactly three zone types with explicit robot policies', () => {
  assert.deepEqual(ZONE_SETUP_TYPES.map(t => t.id), ['KEEP_OUT', 'SPEED', 'NO_STOP']);
  for (const type of ZONE_SETUP_TYPES) assert.ok(ZONE_ROBOT_POLICY[type.id]);
});

test('setup zone colors are distinct', () => {
  assert.equal(new Set(ZONE_SETUP_TYPES.map(type => type.color.toLowerCase())).size, ZONE_SETUP_TYPES.length);
  assert.deepEqual(ZONE_TYPES, ZONE_SETUP_TYPES);
});

const draft = () => ({ ...createDraft(), scan: { status: 'complete', progress: 100 },
  endpoints: [
    { id: 'home', name: 'Gốc', type: 'PARK', x: 580, y: 330, heading: 90 },
    { id: 'pickup', name: 'Nhận thuốc', type: 'WAYPOINT', x: 815, y: 245, heading: 180, queueId: 'home', tasks: [{ action: 'LOAD', seconds: 7 }] },
  ],
  endpointGroups: [{ id: 'g', code: 'G', name: 'Nhóm', active: true, selectionPolicy: 'PRIORITY', members: [{ endpointId: 'home', sequenceNo: 1 }, { endpointId: 'pickup', sequenceNo: 2 }] }],
});

test('speed zone and endpoints without headings survive save and reload without blocking travel', () => {
  const value = draft();
  value.endpoints = value.endpoints.map(({ heading, ...endpoint }) => endpoint);
  value.zones = [{ id: 'slow', name: 'Khu chậm', type: 'SPEED', speed:.3, enabled: true, points: [{x:540,y:315},{x:620,y:315},{x:620,y:355},{x:540,y:355}] }];
  assert.deepEqual(mapIssues(value), []);
  assert.ok(pointAllowed(value, value.endpoints[0]));
  const saved = saveMap(value, '2026-10-14');
  assert.deepEqual(loadDraft({ getItem: () => JSON.stringify(saved) }), saved);
});

test('deleting a group preserves endpoints, other groups and the saved snapshot', () => {
  const before = draft();
  before.endpointGroups.push({ ...before.endpointGroups[0], id: 'other', code: 'OTHER', name: 'Khác' });
  const saved = saveMap(before, '2026-10-14');
  const original = structuredClone(saved);
  const after = removeEndpointGroup(saved, 'g');
  assert.deepEqual(saved, original);
  assert.deepEqual(after.endpoints, saved.endpoints);
  assert.deepEqual(after.endpointGroups, [saved.endpointGroups[1]]);
  assert.deepEqual(after.saved, saved.saved);
  assert.equal(after.revision, saved.revision + 1);
  assert.deepEqual(mapIssues(after), []);
  assert.deepEqual(loadDraft({ getItem: () => JSON.stringify(after) }), after);
  assert.equal(removeEndpointGroup(after, 'missing'), after);
});

test('deleted legacy group is not recreated on reload, even when it was the last group', () => {
  const before = draft();
  delete before.endpointGroups;
  before.endpoints = before.endpoints.map(e => ({ ...e, group: 'Cũ' }));
  const after = removeEndpointGroup(before, 'Cũ');
  assert.deepEqual(after.endpointGroups, []);
  assert.deepEqual(after.endpoints, before.endpoints);
  assert.deepEqual(loadDraft({ getItem: () => JSON.stringify(after) }).endpointGroups, []);
});

test('deletion cleans references, preserves metadata and published snapshot, survives reload', () => {
  const before = saveMap(draft(), '2026-10-14');
  assert.ok(before.saved);
  const original = structuredClone(before);
  const after = removeEndpoint(before, 'home');
  assert.deepEqual(before, original, 'does not mutate input');
  assert.equal(after.revision, before.revision + 1);
  assert.deepEqual(after.saved, before.saved);
  assert.deepEqual(after.endpointGroups[0].members, [{ endpointId: 'pickup', sequenceNo: 2 }]);
  assert.equal(after.endpoints[0].queueId, undefined);
  assert.deepEqual(after.endpoints[0].tasks, before.endpoints[1].tasks);
  assert.deepEqual(mapIssues(after), []);
  assert.deepEqual(loadDraft({ getItem: () => JSON.stringify(after) }), after);
  const saved = saveMap(after, '2026-10-15');
  assert.equal(saved.saved.snapshot.endpoints.length, 1);
});

test('legacy groups and exit references are cleaned; deleting last endpoint requires replacement', () => {
  const before = draft();
  delete before.endpointGroups;
  before.endpoints = before.endpoints.map(e => ({ ...e, group: 'Cũ', queueId: undefined, exitId: e.id === 'pickup' ? 'home' : undefined }));
  const after = removeEndpoint(before, 'home');
  assert.equal(after.endpoints[0].exitId, undefined);
  assert.equal(after.endpointGroups[0].members.length, 1);
  assert.equal(removeEndpoint(after, 'missing'), after);
  const empty = removeEndpoint(after, 'pickup');
  assert.deepEqual(empty.endpointGroups[0].members, []);
  assert.ok(mapIssues(empty).includes('Add at least one endpoint.'));
});
