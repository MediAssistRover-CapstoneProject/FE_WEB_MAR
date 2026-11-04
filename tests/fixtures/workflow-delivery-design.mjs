import { newDocument, addStep, connect, authorizationFromStep } from '../../src/features/workflows/designer/designerModel.js';
import { interactionPresets } from '../../src/features/workflows/designer/stepCatalog.js';
export function deliveryDocument() {
  let doc = newDocument(); doc.workflow.serviceType = 'DELIVERY'; doc.workflow.maxDurationSec = 3600;
  doc.nodes.push({ id: 'recovery', type: 'workflow', position: { x: 100, y: 600 }, data: { kind: 'terminal', name: 'Cần hỗ trợ', terminalStatus: 'RECOVERY_REQUIRED' } });
  let previous = 'start', previousCheck = false;
  const stages = {};
  for (const stage of ['SENDER', 'RECEIVER']) {
    const sequence = ['MOVE', 'AUTHENTICATE', 'CHECK_CONDITION', 'CONTROL_HARDWARE', 'HANDLE_PAYLOAD', 'CHECK_CONDITION', 'INTERACT', 'CHECK_CONDITION', 'CONTROL_HARDWARE', 'INTERACT', 'CHECK_CONDITION'];
    stages[stage] = [];
    for (const [index, type] of sequence.entries()) {
      doc = addStep(doc, type, { x: 300 + index * 250, y: stage === 'SENDER' ? 100 : 400 });
      const node = doc.nodes.at(-1); stages[stage].push(node.id);
      if (type === 'AUTHENTICATE') node.data.params.purpose = 'DELIVERY_' + stage;
      if (type === 'HANDLE_PAYLOAD') node.data.params.action = stage === 'SENDER' ? 'LOAD' : 'UNLOAD';
      if (index === 3) node.data.params.action = 'UNLOCK_COMPARTMENT';
      if (index === 6 || index === 9) node.data.params = structuredClone(interactionPresets.find(p => p.key === (index === 6 ? 'CLOSE_' : 'VERIFY_') + stage).params);
      doc = connect(doc, { source: previous, target: node.id, sourceHandle: previousCheck ? 'true' : 'SUCCESS' });
      if (previousCheck) doc = connect(doc, { source: previous, target: 'recovery', sourceHandle: 'false' });
      previous = node.id; previousCheck = type === 'CHECK_CONDITION';
    }
    const [move, auth, check, unlock] = stages[stage];
    doc.nodes.find(n => n.id === unlock).data.params.authorization = authorizationFromStep(doc, unlock, auth);
  }
  doc = connect(doc, { source: previous, target: 'end', sourceHandle: 'true' });
  doc = connect(doc, { source: previous, target: 'recovery', sourceHandle: 'false' });
  return { doc, stages };
}
