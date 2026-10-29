import { endpointPayload } from './facilityContract.js';

export function endpointDraftDirty(endpoint, map, endpoints, zones, rooms) {
  if (!endpoint.endpointId && !endpoint.endpointCode && !endpoint.endpointName && endpoint.xM === '' && endpoint.yM === '') return false;
  const saved = endpoints.find(p => p.endpointId === endpoint.endpointId);
  if (!saved) return true;
  try { return JSON.stringify(endpointPayload(endpoint,map,zones,rooms)) !== JSON.stringify(endpointPayload(saved,map,zones,rooms)); }
  catch { return true; }
}

export function dispatchMaps(maps) { return maps.filter(m => m.status === 'ACTIVE'); }
export function dispatchEndpoints(endpoints,mapId) { return endpoints.filter(e => e.mapId === mapId && e.active && e.accessible); }
