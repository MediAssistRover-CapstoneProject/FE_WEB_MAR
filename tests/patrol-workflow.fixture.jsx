// Isolated manual UI fixture. No request may reach the real BE.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import WorkflowsPage from '../src/pages/Workflows/WorkflowsPage.jsx';
import AdminApp from '../src/pages/Admin/AdminApp.jsx';
import { workflowApi } from '../src/features/workflows/workflowApi.js';
import { buildPatrolGraph } from '../src/features/workflows/patrolWorkflowModel.js';
import { createDraft, saveMap, STORAGE_KEY } from '../src/pages/Admin/mapStudioModel.js';

// Isolated origin 5175 only; never seed the user's application on 5173.
if (location.port !== '5175') throw new Error('Open fixture on isolated port 5175');
if (!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, JSON.stringify(saveMap({
  ...createDraft(), scan: { status: 'complete', progress: 100 }, endpoints: [
    { id: 'ep1', name: 'EP1', x: 580, y: 330, type: 'PARK', enabled: true },
    { id: 'ep2', name: 'EP2', x: 580, y: 550, type: 'WAYPOINT', enabled: true },
  ],
}, '2026-10-22T00:00:00Z')));

window.fetch = async () => { throw new Error('Fixture blocked network API request'); };
sessionStorage.setItem('mediassist-rover.session', JSON.stringify({ mode: 'demo', account: { role: 'ADMIN' } }));
const map = { mapId: 'map-1', mapName: 'Tầng 1 · Dữ liệu kiểm tra', widthM: 5, heightM: 3, originXM: 0, originYM: 0, versionNo: 1, status: 'ACTIVE' };
const endpoints = ['Sảnh tiếp đón', 'Hành lang', 'Phòng trực'].map((name, index) => ({ endpointId: `ep-${index}`, endpointName: name, endpointCode: `EP_${index}`, mapId: map.mapId, xM: .8 + index * 1.5, yM: .8 + index * .5, active: true, accessible: true }));
const body = { workflowId: 'patrol-1', workflowName: 'Tuần tra tầng 1', workflowCode: 'WF_PATROL_TEST', versionNo: 1, serviceType: 'PATROL', schemaVersion: 3, status: 'DRAFT', acceptsNewJobs: false };
function fromGraph(workflow, graph) {
  return { workflow: { ...workflow, startStepId: graph.startStepCode }, tasks: graph.tasks.map(task => ({ ...task, taskId: task.taskCode })), steps: graph.steps.map(step => ({ ...step, stepId: step.stepCode, taskId: step.taskCode, stepTypeCode: step.stepType, enabled: true })), transitions: graph.transitions.map((edge, index) => ({ ...edge, transitionId: String(index), fromStepId: edge.fromStepCode, toStepId: edge.toStepCode })) };
}
let detail = fromGraph(body, buildPatrolGraph([{ code: 'PATROL_ROUTE', name: 'Tuyến tuần tra', steps: endpoints.map((point, index) => ({ code: `MOVE_${index}`, type: 'MOVE', values: { map_id: map.mapId, endpoint_id: point.endpointId, mode: 'PATROL', max_speed_mps: .08 } })) }]));
const stored = sessionStorage.getItem('patrol-workflow-fixture');
if (stored) detail = JSON.parse(stored);
const save = () => sessionStorage.setItem('patrol-workflow-fixture', JSON.stringify(detail));
const page = content => ({ content, last: true, totalPages: 1 });
Object.keys(workflowApi).forEach(key => { workflowApi[key] = async () => { throw new Error('Fixture: unsupported API ' + key); }; });
Object.assign(workflowApi, {
  list: async () => page([detail.workflow, { workflowId: 'other', workflowName: 'Quy trình phát loa', serviceType: 'SPEECH', status: 'PUBLISHED', versionNo: 1 }]), get: async () => structuredClone(detail),
  listMaps: async () => page([map]), listEndpoints: async () => page(endpoints),
  listRobots: async () => page([{ robotId: 'robot-1', robotName: 'Robot thử nghiệm', currentMapId: map.mapId, status: 'OFFLINE', capabilitiesJson: ['MOVE'] }]),
  listSchedules: async () => page([]),
  update: async (id, update) => { detail.workflow = { ...detail.workflow, ...update, status: 'DRAFT', acceptsNewJobs: false }; save(); return detail.workflow; },
  replaceGraph: async (id, graph) => { detail = fromGraph(detail.workflow, graph); save(); return structuredClone(detail); },
  createGraph: async data => { detail = fromGraph({ ...body, ...data.workflow }, data.graph); save(); return structuredClone(detail); },
  validate: async () => { detail.workflow.status = 'VALIDATED'; save(); return { warnings: [] }; },
  publish: async () => { detail.workflow.status = 'PUBLISHED'; detail.workflow.acceptsNewJobs = true; save(); return detail.workflow; },
});
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/workflows']}><Routes><Route path="/workflows" element={<WorkflowsPage />} /><Route path="/admin" element={<AdminApp />} /></Routes></MemoryRouter>);
