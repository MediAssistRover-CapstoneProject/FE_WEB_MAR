import { appendStep, newDocument } from '../../src/features/workflows/designer/designerModel.js';

export function happyPathDocument() {
  let document = appendStep(newDocument(), 'WAIT', null, { x: 380, y: 170 });
  document = appendStep(document, 'WAIT', document.nodes.at(-1).id, { x: 680, y: 170 });
  document.nodes.find(n => n.id === 'end').position = { x: 980, y: 170 };
  return document;
}

export function graphDetail(payload, id = 'happy-path') {
  return {
    workflow: { ...payload.workflow, workflowId: id, status: 'DRAFT', startStepId: 'id-' + payload.graph.startStepCode },
    tasks: payload.graph.tasks.map(t => ({ ...t, taskId: 'task-' + t.taskCode })),
    steps: payload.graph.steps.map(s => ({ ...s, stepTypeCode: s.stepType, stepId: 'id-' + s.stepCode, taskId: 'task-' + s.taskCode, enabled: true })),
    transitions: payload.graph.transitions.map((t, i) => ({ ...t, transitionId: 'route-' + i, fromStepId: 'id-' + t.fromStepCode, toStepId: t.toStepCode ? 'id-' + t.toStepCode : null })),
  };
}
