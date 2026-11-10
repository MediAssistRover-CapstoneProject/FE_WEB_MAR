import test from 'node:test';
import assert from 'node:assert/strict';
import { missionProgress } from '../src/features/operations/missionProgress.js';

const job = { jobId: 'job', status: 'RUNNING', selectedJobStepId: 'move' };
const move = { jobStepId: 'move', executionSequenceNo: 1, stepTypeSnapshot: 'MOVE', status: 'RUNNING', resolvedInputsJson: { endpoint_id: 'room' } };
const receive = { jobStepId: 'receive', executionSequenceNo: 2, stepTypeSnapshot: 'HANDLE_PAYLOAD', status: 'PENDING' };
const detail = (overrides = {}, steps = [receive, move]) => ({ job: { ...job, ...overrides }, steps });

test('uses BE selection and execution order, resolves the current target without fetching', () => {
  const model = missionProgress(detail(), { endpoints: [{ endpointId: 'room', endpointName: 'Phòng 03' }] });
  assert.equal(model.index, 0);
  assert.equal(model.target, 'Phòng 03');
  assert.equal(model.status.tone, 'running');
});

test('success waits for BE to select and start the next step', () => {
  const steps = [{ ...move, status: 'SUCCEEDED' }, receive];
  const waiting = missionProgress(detail({}, steps));
  assert.equal(waiting.step.jobStepId, 'move');
  assert.equal(waiting.status.label, 'Thành công');
  const next = missionProgress(detail({ selectedJobStepId: 'receive' }, [steps[0], { ...receive, status: 'RUNNING' }]));
  assert.equal(next.index, 1);
  assert.equal(next.status.label, 'Chờ xác nhận bước');
  assert.equal(next.step.jobStepId, 'receive');
});

test('does not guess a step from pending or running records when BE has no selection', () => {
  const model = missionProgress(detail({ selectedJobStepId: null }));
  assert.equal(model.step, undefined);
  assert.equal(model.index, -1);
  assert.match(model.title, /Chờ máy chủ/);
});

test('failure, timeout, recovery and cancellation keep the affected step and server status', () => {
  for (const status of ['FAILED', 'CANCELLED', 'RECOVERY_REQUIRED']) {
    const model = missionProgress(detail({ status }, [{ ...move, status: 'FAILED', errorCode: 'ROBOT_OFFLINE' }, receive]));
    assert.equal(model.step.jobStepId, 'move');
    assert.equal(model.terminal, true);
    assert.equal(model.status.label, { FAILED: 'Thất bại', CANCELLED: 'Đã hủy', RECOVERY_REQUIRED: 'Cần xử lý' }[status]);
  }
  const timeout = missionProgress(detail({}, [{ ...move, status: 'TIMED_OUT', errorCode: 'STEP_TIMEOUT' }, receive]));
  assert.equal(timeout.status.label, 'Quá thời gian chờ');
});

test('completed steps alone do not claim the job is complete; BE success does', () => {
  const steps = [{ ...move, status: 'SUCCEEDED' }, { ...receive, status: 'SUCCEEDED' }];
  assert.notEqual(missionProgress(detail({ selectedJobStepId: 'receive' }, steps)).title, 'Nhiệm vụ đã hoàn thành');
  const complete = missionProgress(detail({ status: 'SUCCEEDED', selectedJobStepId: null }, steps));
  assert.equal(complete.title, 'Nhiệm vụ đã hoàn thành');
  assert.equal(complete.status.label, 'Thành công');
});

test('WAIT uses a waiting label and retry keeps its server status', () => {
  assert.equal(missionProgress(detail({}, [{ ...move, stepTypeSnapshot: 'WAIT' }])).status.label, 'Đang chờ');
  assert.equal(missionProgress(detail({}, [{ ...move, status: 'RETRYING' }])).status.label, 'Đang thử lại');
  assert.equal(missionProgress(null), null);
});
