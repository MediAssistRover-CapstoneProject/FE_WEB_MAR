import { apiRequest } from '../api/client.js';

export function createSystemSettingsApi(request = apiRequest) {
  const all = async (path, signal) => {
    const rows = [];
    for (let page = 0; page < 1000; page++) {
      const data = await request(`${path}?page=${page}&size=100`, { signal });
      if (!Array.isArray(data?.content)) throw Error('Danh sách từ máy chủ không đúng định dạng.');
      rows.push(...data.content);
      if (data.last || page + 1 >= data.totalPages || data.content.length < 100) return rows;
    }
    throw Error('Danh sách vượt quá giới hạn tải.');
  };
  return {
    listSettings: signal => all('/api/v1/admin/system-settings', signal),
    listRooms: signal => all('/api/v1/rooms', signal),
    listRobots: signal => all('/api/v1/robots', signal),
    saveSetting: (row, body) => request('/api/v1/admin/system-settings' + (row ? `/${encodeURIComponent(row.systemSettingId)}` : ''), { method: row ? 'PUT' : 'POST', body, retry: false }),
    mqttStatus: signal => request('/api/v1/admin/mqtt-rollout', { signal }),
    changeMqtt: body => request('/api/v1/admin/mqtt-rollout', { method: 'PUT', body, retry: false }),
    retentionPolicies: signal => request('/api/v1/admin/operations/retention/policies', { signal }),
    runRetention: (dryRun = true) => request(`/api/v1/admin/operations/retention/runs?dryRun=${dryRun === true ? 'true' : 'false'}`, { method: 'POST', retry: false }),
  };
}

export const systemSettingsApi = createSystemSettingsApi();
