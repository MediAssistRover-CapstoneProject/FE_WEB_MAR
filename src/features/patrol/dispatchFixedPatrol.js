import { resumeDispatch } from '../workflows/dispatchModel.js';
import { newPatrolDispatch } from './patrolModel.js';
import { createPatrolJob, patrolApi, patrolDispatchApi } from './patrolApi.js';

export async function dispatchFixedPatrol(pending, { workflow, robotId, mapId, navigationSessionId }, save) {
  const resumeSchedule = schedule => resumeDispatch(schedule, patrolDispatchApi, save, { onInvalidCreate: () => save(null) });
  if (pending?.body.scheduleCode) return resumeSchedule(pending);

  const workflowId = pending?.workflowId || workflow.workflowId;
  const key = pending?.key || `PATROL_${crypto.randomUUID()}`;
  let previous;
  try {
    previous = await patrolApi.findJob(workflowId, key);
  } catch (error) {
    // Only a new, unwritten attempt can use the older schedule-only backend.
    // After a job POST, always reconcile the original key on the original API.
    if (pending || ![404, 405].includes(error.status)) throw error;
    const schedule = newPatrolDispatch(workflow, robotId, key.slice('PATROL_'.length));
    save(schedule);
    return resumeSchedule(schedule);
  }
  if (previous?.jobId) return previous;
  if (previous != null) throw new Error('Máy chủ trả kết quả tra nhiệm vụ không hợp lệ.');
  const attempt = pending || {
    kind: 'job', key, workflowId, workflowName: workflow.workflowName,
    body: { robotId, mapId, navigationSessionId, inputs: {}, priority: 0 },
  };
  if (!attempt.body.navigationSessionId) throw new Error('Cần phiên định vị hiện tại để chạy ngay trên bản đồ này.');
  save(attempt);
  return createPatrolJob(attempt, save);
}
