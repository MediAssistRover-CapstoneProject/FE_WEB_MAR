import { addStep, connect, newDocument, renameVariable } from './designerModel.js';
import { readDrafts, writeDraft } from './designerStorage.js';

export const SERVO_DEMO_CODE = 'WF_MOVE_A_SERVO_5S_MOVE_B';
export const SERVO_DEMO_NAME = 'Đến A → mở servo → chờ 5 giây → đóng servo → đến B';

export function createServoDemoDraft() {
  let document = newDocument();
  document.workflow = { ...document.workflow, workflowCode: SERVO_DEMO_CODE, workflowName: SERVO_DEMO_NAME, serviceType: 'ROBOT_TEST', description: 'Đi đến điểm A, mở servo không yêu cầu xác thực, đợi đúng 5 giây, đóng servo rồi đi đến điểm B. Chọn bản đồ và hai điểm khi điều phối.', requiredCapabilitiesJson: ['MOVE', 'CONTROL_HARDWARE', 'WAIT'], maxDurationSec: 600, maxTotalVisits: 5 };
  const steps = [
    ['MOVE_A', 'MOVE', 'Đi đến điểm A'],
    ['OPEN_SERVO', 'CONTROL_HARDWARE', 'Mở servo tại A'],
    ['WAIT_5_SECONDS', 'WAIT', 'Chờ 5 giây'],
    ['CLOSE_SERVO', 'CONTROL_HARDWARE', 'Đóng servo'],
    ['MOVE_B', 'MOVE', 'Đi đến điểm B'],
  ];
  let previous = 'start';
  steps.forEach(([id, type, name], index) => {
    document = addStep(document, type, { x: 310 + index * 270, y: 170 });
    const node = document.nodes.at(-1);
    node.id = id; node.data.name = name; node.data.auditLevel = 'FULL';
    if (type === 'CONTROL_HARDWARE') { node.data.params.action = id === 'OPEN_SERVO' ? 'UNLOCK_COMPARTMENT' : 'LOCK_COMPARTMENT'; node.data.timeoutSec = 20; }
    if (type === 'WAIT') { node.data.params = { wait_type: 'DURATION', duration_sec: 5 }; node.data.timeoutSec = 15; }
    document = connect(document, { source: previous, target: id, sourceHandle: 'SUCCESS' });
    previous = id;
  });
  document.nodes.find(node => node.id === 'end').position = { x: 1660, y: 170 };
  document = connect(document, { source: previous, target: 'end', sourceHandle: 'SUCCESS' });
  document = renameVariable(document, 'destination_1_endpoint_id', 'point_a_endpoint_id');
  document = renameVariable(document, 'destination_2_endpoint_id', 'point_b_endpoint_id');
  document.variables.find(variable => variable.key === 'point_a_endpoint_id').label = 'Điểm A';
  document.variables.find(variable => variable.key === 'point_b_endpoint_id').label = 'Điểm B';
  document.variables.push({ key: 'hardware_test_mode', label: 'Chế độ thử servo', kind: 'string', required: true, defaultValue: 'COMMISSIONING_ONLY', schema: { type: 'string', const: 'COMMISSIONING_ONLY' } });
  document.workflow.defaultInputsJson = { hardware_test_mode: 'COMMISSIONING_ONLY' };
  return document;
}

// Seed this requested starter once per account/API without replacing existing drafts.
// The marker also prevents a deleted starter from being recreated on every reload.
export function ensureServoDemoDraft(storage, key) {
  const marker = key + ':servo-ab-starter-v1';
  if (storage.getItem(marker)) return;
  const drafts = readDrafts(storage, key);
  if (!drafts.some(entry => entry.document.workflow.workflowCode === SERVO_DEMO_CODE)) writeDraft(storage, key, { document: createServoDemoDraft(), syncFingerprint: null });
  storage.setItem(marker, 'created');
}
