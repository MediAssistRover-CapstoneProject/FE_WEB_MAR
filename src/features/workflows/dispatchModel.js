import { variableValueError } from './designer/stepCatalog.js';
import { availableDestinations } from './designer/designerModel.js';

export const serviceLabels = { DELIVERY: 'Giao hàng', NAVIGATION: 'Di chuyển', ESCORT: 'Dẫn đường', PATROL: 'Tuần tra', INFORMATION: 'Thông tin', CUSTOM: 'Tùy chỉnh' };

export function dispatchVariables(workflow) {
  return Object.entries(workflow?.inputSchemaJson?.properties ?? {}).map(([key, schema]) => {
    const ui = workflow.inputUiJson?.fields?.[key] ?? {};
    return { ...ui, key, schema, label: ui.label || schema.title || key, description: ui.description || schema.description || '', kind: ui.kind || (schema.enum ? 'select' : schema.type || 'string'), options: schema.enum ?? ui.options, required: workflow.inputSchemaJson.required?.includes(key) ?? false };
  });
}

const hasReference = value => value && typeof value === 'object' && (Object.hasOwn(value, '$ref') || Object.values(value).some(hasReference));

export function dispatchInputErrors(workflow, values, catalog) {
  const errors = {};
  for (const variable of dispatchVariables(workflow)) {
    const value = values[variable.key];
    let error = variableValueError(value, variable);
    if (hasReference(value)) error = 'Nhập giá trị thực tế cho lượt chạy.';
    if (value && variable.kind === 'map' && !catalog.maps.some(map => map.mapId === value && map.status === 'ACTIVE')) error = 'Bản đồ không còn hoạt động.';
    if (value && variable.kind === 'endpoint' && !availableDestinations(catalog, values[variable.mapVariable]).some(point => point.endpointId === value)) error = 'Điểm đến không khả dụng trên bản đồ đã chọn.';
    if (error) errors[variable.key] = error;
  }
  return errors;
}

export function updateDispatchValue(workflow, previous, variable, value) {
  const next = { ...previous };
  if (value === undefined) delete next[variable.key]; else next[variable.key] = value;
  if (variable.kind === 'map') dispatchVariables(workflow).filter(field => field.mapVariable === variable.key).forEach(field => delete next[field.key]);
  return next;
}

// The existing backend creates generic workflow jobs through a one-time schedule.
// Keep the unique code and body unchanged when recovering an interrupted request.
export function newDispatch(workflow, robotId, inputs, priority, id, now = new Date()) {
  return { code: `DISPATCH_${id}`, workflowName: workflow.workflowName, createdAt: now.toISOString(), body: {
    workflowId: workflow.workflowId, robotId: robotId || null,
    scheduleCode: `DISPATCH_${id}`, scheduleName: workflow.workflowName.slice(0, 140) + ' · Điều phối',
    scheduleType: 'ONCE', timezone: 'Asia/Ho_Chi_Minh', startsAt: now.toISOString(),
    inputTemplateJson: structuredClone(inputs), priority, misfirePolicy: 'FIRE_ONCE',
  } };
}

export async function resumeDispatch(attempt, api, save) {
  let current = attempt;
  let schedule = current.scheduleId ? await api.get(current.scheduleId) : await api.find(current.code);
  if (!schedule) schedule = await api.create(current.body);
  if (!schedule?.scheduleId) throw new Error('Máy chủ chưa trả mã lượt điều phối. Hãy kiểm tra lại yêu cầu.');
  current = { ...current, scheduleId: schedule.scheduleId, status: schedule.status };
  save(current);
  if (schedule.status === 'PAUSED') {
    schedule = await api.activate(schedule.scheduleId);
    current = { ...current, status: schedule.status };
    save(current);
  }
  if (!['ACTIVE', 'RETIRED'].includes(current.status)) throw new Error('Lượt điều phối chưa được kích hoạt. Kiểm tra lại trước khi tiếp tục.');
  return current;
}
