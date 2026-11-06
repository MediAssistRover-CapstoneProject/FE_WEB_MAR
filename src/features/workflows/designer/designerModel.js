import { defaultFailurePolicy, failurePolicyIssues } from '../workflowFailurePolicy.js';
import { stepCatalog, operators, terminalStatuses, valueError, variableFitsField, fieldsForStep, speechFields, variableValueError } from './stepCatalog.js';
import { defaultOutput, lookupOutput, inferKind } from './stepOutputs.js';
import { stepContractIssues } from './stepContractChecks.js';
import { branchResultField, branchesOnResult, isCloseRequest } from './designerPresentation.js';

export const copy = value => structuredClone(value);
export const makeId = prefix => `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
export const outcomes = ['SUCCESS', 'FAILURE', 'TIMEOUT'];
const escape = key => key.replaceAll('~', '~0').replaceAll('/', '~1');
const unescape = key => key.replaceAll('~1', '/').replaceAll('~0', '~');
export const inputRef = key => ({ $ref: `/inputs/${escape(key)}` });
export function visit(value, fn, path = '') {
  if (value && typeof value === 'object') {
    if (Object.hasOwn(value, '$ref')) fn(value, path);
    else Object.entries(value).forEach(([key, child]) => visit(child, fn, `${path}/${key}`));
  }
}
export function newDocument() {
  return {
    localId: makeId('DESIGN'), workflow: { workflowCode: makeId('WF_USER'), versionNo: 1, workflowName: 'Quy trình mới', serviceType: 'CUSTOM', description: '', inputSchemaJson: { type: 'object', properties: {} }, inputUiJson: { failureHandling: { ...defaultFailurePolicy } }, defaultInputsJson: {}, outputMappingJson: {}, requiredCapabilitiesJson: [], maxDurationSec: 1200, maxTotalVisits: 100, graphVersion: 3, schemaVersion: 3 },
    tasks: [{ taskCode: 'MAIN', taskName: 'Tác vụ chính', sequenceNo: 1, description: '', configJson: {} }], variables: [],
    nodes: [{ id: 'start', type: 'workflow', position: { x: 80, y: 170 }, data: { kind: 'start', name: 'Bắt đầu' } }, { id: 'end', type: 'workflow', position: { x: 680, y: 170 }, data: { kind: 'terminal', name: 'Hoàn thành', terminalStatus: 'SUCCEEDED' } }],
    edges: [], viewport: { x: 0, y: 0, zoom: 1 }, readOnlyReasons: [],
  };
}
export function addStep(document, type, position) {
  const next = copy(document), spec = stepCatalog[type], id = makeId(type);
  const params = copy(spec.defaults), mapping = {};
  if (type === 'MOVE') {
    if (!next.variables.some(v => v.key === 'map_id')) next.variables.push({ key: 'map_id', label: 'Bản đồ', kind: 'map', required: true });
    const key = `destination_${next.nodes.filter(n => n.data.stepType === 'MOVE').length + 1}_endpoint_id`;
    let endpointKey = key;
    while (next.variables.some(v => v.key === endpointKey)) endpointKey += '_next';
    next.variables.push({ key: endpointKey, label: 'Điểm đến ' + (next.nodes.filter(n => n.data.stepType === 'MOVE').length + 1), kind: 'endpoint', required: true, mapVariable: 'map_id', selection: 'endpoint' });
    mapping.map_id = inputRef('map_id'); mapping.endpoint_id = inputRef(endpointKey);
  }
  if (['AUTHENTICATE', 'HANDLE_PAYLOAD'].includes(type)) {
    let request = next.variables.find(v => v.key === 'service_request_id');
    if (!request) {
      request = { key: 'service_request_id', label: 'Yêu cầu dịch vụ', description: 'UUID yêu cầu giao hàng được gắn với nhiệm vụ.', kind: 'string', required: true, schema: { type: 'string', format: 'uuid' } };
      next.variables.push(request);
    }
    const field = spec.fields.find(f => f.key === 'service_request_id');
    if (variableFitsField(request, field)) mapping.service_request_id = inputRef(request.key);
  }
  if (type === 'HANDLE_PAYLOAD') {
    if (!next.variables.some(v => v.key === 'items')) next.variables.push({ key: 'items', label: 'Danh sách hàng', kind: 'array', required: true, schema: { type: 'array', minItems: 1, items: { type: 'object', required: ['item_code', 'quantity'], properties: { item_code: { type: 'string', minLength: 1 }, quantity: { type: 'integer', minimum: 1 } }, additionalProperties: false } } });
    if (next.variables.find(v => v.key === 'items')?.kind === 'array') mapping.items = inputRef('items');
  }
  next.nodes.push({ id, type: 'workflow', position, data: { kind: 'step', stepType: type, name: spec.label, taskCode: next.tasks[0].taskCode, params, mapping, timeoutSec: spec.timeout ?? 60, maxAttempts: 1, retryDelaySec: 0, retryCodesJson: [], maxVisits: 1, auditLevel: 'BASIC', enabled: true, description: '' } });
  return next;
}
export function graphHasCycle(nodes, edges) {
  const active = new Set(), done = new Set();
  const walk = id => {
    if (active.has(id)) return true;
    if (done.has(id)) return false;
    active.add(id);
    if (edges.some(e => e.source === id && walk(e.target))) return true;
    active.delete(id); done.add(id); return false;
  };
  return nodes.some(n => walk(n.id));
}
// A palette click extends an open main path, or inserts before its success terminal.
// Existing branches and paths to other steps always require an explicit connection.
export function quickAppendSource(document, selectedId) {
  const source = document.nodes.find(n => n.id === (selectedId ?? 'start'));
  if (!source || source.data.kind === 'terminal' || branchesOnResult(source.data)) return null;
  const routes = document.edges.filter(e => e.source === source.id && e.data?.outcome === 'SUCCESS');
  if (!routes.length) return source;
  if (source.data.kind === 'start' || routes.length !== 1 || !routes[0].data.defaultTransition) return null;
  const terminal = document.nodes.find(n => n.id === routes[0].target);
  return terminal?.data.kind === 'terminal' && terminal.data.terminalStatus === 'SUCCEEDED' ? source : null;
}
export function appendStep(document, type, selectedId, position) {
  const source = quickAppendSource(document, selectedId);
  let next = addStep(document, type, position);
  if (!source) return next;
  const targetId = next.nodes.at(-1).id;
  const previous = next.edges.find(e => e.source === source.id && e.data?.outcome === 'SUCCESS');
  if (previous) next.edges = next.edges.filter(e => e.id !== previous.id);
  next = connect(next, { source: source.id, target: targetId, sourceHandle: 'SUCCESS' });
  if (!branchesOnResult(next.nodes.find(n => n.id === targetId).data)) {
    const end = previous ? next.nodes.find(n => n.id === previous.target) : next.nodes.find(n => n.data.kind === 'terminal' && n.data.terminalStatus === 'SUCCEEDED');
    if (end) next = connect(next, { source: targetId, target: end.id, sourceHandle: 'SUCCESS' });
  }
  return next;
}
export function canConnect(document, connection) {
  const source = document.nodes.find(n => n.id === connection.source), target = document.nodes.find(n => n.id === connection.target);
  if (!source || !target || source.id === target.id || source.data.kind === 'terminal' || target.data.kind === 'start') return false;
  if (source.data.kind === 'start' && (target.data.kind !== 'step' || document.edges.some(e => e.source === source.id))) return false;
  return !graphHasCycle(document.nodes, [...document.edges, connection]);
}
export function connect(document, connection) {
  if (!canConnect(document, connection)) return document;
  const next = copy(document), source = next.nodes.find(n => n.id === connection.source);
  const handle = connection.sourceHandle ?? 'SUCCESS';
  const outcome = handle === 'true' || handle === 'false' ? 'SUCCESS' : handle;
  const same = next.edges.filter(e => e.source === source.id && e.data?.outcome === outcome);
  const condition = handle === 'true' ? { path: `/outputs/${source.id}/${branchResultField(source.data)}`, operator: 'EQ', value: true } : null;
  // Ordinary ports have one fallback. Conditional edges are explicitly edited in the inspector.
  if (!condition && same.some(e => e.data?.defaultTransition)) return document;
  if (handle === 'true' && same.some(e => e.sourceHandle === 'true')) return document;
  const priority = Math.max(0, ...same.filter(e => !e.data.defaultTransition).map(e => e.data.priority)) + 1;
  if (condition) same.filter(e => e.data.defaultTransition).forEach(e => { e.data.priority = priority + 1; });
  next.edges.push({ ...connection, id: makeId('EDGE'), sourceHandle: handle, data: { outcome, conditionJson: condition, defaultTransition: !condition, priority } });
  const target = next.nodes.find(n => n.id === connection.target);
  if (source.data.kind === 'step' && outcome === 'SUCCESS' && target?.data.stepType === 'CHECK_CONDITION' && !target.data.params.expression?.path) {
    const field = defaultOutput(source.data);
    if (field) target.data.params.expression = { path: `/outputs/${escape(source.id)}/${field.path}`, operator: 'EQ', value: field.kind === 'boolean' ? true : field.kind === 'integer' || field.kind === 'number' ? 0 : '' };
  }
  return next;
}
export function effectiveParams(node) { return { ...node.data.params, ...node.data.mapping }; }
export function hasAutomaticCloseStop(document, nodeId) {
  const node = document.nodes.find(n => n.id === nodeId);
  if (!isCloseRequest(node?.data)) return false;
  const routes = document.edges.filter(e => e.source === nodeId && e.data?.outcome === 'SUCCESS');
  const condition = routes[0]?.data.conditionJson;
  return routes.length === 1 && !routes[0].data.defaultTransition && routes[0].data.priority === 1
    && condition?.path === `/outputs/${escape(nodeId)}/confirmed` && condition.operator === 'EQ' && condition.value === true;
}
const conditionPointer = path => typeof path === 'string' && !path.startsWith('/') ? '/' + path.split('.').join('/') : path;
const below = (path, prefix) => path === prefix || path?.startsWith(prefix + '/');
function transitionInputPath(node, path, direction) {
  const bindings = [];
  if (node) visit(effectiveParams(node), (ref, field) => {
    if (typeof ref.$ref === 'string' && /^\/inputs\/[A-Za-z][A-Za-z0-9_]*$/.test(ref.$ref)) bindings.push({ canvas: ref.$ref, api: '/inputs' + field });
  });
  const from = direction === 'api' ? 'canvas' : 'api', to = direction === 'api' ? 'api' : 'canvas';
  const matches = bindings.filter(binding => below(path, binding[from]));
  const longest = Math.max(0, ...matches.map(binding => binding[from].length));
  const targets = new Set(matches.filter(binding => binding[from].length === longest).map(binding => binding[to] + path.slice(binding[from].length)));
  return targets.size === 1 ? [...targets][0] : null;
}
// Transition conditions run against the completing step's {result, error, inputs},
// independently of the global workflow context used by step input mappings.
function transitionCondition(condition, node, direction) {
  if (!condition || typeof condition.path !== 'string') return copy(condition);
  const next = copy(condition), path = conditionPointer(next.path), self = `/outputs/${escape(node?.id ?? '')}`;
  if (direction === 'api' && below(path, self)) next.path = '/result' + path.slice(self.length);
  else if (direction === 'canvas' && below(path, '/result')) next.path = self + path.slice('/result'.length);
  else if (below(path, '/inputs')) next.path = transitionInputPath(node, path, direction) ?? next.path;
  return next;
}
function transitionConditionIssue(condition, source, outcome) {
  const path = conditionPointer(condition?.path);
  if (typeof path !== 'string') return null; // The ordinary condition validation reports malformed values.
  if (below(path, '/outputs')) {
    if (!below(path, `/outputs/${escape(source?.id ?? '')}`)) return 'Điều kiện dây nối chỉ đọc kết quả của chính bước nguồn; dùng bước Kiểm tra điều kiện để đọc bước trước.';
    if (outcome !== 'SUCCESS') return 'Kết quả bước nguồn chỉ có trên nhánh thành công.';
  } else if (below(path, '/inputs')) {
    if (!transitionInputPath(source, path, 'api')) return 'Biến trong điều kiện dây nối cần ánh xạ duy nhất vào đầu vào của bước nguồn; dùng bước Kiểm tra điều kiện cho biến khác.';
  } else return 'Nguồn dữ liệu của điều kiện dây nối chưa hỗ trợ chỉnh sửa; dùng bước Kiểm tra điều kiện cho ngữ cảnh quy trình.';
  return null;
}
export function authorizationFromStep(document, nodeId, authId) {
  const auth = document.nodes.find(n => n.id === authId && n.data.stepType === 'AUTHENTICATE');
  if (!auth || !availableOutputs(document).get(nodeId)?.has(authId)) throw new Error('Chọn Xác thực đã thành công trên mọi đường chạy tới bước mở ngăn.');
  const purpose = auth.data.params.purpose;
  if (!['DELIVERY_SENDER', 'DELIVERY_RECEIVER'].includes(purpose)) throw new Error('Mục đích xác thực phải cố định.');
  return { mode: 'STAFF_VERIFIED', purpose, verification_id: { $ref: `/outputs/${escape(authId)}/verification_id` }, actor_account_id: { $ref: `/outputs/${escape(authId)}/actor_account_id` }, valid_until: { $ref: `/outputs/${escape(authId)}/valid_until` } };
}
export function suggestedCondition(document, nodeId, includeSelf = false) {
  const available = availableOutputs(document).get(nodeId) ?? new Set();
  const candidates = document.nodes.filter(n => n.data.kind === 'step' && (available.has(n.id) || includeSelf && n.id === nodeId));
  const source = includeSelf ? candidates.find(n => n.id === nodeId) ?? candidates.at(-1) : candidates.at(-1);
  const field = source && defaultOutput(source.data);
  if (field) return field.kind === 'boolean' ? { path: `/outputs/${escape(source.id)}/${field.path}`, operator: 'EQ', value: true } : { path: `/outputs/${escape(source.id)}/${field.path}`, operator: 'EXISTS' };
  const input = document.variables.find(v => v.kind === 'boolean');
  return input ? { path: `/inputs/${escape(input.key)}`, operator: 'EQ', value: true } : { path: '', operator: 'EXISTS' };
}
export function inputUsages(document, key) {
  const matches = [], ref = `/inputs/${escape(key)}`;
  const pathUses = path => typeof path === 'string' && (path === ref || path.startsWith(ref + '/') || path === `inputs.${key}` || path.startsWith(`inputs.${key}.`));
  visit(document.nodes, (node, path) => { if (typeof node.$ref === 'string' && (node.$ref === ref || node.$ref.startsWith(ref + '/'))) matches.push(path); });
  visit(document.workflow.outputMappingJson, node => { if (typeof node.$ref === 'string' && (node.$ref === ref || node.$ref.startsWith(ref + '/'))) matches.push('outputMapping'); });
  for (const edge of document.edges) if (pathUses(edge.data?.conditionJson?.path)) matches.push(edge.id);
  for (const node of document.nodes) if (pathUses(node.data.params?.expression?.path)) matches.push(node.id);
  if (document.variables.some(v => v.mapVariable === key)) matches.push('mapVariable');
  return matches;
}
export function renameVariable(document, oldKey, newKey) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(newKey) || document.variables.some(v => v.key === newKey && v.key !== oldKey)) throw new Error('Khóa biến phải duy nhất, bắt đầu bằng chữ và chỉ chứa chữ, số, dấu _.');
  const next = copy(document), before = `/inputs/${escape(oldKey)}`, after = `/inputs/${escape(newKey)}`;
  const rewrite = value => typeof value !== 'string' ? value : value === before || value.startsWith(before + '/') ? after + value.slice(before.length) : value === `inputs.${oldKey}` || value.startsWith(`inputs.${oldKey}.`) ? `inputs.${newKey}` + value.slice(`inputs.${oldKey}`.length) : value;
  visit(next.nodes, node => { node.$ref = rewrite(node.$ref); });
  visit(next.workflow.outputMappingJson, node => { node.$ref = rewrite(node.$ref); });
  next.nodes.forEach(n => { if (n.data.params?.expression) n.data.params.expression.path = rewrite(n.data.params.expression.path); });
  next.edges.forEach(e => { if (e.data?.conditionJson) e.data.conditionJson.path = rewrite(e.data.conditionJson.path); });
  next.variables.forEach(v => { if (v.key === oldKey) v.key = newKey; if (v.mapVariable === oldKey) v.mapVariable = newKey; });
  for (const prefix of ['default:', 'options:']) if (next.invalidJson && Object.hasOwn(next.invalidJson, prefix + oldKey)) { next.invalidJson[prefix + newKey] = next.invalidJson[prefix + oldKey]; delete next.invalidJson[prefix + oldKey]; }
  return next;
}
export function variableSchema(variable) {
  const schema = { ...(variable.schema ?? {}), type: ['map', 'endpoint', 'select'].includes(variable.kind) ? 'string' : variable.kind, title: variable.label, description: variable.description ?? '' };
  if (['map', 'endpoint'].includes(variable.kind)) schema.format = 'uuid';
  if (variable.kind === 'select') schema.enum = (variable.options ?? []).map(o => typeof o === 'object' ? o.value : o);
  else if (!variable.schema?.enum) delete schema.enum;
  return schema;
}
export function fromDetail(detail) {
  const document = newDocument(), workflow = copy(detail.workflow);
  document.workflow = workflow; document.localId = workflow.workflowId; document.legacyLocal = !!workflow.localOnly;
  document.readOnlyReasons = [];
  const supported = new Set(Object.keys(stepCatalog));
  document.tasks = detail.tasks.map(({ taskId, workflowId, createdAt, ...task }) => task);
  const designer = workflow.inputUiJson?.designer;
  const fields = workflow.inputUiJson?.fields ?? {};
  document.variables = Object.entries(workflow.inputSchemaJson?.properties ?? {}).map(([key, schema]) => ({ key, label: schema.title || key, description: schema.description || '', kind: fields[key]?.kind ?? (schema.enum ? 'select' : schema.type || 'string'), options: schema.enum, required: workflow.inputSchemaJson.required?.includes(key) ?? false, ...fields[key], schema, ...(Object.hasOwn(workflow.defaultInputsJson ?? {}, key) ? { defaultValue: workflow.defaultInputsJson[key] } : {}) }));
  Object.entries(workflow.defaultInputsJson ?? {}).forEach(([key, value]) => { if (!document.variables.some(v => v.key === key)) document.variables.push({ key, label: key, kind: Array.isArray(value) ? 'array' : typeof value, defaultValue: value, required: false }); });
  const codes = new Map(detail.steps.map(s => [s.stepId, s.stepCode]));
  const taskCodes = new Map(detail.tasks.map(t => [t.taskId, t.taskCode]));
  document.nodes = [document.nodes[0]];
  detail.steps.forEach((s, index) => {
    if (!supported.has(s.stepTypeCode) || s.enabled === false) document.readOnlyReasons.push(`Bước ${s.stepCode} chưa được hỗ trợ chỉnh sửa đầy đủ.`);
    document.nodes.push({ id: s.stepCode, type: 'workflow', position: designer?.positions?.[s.stepCode] ?? { x: 300 + index % 4 * 270, y: 100 + Math.floor(index / 4) * 230 }, data: { kind: 'step', stepType: s.stepTypeCode, name: s.stepName, taskCode: taskCodes.get(s.taskId), params: copy(s.paramsJson ?? {}), mapping: copy(s.inputMappingJson ?? {}), timeoutSec: s.timeoutSec, maxAttempts: s.maxAttempts, retryDelaySec: s.retryDelaySec, retryCodesJson: s.retryCodesJson, maxVisits: s.maxVisits, auditLevel: s.auditLevel, enabled: s.enabled, description: s.description ?? '' } });
  });
  document.edges = [];
  if (workflow.startStepId && codes.has(workflow.startStepId)) document.edges.push({ id: 'start-edge', source: 'start', target: codes.get(workflow.startStepId), sourceHandle: 'SUCCESS', data: { outcome: 'SUCCESS', defaultTransition: true, priority: 1, conditionJson: null } });
  (detail.transitions ?? []).forEach(t => {
    const source = codes.get(t.fromStepId);
    // Automatic stop routes belong to the step, not to the editable canvas.
    // v1 designers did not mark them explicitly, but did record every drawn terminal route.
    const routeKey = `${source}:${t.outcome}:${t.priority}`;
    const automatic = Array.isArray(designer?.automaticErrorRoutes) && designer.automaticErrorRoutes.some(route => route?.fromStepCode === source && route.outcome === t.outcome && route.terminalStatus === t.terminalStatus)
      || designer?.version === 1 && !Object.hasOwn(designer, 'automaticErrorRoutes') && Object.hasOwn(designer.positions ?? {}, source) && designer.terminalRoutes && !Object.hasOwn(designer.terminalRoutes, routeKey);
    if (automatic && ['FAILURE', 'TIMEOUT'].includes(t.outcome) && t.terminalStatus === 'RECOVERY_REQUIRED'
      && t.toStepId == null && t.defaultTransition === true && t.priority === 1 && t.conditionJson == null
      && !Object.hasOwn(designer?.terminalRoutes ?? {}, routeKey)
      && detail.transitions.filter(route => route.fromStepId === t.fromStepId && route.outcome === t.outcome).length === 1) return;
    if (automatic && t.outcome === 'SUCCESS' && t.terminalStatus === 'RECOVERY_REQUIRED'
      && t.toStepId == null && t.defaultTransition === true && t.priority === 2 && t.conditionJson == null
      && !Object.hasOwn(designer?.terminalRoutes ?? {}, routeKey)
      && isCloseRequest(document.nodes.find(n => n.id === source)?.data)) {
      const routes = detail.transitions.filter(route => route.fromStepId === t.fromStepId && route.outcome === 'SUCCESS');
      const main = routes.find(route => !route.defaultTransition && route.priority === 1 && (route.toStepId != null || terminalStatuses.includes(route.terminalStatus))
        && route.conditionJson?.path === '/result/confirmed' && route.conditionJson.operator === 'EQ' && route.conditionJson.value === true);
      if (routes.length === 2 && main) return;
    }
    let target = codes.get(t.toStepId);
    if (t.terminalStatus) {
      const stored = designer?.terminals?.find(n => n.id === designer.terminalRoutes?.[routeKey] && n.terminalStatus === t.terminalStatus);
      target = stored?.id ?? `terminal-${t.terminalStatus}`;
      if (!document.nodes.some(n => n.id === target)) document.nodes.push({ id: target, type: 'workflow', position: designer?.positions?.[target] ?? { x: 1450, y: 80 + terminalStatuses.indexOf(t.terminalStatus) * 150 }, data: { kind: 'terminal', name: stored?.name ?? (t.terminalStatus === 'SUCCEEDED' ? 'Hoàn thành' : t.terminalStatus), terminalStatus: t.terminalStatus } });
    }
    if (!source || !target) document.readOnlyReasons.push('Có liên kết tham chiếu bước không tồn tại.');
    const sourceNode = document.nodes.find(n => n.id === source), check = branchesOnResult(sourceNode?.data);
    const conditionJson = transitionCondition(t.conditionJson ?? null, sourceNode, 'canvas');
    const unsupported = !t.defaultTransition && transitionConditionIssue(conditionJson, sourceNode, t.outcome);
    if (unsupported) document.readOnlyReasons.push(unsupported);
    document.edges.push({ id: t.transitionId ?? makeId('EDGE'), source, target, sourceHandle: check && t.outcome === 'SUCCESS' ? (t.defaultTransition ? 'false' : 'true') : t.outcome, data: { outcome: t.outcome, conditionJson, priority: t.priority, defaultTransition: t.defaultTransition } });
  });
  if (designer?.positions?.start) document.nodes[0].position = designer.positions.start;
  if (designer?.startLabel) document.nodes[0].data.name = designer.startLabel;
  document.viewport = designer?.viewport ?? document.viewport;
  if (graphHasCycle(document.nodes, document.edges)) document.readOnlyReasons.push('Workflow có vòng lặp. Phiên bản này chỉ hỗ trợ xem nguyên trạng.');
  if (workflow.graphVersion !== 3 || ![2, 3].includes(workflow.schemaVersion)) document.readOnlyReasons.push('Phiên bản contract chưa hỗ trợ chỉnh sửa.');
  if (document.variables.some(v => !['string', 'number', 'integer', 'boolean', 'object', 'array', 'map', 'endpoint', 'select'].includes(v.kind))) document.readOnlyReasons.push('Cấu trúc biến đầu vào chưa hỗ trợ chỉnh sửa.');
  if (!document.tasks.length) document.tasks = [{ taskCode: 'MAIN', taskName: 'Tác vụ chính', sequenceNo: 1, configJson: {} }];
  return document;
}
export function dominators(document) {
  const ids = document.nodes.map(n => n.id), all = new Set(ids), result = new Map(ids.map(id => [id, id === 'start' ? new Set(['start']) : new Set(all)]));
  for (let round = 0; round <= ids.length; round++) {
    let changed = false;
    for (const id of ids.filter(id => id !== 'start')) {
      const parents = document.edges.filter(e => e.target === id).map(e => e.source);
      const set = parents.length ? new Set([...result.get(parents[0]) ?? []].filter(v => parents.every(p => result.get(p)?.has(v)))) : new Set();
      set.add(id);
      if ([...set].sort().join() !== [...result.get(id)].sort().join()) { result.set(id, set); changed = true; }
    }
    if (!changed) break;
  }
  return result;
}
// Outputs exist only after SUCCEEDED steps. A failure edge does not supply its source output.
export function availableOutputs(document) {
  const sets = new Map(document.nodes.map(n => [n.id, new Set()]));
  for (let round = 0; round <= document.nodes.length; round++) {
    let changed = false;
    for (const node of document.nodes) {
      const incoming = document.edges.filter(e => e.target === node.id).map(e => {
        const values = new Set(sets.get(e.source));
        const source = document.nodes.find(n => n.id === e.source);
        if (source?.data.kind === 'step' && e.data?.outcome === 'SUCCESS') values.add(e.source);
        return values;
      });
      const values = incoming.length ? new Set([...incoming[0]].filter(id => incoming.every(set => set.has(id)))) : new Set();
      if ([...values].sort().join() !== [...sets.get(node.id)].sort().join()) { sets.set(node.id, values); changed = true; }
    }
    if (!changed) break;
  }
  return sets;
}
export function availableContext(document) {
  const before = new Map(document.nodes.map(n => [n.id, new Map()]));
  const valueKind = (value, context) => {
    if (typeof value?.$ref !== 'string') return inferKind(value);
    const [, root, key, ...path] = value.$ref.split('/');
    if (root === 'vars') return context.get(unescape(key ?? '')) ?? 'unknown';
    if (root === 'inputs') { const v = document.variables.find(v => v.key === unescape(key ?? '')); return v ? ['map', 'endpoint', 'select'].includes(v.kind) ? 'string' : v.kind : 'unknown'; }
    const node = document.nodes.find(n => n.id === unescape(key ?? ''));
    return node ? lookupOutput(node.data, path.join('/'), document.workflow.schemaVersion)?.kind ?? 'unknown' : 'unknown';
  };
  for (let round = 0; round <= document.nodes.length; round++) {
    let changed = false;
    for (const node of document.nodes) {
      const incoming = document.edges.filter(e => e.target === node.id).map(edge => {
        const values = new Map(before.get(edge.source));
        const producer = document.nodes.find(n => n.id === edge.source);
        const ops = producer?.data.stepType === 'SET_CONTEXT' ? effectiveParams(producer).operations : null;
        if (edge.data?.outcome === 'SUCCESS' && Array.isArray(ops)) for (const op of ops) if (typeof op?.path === 'string' && /^\/vars\/[A-Za-z][A-Za-z0-9_]*$/.test(op.path)) values.set(op.path.slice(6), op.operation === 'INCREMENT' ? 'number' : valueKind(op.value, before.get(edge.source) ?? new Map()));
        return values;
      });
      const values = incoming.length ? new Map([...incoming[0]].filter(([key, kind]) => incoming.every(map => map.has(key) && map.get(key) === kind))) : new Map();
      if (JSON.stringify([...values].sort()) !== JSON.stringify([...before.get(node.id)].sort())) { before.set(node.id, values); changed = true; }
    }
    if (!changed) break;
  }
  return before;
}
export function validateDocument(document, catalog = null) {
  const errors = [], add = (message, nodeId, edgeId) => errors.push({ message, nodeId, edgeId });
  for (const key of Object.keys(document.invalidJson ?? {})) add(`JSON chưa hợp lệ: ${key}`, key.split(':')[0]);
  if (!document.workflow.workflowName?.trim()) add('Nhập tên quy trình.');
  for (const issue of failurePolicyIssues(document.workflow)) add(issue);
  if (document.workflow.workflowName?.length > 160) add('Tên quy trình tối đa 160 ký tự.');
  if (!(document.workflow.maxDurationSec > 0) || !(document.workflow.maxTotalVisits > 0)) add('Giới hạn thời gian và lượt chạy phải lớn hơn 0.');
  const taskCodes = document.tasks.map(t => t.taskCode), taskOrders = document.tasks.map(t => t.sequenceNo);
  if (!document.tasks.length || new Set(taskCodes).size !== taskCodes.length || new Set(taskOrders).size !== taskOrders.length) add('Nhóm tác vụ phải tồn tại và không trùng mã/thứ tự.');
  document.tasks.forEach(t => { if (!/^[A-Z][A-Z0-9_]{1,79}$/.test(t.taskCode) || !t.taskName?.trim() || !Number.isInteger(t.sequenceNo) || t.sequenceNo < 1 || !t.configJson || typeof t.configJson !== 'object' || Array.isArray(t.configJson)) add('Nhóm tác vụ có tên, mã, thứ tự hoặc cấu hình không hợp lệ.'); });
  if (document.readOnlyReasons?.length) document.readOnlyReasons.forEach(reason => add(reason));
  if (document.legacyLocal) add('Tạo bản sao và chuyển điểm cục bộ sang endpoint máy chủ hoặc biến trước khi lưu.');
  const steps = document.nodes.filter(n => n.data.kind === 'step');
  if (!steps.length) add('Thêm ít nhất một bước.');
  if (document.nodes.filter(n => n.data.kind === 'start').length !== 1 || document.edges.filter(e => e.source === 'start').length !== 1) add('Bắt đầu cần nối tới đúng một bước.', 'start');
  if (graphHasCycle(document.nodes, document.edges)) add('Không hỗ trợ vòng lặp.');
  const reachable = new Set(), walk = id => { if (reachable.has(id)) return; reachable.add(id); document.edges.filter(e => e.source === id).forEach(e => walk(e.target)); }; walk('start');
  const outputs = availableOutputs(document), context = availableContext(document), keys = new Set(document.variables.map(v => v.key)), codes = new Set(steps.map(n => n.id));
  const checkPointer = (ref, nodeId, allowSelf = false) => {
    if (typeof ref !== 'string' || !/^\/(inputs|outputs|vars)(\/.*)?$/.test(ref) || /~(?![01])/.test(ref)) { add('Tham chiếu dữ liệu không hợp lệ.', nodeId); return; }
    const [, root, raw] = ref.split('/'), key = unescape(raw ?? '');
    if (!key || ref.endsWith('/')) { add('Chọn đầy đủ biến, bước và trường dữ liệu cho tham chiếu.', nodeId); return; }
    if (root === 'inputs' && !keys.has(key)) add(`Biến ${key} chưa được khai báo.`, nodeId);
    if (root === 'vars' && nodeId && document.workflow.schemaVersion === 3 && !['mapping_session_id', 'artifact_id'].includes(key) && !context.get(nodeId)?.has(key)) add(`Biến ngữ cảnh ${key} chưa được gán trên mọi đường chạy trước bước này.`, nodeId);
    if (root === 'outputs' && (!codes.has(key) || nodeId && (key === nodeId ? !allowSelf : !outputs.get(nodeId)?.has(key)))) add(`Kết quả ${key} chưa chắc tồn tại trên đường chạy này.`, nodeId);
    if (root === 'outputs' && codes.has(key) && document.workflow.schemaVersion === 3) {
      const producer = document.nodes.find(n => n.id === key);
      const fieldPath = ref.split('/').slice(3).join('/');
      if (fieldPath && !lookupOutput(producer.data, fieldPath, 3)) add(`${producer.data.name}: không có trường output ${fieldPath} trong cấu hình hiện tại.`, nodeId);
    }
  };
  document.variables.forEach((v, index) => {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(v.key) || document.variables.findIndex(w => w.key === v.key) !== index) add(`Khóa biến ${v.key} không hợp lệ hoặc bị trùng.`);
    if (v.kind === 'endpoint' && !document.variables.some(m => m.key === v.mapVariable && m.kind === 'map')) add(`Biến ${v.key} cần liên kết một biến bản đồ.`);
    if (v.kind === 'select' && (!Array.isArray(v.options) || !v.options.length || v.options.some(o => typeof o !== 'string' && !(o && typeof o.value === 'string')))) add(`Biến ${v.key} cần danh sách lựa chọn chuỗi hợp lệ.`);
    if (Object.hasOwn(v, 'defaultValue')) { const error = variableValueError(v.defaultValue, v); if (error) add(`Mặc định ${v.key}: ${error}`); visit(v.defaultValue, () => add(`Mặc định ${v.key} phải là dữ liệu, không dùng $ref.`)); }
  });
  steps.forEach(node => {
    const d = node.data, spec = stepCatalog[d.stepType], params = effectiveParams(node);
    if (!reachable.has(node.id)) add(`${d.name}: chưa được nối từ Bắt đầu.`, node.id);
    if (!spec) { add(`Loại bước ${d.stepType} chưa được hỗ trợ.`, node.id); return; }
    if (!document.tasks.some(t => t.taskCode === d.taskCode)) add(`${d.name}: tác vụ không tồn tại.`, node.id);
    if (!d.name?.trim()) add('Bước cần tên.', node.id);
    if (!(d.timeoutSec >= 1) || !(d.maxAttempts >= 1) || !(d.maxVisits >= 1) || d.retryDelaySec < 0) add(`${d.name}: thời gian hoặc số lần thử không hợp lệ.`, node.id);
    if (d.stepType === 'CONTROL_HARDWARE' && d.maxAttempts !== 1) add('Lệnh phần cứng chỉ được thử một lần.', node.id);
    fieldsForStep(d, document.workflow.schemaVersion, document.workflow).forEach(field => {
      const value = params[field.key];
      if (field.fixed && value && typeof value === 'object' && value.$ref) add(`${field.label} phải là giá trị cố định.`, node.id);
      const error = valueError(value, field); if (error) add(`${d.name} · ${field.label}: ${error}`, node.id);
      if (typeof value?.$ref === 'string' && value.$ref.startsWith('/inputs/')) {
        const variable = document.variables.find(v => v.key === unescape(value.$ref.split('/')[2]));
        if (variable && value.$ref.split('/').length === 3) {
          if (!variableFitsField(variable, field)) add(`${field.label}: kiểu biến không tương thích.`, node.id);
          if (field.required && !variable.required && !Object.hasOwn(variable, 'defaultValue')) add(`${field.label}: biến phải bắt buộc hoặc có mặc định.`, node.id);
        }
      }
    });
    stepContractIssues(d, document.workflow.schemaVersion, document.workflow).forEach(message => add(`${d.name} · ${message}`, node.id));
    const inspectDraft = value => {
      if (!value || typeof value !== 'object') return;
      if (Object.hasOwn(value, '__invalidJSON')) add('JSON trong cấu hình chi tiết chưa hợp lệ.', node.id);
      Object.values(value).forEach(inspectDraft);
    };
    inspectDraft(params);
    visit(params, (ref, path) => {
      if (Object.keys(ref).length !== 1) add('Đối tượng $ref chỉ được chứa khóa $ref.', node.id);
      checkPointer(ref.$ref, node.id);
      if (path.includes('/authorization') && !(typeof ref.$ref === 'string' && ref.$ref.startsWith('/outputs/'))) add('Quyền phần cứng phải lấy từ kết quả bước xác thực.', node.id);
      const parts = typeof ref.$ref === 'string' ? ref.$ref.split('/') : [];
      const expected = expectedField(d, path, document.workflow.schemaVersion);
      if (expected && parts[1] === 'inputs') {
        const variable = document.variables.find(v => v.key === unescape(parts[2] ?? ''));
        if (variable && parts.length === 3 && !variableFitsField(variable, expected)) add(`${path}: kiểu biến đầu vào không phù hợp.`, node.id);
      }
      if (expected && parts[1] === 'outputs') {
        const producer = document.nodes.find(n => n.id === unescape(parts[2] ?? ''));
        const actual = producer && lookupOutput(producer.data, parts.slice(3).join('/'), document.workflow.schemaVersion);
        if (actual && actual.kind !== 'unknown' && !variableFitsField(actual, expected)) add(`${path}: kiểu output ${actual.kind} không phù hợp với ${expected.kind}.`, node.id);
      }
      if (expected && parts[1] === 'vars') {
        const kind = context.get(node.id)?.get(unescape(parts[2] ?? ''));
        if (kind && kind !== 'unknown' && !variableFitsField({ kind }, expected)) add(`${path}: kiểu biến ngữ cảnh không phù hợp.`, node.id);
      }
    });
    if (d.stepType === 'SET_CONTEXT' && Array.isArray(params.operations)) for (const op of params.operations) if (op?.operation === 'INCREMENT') {
      const kind = typeof op.path === 'string' ? context.get(node.id)?.get(op.path.slice(6)) : null;
      if (!['integer', 'number'].includes(kind)) add('INCREMENT cần biến số đã được khởi tạo bằng SET trước đó.', node.id);
    }
    if (d.stepType === 'CONTROL_HARDWARE' && params.authorization && typeof params.authorization.verification_id?.$ref === 'string') {
      const authId = unescape(params.authorization.verification_id.$ref.split('/')[2] ?? '');
      const auth = document.nodes.find(n => n.id === authId && n.data.stepType === 'AUTHENTICATE');
      if (!auth || auth.data.params.purpose !== params.authorization.purpose) add('Quyền mở ngăn phải trỏ tới xác thực đúng mục đích người gửi/người nhận.', node.id);
      for (const field of ['verification_id', 'actor_account_id', 'valid_until']) if (params.authorization[field]?.$ref !== `/outputs/${escape(authId)}/${field}`) add(`Quyền ${field} phải lấy từ cùng một bước Xác thực.`, node.id);
    }
    if (d.stepType === 'CHECK_CONDITION') checkCondition(params.expression, node.id);
    if (d.stepType === 'WAIT' && typeof params.duration_sec === 'number' && d.timeoutSec <= params.duration_sec) add('Timeout phải lớn hơn thời gian chờ.', node.id);
    if (d.stepType === 'SET_CONTEXT' && Array.isArray(params.operations) && (!params.operations.length || params.operations.length > 128)) add('Ghi ngữ cảnh cần 1–128 phép cập nhật.', node.id);
    if (d.stepType === 'MOVE') {
      if (params.map_id === 'local-map-studio' || typeof params.endpoint_id === 'string' && params.endpoint_id.startsWith('local-')) add('Không thể gửi điểm cục bộ lên máy chủ.', node.id);
      if (catalog && typeof params.map_id === 'string' && !catalog.maps.some(m => m.mapId === params.map_id && m.status === 'ACTIVE')) add('Bản đồ MOVE không còn hoạt động.', node.id);
      if (catalog && typeof params.endpoint_id === 'string' && !catalog.endpoints.some(e => e.endpointId === params.endpoint_id && e.active && e.accessible && (typeof params.map_id !== 'string' || e.mapId === params.map_id))) add('Điểm MOVE không còn khả dụng hoặc sai bản đồ.', node.id);
    }
    const outgoing = document.edges.filter(e => e.source === node.id && e.data?.outcome === 'SUCCESS');
    if (!outgoing.length || !outgoing.some(e => e.data.defaultTransition) && !hasAutomaticCloseStop(document, node.id)) add(`${d.name}: nối đường thành công mặc định tới bước tiếp theo hoặc kết thúc.`, node.id);
    for (const outcome of outcomes) {
      const routes = document.edges.filter(e => e.source === node.id && e.data?.outcome === outcome);
      if (routes.length && routes.filter(e => e.data.defaultTransition).length !== 1 && !(outcome === 'SUCCESS' && hasAutomaticCloseStop(document, node.id))) add(`${d.name}: ${outcome} cần đúng một nhánh mặc định.`, node.id);
      const priorities = routes.map(e => e.data.priority);
      if (new Set(priorities).size !== priorities.length || priorities.some(p => !Number.isInteger(p) || p < 1)) add(`${d.name}: thứ tự nhánh phải là số nguyên dương và không trùng.`, node.id);
      if (routes.some(e => e.data.defaultTransition && e.data.priority !== Math.max(...priorities))) add(`${d.name}: nhánh mặc định phải có thứ tự cuối.`, node.id);
    }
  });
  function checkCondition(c, nodeId, allowSelf = false) {
    if (c && Object.hasOwn(c, '__invalidValue')) add('JSON giá trị so sánh chưa hợp lệ.', nodeId);
    if (!c || !operators.includes(c.operator) || typeof c.path !== 'string' || !c.path || c.operator !== 'EXISTS' && !Object.hasOwn(c, 'value')) { add('Điều kiện cần đường dẫn, phép so sánh và giá trị.', nodeId); return; }
    const pointer = c.path.startsWith('/') ? c.path : '/' + c.path.split('.').join('/');
    checkPointer(pointer, nodeId, allowSelf);
    if (['GT', 'GTE', 'LT', 'LTE'].includes(c.operator) && typeof c.value !== 'number') add('Phép so sánh thứ tự cần giá trị số.', nodeId);
    if (c.operator === 'IN' && !Array.isArray(c.value)) add('Phép IN cần một mảng.', nodeId);
  }
  document.edges.forEach(edge => {
    const source = document.nodes.find(n => n.id === edge.source), target = document.nodes.find(n => n.id === edge.target);
    if (!source || !target || source.data.kind === 'terminal' || target.data.kind === 'start') add('Liên kết có nguồn hoặc đích không hợp lệ.', edge.source, edge.id);
    if (source?.data.kind === 'start') { if (target?.data.kind !== 'step') add('Bắt đầu phải nối tới một bước.', 'start', edge.id); return; }
    if (!outcomes.includes(edge.data?.outcome)) add('Kết quả liên kết không hợp lệ.', edge.source, edge.id);
    if (!edge.data?.defaultTransition) {
      checkCondition(edge.data?.conditionJson, edge.source, edge.data?.outcome === 'SUCCESS');
      const issue = transitionConditionIssue(edge.data?.conditionJson, source, edge.data?.outcome);
      if (issue) add(issue, edge.source, edge.id);
    }
    else if (edge.data.conditionJson != null) add('Nhánh mặc định không được chứa điều kiện.', edge.source, edge.id);
  });
  visit(document.workflow.outputMappingJson, ref => checkPointer(ref.$ref));
  if (document.nodes.some(n => n.data.kind === 'terminal' && !terminalStatuses.includes(n.data.terminalStatus))) add('Trạng thái kết thúc không hợp lệ.');
  if (document.workflow.maxTotalVisits < steps.length) add('Giới hạn lượt chạy phải đủ cho các bước.');
  return errors.filter((error, index, all) => all.findIndex(other => other.message === error.message && other.nodeId === error.nodeId && other.edgeId === error.edgeId) === index);
}
function expectedField(data, path, version) {
  const parts = path.split('/').slice(1);
  if (parts.length === 1) return fieldsForStep(data, version).find(f => f.key === parts[0]);
  if (data.stepType === 'INTERACT' && parts[0] === 'data' && parts.length === 2 && data.params.action === 'SPEAK') return speechFields.find(f => f.key === parts[1]);
  if (parts[0] === 'authorization' && parts.length === 2) return { kind: 'string' };
  if (parts[0] === 'items' && parts.length === 3) return { kind: parts[2] === 'quantity' ? 'integer' : 'string' };
  if (parts[0] === 'operations' && parts[2] === 'value' && data.params.operations?.[parts[1]]?.operation === 'INCREMENT') return { kind: 'number' };
  return null;
}
export function toPayload(document) {
  const workflow = copy(document.workflow), properties = {}, defaults = {}, fields = {}, required = [];
  for (const variable of document.variables) {
    properties[variable.key] = variableSchema(variable);
    if (variable.required) required.push(variable.key);
    if (Object.hasOwn(variable, 'defaultValue')) defaults[variable.key] = variable.defaultValue;
    fields[variable.key] = { ...(workflow.inputUiJson?.fields?.[variable.key] ?? {}), kind: variable.kind, label: variable.label, description: variable.description ?? '', ...(variable.kind === 'endpoint' ? { mapVariable: variable.mapVariable, selection: variable.selection ?? 'endpoint' } : {}), ...(variable.kind === 'select' ? { options: variable.options } : {}) };
  }
  workflow.inputSchemaJson = { ...workflow.inputSchemaJson, type: 'object', properties, required };
  workflow.defaultInputsJson = defaults;
  workflow.inputUiJson = { ...workflow.inputUiJson, fields, designer: { version: 1, positions: Object.fromEntries(document.nodes.map(n => [n.id, n.position])), viewport: document.viewport, startLabel: document.nodes.find(n => n.data.kind === 'start')?.data.name, terminals: document.nodes.filter(n => n.data.kind === 'terminal').map(n => ({ id: n.id, name: n.data.name, terminalStatus: n.data.terminalStatus })), terminalRoutes: Object.fromEntries(document.edges.filter(e => document.nodes.some(n => n.id === e.target && n.data.kind === 'terminal')).map(e => [`${e.source}:${e.data.outcome}:${e.data.priority}`, e.target])) } };
  const allowed = ['workflowCode', 'versionNo', 'workflowName', 'serviceType', 'description', 'inputSchemaJson', 'inputUiJson', 'defaultInputsJson', 'outputMappingJson', 'requiredCapabilitiesJson', 'maxDurationSec', 'maxTotalVisits', 'graphVersion', 'schemaVersion'];
  const steps = document.nodes.filter(n => n.data.kind === 'step').map((n, i) => ({ taskCode: n.data.taskCode, stepType: n.data.stepType, stepCode: n.id, stepName: n.data.name, sequenceNo: i + 1, description: n.data.description, paramsJson: n.data.params, inputMappingJson: n.data.mapping, timeoutSec: n.data.timeoutSec, maxAttempts: n.data.maxAttempts, retryDelaySec: n.data.retryDelaySec, retryCodesJson: n.data.retryCodesJson, maxVisits: n.data.maxVisits, auditLevel: n.data.auditLevel }));
  const transitions = [];
  const automaticErrorRoutes = [];
  for (const step of steps) for (const outcome of outcomes) {
    const routes = document.edges.filter(e => e.source === step.stepCode && e.data.outcome === outcome);
    if (!routes.length && outcome !== 'SUCCESS') {
      transitions.push({ fromStepCode: step.stepCode, toStepCode: null, outcome, conditionJson: null, priority: 1, defaultTransition: true, terminalStatus: 'RECOVERY_REQUIRED' });
      automaticErrorRoutes.push({ fromStepCode: step.stepCode, outcome, terminalStatus: 'RECOVERY_REQUIRED' });
    }
    routes.forEach(edge => { const target = document.nodes.find(n => n.id === edge.target), source = document.nodes.find(n => n.id === step.stepCode); transitions.push({ fromStepCode: step.stepCode, toStepCode: target?.data.kind === 'step' ? edge.target : null, ...edge.data, conditionJson: transitionCondition(edge.data.conditionJson, source, 'api'), terminalStatus: target?.data.kind === 'terminal' ? target.data.terminalStatus : null }); });
    if (outcome === 'SUCCESS' && hasAutomaticCloseStop(document, step.stepCode)) {
      transitions.push({ fromStepCode: step.stepCode, toStepCode: null, outcome, conditionJson: null, priority: 2, defaultTransition: true, terminalStatus: 'RECOVERY_REQUIRED' });
      automaticErrorRoutes.push({ fromStepCode: step.stepCode, outcome, terminalStatus: 'RECOVERY_REQUIRED' });
    }
  }
  workflow.inputUiJson.designer.automaticErrorRoutes = automaticErrorRoutes;
  return { workflow: Object.fromEntries(allowed.map(k => [k, workflow[k]])), graph: { startStepCode: document.edges.find(e => e.source === 'start')?.target, tasks: document.tasks.map((t, i) => ({ taskCode: t.taskCode, taskName: t.taskName, description: t.description ?? '', configJson: t.configJson ?? {}, sequenceNo: t.sequenceNo ?? i + 1 })), steps, transitions } };
}
export const fingerprint = document => JSON.stringify(toPayload(document));
export function convertLocal(document) {
  const next = copy(document);
  next.localId = makeId('DESIGN'); next.legacyLocal = false; delete next.workflow.workflowId; delete next.workflow.localOnly;
  Object.assign(next.workflow, { workflowCode: makeId('WF_USER'), versionNo: 1, status: 'DRAFT', acceptsNewJobs: false, schemaVersion: 3, graphVersion: 3, workflowName: next.workflow.workflowName + ' · bản chuyển đổi' });
  next.variables = next.variables.filter(v => !['map', 'endpoint'].includes(v.kind));
  next.variables.push({ key: 'map_id', label: 'Bản đồ', kind: 'map', required: true });
  next.nodes.filter(n => n.data.stepType === 'MOVE').forEach((node, index) => {
    let key = `destination_${index + 1}_endpoint_id`; while (next.variables.some(v => v.key === key)) key += '_next';
    next.variables.push({ key, label: node.data.name, kind: 'endpoint', required: true, mapVariable: 'map_id', selection: 'endpoint' });
    delete node.data.params.map_id; delete node.data.params.endpoint_id;
    node.data.mapping.map_id = inputRef('map_id'); node.data.mapping.endpoint_id = inputRef(key);
  });
  next.readOnlyReasons = next.readOnlyReasons.filter(reason => !reason.includes('cục bộ'));
  return next;
}
export function availableDestinations(catalog, mapId, roomId = '') {
  return catalog.endpoints.filter(e => e.mapId === mapId && e.active && e.accessible && (!roomId || e.roomId === roomId));
}
