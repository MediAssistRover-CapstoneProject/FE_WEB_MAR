import { movementBlock, rejectedReceipts } from './model.js';

export function autonomyBlock(state, now = Date.now(), ownedRunId = null) {
  const reason = movementBlock({ ...state, manual: false, now, session: { ...state.session, autonomy: { ...state.session?.autonomy, control_selected: false } } });
  if (reason) return reason;
  const age = now - Date.parse(state.session?.motionObservedAt);
  if (!Number.isFinite(age) || age < -1000 || age > 15000 || !state.session?.autonomy?.available) return 'Pi chưa cấu hình tự quét hoặc phản hồi tự quét đã cũ.';
  if (state.session.autonomy.control_selected && (!ownedRunId || state.session.autonomy.run_id !== ownedRunId)) return 'Pi đang giữ quyền tự quét của một phiên điều khiển. Dừng tự quét và chờ phản hồi trước khi bắt đầu lại.';
  return '';
}

// The lease belongs to one Job/session. A late response can never resume a
// cancelled lease, and every renewal rechecks the current authenticated scope.
export class MappingAutonomy {
  constructor({ send, allowed, onState = () => {}, onFinish = () => {}, clock = () => Date.now() }) {
    Object.assign(this, { send, allowed, onState, onFinish, clock, active: false, generation: 0, commandIds: new Set() });
  }
  start(context, seconds, stopOnReturn, saveAfter) {
    if (this.active) throw Error('Dừng phiên tự quét hiện tại trước.');
    const reason = this.allowed(context); if (reason) throw Error(reason);
    if (!context.jobId || !context.sessionId || !Number.isInteger(seconds) || seconds < 10 || seconds > 600) throw Error('Thời gian tự quét từ 10 đến 600 giây và cần đúng phiên quét.');
    this.context = { ...context }; this.saveAfter = !!saveAfter;
    this.run = { action: 'START', runId: crypto.randomUUID(), maxDurationSec: seconds, stopOnReturn: !!stopOnReturn, saveOnComplete: !!saveAfter };
    this.active = true; this.confirmed = false; this.commandIds.clear(); this.startedAt = this.clock();
    const generation = ++this.generation;
    this.limit = setTimeout(() => void this.stop('Hết thời gian trên trình duyệt; đã ngừng gia hạn.').catch(() => {}), (seconds + 3) * 1000);
    this.onState('Đã yêu cầu tự quét; đang chờ Pi xác nhận.');
    void this.renew(generation);
  }
  async renew(generation) {
    if (!this.active || generation !== this.generation) return;
    const reason = this.allowed(this.context, this.run.runId);
    if (reason) { await this.stop(reason).catch(() => {}); return; }
    const started = this.clock();
    try {
      if (!this.confirmed && started - this.startedAt > 3500) throw Error('Pi chưa xác nhận START. Kiểm tra kết nối và đồng hồ BE/Pi.');
      const receipt = await this.send({ ...this.run, action: this.confirmed ? 'RENEW' : 'START' }, this.context);
      if (!this.active || generation !== this.generation) return;
      if (receipt?.commandId) { this.commandIds.add(receipt.commandId); if (this.commandIds.size > 16) this.commandIds.delete(this.commandIds.values().next().value); }
      this.observeReceipt(receipt);
      if (!this.active || generation !== this.generation) return;
      this.timer = setTimeout(() => void this.renew(generation), Math.max(0, 300 - (this.clock() - started)));
    } catch (error) { if (this.active && generation === this.generation) await this.stop('Đã ngừng gia hạn tự quét: ' + error.message).catch(() => {}); }
  }
  observeReceipt(receipt) {
    if (!this.active || !this.commandIds.has(receipt?.commandId)) return;
    if (receipt.status === 'PI_ACCEPTED') this.confirmed = true;
    if (rejectedReceipts.has(receipt.status)) void this.stop('Pi chưa thực hiện tự quét: ' + (receipt.errorCode || receipt.status)).catch(() => {});
    if (receipt.status === 'PI_ACCEPTED' || rejectedReceipts.has(receipt.status)) this.commandIds.delete(receipt.commandId);
  }
  receiptCommandId() { return [...this.commandIds].at(-4) || [...this.commandIds][0] || ''; }
  observe(report, context) {
    if (!this.active) return;
    if (context.jobId !== this.context.jobId || context.sessionId !== this.context.sessionId) { void this.stop('Phiên quét đã thay đổi; đã ngừng gia hạn.').catch(() => {}); return; }
    if (report?.run_id !== this.run.runId) return;
    if (report.state === 'RUNNING') this.confirmed = true;
    if (!report.finished) return;
    const covered = report.reason === 'COVERAGE_COMPLETE' && report.coverage_complete === true && report.exploration?.state === 'COMPLETE';
    const save = this.saveAfter && (['TIME_LIMIT', 'RETURNED_TO_START'].includes(report.reason) || covered && report.save_on_complete !== true);
    const scope = this.context;
    this.cancel(); this.onState('Pi đã kết thúc tự quét: ' + report.reason + '.');
    if (save) this.onFinish(scope, report);
  }
  cancel() { this.active = false; ++this.generation; clearTimeout(this.timer); clearTimeout(this.limit); }
  async stop(message = 'Đã ngừng gia hạn và yêu cầu dừng tự quét. Chờ phản hồi Pi.') {
    const run = this.run && { ...this.run, action: 'STOP' }, context = this.context;
    this.cancel(); this.onState(message);
    if (run && context) return this.send(run, context);
  }
}

export function mappingRecoveryPlan(jobId, pending, evidence, note) {
  if (!jobId || !note?.trim()) throw Error('Cần mã nhiệm vụ và ghi chú phục hồi.');
  if (pending?.selectedUnsentStop || pending?.selectedRejectedMappingAction) {
    if (!pending.canReconcile) throw Error('BE chưa cho phép phục hồi: ' + (pending.blockers || []).join('; '));
    if (pending.jobId && pending.jobId !== jobId) throw Error('Bằng chứng không thuộc nhiệm vụ đang xem.');
    if (!pending.jobStepId || !pending.transportSessionId) throw Error('Thiếu định danh bước hoặc phiên kết nối từ BE.');
    return { path: `/api/v1/jobs/${encodeURIComponent(jobId)}/mapping-recovery`, body: { jobStepId: pending.jobStepId, transportSessionId: pending.transportSessionId, confirmedStopped: true, outcome: 'CONFIRM_CANCELLED', note: note.trim() } };
  }
  if (evidence?.jobId && evidence.jobId !== jobId) throw Error('Bằng chứng không thuộc nhiệm vụ đang xem.');
  const command = evidence?.commands?.find(c => c.jobStepId === evidence.jobStepId && c.commandType === 'EXECUTE_STEP');
  if (!evidence?.recoveryRequired || !command || command.physicalStopConfirmed !== true && command.operatorReconciled !== true) throw Error('BE chưa có bằng chứng Pi đã dừng hoặc biên nhận kiểm tra tại robot. Không thể xác nhận chỉ bằng heartbeat.');
  if (!command.commandId || !evidence.operationKey || !evidence.transportSessionId || !evidence.jobStepId) throw Error('Bằng chứng phục hồi chưa đủ định danh operation.');
  return { path: `/api/v1/jobs/${encodeURIComponent(jobId)}/operations/${encodeURIComponent(evidence.jobStepId)}/reconcile`, body: { commandId: command.commandId, operationKey: evidence.operationKey, transportSessionId: evidence.transportSessionId, evidence: command.physicalStopConfirmed === true ? 'PI_STOP_CONFIRMED' : 'STAFF_INSPECTED_STOP', confirmedStopped: true, outcome: 'CONFIRM_CANCELLED', note: note.trim() } };
}

const stable = value => JSON.stringify(normalize(value));
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])]));
  return value;
}
export function mappingWorkflowContract(detail) {
  const workflow = detail?.workflow;
  if (!workflow || !Array.isArray(detail.steps) || !Array.isArray(detail.transitions)) return null;
  const code = id => detail.steps.find(step => step.stepId === id)?.stepCode;
  return {
    serviceType: workflow.serviceType, schemaVersion: workflow.schemaVersion, graphVersion: workflow.graphVersion, maxTotalVisits: workflow.maxTotalVisits,
    inputSchemaJson: workflow.inputSchemaJson, defaultInputsJson: workflow.defaultInputsJson, requiredCapabilitiesJson: workflow.requiredCapabilitiesJson,
    startStepCode: code(workflow.startStepId),
    steps: detail.steps.map(step => ({ stepCode: step.stepCode, stepType: step.stepTypeCode, enabled: step.enabled !== false, paramsJson: step.paramsJson, inputMappingJson: step.inputMappingJson, timeoutSec: step.timeoutSec, maxAttempts: step.maxAttempts, retryDelaySec: step.retryDelaySec, retryCodesJson: step.retryCodesJson, maxVisits: step.maxVisits, auditLevel: step.auditLevel })).sort((a, b) => a.stepCode.localeCompare(b.stepCode)),
    transitions: detail.transitions.map(t => ({ fromStepCode: code(t.fromStepId), toStepCode: t.toStepId == null ? null : code(t.toStepId), outcome: t.outcome, conditionJson: t.conditionJson ?? null, priority: t.priority, defaultTransition: t.defaultTransition, terminalStatus: t.terminalStatus ?? null })).sort((a, b) => stable(a).localeCompare(stable(b))),
  };
}
export function mappingTemplateContract(definition) {
  return mappingWorkflowContract({ workflow: { ...definition.workflow, startStepId: definition.graph.startStepCode }, steps: definition.graph.steps.map(step => ({ ...step, stepId: step.stepCode, stepTypeCode: step.stepType })), transitions: definition.graph.transitions.map(t => ({ ...t, fromStepId: t.fromStepCode, toStepId: t.toStepCode ?? null })) });
}
export async function prepareMappingWorkflow({ request, post, definition }) {
  if (definition?.workflow?.workflowCode !== 'WF_MAPPING' || definition.workflow.schemaVersion !== 3 || definition.workflow.serviceType !== 'MAPPING') throw Error('Mẫu quy trình quét không đúng hợp đồng.');
  const published = await request('/api/v1/admin/workflows/published/all');
  const expected = stable(mappingTemplateContract(definition));
  const found = published.find(d => d.workflow?.workflowCode === 'WF_MAPPING' && d.workflow.status === 'PUBLISHED' && d.workflow.acceptsNewJobs && stable(mappingWorkflowContract(d)) === expected);
  if (found) return found.workflow.workflowId;
  const rows = [];
  for (let page = 0; ; page++) {
    const data = await request(`/api/v1/admin/workflows?page=${page}&size=100`);
    if (Array.isArray(data)) { rows.push(...data); break; }
    if (!Array.isArray(data.content)) throw Error('Danh mục quy trình không hợp lệ.');
    rows.push(...data.content);
    if (data.last || data.content.length < 100 || page + 1 >= data.totalPages) break;
    if (page >= 999) throw Error('Danh mục quy trình quá lớn.');
  }
  // Never publish somebody else's edited draft. Create a new version from the
  // reviewed asset, then let BE validate the graph before publishing it.
  const body = structuredClone(definition);
  body.workflow.versionNo = Math.max(0, ...rows.filter(w => w.workflowCode === 'WF_MAPPING').map(w => Number(w.versionNo) || 0)) + 1;
  const created = await post('/api/v1/admin/workflows/graph', body, { retry: false });
  const id = created?.workflow?.workflowId;
  if (!id) throw Error('BE chưa trả mã quy trình mới. Tải lại danh sách trước khi thử lại.');
  await post(`/api/v1/admin/workflows/${encodeURIComponent(id)}/validate`, {}, { retry: false });
  await post(`/api/v1/admin/workflows/${encodeURIComponent(id)}/publish`, {}, { retry: false });
  return id;
}
