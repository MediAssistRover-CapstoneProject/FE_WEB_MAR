import { operationSummary, selectedStep, statusInfo, stepSummary } from './liveOperations.js';
import { vi } from '../../i18n/vi.js';

export function missionProgress(detail, catalogs = {}) {
  const job = detail?.job;
  if (!job) return null;
  const steps = [...(detail.steps || [])].sort((a, b) => (a.executionSequenceNo || 0) - (b.executionSequenceNo || 0));
  // Selection belongs to BE. A completed step never starts its successor in FE.
  const step = selectedStep(detail);
  const index = steps.findIndex(item => item.jobStepId === step?.jobStepId);
  const terminal = ['SUCCEEDED', 'FAILED', 'CANCELLED', 'RECOVERY_REQUIRED'].includes(job.status);
  const summary = step ? stepSummary(step, catalogs) : {};
  const operation = step && operationSummary(job, step);
  const status = terminal ? statusInfo(job.status) : statusInfo(step?.status || job.status);
  return {
    step, index, terminal,
    title: job.status === 'SUCCEEDED' ? 'Nhiệm vụ đã hoàn thành'
      : step ? vi(step.stepTypeSnapshot || step.stepCodeSnapshot || 'Bước thực hiện')
      : terminal ? `Nhiệm vụ · ${status.label}` : 'Chờ máy chủ xác nhận bước thực hiện',
    status: operation?.title === 'Chờ xác nhận bước' ? { label: operation.title, tone: 'waiting' }
      : !terminal && step?.stepTypeSnapshot === 'WAIT' && step.status === 'RUNNING' ? { label: 'Đang chờ', tone: 'waiting' } : status,
    target: summary.target,
  };
}
