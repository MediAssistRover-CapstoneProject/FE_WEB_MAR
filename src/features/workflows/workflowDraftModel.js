export function newWorkflowCode() {
  return `WF_USER_${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

export function workflowPayload({ code, versionNo = 1, name, description, source }) {
  return {
    workflowCode: code,
    versionNo,
    workflowName: name.trim(),
    serviceType: source?.serviceType ?? 'CUSTOM',
    description: description.trim(),
    inputSchemaJson: source?.inputSchemaJson ?? { type: 'object' },
    inputUiJson: source?.inputUiJson ?? {},
    defaultInputsJson: source?.defaultInputsJson ?? {},
    outputMappingJson: source?.outputMappingJson ?? {},
    requiredCapabilitiesJson: source?.requiredCapabilitiesJson ?? [],
    maxDurationSec: source?.maxDurationSec ?? 1200,
    maxTotalVisits: source?.maxTotalVisits ?? 100,
    graphVersion: source?.graphVersion ?? 3,
    schemaVersion: source?.schemaVersion ?? 2,
  };
}

export function taskPayload(task, sequenceNo) {
  return {
    taskCode: task.code,
    taskName: task.name.trim(),
    sequenceNo,
    description: task.description ?? '',
    configJson: task.configJson ?? {},
  };
}

export function stepPayload(step, taskId, sequenceNo) {
  return {
    taskId,
    stepTypeCode: step.type,
    stepCode: step.code,
    stepName: step.name ?? step.type.replaceAll('_', ' '),
    sequenceNo,
    description: step.description ?? '',
    enabled: step.enabled ?? true,
    paramsJson: step.type === 'MOVE' && step.values.max_speed_mps !== '' && Number.isFinite(Number(step.values.max_speed_mps)) ? { ...step.values, max_speed_mps: Number(step.values.max_speed_mps) } : step.values,
    inputMappingJson: step.inputMappingJson ?? {},
    timeoutSec: step.timeoutSec ?? 60,
    maxAttempts: step.maxAttempts ?? 1,
    retryDelaySec: step.retryDelaySec ?? 0,
    retryCodesJson: step.retryCodesJson ?? [],
    maxVisits: step.maxVisits ?? 1,
    auditLevel: step.auditLevel ?? 'BASIC',
  };
}

export function editorTasks(detail) {
  return [...(detail?.tasks ?? [])].sort((a, b) => a.sequenceNo - b.sequenceNo).map((task) => ({
    id: task.taskId,
    taskId: task.taskId,
    code: task.taskCode,
    name: task.taskName,
    sequenceNo: task.sequenceNo,
    description: task.description,
    configJson: task.configJson,
    steps: (detail.steps ?? []).filter((step) => step.taskId === task.taskId).sort((a, b) => a.sequenceNo - b.sequenceNo).map((step) => ({
      id: step.stepId,
      stepId: step.stepId,
      code: step.stepCode,
      type: step.stepTypeCode,
      name: step.stepName,
      sequenceNo: step.sequenceNo,
      values: step.paramsJson ?? {},
      description: step.description,
      enabled: step.enabled,
      inputMappingJson: step.inputMappingJson,
      timeoutSec: step.timeoutSec,
      maxAttempts: step.maxAttempts,
      retryDelaySec: step.retryDelaySec,
      retryCodesJson: step.retryCodesJson,
      maxVisits: step.maxVisits,
      auditLevel: step.auditLevel,
    })),
  }));
}
