import { memo, useEffect, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Handle, Position, useReactFlow, useUpdateNodeInternals, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { stepCatalog } from '../../../features/workflows/designer/stepCatalog.js';
import { canConnect, connect, copy, makeId, addStep as propsAdd, appendStep, quickAppendSource } from '../../../features/workflows/designer/designerModel.js';
import { branchesOnResult, isCloseRequest, stepBehaviour, stepSuccessLabel, workflowEdgeLabel } from '../../../features/workflows/designer/designerPresentation.js';
import { failurePolicy } from '../../../features/workflows/workflowFailurePolicy.js';

const WorkflowNode = memo(function WorkflowNode({ id, data, selected }) {
  const spec = stepCatalog[data.stepType], check = branchesOnResult(data), close = isCloseRequest(data), behaviour = stepBehaviour(data);
  const showFalse = check && (!close || data.showErrorPorts || data.hasCloseFallback);
  const errorPorts = ['FAILURE', 'TIMEOUT'].filter(outcome => data.showErrorPorts || data.customErrorOutcomes?.includes(outcome));
  const errorPortKey = errorPorts.join(','), updateInternals = useUpdateNodeInternals();
  const shape = `${check}:${showFalse}:${errorPortKey}`, previousShape = useRef(shape);
  useEffect(() => {
    // Initial measurement belongs to React Flow; forcing it while mounting can fit only one node.
    if (previousShape.current !== shape) { previousShape.current = shape; updateInternals(id); }
  }, [id, shape, updateInternals]);
  const automatic = ['FAILURE', 'TIMEOUT'].filter(outcome => data.failureHandlingEnabled || !data.customErrorOutcomes?.includes(outcome));
  return <div className={`wfd-node ${data.kind} ${errorPorts.length ? 'with-error-ports' : 'happy-path'} ${selected ? 'selected' : ''} ${data.invalid ? 'invalid' : ''}`}>
    {data.kind !== 'start' && <Handle type="target" position={Position.Left} />}
    <div className="wfd-node-top"><i>{data.kind === 'start' ? '▶' : data.kind === 'terminal' ? '■' : spec?.icon ?? '◇'}</i><small>{data.kind === 'start' ? 'ĐIỂM BẮT ĐẦU' : data.kind === 'terminal' ? data.terminalStatus : data.stepType}</small></div><strong>{data.name}</strong>
    {data.kind === 'step' && <><span className="wfd-node-hint">{behaviour?.hint ?? (Object.values(data.mapping ?? {}).some(v => v?.$ref?.startsWith('/inputs/')) ? 'Dùng biến đầu vào' : spec?.label)}</span><div className="wfd-node-ports">{check ? <><span>{close ? 'Đã bấm nút' : 'Đúng'}</span>{showFalse && <span>{close ? 'Phản hồi sai' : 'Còn lại'}</span>}</> : <span>{stepSuccessLabel(data)}</span>}{errorPorts.map(outcome => <span key={outcome}>{outcome === 'FAILURE' ? 'Lỗi' : 'Hết giờ'}</span>)}</div><small className="wfd-node-error-policy">{automatic.length ? `${automatic.map(o => o === 'FAILURE' ? 'Lỗi' : 'Hết giờ').join(' / ')}: báo lỗi và dừng` : 'Lỗi / hết giờ: nhánh tùy chỉnh'}</small></>}
    {data.kind === 'start' && <Handle type="source" position={Position.Right} id="SUCCESS" />}
    {data.kind === 'step' && <>{check ? <><Handle type="source" position={Position.Right} id="true" style={{ top: 65 }} />{showFalse && <Handle type="source" position={Position.Right} id="false" style={{ top: 89 }} />}</> : <Handle type="source" position={Position.Right} id="SUCCESS" style={{ top: 65 }} />}{errorPorts.map((outcome, index) => <Handle key={outcome} type="source" position={Position.Right} id={outcome} style={{ top: (showFalse ? 113 : 89) + index * 24, background: outcome === 'FAILURE' ? '#dd766f' : '#d39d45' }} />)}</>}
  </div>;
});
const nodeTypes = { workflow: WorkflowNode };
export default function WorkflowCanvas(props) { return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>; }
function Canvas({ document, change, recordHistory, readOnly, errors, onSelect, selectedNode, selectedEdge, onDelete, undo, redo, canUndo, canRedo }) {
  const flow = useReactFlow(), [search, setSearch] = useState(''), [dimensions, setDimensions] = useState({}), [showErrorPorts, setShowErrorPorts] = useState(false), dragStart = useRef(null);
  const invalid = new Set(errors.map(e => e.nodeId));
  const hasCustomErrors = document.edges.some(e => ['FAILURE', 'TIMEOUT'].includes(e.data?.outcome));
  const failureHandlingEnabled = failurePolicy(document.workflow).enabled;
  const nodes = document.nodes.map(n => ({ ...n, measured: dimensions[n.id] ?? n.measured, selected: n.id === selectedNode, data: { ...n.data, invalid: invalid.has(n.id), showErrorPorts, failureHandlingEnabled, hasCloseFallback: document.edges.some(e => e.source === n.id && e.data?.outcome === 'SUCCESS' && e.data.defaultTransition), customErrorOutcomes: document.edges.filter(e => e.source === n.id && ['FAILURE', 'TIMEOUT'].includes(e.data?.outcome)).map(e => e.data.outcome) } }));
  const edges = document.edges.map(e => ({ ...e, selected: e.id === selectedEdge, label: workflowEdgeLabel(e, document), style: { stroke: e.data?.outcome === 'FAILURE' ? '#d98d88' : e.data?.outcome === 'TIMEOUT' ? '#c69a51' : '#6c91cc', strokeWidth: 1.7 }, labelStyle: { fontSize: 10, fill: '#536781' }, markerEnd: { type: 'arrowclosed', color: '#7797c7' } }));
  const appendSource = quickAppendSource(document, selectedNode);
  const insert = (type, position, append = false) => {
    if (readOnly) return;
    const origin = { ...position }, placed = { ...position };
    for (let attempt = 0; attempt < 80 && document.nodes.some(n => !(append && appendSource && n.data.kind === 'terminal') && Math.abs(n.position.x - placed.x) < 230 && Math.abs(n.position.y - placed.y) < 175); attempt++) {
      placed.y += 185;
      if (placed.y > origin.y + 400) { placed.y = origin.y; placed.x += 250; }
    }
    const next = append ? appendStep(document, type, selectedNode, placed) : propsAdd(document, type, placed);
    const added = next.nodes.at(-1);
    if (append && appendSource) for (const edge of next.edges.filter(e => e.source === added.id)) {
      const end = next.nodes.find(n => n.id === edge.target && n.data.kind === 'terminal');
      if (end && end.position.x < placed.x + 280) end.position = { x: placed.x + 300, y: placed.y };
    }
    change(next); onSelect(added.id, null);
    if (append && appendSource) requestAnimationFrame(() => flow.fitView({ padding: 0.2 }));
  };
  // Import at module scope keeps the pure document operation shared with tests.
  function addAtCenter(type) { const rect = globalThis.document.querySelector('.wfd-canvas')?.getBoundingClientRect(); insert(type, appendSource ? { x: appendSource.position.x + 300, y: appendSource.position.y } : flow.screenToFlowPosition({ x: (rect?.left ?? 0) + (rect?.width ?? 600) / 2, y: (rect?.top ?? 0) + 160 }), true); }
  return <><aside className="wfd-palette"><div><small>THƯ VIỆN STEP</small><h2>Xây từng bước</h2><p>Bấm để thêm vào luồng chính. Kéo vào canvas để tự nối.</p>{appendSource ? <p className="wfd-muted">Thêm tiếp sau: <strong>{appendSource.data.name}</strong>. Lỗi / hết giờ tự báo tại bước và dừng luồng; không cần nối dây.</p> : <p className="wfd-muted">Chọn bước cuối luồng chính để thêm tiếp. Với bước rẽ nhánh, chọn và nối rõ từng nhánh.</p>}</div><input aria-label="Tìm loại bước" placeholder="Tìm hành động…" value={search} onChange={e => setSearch(e.target.value)} /><div className="wfd-palette-list">{Object.entries(stepCatalog).filter(([type, spec]) => `${type} ${spec.label} ${spec.description}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))).map(([type, spec]) => <button key={type} draggable={!readOnly} disabled={readOnly} title={appendSource ? `Thêm và nối sau ${appendSource.data.name}` : "Thêm bước rời; kéo dây để nối"} onDragStart={e => { e.dataTransfer.setData('application/workflow-step', type); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => addAtCenter(type)}><i>{spec.icon}</i><span><strong>{spec.label}</strong><small>{spec.description}</small></span><b>＋</b></button>)}</div><button disabled={readOnly} className="wfd-add-terminal" onClick={() => change(d => ({ ...d, nodes: [...d.nodes, { id: makeId('END'), type: 'workflow', position: flow.screenToFlowPosition({ x: (globalThis.document.querySelector('.wfd-canvas')?.getBoundingClientRect().left ?? 0) + 250, y: 350 }), data: { kind: 'terminal', name: 'Kết thúc', terminalStatus: 'SUCCEEDED' } }] }))}>＋ Thêm kết thúc</button></aside><section className="wfd-canvas" aria-label="Canvas workflow"><div className="wfd-canvas-toolbar"><button disabled={!canUndo || readOnly} onClick={undo} title="Hoàn tác (Ctrl+Z)">↶ Hoàn tác</button><button disabled={!canRedo || readOnly} onClick={redo} title="Làm lại (Ctrl+Shift+Z)">↷ Làm lại</button><span>Canvas · {document.nodes.filter(n => n.data.kind === 'step').length} bước</span><button aria-pressed={showErrorPorts} title="Chỉ mở khi cần tự nối cách xử lý lỗi riêng; mặc định mỗi bước tự báo lỗi và dừng." onClick={() => setShowErrorPorts(value => !value)}>Nhánh lỗi nâng cao</button><button onClick={() => flow.fitView({ padding: 0.2 })}>Vừa khung</button></div><div className="wfd-flow"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} defaultViewport={document.viewport} fitView={!document.edges.length} nodesDraggable={!readOnly} nodesConnectable={!readOnly} edgesReconnectable={false} deleteKeyCode={null} minZoom={0.2} maxZoom={2} onNodeClick={(_, n) => onSelect(n.id, null)} onEdgeClick={(_, e) => onSelect(null, e.id)} onPaneClick={() => onSelect(null, null)} onNodeDragStart={() => { dragStart.current = copy(document); recordHistory(); }} onNodeDragStop={() => { dragStart.current = null; }} onNodesChange={changes => {
    const positions = changes.filter(c => c.type === 'position');
    const measured = changes.filter(c => c.type === 'dimensions' && c.dimensions);
    if (measured.length) setDimensions(previous => ({ ...previous, ...Object.fromEntries(measured.map(c => [c.id, c.dimensions])) }));
    if (!readOnly && positions.length) change(d => ({ ...d, nodes: applyNodeChanges(positions, d.nodes) }), false);
  }} onEdgesChange={changes => { const removed = changes.filter(c => c.type === 'remove'); if (!readOnly && removed.length) change(d => ({ ...d, edges: applyEdgeChanges(removed, d.edges) })); }} onConnect={connection => { change(d => connect(d, connection)); }} isValidConnection={connection => !readOnly && canConnect(document, connection)} onMoveEnd={(_, viewport) => { if (!readOnly && JSON.stringify(viewport) !== JSON.stringify(document.viewport)) change(d => ({ ...d, viewport }), false); }} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }} onDrop={e => { e.preventDefault(); const type = e.dataTransfer.getData('application/workflow-step'); if (stepCatalog[type]) insert(type, flow.screenToFlowPosition({ x: e.clientX, y: e.clientY })); }}><Background gap={22} size={1} color="#d6e0ee" /><Controls showInteractive={false} /><MiniMap pannable zoomable nodeColor={n => n.data.kind === 'start' ? '#8bc6b0' : n.data.kind === 'terminal' ? '#c5d0df' : '#8fafe1'} /></ReactFlow></div>{!document.nodes.some(n => n.data.kind === 'step') && <div className="wfd-canvas-empty"><i>⌘</i><strong>Quy trình bắt đầu từ một bước</strong><p>Kéo Di chuyển, Tương tác hoặc một hành động bên trái vào đây.</p></div>}{(selectedNode && selectedNode !== 'start' || selectedEdge) && !readOnly && <button className="wfd-canvas-delete" onClick={() => onDelete(selectedEdge ? 'edge' : 'node', selectedEdge ?? selectedNode)}>Xóa {selectedEdge ? 'liên kết' : 'bước đã chọn'}</button>}<div className="wfd-canvas-legend"><i />Luồng thành công{showErrorPorts || hasCustomErrors ? <><i className="failure" />Lỗi<i className="timeout" />Hết giờ</> : <span>· Lỗi / hết giờ tự dừng tại bước</span>}</div></section></>;
}
