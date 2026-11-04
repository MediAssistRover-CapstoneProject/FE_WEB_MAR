import { availableOutputs, availableContext } from './designerModel.js';
import { outputsForStep, lookupOutput } from './stepOutputs.js';
export const pointerEscape = value => value.replaceAll('~', '~0').replaceAll('/', '~1');
export function parseReference(path) {
  if (typeof path !== 'string') return { source: 'custom', key: '', field: '' };
  const normalized = path.startsWith('/') ? path : '/' + path.split('.').join('/');
  const [, root, key = '', ...parts] = normalized.split('/');
  return { source: root === 'inputs' ? 'input' : root === 'outputs' ? 'output' : root === 'vars' ? 'context' : 'custom', key: key.replaceAll('~1', '/').replaceAll('~0', '~'), field: parts.join('/') };
}
export function referenceOptions(document, nodeId, includeSelf = false) {
  const available = availableOutputs(document).get(nodeId) ?? new Set();
  const steps = document.nodes.filter(n => n.data.kind === 'step' && (available.has(n.id) || includeSelf && n.id === nodeId));
  const allSteps = document.nodes.filter(n => n.data.kind === 'step');
  const outputs = steps.map(n => ({ id: n.id, name: n.data.name, sequence: allSteps.findIndex(s => s.id === n.id) + 1, stepType: n.data.stepType, fields: outputsForStep(n.data, document.workflow.schemaVersion) }));
  const context = [...(availableContext(document).get(nodeId) ?? new Map())].map(([key, kind]) => ({ key, label: key, kind }));
  return { inputs: document.variables, outputs, context };
}
export function referenceValueKind(document, nodeId, path) {
  const ref = parseReference(path);
  if (ref.source === 'input') {
    const variable = document.variables.find(v => v.key === ref.key);
    return variable && !ref.field ? ['map', 'endpoint', 'select'].includes(variable.kind) ? 'string' : variable.kind : 'unknown';
  }
  if (ref.source === 'output') {
    const node = document.nodes.find(n => n.id === ref.key);
    return node ? lookupOutput(node.data, ref.field, document.workflow.schemaVersion)?.kind ?? 'unknown' : 'unknown';
  }
  return ref.source === 'context' ? referenceOptions(document, nodeId).context.find(v => v.key === ref.key)?.kind ?? 'unknown' : 'unknown';
}
