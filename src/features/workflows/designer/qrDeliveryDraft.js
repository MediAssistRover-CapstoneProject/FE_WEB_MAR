import { addStep, authorizationFromStep, connect, copy, makeId, newDocument, renameVariable } from './designerModel.js';

export const QR_DELIVERY_DRAFT_NOTICE = 'Bản thiết kế QR và một nút yêu cầu đóng cửa chưa sẵn sàng chạy. Cần tích hợp nút trên màn robot, luồng bàn giao BE và quyền mở ngăn trên Pi. Bấm nút chỉ yêu cầu đóng cửa, không xác nhận cửa hoặc khóa đã đóng chắc chắn.';

/** Rebuild the same draft definition without claiming that its robot UI/runtime is integrated. */
export function rebuildQrDeliveryDraft(document) {
  const base = newDocument();
  const oldWorkflow = copy(document?.workflow ?? {});
  const { designer, fields, deliveryDraft, ...inputUi } = oldWorkflow.inputUiJson ?? {};
  let next = {
    ...base,
    localId: document?.localId ?? base.localId,
    workflow: {
      ...base.workflow,
      ...oldWorkflow,
      status: 'DRAFT',
      acceptsNewJobs: false,
      schemaVersion: 3,
      graphVersion: 3,
      serviceType: 'DELIVERY',
      description: 'Đến A → staff quét QR → mở servo → bấm “Đã bỏ hàng — Đóng cửa” → đóng servo → đến B → staff quét QR → mở servo → bấm “Đã lấy hàng — Đóng cửa” → đóng servo. Bản thiết kế chờ tích hợp màn robot và runtime bàn giao.',
      inputSchemaJson: { type: 'object', properties: {} },
      inputUiJson: { ...inputUi, deliveryDraft: { mode: 'QR_SINGLE_BUTTON', runtimeReady: false, notice: QR_DELIVERY_DRAFT_NOTICE } },
      defaultInputsJson: {},
      outputMappingJson: {},
      maxDurationSec: 3600,
      maxTotalVisits: Math.max(10, oldWorkflow.maxTotalVisits ?? 100),
    },
    tasks: document?.tasks?.length ? copy(document.tasks) : base.tasks,
    variables: [],
    invalidJson: {},
    legacyLocal: false,
    readOnlyReasons: [],
  };
  // Server validation belongs to the previous graph; never carry it onto the rebuilt draft.
  for (const key of ['definitionHash', 'compiledGraphJson', 'validatedAt', 'publishedAt', 'startStepId']) delete next.workflow[key];
  next.nodes[0].position = { x: 40, y: 120 };
  next.nodes[1].position = { x: 2020, y: 510 };
  const recoveryId = makeId('END');
  next.nodes.push({ id: recoveryId, type: 'workflow', position: { x: 1000, y: 900 }, data: { kind: 'terminal', name: 'Cần hỗ trợ · lỗi, hết giờ hoặc không xác nhận', terminalStatus: 'RECOVERY_REQUIRED' } });

  const sequence = [];
  const stages = [];
  for (const [row, stage] of ['SENDER', 'RECEIVER'].entries()) {
    const point = row === 0 ? 'A' : 'B';
    const cargoText = row === 0 ? 'Đã bỏ hàng — Đóng cửa' : 'Đã lấy hàng — Đóng cửa';
    const names = [
      `Đến điểm ${point} ${row === 0 ? 'nhận' : 'giao'} hàng`,
      `Quét QR ${row === 0 ? 'người gửi' : 'người nhận'} ${point}`,
      `Mở servo tại ${point}`,
      `Chờ nút “${cargoText}”`,
      `Đóng servo tại ${point}`,
    ];
    const ids = [];
    for (const [column, type] of ['MOVE', 'AUTHENTICATE', 'CONTROL_HARDWARE', 'INTERACT', 'CONTROL_HARDWARE'].entries()) {
      next = addStep(next, type, { x: 320 + column * 330, y: 120 + row * 390 });
      const node = next.nodes.at(-1);
      node.data.name = `${String(sequence.length + 1).padStart(2, '0')} · ${names[column]}`;
      if (type === 'AUTHENTICATE') node.data.params = { purpose: `DELIVERY_${stage}`, method: 'QR_CODE' };
      if (column === 2) node.data.params.action = 'UNLOCK_COMPARTMENT';
      if (type === 'INTERACT') {
        node.data.params = {
          action: 'CONFIRM',
          prompt_key: `REQUEST_CLOSE_${stage}`,
          data: { text: cargoText },
          actor: 'STAFF',
          required_role: 'STAFF',
          compartment_id: 'CART_MAIN',
        };
        node.data.description = 'Chờ staff bấm nút trên màn robot để yêu cầu đóng cửa sau khi đặt/lấy hàng. Đây không phải xác nhận cửa hoặc khóa đã đóng.';
      }
      ids.push(node.id);
      sequence.push(node.id);
    }
    stages.push(ids);
  }

  next = connect(next, { source: 'start', target: sequence[0], sourceHandle: 'SUCCESS' });
  sequence.forEach((id, index) => {
    next = connect(next, { source: id, target: sequence[index + 1] ?? 'end', sourceHandle: 'SUCCESS' });
    const node = next.nodes.find(n => n.id === id);
    const guardedField = node.data.stepType === 'AUTHENTICATE' ? 'verified' : node.data.stepType === 'INTERACT' ? 'confirmed' : null;
    if (guardedField) {
      const main = next.edges.find(edge => edge.source === id && edge.data.outcome === 'SUCCESS');
      main.data = { ...main.data, defaultTransition: false, conditionJson: { path: `/outputs/${id}/${guardedField}`, operator: 'EQ', value: true }, priority: 1 };
      next = connect(next, { source: id, target: recoveryId, sourceHandle: 'SUCCESS' });
    }
    for (const outcome of ['FAILURE', 'TIMEOUT']) next = connect(next, { source: id, target: recoveryId, sourceHandle: outcome });
  });
  for (const [, auth, unlock] of stages) next.nodes.find(n => n.id === unlock).data.params.authorization = authorizationFromStep(next, unlock, auth);

  next = renameVariable(next, 'destination_1_endpoint_id', 'pickup_endpoint_id');
  next = renameVariable(next, 'destination_2_endpoint_id', 'delivery_endpoint_id');
  Object.assign(next.variables.find(v => v.key === 'pickup_endpoint_id'), { label: 'Điểm A · nhận hàng', description: 'Endpoint của phòng nhận hàng trên bản đồ đã chọn.' });
  Object.assign(next.variables.find(v => v.key === 'delivery_endpoint_id'), { label: 'Điểm B · giao hàng', description: 'Endpoint của phòng giao hàng trên bản đồ đã chọn.' });
  return next;
}
