import { apiRequest } from '../api/client.js';
import { allFacilityPages } from '../facility/facilityApi.js';
import { workflowApi } from './workflowApi.js';

export const dispatchApi = {
  getWorkflow: id => apiRequest(`/api/v1/workflows/published/${encodeURIComponent(id)}`),
  get: id => apiRequest(`/api/v1/schedules/${encodeURIComponent(id)}`),
  find: async code => (await allFacilityPages(workflowApi.listSchedules)).find(schedule => schedule.scheduleCode === code),
  create: workflowApi.createSchedule,
  activate: workflowApi.activateSchedule,
};
