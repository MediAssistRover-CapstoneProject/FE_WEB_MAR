import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedJobActions, assertJobAction, confirmationBlock, dataFreshness, mergeJobDetail, newerJob, operationSummary, recoveryPlan, recoveryIdentity, selectedStep, jobPresentation, jobProblem, filterJobs, stepSummary, durationLabel } from '../src/features/operations/liveOperations.js';

test('finished jobs never offer mutations, including recovery or step confirmation', () => {
  for (const status of ['SUCCEEDED', 'FAILED', 'CANCELLED']) {
    const actions = allowedJobActions({ status }, 'ADMIN', { status: 'RUNNING', stepTypeSnapshot: 'HANDLE_PAYLOAD' });
    assert.ok(Object.values(actions).every(value => !value));
  }
});

test('cancel acceptance, queued assignment and recovery follow separate rules', () => {
  assert.equal(allowedJobActions({ status: 'RUNNING' }, 'STAFF').cancel, true);
  assert.equal(allowedJobActions({ status: 'RUNNING', cancelCommandId: 'pending' }, 'ADMIN').cancel, false);
  assert.equal(allowedJobActions({ status: 'QUEUED', acceptedAt: '2026-11-03T01:00:00Z' }, 'ADMIN').assignRobot, false);
  assert.equal(allowedJobActions({ status: 'QUEUED' }, 'ADMIN').assignRobot, true);
  assert.equal(allowedJobActions({ status: 'QUEUED' }, 'STAFF').assignRobot, false);
  assert.equal(allowedJobActions({ status: 'RECOVERY_REQUIRED' }, 'ADMIN').recover, true);
  assert.equal(allowedJobActions({ status: 'RECOVERY_REQUIRED' }, 'ADMIN').cancel, false);
  assert.ok(Object.values(allowedJobActions({ status: 'RUNNING' }, 'DEVICE')).every(value => !value));
});

test('only a running step waiting for a human offers confirmation', () => {
  const step = { status: 'RUNNING', stepTypeSnapshot: 'INTERACT', startedAt: new Date().toISOString(), timeoutSecSnapshot: 180, resolvedInputsJson: { action: 'DISPLAY' } };
  assert.equal(allowedJobActions({ status: 'RUNNING', beOrchestrated: true, schemaVersion: 3 }, 'STAFF', step).confirmStep, true);
  assert.equal(allowedJobActions({ status: 'RUNNING' }, 'STAFF', { ...step, resolvedInputsJson: { action: 'SPEAK' } }).confirmStep, false);
  assert.equal(allowedJobActions({ status: 'RUNNING' }, 'STAFF', { ...step, stepTypeSnapshot: 'MOVE' }).confirmStep, false);
  assert.equal(allowedJobActions({ status: 'RUNNING' }, 'STAFF', { ...step, status: 'SUCCEEDED' }).confirmStep, false);
  assert.equal(selectedStep({ job: { selectedJobStepId: 'b' }, steps: [{ jobStepId: 'a' }, { jobStepId: 'b' }] }).jobStepId, 'b');
});

test('delayed REST data cannot roll back a newer streamed job status', () => {
  const live = { jobId: 'one', rowVersion: 9, status: 'SUCCEEDED' };
  assert.equal(newerJob(live, { jobId: 'one', rowVersion: 8, status: 'RUNNING' }), live);
  assert.equal(newerJob(live, { jobId: 'two', rowVersion: 1 }).jobId, 'two');
  assert.equal(newerJob(live, { ...live, rowVersion: 10, status: 'FAILED' }).status, 'FAILED');
});

test('jobs are identified by related records with useful fallbacks when catalogs are unavailable', () => {
  const job = { jobId: 'job-id', jobCode: 'JOB-123456', workflowId: 'workflow', robotId: 'robot', serviceRequestId: 'request', inputJson: { destinationEndpointId: 'endpoint' } };
  const catalogs = {
    workflows: [{ workflowId: 'workflow', workflowName: 'Giao thuốc' }],
    robots: [{ robotId: 'robot', robotName: 'MAR-01' }],
    endpoints: [{ endpointId: 'endpoint', endpointName: 'Phòng 305' }],
    requests: [{ serviceRequestId: 'request', requestCode: 'REQ-01' }],
  };
  assert.equal(jobPresentation(job, catalogs).title, 'Giao thuốc');
  assert.equal(jobPresentation(job, catalogs).robot, 'MAR-01');
  assert.equal(jobPresentation(job, catalogs).target, 'Phòng 305');
  assert.equal(jobPresentation(job).title, 'Công việc 123456');
  assert.match(jobPresentation(job).robot, /robot/);
});

test('history does not mix terminal failures with jobs awaiting recovery', () => {
  const jobs = [
    { jobId: 'failed', status: 'FAILED', queuedAt: '2026-11-02T02:00:00Z' },
    { jobId: 'recovery', status: 'RECOVERY_REQUIRED', queuedAt: '2026-11-03T02:00:00Z' },
    { jobId: 'running', status: 'RUNNING', queuedAt: '2026-11-03T03:00:00Z' },
    { jobId: 'done', status: 'SUCCEEDED', queuedAt: '2026-11-03T01:00:00Z' },
  ];
  assert.deepEqual(filterJobs(jobs, { group: 'active' }).map(row => row.jobId), ['running']);
  assert.deepEqual(filterJobs(jobs, { group: 'attention' }).map(row => row.jobId), ['recovery']);
  assert.deepEqual(filterJobs(jobs, { group: 'history' }).map(row => row.jobId), ['done', 'failed']);
  assert.deepEqual(filterJobs(jobs, { group: 'history', status: 'FAILED' }).map(row => row.jobId), ['failed']);
});

test('the latest failed attempt supplies a useful error even if the job has no error code', () => {
  const problem = jobProblem({ job: { status: 'FAILED' }, steps: [
    { status: 'FAILED', executionSequenceNo: 1, errorCode: 'OLD_ERROR' },
    { status: 'FAILED', jobStepId: 'failed-step', stepTypeSnapshot: 'MOVE', executionSequenceNo: 3, stepCodeSnapshot: 'MOVE_03', errorCode: 'ENDPOINT_DRIFT_DURING_ALIGNMENT' },
  ] });
  assert.equal(problem.step, 'MOVE_03');
  assert.equal(problem.stepId, 'failed-step');
  assert.equal(problem.stepNumber, 2);
  assert.equal(problem.stepName, 'Di chuyển');
  assert.match(problem.message, /lệch khỏi điểm đích/);
  assert.equal(problem.recovery, false);
  assert.equal(jobProblem({ job: { status: 'SUCCEEDED' }, steps: [] }), null);
  assert.equal(jobProblem({ job: { status: 'SUCCEEDED' }, steps: [{ status: 'FAILED', errorCode: 'OLD_ERROR', attemptNo: 1 }, { status: 'SUCCEEDED', attemptNo: 2 }] }), null);
});

test('date boundaries include the whole selected local day and workflow filtering is exact', () => {
  const jobs = [
    { jobId: 'morning', workflowId: 'a', status: 'SUCCEEDED', queuedAt: new Date(2026, 10, 3, 0, 0, 0).toISOString() },
    { jobId: 'evening', workflowId: 'a', status: 'FAILED', queuedAt: new Date(2026, 10, 3, 23, 59, 59).toISOString() },
    { jobId: 'next-day', workflowId: 'a', status: 'SUCCEEDED', queuedAt: new Date(2026, 10, 4, 0, 0, 0).toISOString() },
    { jobId: 'other', workflowId: 'b', status: 'SUCCEEDED', queuedAt: new Date(2026, 10, 3, 12).toISOString() },
  ];
  assert.deepEqual(filterJobs(jobs, { group: 'history', workflowId: 'a', from: '2026-11-03', to: '2026-11-03' }).map(row => row.jobId), ['evening', 'morning']);
});

test('step summary reports actual elapsed time, not the configured timeout or internal metadata', () => {
  const summary = stepSummary({ status: 'SUCCEEDED', stepTypeSnapshot: 'MOVE', attemptNo: 1, timeoutSecSnapshot: 180,
    startedAt: '2026-11-02T09:47:00Z', endedAt: '2026-11-02T09:47:22Z',
    jobStepId: 'internal', executionSequenceNo: 4, rowVersion: 99,
    resolvedInputsJson: { endpoint_id: 'destination', internal: 'diagnostic' },
    resultJson: { data: { reached: true, internal: 'diagnostic' } },
  }, { endpoints: [{ endpointId: 'destination', endpointName: 'Phòng 305' }] });
  assert.equal(summary.duration, '22 giây');
  assert.equal(summary.target, 'Phòng 305');
  assert.equal(summary.outcome, 'Robot báo đã đến điểm đích');
  assert.equal(summary.timeout, null);
  assert.equal(summary.attempts, null);
  assert.equal(summary.issue, null);
  assert.ok(!JSON.stringify(summary).includes('diagnostic'));
  assert.ok(!Object.hasOwn(summary, 'rowVersion'));
});

test('running, retry and interrupted steps expose only relevant conditional facts', () => {
  const summary = stepSummary({ status: 'RUNNING', timeoutSecSnapshot: 180, attemptNo: 2,
    interruptionReason: 'Đường bị chặn', interruptionRequestedAt: '2026-11-02T09:48:00Z',
  });
  assert.equal(summary.timeout, '3 phút');
  assert.equal(summary.attempts, 2);
  assert.equal(summary.interruption, 'Đường bị chặn');
  assert.equal(summary.duration, null);
  assert.equal(stepSummary({ status: 'SUCCEEDED', errorDetailsJson: { message: 'Old diagnostic' } }).issue, null);
  assert.equal(durationLabel(0), '0 giây');
  assert.equal(durationLabel(3662), '1 giờ 1 phút 2 giây');
  assert.equal(durationLabel(-1), null);
  assert.equal(stepSummary({ startedAt: '2026-11-03T00:00:22Z', endedAt: '2026-11-03T00:00:00Z' }).duration, null);
});

test('detail merge preserves newer step versions and recorded visits independently of job version', () => {
  const previous = { job: { jobId: 'j', rowVersion: 5, status: 'RUNNING' }, steps: [
    { jobStepId: 'a', rowVersion: 8, status: 'SUCCEEDED' }, { jobStepId: 'b', rowVersion: 2, status: 'RUNNING' },
  ], tasks: [{ jobTaskId: 'task' }] };
  const merged = mergeJobDetail(previous, { job: { ...previous.job }, steps: [{ jobStepId: 'a', rowVersion: 7, status: 'RUNNING' }] });
  assert.equal(merged.steps.find(s => s.jobStepId === 'a').status, 'SUCCEEDED');
  assert.equal(merged.steps.length, 2);
  const next = mergeJobDetail(previous, { job: { ...previous.job, rowVersion: 6, status: 'SUCCEEDED' }, steps: [{ jobStepId: 'b', rowVersion: 3, status: 'SUCCEEDED' }] });
  assert.equal(next.job.status, 'SUCCEEDED');
  assert.equal(next.steps.find(s => s.jobStepId === 'b').status, 'SUCCEEDED');
});

test('freshness measures data receipt, including failures without rewriting execution state', () => {
  assert.deepEqual(dataFreshness(null, 10000), { ageSeconds: null, stale: true });
  assert.deepEqual(dataFreshness(10000, 20000), { ageSeconds: 10, stale: false });
  assert.equal(dataFreshness(10000, 55000).stale, true);
  assert.equal(dataFreshness(10000, 10001, true).stale, true);
});

test('preflight rejects changed steps or instructions and operations no longer permitted', () => {
  const original = { job: { jobId: 'j', status: 'RUNNING', selectedJobStepId: 'a', beOrchestrated: true, schemaVersion: 3 }, steps: [{ jobStepId: 'a', stepTypeSnapshot: 'HANDLE_PAYLOAD', status: 'RUNNING', startedAt: new Date().toISOString(), timeoutSecSnapshot: 180, attemptNo: 1, resolvedInputsJson: { items: ['A'] } }] };
  assert.doesNotThrow(() => assertJobAction('POST /api/v1/job-steps/{id}/responses', original, original, 'STAFF'));
  assert.throws(() => assertJobAction('POST /api/v1/job-steps/{id}/responses', original, { ...original, job: { ...original.job, selectedJobStepId: 'b' } }, 'STAFF'), /thay đổi/);
  assert.throws(() => assertJobAction('POST /api/v1/job-steps/{id}/responses', original, { ...original, steps: [{ ...original.steps[0], resolvedInputsJson: { items: ['B'] } }] }, 'STAFF'), /thay đổi/);
  assert.throws(() => assertJobAction('POST /api/v1/jobs/{id}/cancel', original, { ...original, job: { ...original.job, status: 'SUCCEEDED' } }, 'ADMIN'), /không còn/);
  assert.throws(() => assertJobAction('POST /api/v1/jobs/{id}/assign-robot', original, original, 'ADMIN'), /không còn/);
});

test('confirmation blocks cancellation, expiry, unsupported runtime and known role restrictions', () => {
  const now = Date.parse('2026-11-03T03:00:00Z');
  const job = { jobId: 'j', status: 'RUNNING', beOrchestrated: true, schemaVersion: 3 };
  const step = { status: 'RUNNING', stepTypeSnapshot: 'HANDLE_PAYLOAD', startedAt: '2026-11-03T02:59:00Z', timeoutSecSnapshot: 180 };
  assert.equal(allowedJobActions(job, 'STAFF', step, now).confirmStep, true);
  for (const change of [{ cancelCommandId: 'c' }, { cancelRequestedAt: '2026-11-03T02:59:30Z' }, { schemaVersion: 2 }, { beOrchestrated: false }]) assert.equal(allowedJobActions({ ...job, ...change }, 'ADMIN', step, now).confirmStep, false);
  assert.equal(allowedJobActions(job, 'ADMIN', step, now + 120000).confirmStep, false);
  assert.match(confirmationBlock(job, 'ADMIN', step, now + 120000), /vượt thời gian/);
  const restricted = { ...step, resolvedInputsJson: { required_role: 'ADMIN' } };
  assert.equal(allowedJobActions(job, 'STAFF', restricted, now).confirmStep, false);
  assert.equal(allowedJobActions(job, 'ADMIN', restricted, now).confirmStep, true);
  assert.equal(allowedJobActions(job, 'ADMIN', { ...step, stepTypeSnapshot: 'AUTHENTICATE', resolvedInputsJson: { method: 'QR_CODE' } }, now).confirmStep, false);
});

test('operational summary reports waits without inventing terminal states', () => {
  const now = Date.parse('2026-11-03T03:00:00Z');
  assert.match(operationSummary({ status: 'QUEUED', queuedAt: '2026-11-03T02:59:00Z' }, null, now).message, /Chưa phân robot/);
  assert.equal(operationSummary({ status: 'QUEUED', queuedAt: '2026-11-03T02:59:00Z' }, null, now).elapsed, '1 phút');
  assert.equal(operationSummary({ status: 'RUNNING', cancelCommandId: 'c' }, null, now).title, 'Đang chờ hủy');
  assert.equal(operationSummary({ status: 'CANCELLED', cancelCommandId: 'c' }, null, now), null);
  assert.equal(operationSummary({ status: 'RUNNING' }, { status: 'RUNNING', stepTypeSnapshot: 'MOVE', startedAt: '2026-11-03T02:59:00Z', timeoutSecSnapshot: 30 }, now).title, 'Bước đã vượt thời gian chờ');
});

const recoveryFixture = () => {
  const detail = { job: { jobId: 'j', status: 'RECOVERY_REQUIRED', beOrchestrated: true, selectedJobStepId: 's' }, steps: [{ jobStepId: 's', stepTypeSnapshot: 'MOVE', stepCodeSnapshot: 'MOVE_01' }] };
  const evidence = { jobId: 'j', recoveryRequired: true, jobStepId: 's', operationKey: 'op', transportSessionId: 'session', commands: [{ commandId: 'c', jobStepId: 's', commandType: 'EXECUTE_STEP', state: 'RECOVERY_REQUIRED', physicalStopConfirmed: true }], physicalUncertainty: { sessionOwned: true, heartbeatFresh: true, robotReportsIdle: true, activeOperationReported: false, mappingOpen: false } };
  return { detail, evidence };
};

test('recovery chooses generic closing only with known evidence and no unresolved robot operations', () => {
  const { detail, evidence } = recoveryFixture();
  assert.ok(recoveryPlan(detail, null).blocked.length);
  assert.ok(recoveryPlan(detail, { ...evidence, jobId: 'foreign' }).blocked.length);
  const noCommand = recoveryPlan(detail, { ...evidence, commands: [] });
  assert.equal(noCommand.kind, 'job'); assert.equal(noCommand.blocked.length, 0);
  const stoppedCommand = recoveryPlan(detail, { ...evidence, commands: [{ ...evidence.commands[0], state: 'COMPLETED' }] });
  assert.equal(stoppedCommand.kind, 'job');
  assert.equal(recoveryPlan({ ...detail, job: { ...detail.job, beOrchestrated: false } }, null).kind, 'job');
});

test('operation recovery binds exact identities, supported evidence and physical prerequisites', () => {
  const { detail, evidence } = recoveryFixture();
  const plan = recoveryPlan(detail, evidence);
  assert.equal(plan.kind, 'operation'); assert.equal(plan.blocked.length, 0);
  assert.deepEqual(plan.evidenceTypes, ['PI_STOP_CONFIRMED']);
  assert.deepEqual(plan.path, { jobId: 'j', jobStepId: 's' }); assert.equal(plan.commandId, 'c');
  assert.notEqual(recoveryIdentity(plan), recoveryIdentity({ ...plan, transportSessionId: 'new' }));
  assert.ok(recoveryPlan(detail, { ...evidence, transportSessionId: null }).blocked.length);
  assert.ok(recoveryPlan(detail, { ...evidence, physicalUncertainty: { ...evidence.physicalUncertainty, heartbeatFresh: false } }).blocked.length);
  assert.ok(recoveryPlan(detail, { ...evidence, commands: [{ ...evidence.commands[0], physicalStopConfirmed: false }] }).blocked.length);
  assert.ok(recoveryPlan(detail, { ...evidence, jobStepId: 'foreign' }).blocked.length);
  assert.ok(recoveryPlan(detail, { ...evidence, commands: [...evidence.commands, { ...evidence.commands[0], jobStepId: 'other' }] }).blocked.length);
});

test('rejected-before-acceptance evidence is distinct from a physical stop claim', () => {
  const { detail, evidence } = recoveryFixture();
  detail.steps[0].errorCode = 'LOCALIZATION_NOT_READY';
  evidence.commands[0] = { ...evidence.commands[0], state: 'REJECTED', sendAttempts: 1, physicalStopConfirmed: false };
  evidence.physicalUncertainty = {};
  const plan = recoveryPlan(detail, evidence);
  assert.deepEqual(plan.evidenceTypes, ['COMMAND_NOT_ACCEPTED']); assert.equal(plan.blocked.length, 0);
  assert.ok(recoveryPlan({ ...detail, steps: [{ ...detail.steps[0], startedAt: '2026-11-03T03:00:00Z' }] }, evidence).blocked.length);
});
